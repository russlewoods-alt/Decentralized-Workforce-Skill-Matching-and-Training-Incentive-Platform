import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, uintCV, stringUtf8CV, someCV, noneCV, tupleCV, listCV, booleanCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_SKILL_ALREADY_EXISTS = 101;
const ERR_SKILL_NOT_FOUND = 102;
const ERR_INVALID_NAME = 103;
const ERR_INVALID_DEMAND = 104;
const ERR_INVALID_CATEGORY = 105;
const ERR_INVALID_LOCATION = 106;
const ERR_ORACLE_NOT_SET = 108;
const ERR_MAX_SKILLS_EXCEEDED = 110;
const ERR_INVALID_EVIDENCE_LINK = 113;

interface Skill {
  name: string;
  category: string;
  "demand-score": bigint;
  location: string;
  submitter: string;
  timestamp: bigint;
  verified: boolean;
  "evidence-link": string | null;
  "verification-timestamp": bigint | null;
  verifier: string | null;
}

interface SkillUpdate {
  "old-name": string;
  "new-name": string;
  "new-demand": bigint;
  "new-location": string;
  "update-timestamp": bigint;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class SkillNeedsRegistryMock {
  state: {
    nextSkillId: bigint;
    maxSkills: bigint;
    oraclePrincipal: string | null;
    skillRegistryFee: bigint;
    skills: Map<bigint, Skill>;
    skillByName: Map<string, bigint>;
    skillUpdates: Map<bigint, SkillUpdate>;
    demandHistory: Map<string, bigint>;
  } = {
    nextSkillId: BigInt(0),
    maxSkills: BigInt(5000),
    oraclePrincipal: null,
    skillRegistryFee: BigInt(500),
    skills: new Map(),
    skillByName: new Map(),
    skillUpdates: new Map(),
    demandHistory: new Map(),
  };

  blockHeight: bigint = BigInt(100);
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: bigint; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextSkillId: BigInt(0),
      maxSkills: BigInt(5000),
      oraclePrincipal: null,
      skillRegistryFee: BigInt(500),
      skills: new Map(),
      skillByName: new Map(),
      skillUpdates: new Map(),
      demandHistory: new Map(),
    };
    this.blockHeight = BigInt(100);
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setOracle(newOracle: string): Result<boolean> {
    if (this.state.oraclePrincipal !== null) return { ok: false, value: false };
    if (newOracle === this.caller) return { ok: false, value: false };
    this.state.oraclePrincipal = newOracle;
    return { ok: true, value: true };
  }

