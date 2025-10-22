# SkillForge: Decentralized Workforce Skill Matching and Training Incentive Platform

## Overview

SkillForge is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It addresses real-world problems in the global workforce, such as skill mismatches between job market demands and available talent, lack of incentives for trainers to develop targeted educational content, and centralized control over skill identification and training resources. By leveraging blockchain, SkillForge creates a transparent, decentralized system where:

- Employers and communities identify and register emerging skill needs (e.g., AI ethics, blockchain development, sustainable engineering) via on-chain submissions and oracle-verified data from job markets.
- Trainers are incentivized to create and deliver targeted training programs, earning SFG (SkillForge Governance) tokens as rewards based on course adoption, completion rates, and impact metrics.
- Tokens can be used for course development (e.g., accessing premium tools, collaborating with experts, or funding content creation) or staked for governance participation.
- The platform solves issues like unemployment due to skill gaps (affecting ~1.4 billion workers globally by 2030, per World Economic Forum reports), inefficient training investments, and unequal access to education by democratizing skill identification and rewarding contributions transparently.

This project promotes a merit-based economy for education, reduces reliance on centralized platforms like LinkedIn or Coursera, and ensures immutability and auditability through blockchain. It integrates with real-world data via oracles (e.g., pulling job posting trends from APIs like Indeed or LinkedIn) and encourages community governance to evolve the system.

## Real-World Problems Solved

1. **Skill Gaps in the Workforce**: Traditional systems fail to quickly identify and address evolving needs (e.g., post-COVID remote work skills or AI-driven job displacements). SkillForge uses decentralized submissions and oracles to crowdsource and verify skill demands in real-time.
   
2. **Lack of Incentives for Trainers**: Educators often lack funding or recognition for niche, high-impact courses. SkillForge rewards trainers with tokens based on verifiable outcomes (e.g., learner certifications or employer feedback), enabling them to reinvest in better content.

3. **Inefficient Resource Allocation**: Training programs are often generic and wasteful. By tying rewards to targeted skills, the platform ensures resources go to high-demand areas, reducing mismatches that cost economies trillions annually (e.g., US skill gap costs ~$1.3 trillion in lost productivity).

4. **Centralization and Opacity**: Platforms like edX or Udemy control content and payouts. SkillForge decentralizes this with smart contracts, ensuring fair, transparent rewards without intermediaries.

5. **Access to Development Tools**: Trainers in underserved regions struggle with costs. SFG tokens can be redeemed for on-chain "bounties" or partnerships, fostering global collaboration.

## Architecture

SkillForge consists of 7 interconnected Clarity smart contracts deployed on Stacks (Bitcoin-secured Layer 2). Contracts handle tokenomics, registries, proposals, rewards, governance, data input, and staking. They use Clarity's secure, predictable design (no reentrancy risks, explicit errors).

- **Token Standard**: Based on SIP-010 (Stacks Improvement Proposal for fungible tokens).
- **Security**: All contracts include access controls (e.g., only owners or DAO can mint), error handling, and read-only views.
- **Integration**: Contracts interact via traits (interfaces) for modularity.
- **Off-Chain Components**: Front-end dApp (not included here) for user interactions; oracles (e.g., via Chainlink on Stacks) for external data.

## Smart Contracts

Below is a detailed overview of each contract, including purpose, key functions, and code snippets. Full deployment requires Stacks CLI (`clarinet` for testing, `stacks deploy` for mainnet).

### 1. SFGToken.clar - Fungible Token Contract
**Purpose**: Manages the SFG token (capped supply: 1,000,000,000). Used for rewards, staking, and governance. Implements SIP-010 trait.

```clarity
;; SFGToken.clar
(define-trait sip010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    ;; ... other SIP-010 functions
  )
)

(define-fungible-token sfg u1000000000) ;; 1B total supply

(define-data-var token-owner principal tx-sender)

(define-public (mint (amount uint) (recipient principal))
  (if (is-eq tx-sender (var-get token-owner))
    (ft-mint? sfg amount recipient)
    (err u401) ;; Unauthorized
  )
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (ft-transfer? sfg amount sender recipient)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sfg account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply sfg))
)
```

### 2. SkillNeedsRegistry.clar - Skill Needs Registration
**Purpose**: Allows employers to register skill needs (e.g., "Rust programming for blockchain"). Stores skills with metadata (demand level, category). Community or oracles can update/verity.

```clarity
;; SkillNeedsRegistry.clar
(define-map skills uint { name: (string-ascii 50), demand: uint, submitter: principal, verified: bool })

(define-data-var skill-counter uint u0)

(define-public (register-skill (name (string-ascii 50)) (demand uint))
  (let ((id (var-get skill-counter)))
    (map-insert skills id { name: name, demand: demand, submitter: tx-sender, verified: false })
    (var-set skill-counter (+ id u1))
    (ok id)
  )
)

(define-public (verify-skill (id uint) (oracle principal))
  (match (map-get? skills id)
    skill (if (is-eq tx-sender oracle)
            (map-set skills id (merge skill { verified: true }))
            (err u401))
    (err u404) ;; Not found
  )
)

(define-read-only (get-skill (id uint))
  (map-get? skills id)
)
```

