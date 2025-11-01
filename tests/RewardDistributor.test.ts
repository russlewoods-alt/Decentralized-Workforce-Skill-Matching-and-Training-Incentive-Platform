import { describe, it, expect, beforeEach } from "vitest";
import { uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 401;
const ERR_PROPOSAL_NOT_FOUND = 404;
const ERR_PROPOSAL_NOT_APPROVED = 403;
const ERR_INVALID_AMOUNT = 402;
const ERR_INVALID_METRIC = 405;
const ERR_REWARD_ALREADY_DISTRIBUTED = 406;
const ERR_INSUFFICIENT_BALANCE = 407;
const ERR_INVALID_RECIPIENT = 408;
const ERR_INVALID_TOKEN_CONTRACT = 409;
const ERR_INVALID_PROPOSAL_ID = 410;
const ERR_MAX_REWARDS_EXCEEDED = 411;
const ERR_INVALID_ENROLLMENT_COUNT = 412;
const ERR_INVALID_COMPLETION_RATE = 413;
const ERR_INVALID_FEEDBACK_SCORE = 414;
const ERR_INVALID_REWARD_TYPE = 415;
const ERR_REWARD_NOT_CLAIMABLE = 416;
const ERR_INVALID_TIMESTAMP = 417;
const ERR_REWARD_EXPIRED = 418;
const ERR_INVALID_UPDATE_PARAM = 419;
const ERR_AUTHORITY_NOT_VERIFIED = 420;

interface Proposal {
  title: string;
  desc: string;
  trainer: string;
  skillId: number;
  approved: boolean;
}

interface Metrics {
  enrollments: number;
  completions: number;
  feedbackScore: number;
}

interface DistributedReward {
  amount: number;
  distributedAt: number;
  claimed: boolean;
  recipient: string;
}

interface RewardMetrics {
  enrollments: number;
  completions: number;
  feedbackScore: number;
  calculatedAmount: number;
}

interface Result<T, E> {
  ok: boolean;
  value: T | E;
}

class RewardDistributorMock {
  state: {
    tokenContract: string;
    proposalContract: string;
    authorityPrincipal: string;
    maxRewardPerProposal: number;
    baseRewardRate: number;
    enrollmentMultiplier: number;
    completionBonus: number;
    feedbackThreshold: number;
    rewardExpiryBlocks: number;
    totalDistributed: number;
    maxTotalRewards: number;
    distributedRewards: Map<number, DistributedReward>;
    rewardMetrics: Map<number, RewardMetrics>;
    pendingClaims: Map<string, number[]>;
    proposals: Map<number, Proposal>;
    proposalMetrics: Map<number, Metrics>;
  } = {
    tokenContract: "SP000000000000000000002Q6VF78",
    proposalContract: "SP000000000000000000002Q6VF78",
    authorityPrincipal: "ST1TEST",
    maxRewardPerProposal: 1000000,
    baseRewardRate: 100,
    enrollmentMultiplier: 10,
    completionBonus: 20,
    feedbackThreshold: 80,
    rewardExpiryBlocks: 1440,
    totalDistributed: 0,
    maxTotalRewards: 1000000000,
    distributedRewards: new Map(),
    rewardMetrics: new Map(),
    pendingClaims: new Map(),
    proposals: new Map(),
    proposalMetrics: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  transfers: Array<{ amount: number; from: string; to: string }> = [];
  events: Array<{ event: string; [key: string]: any }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      tokenContract: "SP000000000000000000002Q6VF78",
      proposalContract: "SP000000000000000000002Q6VF78",
      authorityPrincipal: "ST1TEST",
      maxRewardPerProposal: 1000000,
      baseRewardRate: 100,
      enrollmentMultiplier: 10,
      completionBonus: 20,
      feedbackThreshold: 80,
      rewardExpiryBlocks: 1440,
      totalDistributed: 0,
      maxTotalRewards: 1000000000,
      distributedRewards: new Map(),
      rewardMetrics: new Map(),
      pendingClaims: new Map(),
      proposals: new Map(),
      proposalMetrics: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.transfers = [];
    this.events = [];
  }

  getProposal(proposalId: number): Result<Proposal, number> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    return { ok: true, value: proposal };
  }

  getMetrics(proposalId: number): Result<Metrics, number> {
    const metrics = this.state.proposalMetrics.get(proposalId);
    if (!metrics) return { ok: false, value: ERR_INVALID_METRIC };
    return { ok: true, value: metrics };
  }

  transfer(amount: number, from: string, to: string): Result<boolean, number> {
    this.transfers.push({ amount, from, to });
    return { ok: true, value: true };
  }

  setTokenContract(newContract: string): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newContract === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_TOKEN_CONTRACT };
    this.state.tokenContract = newContract;
    return { ok: true, value: true };
  }

  setProposalContract(newContract: string): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newContract === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_TOKEN_CONTRACT };
    this.state.proposalContract = newContract;
    return { ok: true, value: true };
  }

  setMaxRewardPerProposal(newMax: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.maxRewardPerProposal = newMax;
    return { ok: true, value: true };
  }

  setBaseRewardRate(newRate: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newRate <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.baseRewardRate = newRate;
    return { ok: true, value: true };
  }

  setEnrollmentMultiplier(newMultiplier: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMultiplier <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.enrollmentMultiplier = newMultiplier;
    return { ok: true, value: true };
  }

  setCompletionBonus(newBonus: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newBonus <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.completionBonus = newBonus;
    return { ok: true, value: true };
  }

  setFeedbackThreshold(newThreshold: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newThreshold < 0 || newThreshold > 100) return { ok: false, value: ERR_INVALID_METRIC };
    this.state.feedbackThreshold = newThreshold;
    return { ok: true, value: true };
  }

  setRewardExpiryBlocks(newExpiry: number): Result<boolean, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newExpiry <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.rewardExpiryBlocks = newExpiry;
    return { ok: true, value: true };
  }

  distributeReward(proposalId: number): Result<number, number> {
    if (this.caller !== this.state.authorityPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (proposalId <= 0) return { ok: false, value: ERR_INVALID_PROPOSAL_ID };
    const proposalRes = this.getProposal(proposalId);
    if (!proposalRes.ok) return proposalRes as Result<number, number>;
    const proposal = proposalRes.value as Proposal;
    if (!proposal.approved) return { ok: false, value: ERR_PROPOSAL_NOT_APPROVED };
    const metricsRes = this.getMetrics(proposalId);
    if (!metricsRes.ok) return metricsRes as Result<number, number>;
    const metrics = metricsRes.value as Metrics;
    if (metrics.enrollments < 0 || metrics.enrollments > 100000) return { ok: false, value: ERR_INVALID_METRIC };
    if (metrics.completions < 0 || metrics.completions > metrics.enrollments) return { ok: false, value: ERR_INVALID_METRIC };
    if (metrics.feedbackScore < 0 || metrics.feedbackScore > 100) return { ok: false, value: ERR_INVALID_METRIC };
    if (proposal.trainer === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (this.state.distributedRewards.has(proposalId)) return { ok: false, value: ERR_REWARD_ALREADY_DISTRIBUTED };
    const base = metrics.enrollments * this.state.enrollmentMultiplier;
    const completionAdd = metrics.completions * this.state.completionBonus;
    const feedbackBonus = metrics.feedbackScore >= this.state.feedbackThreshold ? base * 2 : 0;
    let amount = base + completionAdd + feedbackBonus;
    if (amount > this.state.maxRewardPerProposal) amount = this.state.maxRewardPerProposal;
    if (this.state.totalDistributed + amount > this.state.maxTotalRewards) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.transfer(amount, "contract", proposal.trainer);
    this.state.distributedRewards.set(proposalId, {
      amount,
      distributedAt: this.blockHeight,
      claimed: true,
      recipient: proposal.trainer,
    });
    this.state.rewardMetrics.set(proposalId, {
      enrollments: metrics.enrollments,
      completions: metrics.completions,
      feedbackScore: metrics.feedbackScore,
      calculatedAmount: amount,
    });
    this.state.totalDistributed += amount;
    this.events.push({ event: "reward-distributed", proposalId, amount, recipient: proposal.trainer });
    return { ok: true, value: amount };
  }

  claimReward(proposalId: number): Result<number, number> {
    const proposalRes = this.getProposal(proposalId);
    if (!proposalRes.ok) return proposalRes as Result<number, number>;
    const proposal = proposalRes.value as Proposal;
    if (this.caller !== proposal.trainer) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const reward = this.state.distributedRewards.get(proposalId);
    if (!reward) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (reward.claimed) return { ok: false, value: ERR_REWARD_NOT_CLAIMABLE };
    if (this.blockHeight - reward.distributedAt >= this.state.rewardExpiryBlocks) return { ok: false, value: ERR_REWARD_EXPIRED };
    this.transfer(reward.amount, "contract", this.caller);
    this.state.distributedRewards.set(proposalId, { ...reward, claimed: true });
    this.events.push({ event: "reward-claimed", proposalId, amount: reward.amount, claimant: this.caller });
    return { ok: true, value: reward.amount };
  }
}

describe("RewardDistributor", () => {
  let contract: RewardDistributorMock;

  beforeEach(() => {
    contract = new RewardDistributorMock();
    contract.reset();
  });

  it("distributes reward successfully", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.proposalMetrics.set(1, { enrollments: 100, completions: 80, feedbackScore: 90 });
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(4600);
    const reward = contract.state.distributedRewards.get(1);
    expect(reward?.amount).toBe(4600);
    expect(reward?.claimed).toBe(true);
    expect(reward?.recipient).toBe("ST2TRAINER");
    expect(contract.state.totalDistributed).toBe(4600);
    expect(contract.transfers).toEqual([{ amount: 4600, from: "contract", to: "ST2TRAINER" }]);
    expect(contract.events).toEqual([{ event: "reward-distributed", proposalId: 1, amount: 4600, recipient: "ST2TRAINER" }]);
  });

  it("rejects distribution for non-approved proposal", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: false });
    contract.state.proposalMetrics.set(1, { enrollments: 100, completions: 80, feedbackScore: 90 });
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_NOT_APPROVED);
  });

  it("rejects distribution by non-authority", () => {
    contract.caller = "ST3FAKE";
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects distribution for already distributed reward", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.proposalMetrics.set(1, { enrollments: 100, completions: 80, feedbackScore: 90 });
    contract.distributeReward(1);
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REWARD_ALREADY_DISTRIBUTED);
  });

  it("claims reward successfully", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.distributedRewards.set(1, { amount: 1000, distributedAt: 0, claimed: false, recipient: "ST2TRAINER" });
    contract.caller = "ST2TRAINER";
    const result = contract.claimReward(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1000);
    const reward = contract.state.distributedRewards.get(1);
    expect(reward?.claimed).toBe(true);
    expect(contract.transfers).toEqual([{ amount: 1000, from: "contract", to: "ST2TRAINER" }]);
    expect(contract.events).toEqual([{ event: "reward-claimed", proposalId: 1, amount: 1000, claimant: "ST2TRAINER" }]);
  });

  it("rejects claim for expired reward", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.distributedRewards.set(1, { amount: 1000, distributedAt: 0, claimed: false, recipient: "ST2TRAINER" });
    contract.caller = "ST2TRAINER";
    contract.blockHeight = 1440;
    const result = contract.claimReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REWARD_EXPIRED);
  });

  it("rejects claim by non-trainer", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.distributedRewards.set(1, { amount: 1000, distributedAt: 0, claimed: false, recipient: "ST2TRAINER" });
    contract.caller = "ST3FAKE";
    const result = contract.claimReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets max reward per proposal successfully", () => {
    const result = contract.setMaxRewardPerProposal(2000000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxRewardPerProposal).toBe(2000000);
  });

  it("rejects invalid max reward per proposal", () => {
    const result = contract.setMaxRewardPerProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("sets feedback threshold successfully", () => {
    const result = contract.setFeedbackThreshold(85);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.feedbackThreshold).toBe(85);
  });

  it("rejects invalid feedback threshold", () => {
    const result = contract.setFeedbackThreshold(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_METRIC);
  });

  it("uses Clarity types for parameters", () => {
    const proposalId = uintCV(1);
    expect(proposalId.value).toEqual(BigInt(1));
  });

  it("rejects distribution when total rewards exceeded", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.proposalMetrics.set(1, { enrollments: 100000, completions: 100000, feedbackScore: 100 });
    contract.state.maxTotalRewards = 100;
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("caps reward at max per proposal", () => {
    contract.state.proposals.set(1, { title: "Test", desc: "Desc", trainer: "ST2TRAINER", skillId: 1, approved: true });
    contract.state.proposalMetrics.set(1, { enrollments: 100000, completions: 100000, feedbackScore: 100 });
    const result = contract.distributeReward(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1000000);
  });
});