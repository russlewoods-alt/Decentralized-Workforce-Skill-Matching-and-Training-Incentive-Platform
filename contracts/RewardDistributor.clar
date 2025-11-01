(define-constant ERR-NOT-AUTHORIZED u401)
(define-constant ERR-PROPOSAL-NOT-FOUND u404)
(define-constant ERR-PROPOSAL-NOT-APPROVED u403)
(define-constant ERR-INVALID-AMOUNT u402)
(define-constant ERR-INVALID-METRIC u405)
(define-constant ERR-REWARD-ALREADY-DISTRIBUTED u406)
(define-constant ERR-INSUFFICIENT-BALANCE u407)
(define-constant ERR-INVALID-RECIPIENT u408)
(define-constant ERR-INVALID-TOKEN-CONTRACT u409)
(define-constant ERR-INVALID-PROPOSAL-ID u410)
(define-constant ERR-MAX-REWARDS-EXCEEDED u411)
(define-constant ERR-INVALID-ENROLLMENT-COUNT u412)
(define-constant ERR-INVALID-COMPLETION-RATE u413)
(define-constant ERR-INVALID-FEEDBACK-SCORE u414)
(define-constant ERR-INVALID-REWARD-TYPE u415)
(define-constant ERR-REWARD-NOT-CLAIMABLE u416)
(define-constant ERR-INVALID-TIMESTAMP u417)
(define-constant ERR-REWARD-EXPIRED u418)
(define-constant ERR-INVALID-UPDATE-PARAM u419)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u420)

(define-trait sip010-trait
  ((transfer (uint principal principal (optional (buff 34))) (response bool uint))
   (get-balance (principal) (response uint uint))
   (get-total-supply () (response uint uint))))

(define-trait proposal-trait
  ((get-proposal (uint) (response {title: (string-ascii 100), desc: (string-utf8 500), trainer: principal, skill-id: uint, approved: bool} uint))
   (get-metrics (uint) (response {enrollments: uint, completions: uint, feedback-score: uint} uint))))

(define-data-var token-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var proposal-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var authority-principal principal tx-sender)
(define-data-var max-reward-per-proposal uint u1000000)
(define-data-var base-reward-rate uint u100)
(define-data-var enrollment-multiplier uint u10)
(define-data-var completion-bonus uint u20)
(define-data-var feedback-threshold uint u80)
(define-data-var reward-expiry-blocks uint u1440)
(define-data-var total-distributed uint u0)
(define-data-var max-total-rewards uint u1000000000)

(define-map distributed-rewards uint {amount: uint, distributed-at: uint, claimed: bool, recipient: principal})
(define-map reward-metrics uint {enrollments: uint, completions: uint, feedback-score: uint, calculated-amount: uint})
(define-map reward-types uint (string-ascii 50))
(define-map pending-claims principal (list 10 uint))

(define-read-only (get-distributed-reward (proposal-id uint))
  (map-get? distributed-rewards proposal-id))

(define-read-only (get-reward-metrics (proposal-id uint))
  (map-get? reward-metrics proposal-id))

(define-read-only (get-pending-claims (trainer principal))
  (map-get? pending-claims trainer))

(define-read-only (get-total-distributed)
  (ok (var-get total-distributed)))

(define-read-only (get-max-reward-per-proposal)
  (ok (var-get max-reward-per-proposal)))

(define-read-only (get-base-reward-rate)
  (ok (var-get base-reward-rate)))

(define-read-only (is-reward-claimable (proposal-id uint))
  (match (map-get? distributed-rewards proposal-id)
    reward (ok (and (not (get claimed reward)) (< (- block-height (get distributed-at reward)) (var-get reward-expiry-blocks))))
    (err ERR-PROPOSAL-NOT-FOUND)))

(define-private (validate-amount (amount uint))
  (if (> amount u0) (ok true) (err ERR-INVALID-AMOUNT)))

(define-private (validate-proposal-id (id uint))
  (if (> id u0) (ok true) (err ERR-INVALID-PROPOSAL-ID)))

(define-private (validate-metric (metric uint) (min uint) (max uint))
  (if (and (>= metric min) (<= metric max)) (ok true) (err ERR-INVALID-METRIC)))

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (ok true) (err ERR-INVALID-RECIPIENT)))

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height) (ok true) (err ERR-INVALID-TIMESTAMP)))

(define-private (calculate-reward-amount (enrollments uint) (completions uint) (feedback-score uint))
  (let (
      (base (* enrollments (var-get enrollment-multiplier)))
      (completion-add (* completions (var-get completion-bonus)))
      (feedback-bonus (if (>= feedback-score (var-get feedback-threshold)) (* base u2) u0))
      (total (+ base completion-add feedback-bonus))
      (capped (if (> total (var-get max-reward-per-proposal)) (var-get max-reward-per-proposal) total)))
    capped))

