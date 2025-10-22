import { describe, it, expect, beforeEach } from "vitest";
import { Cl, stringAsciiCV, uintCV, principalCV, noneCV, someCV, tupleCV, listCV, boolCV, stringUtf8CV } from "@stacks/transactions";

interface TokenState {
  tokenOwner: string;
  tokenUri: string | null;
  mintPaused: boolean;
  burnPaused: boolean;
  minterList: string[];
  totalBurned: number;
  emergencyLock: boolean;
  balances: Map<string, number>;
  minterBalances: Map<string, number>;
  allowances: Map<string, number>;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class SFGTokenMock {
  state: TokenState = {
    tokenOwner: "ST1TEST",
    tokenUri: null,
    mintPaused: false,
    burnPaused: false,
    minterList: [],
    totalBurned: 0,
    emergencyLock: false,
    balances: new Map(),
    minterBalances: new Map(),
    allowances: new Map(),
  };
  caller: string = "ST1TEST";
  events: Array<{ event: string; [key: string]: any }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      tokenOwner: "ST1TEST",
      tokenUri: null,
      mintPaused: false,
      burnPaused: false,
      minterList: [],
      totalBurned: 0,
      emergencyLock: false,
      balances: new Map(),
      minterBalances: new Map(),
      allowances: new Map(),
    };
    this.caller = "ST1TEST";
    this.events = [];
  }

  getName(): Result<string> {
    return { ok: true, value: "SkillForge Token" };
  }

  getSymbol(): Result<string> {
    return { ok: true, value: "SFG" };
  }

  getDecimals(): Result<number> {
    return { ok: true, value: 8 };
  }

  getBalance(account: string): Result<number> {
    return { ok: true, value: this.state.balances.get(account) || 0 };
  }

  getTotalSupply(): Result<number> {
    let total = 0;
    for (const balance of this.state.balances.values()) {
      total += balance;
    }
    return { ok: true, value: total - this.state.totalBurned };
  }

  getTokenUri(): Result<string | null> {
    return { ok: true, value: this.state.tokenUri };
  }

  getMinterBalance(minter: string): Result<number> {
    return { ok: true, value: this.state.minterBalances.get(minter) || 0 };
  }

  getAllowance(owner: string, spender: string): Result<number> {
    return { ok: true, value: this.state.allowances.get(`${owner}:${spender}`) || 0 };
  }

  isMinter(account: string): Result<boolean> {
    return { ok: true, value: this.state.minterList.includes(account) };
  }

  isMintPaused(): Result<boolean> {
    return { ok: true, value: this.state.mintPaused };
  }

  isBurnPaused(): Result<boolean> {
    return { ok: true, value: this.state.burnPaused };
  }

  isEmergencyLocked(): Result<boolean> {
    return { ok: true, value: this.state.emergencyLock };
  }

  setTokenUri(newUri: string): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    if (newUri.length > 256) return { ok: false, value: false };
    this.state.tokenUri = newUri;
    return { ok: true, value: true };
  }

  pauseMint(): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.mintPaused = true;
    return { ok: true, value: true };
  }

  unpauseMint(): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.mintPaused = false;
    return { ok: true, value: true };
  }

  pauseBurn(): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.burnPaused = true;
    return { ok: true, value: true };
  }

  unpauseBurn(): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.burnPaused = false;
    return { ok: true, value: true };
  }

  addMinter(newMinter: string): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    if (newMinter === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    if (this.state.minterList.length >= 10) return { ok: false, value: false };
    if (!this.state.minterList.includes(newMinter)) {
      this.state.minterList.push(newMinter);
    }
    return { ok: true, value: true };
  }

  removeMinter(minter: string): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.minterList = this.state.minterList.filter(m => m !== minter);
    this.state.minterBalances.delete(minter);
    return { ok: true, value: true };
  }

  setEmergencyLock(locked: boolean): Result<boolean> {
    if (this.caller !== this.state.tokenOwner) return { ok: false, value: false };
    this.state.emergencyLock = locked;
    return { ok: true, value: true };
  }

  mint(amount: number, recipient: string): Result<boolean> {
    if (this.state.emergencyLock) return { ok: false, value: false };
    if (this.state.mintPaused) return { ok: false, value: false };
    if (!this.state.minterList.includes(this.caller)) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (recipient === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    const currentBalance = this.state.balances.get(recipient) || 0;
    const currentMinterBalance = this.state.minterBalances.get(this.caller) || 0;
    this.state.balances.set(recipient, currentBalance + amount);
    this.state.minterBalances.set(this.caller, currentMinterBalance + amount);
    this.events.push({ event: "mint", amount, recipient, minter: this.caller });
    return { ok: true, value: true };
  }

  burn(amount: number): Result<boolean> {
    if (this.state.emergencyLock) return { ok: false, value: false };
    if (this.state.burnPaused) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    const currentBalance = this.state.balances.get(this.caller) || 0;
    if (currentBalance < amount) return { ok: false, value: false };
    this.state.balances.set(this.caller, currentBalance - amount);
    this.state.totalBurned += amount;
    this.events.push({ event: "burn", amount, sender: this.caller });
    return { ok: true, value: true };
  }

  approve(spender: string, amount: number): Result<boolean> {
    if (this.state.emergencyLock) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (spender === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    this.state.allowances.set(`${this.caller}:${spender}`, amount);
    this.events.push({ event: "approve", owner: this.caller, spender, amount });
    return { ok: true, value: true };
  }

  transfer(amount: number, sender: string, recipient: string, memo: Buffer | null): Result<boolean> {
    if (this.state.emergencyLock) return { ok: false, value: false };
    if (this.caller !== sender) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (recipient === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    const senderBalance = this.state.balances.get(sender) || 0;
    if (senderBalance < amount) return { ok: false, value: false };
    const recipientBalance = this.state.balances.get(recipient) || 0;
    this.state.balances.set(sender, senderBalance - amount);
    this.state.balances.set(recipient, recipientBalance + amount);
    this.events.push({ event: "transfer", amount, sender, recipient, memo });
    return { ok: true, value: true };
  }

  transferFrom(owner: string, recipient: string, amount: number): Result<boolean> {
    if (this.state.emergencyLock) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (recipient === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    const allowance = this.state.allowances.get(`${owner}:${this.caller}`) || 0;
    if (allowance < amount) return { ok: false, value: false };
    const ownerBalance = this.state.balances.get(owner) || 0;
    if (ownerBalance < amount) return { ok: false, value: false };
    const recipientBalance = this.state.balances.get(recipient) || 0;
    this.state.allowances.set(`${owner}:${this.caller}`, allowance - amount);
    this.state.balances.set(owner, ownerBalance - amount);
    this.state.balances.set(recipient, recipientBalance + amount);
    this.events.push({ event: "transfer-from", amount, owner, recipient, spender: this.caller });
    return { ok: true, value: true };
  }
}

describe("SFGToken", () => {
  let contract: SFGTokenMock;

  beforeEach(() => {
    contract = new SFGTokenMock();
    contract.reset();
  });

  it("returns correct token metadata", () => {
    expect(contract.getName()).toEqual({ ok: true, value: "SkillForge Token" });
    expect(contract.getSymbol()).toEqual({ ok: true, value: "SFG" });
    expect(contract.getDecimals()).toEqual({ ok: true, value: 8 });
    expect(contract.getTokenUri()).toEqual({ ok: true, value: null });
  });

  it("sets token URI successfully", () => {
    const result = contract.setTokenUri("https://skillforge.io/token");
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getTokenUri()).toEqual({ ok: true, value: "https://skillforge.io/token" });
    expect(stringAsciiCV("SkillForge Token").value).toBe("SkillForge Token");
  });

  it("rejects token URI update by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setTokenUri("https://skillforge.io/token");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects invalid token URI", () => {
    const longUri = "a".repeat(257);
    const result = contract.setTokenUri(longUri);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("pauses and unpauses mint successfully", () => {
    expect(contract.pauseMint()).toEqual({ ok: true, value: true });
    expect(contract.isMintPaused()).toEqual({ ok: true, value: true });
    expect(contract.unpauseMint()).toEqual({ ok: true, value: true });
    expect(contract.isMintPaused()).toEqual({ ok: true, value: false });
  });

  it("rejects mint pause by non-owner", () => {
    contract.caller = "ST2FAKE";
    expect(contract.pauseMint()).toEqual({ ok: false, value: false });
  });

  it("pauses and unpauses burn successfully", () => {
    expect(contract.pauseBurn()).toEqual({ ok: true, value: true });
    expect(contract.isBurnPaused()).toEqual({ ok: true, value: true });
    expect(contract.unpauseBurn()).toEqual({ ok: true, value: true });
    expect(contract.isBurnPaused()).toEqual({ ok: true, value: false });
  });

  it("rejects burn pause by non-owner", () => {
    contract.caller = "ST2FAKE";
    expect(contract.pauseBurn()).toEqual({ ok: false, value: false });
  });

  it("adds and removes minter successfully", () => {
    expect(contract.addMinter("ST2TEST")).toEqual({ ok: true, value: true });
    expect(contract.isMinter("ST2TEST")).toEqual({ ok: true, value: true });
    expect(contract.removeMinter("ST2TEST")).toEqual({ ok: true, value: true });
    expect(contract.isMinter("ST2TEST")).toEqual({ ok: true, value: false });
  });

  it("rejects adding minter beyond limit", () => {
    for (let i = 0; i < 10; i++) {
      contract.addMinter(`ST${i}TEST`);
    }
    const result = contract.addMinter("ST11TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects adding invalid minter", () => {
    const result = contract.addMinter("SP000000000000000000002Q6VF78");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects removing minter by non-owner", () => {
    contract.addMinter("ST2TEST");
    contract.caller = "ST3FAKE";
    const result = contract.removeMinter("ST2TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("sets emergency lock successfully", () => {
    expect(contract.setEmergencyLock(true)).toEqual({ ok: true, value: true });
    expect(contract.isEmergencyLocked()).toEqual({ ok: true, value: true });
    expect(contract.setEmergencyLock(false)).toEqual({ ok: true, value: true });
    expect(contract.isEmergencyLocked()).toEqual({ ok: true, value: false });
  });

  it("rejects emergency lock by non-owner", () => {
    contract.caller = "ST2FAKE";
    expect(contract.setEmergencyLock(true)).toEqual({ ok: false, value: false });
  });

  it("mints tokens successfully", () => {
    contract.addMinter("ST1TEST");
    const result = contract.mint(1000, "ST2TEST");
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getBalance("ST2TEST")).toEqual({ ok: true, value: 1000 });
    expect(contract.getMinterBalance("ST1TEST")).toEqual({ ok: true, value: 1000 });
    expect(contract.events).toContainEqual({ event: "mint", amount: 1000, recipient: "ST2TEST", minter: "ST1TEST" });
    expect(uintCV(1000).value).toEqual(BigInt(1000));
  });

  it("rejects mint by non-minter", () => {
    const result = contract.mint(1000, "ST2TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects mint when paused", () => {
    contract.addMinter("ST1TEST");
    contract.pauseMint();
    const result = contract.mint(1000, "ST2TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects mint with emergency lock", () => {
    contract.addMinter("ST1TEST");
    contract.setEmergencyLock(true);
    const result = contract.mint(1000, "ST2TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects mint with invalid amount", () => {
    contract.addMinter("ST1TEST");
    const result = contract.mint(0, "ST2TEST");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects mint to invalid recipient", () => {
    contract.addMinter("ST1TEST");
    const result = contract.mint(1000, "SP000000000000000000002Q6VF78");
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects burn when paused", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.pauseBurn();
    const result = contract.burn(500);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects burn with emergency lock", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.setEmergencyLock(true);
    const result = contract.burn(500);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects burn with insufficient balance", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    const result = contract.burn(1500);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects burn with invalid amount", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    const result = contract.burn(0);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("approves and transfers from successfully", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    expect(contract.approve("ST2TEST", 500)).toEqual({ ok: true, value: true });
    expect(contract.getAllowance("ST1TEST", "ST2TEST")).toEqual({ ok: true, value: 500 });
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "ST3TEST", 300);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getBalance("ST1TEST")).toEqual({ ok: true, value: 700 });
    expect(contract.getBalance("ST3TEST")).toEqual({ ok: true, value: 300 });
    expect(contract.getAllowance("ST1TEST", "ST2TEST")).toEqual({ ok: true, value: 200 });
    expect(contract.events).toContainEqual({ event: "transfer-from", amount: 300, owner: "ST1TEST", recipient: "ST3TEST", spender: "ST2TEST" });
  });

  it("rejects transfer-from with insufficient allowance", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.approve("ST2TEST", 200);
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "ST3TEST", 300);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer-from with insufficient balance", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.approve("ST2TEST", 1500);
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "ST3TEST", 1500);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer-from with invalid amount", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.approve("ST2TEST", 500);
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "ST3TEST", 0);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer-from to invalid recipient", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.approve("ST2TEST", 500);
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "SP000000000000000000002Q6VF78", 300);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer with invalid amount", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    const result = contract.transfer(0, "ST1TEST", "ST2TEST", null);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer by non-sender", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.caller = "ST2FAKE";
    const result = contract.transfer(500, "ST1TEST", "ST2TEST", null);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer with insufficient balance", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    const result = contract.transfer(1500, "ST1TEST", "ST2TEST", null);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer to invalid recipient", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    const result = contract.transfer(500, "ST1TEST", "SP000000000000000000002Q6VF78", null);
    expect(result).toEqual({ ok: false, value: false });
  });

  it("rejects transfer with emergency lock", () => {
    contract.addMinter("ST1TEST");
    contract.mint(1000, "ST1TEST");
    contract.setEmergencyLock(true);
    const result = contract.transfer(500, "ST1TEST", "ST2TEST", null);
    expect(result).toEqual({ ok: false, value: false });
  });
});