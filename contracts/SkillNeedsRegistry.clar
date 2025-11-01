(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-SKILL-ALREADY-EXISTS u101)
(define-constant ERR-SKILL-NOT-FOUND u102)
(define-constant ERR-INVALID-NAME u103)
(define-constant ERR-INVALID-DEMAND u104)
(define-constant ERR-INVALID-CATEGORY u105)
(define-constant ERR-INVALID-LOCATION u106)
(define-constant ERR-INVALID-SUBMITTER u107)
(define-constant ERR-ORACLE-NOT-SET u108)
(define-constant ERR-VERIFICATION-FAILED u109)
(define-constant ERR-MAX-SKILLS-EXCEEDED u110)
(define-constant ERR-INVALID-TIMESTAMP u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-EVIDENCE-LINK u113)
(define-constant ERR-INVALID-VERIFIER u114)

(define-data-var next-skill-id uint u0)
(define-data-var max-skills uint u5000)
(define-data-var oracle-principal (optional principal) none)
(define-data-var skill-registry-fee uint u500)

(define-map skills
  uint
  {
    name: (string-utf8 80),
    category: (string-ascii 40),
    demand-score: uint,
    location: (string-utf8 100),
    submitter: principal,
    timestamp: uint,
    verified: bool,
    evidence-link: (optional (string-utf8 200)),
    verification-timestamp: (optional uint),
    verifier: (optional principal)
  }
)

(define-map skill-by-name
  (string-utf8 80)
  uint
)

(define-map skill-updates
  uint
  {
    old-name: (string-utf8 80),
    new-name: (string-utf8 80),
    new-demand: uint,
    new-location: (string-utf8 100),
    update-timestamp: uint,
    updater: principal
  }
)

(define-map demand-history
  { skill-id: uint, timestamp: uint }
  uint
)

(define-read-only (get-skill (id uint))
  (map-get? skills id)
)

(define-read-only (get-skill-by-name (name (string-utf8 80)))
  (map-get? skill-by-name name)
)

(define-read-only (get-skill-update (id uint))
  (map-get? skill-updates id)
)

(define-read-only (get-demand-at (skill-id uint) (timestamp uint))
  (map-get? demand-history { skill-id: skill-id, timestamp: timestamp })
)

(define-read-only (is-skill-registered (name (string-utf8 80)))
  (is-some (map-get? skill-by-name name))
)

(define-read-only (get-next-skill-id)
  (ok (var-get next-skill-id))
)

(define-read-only (get-oracle)
  (var-get oracle-principal)
)

(define-private (validate-name (name (string-utf8 80)))
  (if (and (> (len name) u0) (<= (len name) u80))
      (ok true)
      (err ERR-INVALID-NAME))
)

(define-private (validate-category (category (string-ascii 40)))
  (let ((valid-categories (list
        "technology" "engineering" "healthcare" "finance" "education"
        "manufacturing" "creative" "sustainability" "logistics" "hospitality")))
    (if (is-some (index-of valid-categories category))
        (ok true)
        (err ERR-INVALID-CATEGORY)))
)

(define-private (validate-demand (demand uint))
  (if (and (>= demand u1) (<= demand u1000))
      (ok true)
      (err ERR-INVALID-DEMAND))
)