(define-public (set-token-contract (new-contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-TOKEN-CONTRACT))
    (var-set token-contract new-contract)
    (ok true)))

(define-public (set-proposal-contract (new-contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-TOKEN-CONTRACT))
    (var-set proposal-contract new-contract)
    (ok true)))

(define-public (set-max-reward-per-proposal (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount new-max))
    (var-set max-reward-per-proposal new-max)
    (ok true)))

(define-public (set-base-reward-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount new-rate))
    (var-set base-reward-rate new-rate)
    (ok true)))

(define-public (set-enrollment-multiplier (new-multiplier uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount new-multiplier))
    (var-set enrollment-multiplier new-multiplier)
    (ok true)))

(define-public (set-completion-bonus (new-bonus uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount new-bonus))
    (var-set completion-bonus new-bonus)
    (ok true)))

(define-public (set-feedback-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-metric new-threshold u0 u100))
    (var-set feedback-threshold new-threshold)
    (ok true)))

(define-public (set-reward-expiry-blocks (new-expiry uint))
  (begin
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount new-expiry))
    (var-set reward-expiry-blocks new-expiry)
    (ok true)))

(define-public (distribute-reward (proposal-id uint) (token <sip010-trait>))
  (let (
      (proposal-res (contract-call? (var-get proposal-contract) get-proposal proposal-id))
      (metrics-res (contract-call? (var-get proposal-contract) get-metrics proposal-id)))
    (asserts! (is-eq tx-sender (var-get authority-principal)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-proposal-id proposal-id))
    (match proposal-res
      proposal
        (begin
          (asserts! (get approved proposal) (err ERR-PROPOSAL-NOT-APPROVED))
          (match metrics-res
            metrics
              (let (
                  (enrollments (get enrollments metrics))
                  (completions (get completions metrics))
                  (feedback-score (get feedback-score metrics))
                  (amount (calculate-reward-amount enrollments completions feedback-score))
                  (recipient (get trainer proposal)))
                (try! (validate-amount amount))
                (try! (validate-metric enrollments u0 u100000))
                (try! (validate-metric completions u0 enrollments))
                (try! (validate-metric feedback-score u0 u100))
                (try! (validate-recipient recipient))
                (asserts! (is-none (map-get? distributed-rewards proposal-id)) (err ERR-REWARD-ALREADY-DISTRIBUTED))
                (asserts! (<= (+ (var-get total-distributed) amount) (var-get max-total-rewards)) (err ERR-INSUFFICIENT-BALANCE))
                (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))
                (map-set distributed-rewards proposal-id {amount: amount, distributed-at: block-height, claimed: true, recipient: recipient})
                (map-set reward-metrics proposal-id {enrollments: enrollments, completions: completions, feedback-score: feedback-score, calculated-amount: amount})
                (var-set total-distributed (+ (var-get total-distributed) amount))
                (print {event: "reward-distributed", proposal-id: proposal-id, amount: amount, recipient: recipient})
                (ok amount))
            (err ERR-INVALID-METRIC)))
      (err ERR-PROPOSAL-NOT-FOUND))))

(define-public (claim-reward (proposal-id uint) (token <sip010-trait>))
  (let ((proposal-res (contract-call? (var-get proposal-contract) get-proposal proposal-id)))
    (match proposal-res
      proposal
        (begin
          (asserts! (is-eq tx-sender (get trainer proposal)) (err ERR-NOT-AUTHORIZED))
          (match (map-get? distributed-rewards proposal-id)
            reward
              (begin
                (asserts! (not (get claimed reward)) (err ERR-REWARD-NOT-CLAIMABLE))
                (asserts! (< (- block-height (get distributed-at reward)) (var-get reward-expiry-blocks)) (err ERR-REWARD-EXPIRED))
                (try! (as-contract (contract-call? token transfer (get amount reward) tx-sender tx-sender none)))
                (map-set distributed-rewards proposal-id (merge reward {claimed: true}))
                (print {event: "reward-claimed", proposal-id: proposal-id, amount: (get amount reward), claimant: tx-sender})
                (ok (get amount reward)))
            (err ERR-PROPOSAL-NOT-FOUND)))
      (err ERR-PROPOSAL-NOT-FOUND))))

(define-public (batch-claim-rewards (proposal-ids (list 10 uint)) (token <sip010-trait>))
  (fold claim-reward-iter proposal-ids (ok u0)))

(define-private (claim-reward-iter (proposal-id uint) (prev (response uint uint)))
  (match prev
    sum
      (match (claim-reward proposal-id token)
        amount (ok (+ sum amount))
        err err)
    err err))