  updateOracle(newOracle: string): Result<boolean> {
    if (!this.state.oraclePrincipal) return { ok: false, value: false };
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: false };
    this.state.oraclePrincipal = newOracle;
    return { ok: true, value: true };
  }

  setRegistryFee(newFee: bigint): Result<boolean> {
    if (!this.state.oraclePrincipal) return { ok: false, value: false };
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: false };
    this.state.skillRegistryFee = newFee;
    return { ok: true, value: true };
  }

  registerSkill(
    name: string,
    category: string,
    demandScore: bigint,
    location: string,
    evidenceLink: string | null
  ): Result<bigint> {
    if (this.state.nextSkillId >= this.state.maxSkills)
      return { ok: false, value: ERR_MAX_SKILLS_EXCEEDED };
    if (!name || name.length > 80) return { ok: false, value: ERR_INVALID_NAME };
    if (demandScore < BigInt(1) || demandScore > BigInt(1000))
      return { ok: false, value: ERR_INVALID_DEMAND };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (evidenceLink && evidenceLink.length > 200)
      return { ok: false, value: ERR_INVALID_EVIDENCE_LINK };
    if (this.state.skillByName.has(name))
      return { ok: false, value: ERR_SKILL_ALREADY_EXISTS };
    if (!this.state.oraclePrincipal) return { ok: false, value: ERR_ORACLE_NOT_SET };

    this.stxTransfers.push({
      amount: this.state.skillRegistryFee,
      from: this.caller,
      to: this.state.oraclePrincipal,
    });

    const id = this.state.nextSkillId;
    const skill: Skill = {
      name,
      category,
      "demand-score": demandScore,
      location,
      submitter: this.caller,
      timestamp: this.blockHeight,
      verified: false,
      "evidence-link": evidenceLink,
      "verification-timestamp": null,
      verifier: null,
    };
    this.state.skills.set(id, skill);
    this.state.skillByName.set(name, id);
    this.state.demandHistory.set(`${id}-${this.blockHeight}`, demandScore);
    this.state.nextSkillId++;
    return { ok: true, value: id };
  }

  verifySkill(skillId: bigint, verified: boolean): Result<boolean> {
    const skill = this.state.skills.get(skillId);
    if (!skill) return { ok: false, value: false };
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: false };

    const updated = { ...skill, verified, "verification-timestamp": this.blockHeight, verifier: this.caller };
    this.state.skills.set(skillId, updated);
    return { ok: true, value: true };
  }

  updateDemand(skillId: bigint, newDemand: bigint, evidenceLink: string | null): Result<boolean> {
    const skill = this.state.skills.get(skillId);
    if (!skill) return { ok: false, value: false };
    if (!skill.verified) return { ok: false, value: false };
    if (newDemand < BigInt(1) || newDemand > BigInt(1000)) return { ok: false, value: false };
    if (evidenceLink && evidenceLink.length > 200) return { ok: false, value: false };

    const updated = { ...skill, "demand-score": newDemand };
    this.state.skills.set(skillId, updated);
    this.state.demandHistory.set(`${skillId}-${this.blockHeight}`, newDemand);
    return { ok: true, value: true };
  }

  updateSkillMetadata(skillId: bigint, newName: string, newLocation: string): Result<boolean> {
    const skill = this.state.skills.get(skillId);
    if (!skill) return { ok: false, value: false };
    if (skill.submitter !== this.caller) return { ok: false, value: false };
    if (!newName || newName.length > 80) return { ok: false, value: false };
    if (!newLocation || newLocation.length > 100) return { ok: false, value: false };
    if (this.state.skillByName.has(newName) && this.state.skillByName.get(newName) !== skillId)
      return { ok: false, value: false };

    if (skill.name !== newName) {
      this.state.skillByName.delete(skill.name);
      this.state.skillByName.set(newName, skillId);
    }

    const updated = { ...skill, name: newName, location: newLocation };
    this.state.skills.set(skillId, updated);
    this.state.skillUpdates.set(skillId, {
      "old-name": skill.name,
      "new-name": newName,
      "new-demand": skill["demand-score"],
      "new-location": newLocation,
      "update-timestamp": this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getSkill(id: bigint): Skill | null {
    return this.state.skills.get(id) || null;
  }

  getSkillCount(): Result<bigint> {
    return { ok: true, value: this.state.nextSkillId };
  }
}

describe("SkillNeedsRegistry", () => {
  let registry: SkillNeedsRegistryMock;

  beforeEach(() => {
    registry = new SkillNeedsRegistryMock();
    registry.reset();
  });

  it("registers a new skill successfully", () => {
    registry.setOracle("ST2ORACLE");
    const result = registry.registerSkill(
      "Rust Blockchain Dev",
      "technology",
      BigInt(850),
      "Global Remote",
      "https://jobs.example.com/rust-report.pdf"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(0));

    const skill = registry.getSkill(BigInt(0));
    expect(skill?.name).toBe("Rust Blockchain Dev");
    expect(skill?.category).toBe("technology");
    expect(skill?.["demand-score"]).toBe(BigInt(850));
    expect(skill?.location).toBe("Global Remote");
    expect(skill?.submitter).toBe("ST1TEST");
    expect(skill?.verified).toBe(false);
    expect(registry.stxTransfers).toEqual([
      { amount: BigInt(500), from: "ST1TEST", to: "ST2ORACLE" },
    ]);
  });

  it("rejects duplicate skill names", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("AI Ethics", "technology", BigInt(920), "San Francisco", null);
    const result = registry.registerSkill("AI Ethics", "education", BigInt(800), "Remote", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SKILL_ALREADY_EXISTS);
  });

  it("rejects registration without oracle", () => {
    const result = registry.registerSkill("Web3 UX", "creative", BigInt(700), "Europe", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_SET);
  });

  it("verifies a skill as oracle", () => {
    registry.setOracle("ST2ORACLE");
    registry.caller = "ST1TEST";
    registry.registerSkill("Solidity Security", "technology", BigInt(880), "Remote", "https://audit.com");
    registry.caller = "ST2ORACLE";
    const result = registry.verifySkill(BigInt(0), true);
    expect(result.ok).toBe(true);
    const skill = registry.getSkill(BigInt(0));
    expect(skill?.verified).toBe(true);
    expect(skill?.verifier).toBe("ST2ORACLE");
  });

  it("rejects verification by non-oracle", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("Zero Knowledge", "technology", BigInt(900), "Global", null);
    registry.caller = "ST3FAKE";
    const result = registry.verifySkill(BigInt(0), true);
    expect(result.ok).toBe(false);
  });

  it("updates demand for verified skill", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("DeFi Risk", "finance", BigInt(750), "Singapore", null);
    registry.caller = "ST2ORACLE";
    registry.verifySkill(BigInt(0), true);
    registry.caller = "ST1TEST";
    const result = registry.updateDemand(BigInt(0), BigInt(820), "https://new-report.com");
    expect(result.ok).toBe(true);
    const skill = registry.getSkill(BigInt(0));
    expect(skill?.["demand-score"]).toBe(BigInt(820));
  });

  it("rejects demand update for unverified skill", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("NFT Curation", "creative", BigInt(600), "New York", null);
    const result = registry.updateDemand(BigInt(0), BigInt(700), null);
    expect(result.ok).toBe(false);
  });

  it("updates skill metadata by submitter", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("Smart Contract Testing", "technology", BigInt(780), "Berlin", null);
    const result = registry.updateSkillMetadata(BigInt(0), "SC Testing & Audit", "Berlin + Remote");
    expect(result.ok).toBe(true);
    const skill = registry.getSkill(BigInt(0));
    expect(skill?.name).toBe("SC Testing & Audit");
    expect(skill?.location).toBe("Berlin + Remote");
  });

  it("rejects metadata update by non-submitter", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("DAO Governance", "technology", BigInt(700), "Worldwide", null);
    registry.caller = "ST3FAKE";
    const result = registry.updateSkillMetadata(BigInt(0), "DAO Ops", "Global");
    expect(result.ok).toBe(false);
  });

  it("returns correct skill count", () => {
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("Tokenomics", "finance", BigInt(800), "Remote", null);
    registry.registerSkill("Layer 2 Scaling", "engineering", BigInt(900), "Global", null);
    const result = registry.getSkillCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(2));
  });

  it("validates Clarity types correctly", () => {
    const name = stringUtf8CV("Clarity Dev");
    const demand = uintCV(950);
    const link = someCV(stringUtf8CV("https://clarity-lang.org/report"));
    expect(name.value).toBe("Clarity Dev");
    expect(demand.value).toEqual(BigInt(950));
    expect(link.value.value).toBe("https://clarity-lang.org/report");
  });

  it("rejects invalid demand score", () => {
    registry.setOracle("ST2ORACLE");
    const result = registry.registerSkill("Invalid", "technology", BigInt(0), "Here", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DEMAND);
  });

  it("rejects overly long evidence link", () => {
    registry.setOracle("ST2ORACLE");
    const longLink = "a".repeat(201);
    const result = registry.registerSkill("LongLink", "technology", BigInt(500), "There", longLink);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EVIDENCE_LINK);
  });

  it("prevents max skills limit", () => {
    registry.state.maxSkills = BigInt(1);
    registry.setOracle("ST2ORACLE");
    registry.registerSkill("First", "technology", BigInt(500), "Here", null);
    const result = registry.registerSkill("Second", "finance", BigInt(600), "There", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_SKILLS_EXCEEDED);
  });
});