(define-private (validate-location (location (string-utf8 100)))
  (if (and (> (len location) u0) (<= (len location) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-evidence-link (link (optional (string-utf8 200))))
  (match link
    l (if (<= (len l) u200) (ok true) (err ERR-INVALID-EVIDENCE-LINK))
    (ok true))
)

(define-private (validate-submitter (submitter principal))
  (if (not (is-eq submitter tx-sender))
      (err ERR-INVALID-SUBMITTER)
      (ok true))
)

(define-public (set-oracle (new-oracle principal))
  (let ((current-oracle (var-get oracle-principal)))
    (asserts! (is-none current-oracle) (err ERR-ORACLE-NOT-SET))
    (asserts! (not (is-eq new-oracle tx-sender)) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-principal (some new-oracle))
    (ok true))
)

(define-public (update-oracle (new-oracle principal))
  (let ((current-oracle (var-get oracle-principal)))
    (asserts! (is-some current-oracle) (err ERR-ORACLE-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! current-oracle (err ERR-ORACLE-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-principal (some new-oracle))
    (ok true))
)

(define-public (set-registry-fee (new-fee uint))
  (begin
    (asserts! (is-some (var-get oracle-principal)) (err ERR-ORACLE-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get oracle-principal) (err ERR-ORACLE-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (var-set skill-registry-fee new-fee)
    (ok true))
)

(define-public (register-skill
  (name (string-utf8 80))
  (category (string-ascii 40))
  (demand-score uint)
  (location (string-utf8 100))
  (evidence-link (optional (string-utf8 200)))
)
  (let (
    (skill-id (var-get next-skill-id))
    (current-max (var-get max-skills))
    (oracle (var-get oracle-principal))
  )
    (asserts! (< skill-id current-max) (err ERR-MAX-SKILLS-EXCEEDED))
    (try! (validate-name name))
    (try! (validate-category category))
    (try! (validate-demand demand-score))
    (try! (validate-location location))
    (try! (validate-evidence-link evidence-link))
    (try! (validate-submitter tx-sender))
    (asserts! (is-none (map-get? skill-by-name name)) (err ERR-SKILL-ALREADY-EXISTS))
    (asserts! (is-some oracle) (err ERR-ORACLE-NOT-SET))

    (let ((authority-recipient (unwrap! oracle (err ERR-ORACLE-NOT-SET))))
      (try! (stx-transfer? (var-get skill-registry-fee) tx-sender authority-recipient))
    )

    (map-set skills skill-id
      {
        name: name,
        category: category,
        demand-score: demand-score,
        location: location,
        submitter: tx-sender,
        timestamp: block-height,
        verified: false,
        evidence-link: evidence-link,
        verification-timestamp: none,
        verifier: none
      }
    )
    (map-set skill-by-name name skill-id)
    (map-set demand-history { skill-id: skill-id, timestamp: block-height } demand-score)
    (var-set next-skill-id (+ skill-id u1))
    (print { event: "skill-registered", id: skill-id, name: name })
    (ok skill-id)
  )
)

(define-public (verify-skill (skill-id uint) (verified bool) (notes (optional (string-utf8 200))))
  (let (
    (skill (unwrap! (map-get? skills skill-id) (err ERR-SKILL-NOT-FOUND)))
    (oracle (var-get oracle-principal))
  )
    (asserts! (is-eq tx-sender (unwrap! oracle (err ERR-ORACLE-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (match (validate-evidence-link notes)
      valid (ok true)
      err (err err))

    (map-set skills skill-id
      (merge skill {
        verified: verified,
        verification-timestamp: (some block-height),
        verifier: (some tx-sender)
      })
    )
    (if verified
        (print { event: "skill-verified", id: skill-id })
        (print { event: "skill-rejected", id: skill-id }))
    (ok true))
)

(define-public (update-demand
  (skill-id uint)
  (new-demand uint)
  (evidence-link (optional (string-utf8 200)))
)
  (let ((skill (unwrap! (map-get? skills skill-id) (err ERR-SKILL-NOT-FOUND))))
    (asserts! (get verified skill) (err ERR-VERIFICATION-FAILED))
    (try! (validate-demand new-demand))
    (try! (validate-evidence-link evidence-link))

    (map-set skills skill-id
      (merge skill { demand-score: new-demand }))
    (map-set demand-history
      { skill-id: skill-id, timestamp: block-height }
      new-demand)
    (print { event: "demand-updated", id: skill-id, demand: new-demand })
    (ok true))
)

(define-public (update-skill-metadata
  (skill-id uint)
  (new-name (string-utf8 80))
  (new-location (string-utf8 100))
)
  (let (
    (skill (unwrap! (map-get? skills skill-id) (err ERR-SKILL-NOT-FOUND)))
    (old-name (get name skill))
  )
    (asserts! (is-eq (get submitter skill) tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-name new-name))
    (try! (validate-location new-location))

    (let ((existing-id (map-get? skill-by-name new-name)))
      (asserts!
        (or (is-none existing-id) (is-eq (unwrap! existing-id (err ERR-SKILL-NOT-FOUND)) skill-id))
        (err ERR-SKILL-ALREADY-EXISTS))
    )

    (if (not (is-eq old-name new-name))
        (begin
          (map-delete skill-by-name old-name)
          (map-set skill-by-name new-name skill-id)
        )
        (ok true))

    (map-set skills skill-id
      (merge skill {
        name: new-name,
        location: new-location
      }))
    (map-set skill-updates skill-id
      {
        old-name: old-name,
        new-name: new-name,
        new-demand: (get demand-score skill),
        new-location: new-location,
        update-timestamp: block-height,
        updater: tx-sender
      })
    (print { event: "skill-updated", id: skill-id })
    (ok true))
)

(define-public (get-skill-count)
  (ok (var-get next-skill-id))
)

(define-public (get-verified-skills)
  (filter
    (lambda (id) (default-to false (get verified (map-get? skills id))))
    (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9))
)