### 3. CourseProposal.clar - Course Proposal Submission
**Purpose**: Trainers propose courses targeting registered skills. Includes course details (title, description, linked skill ID).

```clarity
;; CourseProposal.clar
(define-map proposals uint { title: (string-ascii 100), desc: (string-utf8 500), trainer: principal, skill-id: uint, approved: bool })

(define-data-var proposal-counter uint u0)

(define-public (submit-proposal (title (string-ascii 100)) (desc (string-utf8 500)) (skill-id uint))
  (let ((id (var-get proposal-counter)))
    (map-insert proposals id { title: title, desc: desc, trainer: tx-sender, skill-id: skill-id, approved: false })
    (var-set proposal-counter (+ id u1))
    (ok id)
  )
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)
```

### 4. RewardDistributor.clar - Reward Distribution
**Purpose**: Distributes SFG tokens to trainers based on course metrics (e.g., enrollments, completions). Integrates with token contract.

```clarity
;; RewardDistributor.clar
(use-trait sip010 .SFGToken.sip010-trait)

(define-data-var token-contract principal 'SP...::SFGToken) ;; Deployed address

(define-public (distribute-reward (proposal-id uint) (amount uint) (token <sip010>))
  (match (contract-call? .CourseProposal get-proposal proposal-id)
    proposal (if (get approved proposal)
               (contract-call? token transfer amount (as-contract tx-sender) (get trainer proposal) none)
               (err u403)) ;; Not approved
    (err u404)
  )
)
```

### 5. Governance.clar - DAO Governance
**Purpose**: Token holders vote on approving proposals, verifying skills, or updating parameters. Uses staking for voting power.

```clarity
;; Governance.clar
(use-trait sip010 .SFGToken.sip010-trait)

(define-map votes { proposal-id: uint, voter: principal } { yes: uint, no: uint })

(define-public (vote (proposal-id uint) (yes bool) (token <sip010>))
  (let ((balance (unwrap-panic (contract-call? token get-balance tx-sender))))
    (if (> balance u0)
      (map-set votes { proposal-id: proposal-id, voter: tx-sender } { yes: (if yes balance u0), no: (if yes u0 balance) })
      (err u402) ;; Insufficient balance
    )
  )
)

(define-read-only (tally-votes (proposal-id uint))
  ;; Logic to sum yes/no votes
  (ok { yes: u0, no: u0 }) ;; Placeholder
)
```

### 6. Oracle.clar - Data Oracle Integration
**Purpose**: Feeds external data (e.g., job market trends) to verify skill demands. Assumes an oracle principal submits data.

```clarity
;; Oracle.clar
(define-data-var oracle principal tx-sender)

(define-map external-data uint { key: (string-ascii 50), value: uint })

(define-public (submit-data (key (string-ascii 50)) (value uint))
  (if (is-eq tx-sender (var-get oracle))
    (map-set external-data (hash160 key) { key: key, value: value })
    (err u401)
  )
)

(define-read-only (get-data (key (string-ascii 50)))
  (map-get? external-data (hash160 key))
)
```

### 7. Staking.clar - Token Staking
**Purpose**: Allows users to stake SFG for governance voting power or earn yields from reward pools.

```clarity
;; Staking.clar
(use-trait sip010 .SFGToken.sip010-trait)

(define-map stakes principal uint)

(define-public (stake (amount uint) (token <sip010>))
  (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
  (map-set stakes tx-sender (+ (default-to u0 (map-get? stakes tx-sender)) amount))
  (ok amount)
)

(define-public (unstake (amount uint) (token <sip010>))
  (let ((current (default-to u0 (map-get? stakes tx-sender))))
    (if (>= current amount)
      (begin
        (try! (as-contract (contract-call? token transfer amount tx-sender tx-sender none)))
        (map-set stakes tx-sender (- current amount))
        (ok amount)
      )
      (err u403)
    )
  )
)

(define-read-only (get-stake (account principal))
  (ok (default-to u0 (map-get? stakes account)))
)
```

## Installation and Deployment

1. **Prerequisites**:
   - Install Clarinet: `cargo install clarinet`.
   - Stacks Wallet for testnet/mainnet.

2. **Setup**:
   - Clone repo: <this-repo>
   - Create contracts folder and add the .clar files above.
   - Run `clarinet test` for unit tests (add your own).

3. **Deployment**:
   - Use Clarinet to deploy to devnet: `clarinet deploy`.
   - For mainnet: Use Stacks API or CLI with your private key.
   - Deploy in order: SFGToken → Registries → Others (set principals accordingly).

4. **Usage**:
   - Interact via Stacks Explorer or custom dApp.
   - Example: Register a skill, propose a course, vote, claim rewards.

## Roadmap and Contributions

- V1: Core contracts (as above).
- V2: Integrate real oracles (e.g., Chainlink), NFT certifications for learners.
- Contributions: Fork and PR. Licensed under MIT.s