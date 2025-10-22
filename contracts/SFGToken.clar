(define-trait sip010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 10) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

(define-fungible-token sfg u1000000000)

(define-data-var token-owner principal tx-sender)
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var mint-paused bool false)
(define-data-var burn-paused bool false)
(define-data-var minter-list (list 10 principal) (list))
(define-data-var total-burned uint u0)
(define-data-var emergency-lock bool false)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-MINT-PAUSED u101)
(define-constant ERR-BURN-PAUSED u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-RECIPIENT u104)
(define-constant ERR-MINTER-LIMIT u105)
(define-constant ERR-EMERGENCY-LOCK u106)
(define-constant ERR-INVALID-MINTER u107)
(define-constant ERR-INVALID-URI u108)
(define-constant CONTRACT-OWNER tx-sender)

(define-map minter-balances principal uint)
(define-map allowances { owner: principal, spender: principal } uint)

(define-read-only (get-name)
  (ok "SkillForge Token")
)

(define-read-only (get-symbol)
  (ok "SFG")
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sfg account))
)

(define-read-only (get-total-supply)
  (ok (- (ft-get-supply sfg) (var-get total-burned)))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

(define-read-only (get-minter-balance (minter principal))
  (default-to u0 (map-get? minter-balances minter))
)

(define-read-only (get-allowance (owner principal) (spender principal))
  (default-to u0 (map-get? allowances { owner: owner, spender: spender }))
)

(define-read-only (is-minter (account principal))
  (ok (is-some (index-of (var-get minter-list) account)))
)

(define-read-only (is-mint-paused)
  (ok (var-get mint-paused))
)

(define-read-only (is-burn-paused)
  (ok (var-get burn-paused))
)

(define-read-only (is-emergency-locked)
  (ok (var-get emergency-lock))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-minter (minter principal))
  (if (is-some (index-of (var-get minter-list) minter))
      (ok true)
      (err ERR-INVALID-MINTER))
)

(define-private (check-emergency-lock)
  (if (var-get emergency-lock)
      (err ERR-EMERGENCY-LOCK)
      (ok true))
)

(define-public (set-token-uri (new-uri (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= (len new-uri) u256) (err ERR-INVALID-URI))
    (var-set token-uri (some new-uri))
    (ok true)
  )
)

(define-public (pause-mint)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (var-set mint-paused true)
    (ok true)
  )
)

(define-public (unpause-mint)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (var-set mint-paused false)
    (ok true)
  )
)

(define-public (pause-burn)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (var-set burn-paused true)
    (ok true)
  )
)

(define-public (unpause-burn)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (var-set burn-paused false)
    (ok true)
  )
)

(define-public (add-minter (new-minter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (try! (validate-recipient new-minter))
    (let ((current-minters (var-get minter-list)))
      (asserts! (< (len current-minters) u10) (err ERR-MINTER-LIMIT))
      (var-set minter-list (unwrap! (as-max-len? (append current-minters new-minter) u10) (err ERR-MINTER-LIMIT)))
      (ok true)
    )
  )
)

(define-public (remove-minter (minter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (let ((current-minters (var-get minter-list)))
      (var-set minter-list (filter (lambda (m) (not (is-eq m minter))) current-minters))
      (map-delete minter-balances minter)
      (ok true)
    )
  )
)

(define-public (set-emergency-lock (locked bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-NOT-AUTHORIZED))
    (var-set emergency-lock locked)
    (ok true)
  )
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (try! (check-emergency-lock))
    (asserts! (not (var-get mint-paused)) (err ERR-MINT-PAUSED))
    (try! (validate-minter tx-sender))
    (try! (validate-amount amount))
    (try! (validate-recipient recipient))
    (map-set minter-balances tx-sender (+ (get-minter-balance tx-sender) amount))
    (try! (ft-mint? sfg amount recipient))
    (print { event: "mint", amount: amount, recipient: recipient, minter: tx-sender })
    (ok true)
  )
)

(define-public (burn (amount uint))
  (begin
    (try! (check-emergency-lock))
    (asserts! (not (var-get burn-paused)) (err ERR-BURN-PAUSED))
    (try! (validate-amount amount))
    (asserts! (>= (ft-get-balance sfg tx-sender) amount) (err ERR-INVALID-AMOUNT))
    (try! (ft-burn? sfg amount tx-sender))
    (var-set total-burned (+ (var-get total-burned) amount))
    (print { event: "burn", amount: amount, sender: tx-sender })
    (ok true)
  )
)

(define-public (approve (spender principal) (amount uint))
  (begin
    (try! (check-emergency-lock))
    (try! (validate-recipient spender))
    (try! (validate-amount amount))
    (map-set allowances { owner: tx-sender, spender: spender } amount)
    (print { event: "approve", owner: tx-sender, spender: spender, amount: amount })
    (ok true)
  )
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (try! (check-emergency-lock))
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount amount))
    (try! (validate-recipient recipient))
    (try! (ft-transfer? sfg amount sender recipient))
    (print { event: "transfer", amount: amount, sender: sender, recipient: recipient, memo: memo })
    (ok true)
  )
)

(define-public (transfer-from (owner principal) (recipient principal) (amount uint))
  (begin
    (try! (check-emergency-lock))
    (try! (validate-amount amount))
    (try! (validate-recipient recipient))
    (let ((allowance (get-allowance owner tx-sender)))
      (asserts! (>= allowance amount) (err ERR-NOT-AUTHORIZED))
      (map-set allowances { owner: owner, spender: tx-sender } (- allowance amount))
      (try! (ft-transfer? sfg amount owner recipient))
      (print { event: "transfer-from", amount: amount, owner: owner, recipient: recipient, spender: tx-sender })
      (ok true)
    )
  )
)