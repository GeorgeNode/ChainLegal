;; =====================================================
;; CHAINLEGAL: SMART CONTRACT LEGAL FRAMEWORK
;; =====================================================

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant ERR_CONTRACT_NOT_FOUND (err u402))
(define-constant ERR_INVALID_JURISDICTION (err u403))
(define-constant ERR_CONTRACT_ALREADY_SIGNED (err u404))
(define-constant ERR_CONTRACT_EXPIRED (err u405))
(define-constant ERR_INVALID_PARTY (err u406))
(define-constant ERR_INSUFFICIENT_SIGNATURES (err u407))

;; Data Variables
(define-data-var contract-owner principal CONTRACT_OWNER)
(define-data-var next-contract-id uint u1)
(define-data-var next-template-id uint u1)
(define-data-var platform-fee-rate uint u250) ;; 2.5% in basis points

;; Legal Contract Structure
(define-map legal-contracts
    { contract-id: uint }
    {
        template-id: uint,
        creator: principal,
        parties: (list 10 principal),
        jurisdiction: (string-ascii 8),
        contract-type: (string-ascii 32),
        created-at: uint,
        expires-at: uint,
        status: (string-ascii 16),
        terms-hash: (string-ascii 64),
        metadata-uri: (string-ascii 256),
        total-value: uint,
        required-signatures: uint,
        current-signatures: uint,
    }
)

;; Contract Templates
(define-map contract-templates
    { template-id: uint }
    {
        name: (string-ascii 64),
        category: (string-ascii 32),
        jurisdiction: (string-ascii 8),
        creator: principal,
        template-hash: (string-ascii 64),
        compliance-level: (string-ascii 16),
        usage-count: uint,
        is-verified: bool,
        created-at: uint,
    }
)

;; Contract Signatures
(define-map contract-signatures
    {
        contract-id: uint,
        signer: principal,
    }
    {
        signed-at: uint,
        signature-hash: (string-ascii 64),
        witness: (optional principal),
        is-notarized: bool,
    }
)

;; Jurisdiction Registry
(define-map jurisdictions
    { jurisdiction-code: (string-ascii 8) }
    {
        name: (string-ascii 64),
        legal-system: (string-ascii 16),
        compliance-requirements: (string-ascii 32),
        is-supported: bool,
        regulatory-body: (optional principal),
    }
)

;; Legal Entity Registry
(define-map legal-entities
    { entity: principal }
    {
        entity-type: (string-ascii 16),
        jurisdiction: (string-ascii 8),
        registration-number: (string-ascii 32),
        verified-at: uint,
        is-verified: bool,
        legal-name: (string-ascii 128),
    }
)

;; Initialize supported jurisdictions
(map-set jurisdictions { jurisdiction-code: "US-NY" } {
    name: "New York, United States",
    legal-system: "common-law",
    compliance-requirements: "UCC-compliant",
    is-supported: true,
    regulatory-body: none,
})
(map-set jurisdictions { jurisdiction-code: "UK-ENG" } {
    name: "England and Wales",
    legal-system: "common-law",
    compliance-requirements: "UK-contract-law",
    is-supported: true,
    regulatory-body: none,
})
(map-set jurisdictions { jurisdiction-code: "DE-BW" } {
    name: "Baden-Wurttemberg, Germany",
    legal-system: "civil-law",
    compliance-requirements: "BGB-compliant",
    is-supported: true,
    regulatory-body: none,
})

;; Read-only functions
(define-read-only (get-legal-contract (contract-id uint))
    (map-get? legal-contracts { contract-id: contract-id })
)

(define-read-only (get-contract-template (template-id uint))
    (map-get? contract-templates { template-id: template-id })
)

(define-read-only (get-jurisdiction-info (jurisdiction-code (string-ascii 8)))
    (map-get? jurisdictions { jurisdiction-code: jurisdiction-code })
)

(define-read-only (is-jurisdiction-supported (jurisdiction-code (string-ascii 8)))
    (default-to false
        (get is-supported (get-jurisdiction-info jurisdiction-code))
    )
)

(define-read-only (get-legal-entity (entity principal))
    (map-get? legal-entities { entity: entity })
)

;; Core Contract Management Functions
(define-public (create-contract-template
        (name (string-ascii 64))
        (category (string-ascii 32))
        (jurisdiction (string-ascii 8))
        (template-hash (string-ascii 64))
        (compliance-level (string-ascii 16))
    )
    (let ((template-id (var-get next-template-id)))
        ;; Validate jurisdiction
        (asserts! (is-jurisdiction-supported jurisdiction)
            ERR_INVALID_JURISDICTION
        )
        ;; Create template
        (map-set contract-templates { template-id: template-id } {
            name: name,
            category: category,
            jurisdiction: jurisdiction,
            creator: tx-sender,
            template-hash: template-hash,
            compliance-level: compliance-level,
            usage-count: u0,
            is-verified: false,
            created-at: stacks-block-height,
        })
        ;; Increment template counter
        (var-set next-template-id (+ template-id u1))
        (ok template-id)
    )
)

(define-public (create-legal-contract
        (template-id uint)
        (parties (list 10 principal))
        (jurisdiction (string-ascii 8))
        (contract-type (string-ascii 32))
        (expires-at uint)
        (terms-hash (string-ascii 64))
        (metadata-uri (string-ascii 256))
        (total-value uint)
        (required-signatures uint)
    )
    (let (
            (contract-id (var-get next-contract-id))
            (template (unwrap! (get-contract-template template-id) ERR_CONTRACT_NOT_FOUND))
        )
        ;; Validate inputs
        (asserts! (is-jurisdiction-supported jurisdiction)
            ERR_INVALID_JURISDICTION
        )
        (asserts! (> expires-at stacks-block-height) ERR_CONTRACT_EXPIRED)
        (asserts! (<= required-signatures (len parties))
            ERR_INSUFFICIENT_SIGNATURES
        )
        ;; Create legal contract
        (map-set legal-contracts { contract-id: contract-id } {
            template-id: template-id,
            creator: tx-sender,
            parties: parties,
            jurisdiction: jurisdiction,
            contract-type: contract-type,
            created-at: stacks-block-height,
            expires-at: expires-at,
            status: "pending",
            terms-hash: terms-hash,
            metadata-uri: metadata-uri,
            total-value: total-value,
            required-signatures: required-signatures,
            current-signatures: u0,
        })
        ;; Update template usage
        (map-set contract-templates { template-id: template-id }
            (merge template { usage-count: (+ (get usage-count template) u1) })
        )
        ;; Increment contract counter
        (var-set next-contract-id (+ contract-id u1))
        (ok contract-id)
    )
)

;; =====================================================
;; CHAINLEGAL: SMART CONTRACT LEGAL FRAMEWORK
;; =====================================================

;; Compliance Rules
(define-map compliance-rules
    {
        jurisdiction: (string-ascii 8),
        contract-type: (string-ascii 32),
    }
    {
        min-signature-requirements: uint,
        witness-required: bool,
        notarization-required: bool,
        cooling-period: uint,
        max-contract-value: uint,
    }
)

;; Initialize compliance rules
(map-set compliance-rules {
    jurisdiction: "US-NY",
    contract-type: "employment",
} {
    min-signature-requirements: u2,
    witness-required: false,
    notarization-required: false,
    cooling-period: u144,
    max-contract-value: u0,
})

;; ~24 hours cooling period

(map-set compliance-rules {
    jurisdiction: "US-NY",
    contract-type: "real-estate",
} {
    min-signature-requirements: u2,
    witness-required: true,
    notarization-required: true,
    cooling-period: u1008,
    max-contract-value: u0,
})

;; ~7 days cooling period

(map-set compliance-rules {
    jurisdiction: "UK-ENG",
    contract-type: "commercial",
} {
    min-signature-requirements: u2,
    witness-required: false,
    notarization-required: false,
    cooling-period: u72,
    max-contract-value: u0,
})

;; ~12 hours cooling period

;; Digital Signature Functions
(define-public (sign-contract
        (contract-id uint)
        (signature-hash (string-ascii 64))
        (witness (optional principal))
    )
    (let (
            (contract-data (unwrap! (get-legal-contract contract-id) ERR_CONTRACT_NOT_FOUND))
            (current-sigs (get current-signatures contract-data))
        )
        ;; Validate signer is a party to the contract
        (asserts! (is-some (index-of (get parties contract-data) tx-sender))
            ERR_INVALID_PARTY
        )
        ;; Check contract hasn't expired
        (asserts! (< stacks-block-height (get expires-at contract-data))
            ERR_CONTRACT_EXPIRED
        )
        ;; Check if already signed
        (asserts!
            (is-none (map-get? contract-signatures {
                contract-id: contract-id,
                signer: tx-sender,
            }))
            ERR_CONTRACT_ALREADY_SIGNED
        )
        ;; Record signature
        (map-set contract-signatures {
            contract-id: contract-id,
            signer: tx-sender,
        } {
            signed-at: stacks-block-height,
            signature-hash: signature-hash,
            witness: witness,
            is-notarized: false,
        })
        ;; Update signature count
        (map-set legal-contracts { contract-id: contract-id }
            (merge contract-data { current-signatures: (+ current-sigs u1) })
        )
        ;; Check if contract is fully signed
        (if (>= (+ current-sigs u1) (get required-signatures contract-data))
            (begin
                (try! (finalize-contract contract-id))
                (ok "contract-signed-and-finalized")
            )
            (ok "signature-recorded")
        )
    )
)

(define-public (notarize-signature
        (contract-id uint)
        (signer principal)
    )
    (let (
            (signature-data (unwrap!
                (map-get? contract-signatures {
                    contract-id: contract-id,
                    signer: signer,
                })
                ERR_CONTRACT_NOT_FOUND
            ))
            (contract-data (unwrap! (get-legal-contract contract-id) ERR_CONTRACT_NOT_FOUND))
        )
        ;; Only verified legal entities can notarize
        (asserts!
            (default-to false (get is-verified (get-legal-entity tx-sender)))
            ERR_UNAUTHORIZED
        )
        ;; Update notarization status
        (map-set contract-signatures {
            contract-id: contract-id,
            signer: signer,
        }
            (merge signature-data { is-notarized: true })
        )
        (ok true)
    )
)

;; Compliance Validation
(define-read-only (check-compliance (contract-id uint))
    (match (get-legal-contract contract-id)
        contract-data
        (let (
                (jurisdiction (get jurisdiction contract-data))
                (contract-type (get contract-type contract-data))
                (compliance-rule (map-get? compliance-rules {
                    jurisdiction: jurisdiction,
                    contract-type: contract-type,
                }))
            )
            (match compliance-rule
                rule
                {
                    signatures-met: (>= (get current-signatures contract-data)
                        (get min-signature-requirements rule)
                    ),
                    witness-requirement-met: (if (get witness-required rule)
                        (check-witness-requirements contract-id)
                        true
                    ),
                    notarization-requirement-met: (if (get notarization-required rule)
                        (check-notarization-requirements contract-id)
                        true
                    ),
                    value-limit-met: (if (> (get max-contract-value rule) u0)
                        (<= (get total-value contract-data)
                            (get max-contract-value rule)
                        )
                        true
                    ),
                }
                ;; Default compliance if no specific rules
                {
                    signatures-met: (>= (get current-signatures contract-data)
                        (get required-signatures contract-data)
                    ),
                    witness-requirement-met: true,
                    notarization-requirement-met: true,
                    value-limit-met: true,
                }
            )
        )
        ;; Return default failure state if contract not found
        {
            signatures-met: false,
            witness-requirement-met: false,
            notarization-requirement-met: false,
            value-limit-met: false,
        }
    )
)

(define-private (check-witness-requirements (contract-id uint))
    ;; Simplified witness check - in production, this would verify witness signatures
    true
)

(define-private (check-notarization-requirements (contract-id uint))
    ;; Check if all required signatures are notarized
    (let ((contract-data (unwrap! (get-legal-contract contract-id) false)))
        ;; For now, return true - in production, iterate through signatures
        true
    )
)

(define-private (finalize-contract (contract-id uint))
    (let (
            (contract-data (unwrap! (get-legal-contract contract-id) ERR_CONTRACT_NOT_FOUND))
            (compliance-check (check-compliance contract-id))
        )
        ;; Verify compliance before finalizing
        (asserts! (get signatures-met compliance-check)
            ERR_INSUFFICIENT_SIGNATURES
        )
        (asserts! (get witness-requirement-met compliance-check) ERR_UNAUTHORIZED)
        (asserts! (get notarization-requirement-met compliance-check)
            ERR_UNAUTHORIZED
        )
        (asserts! (get value-limit-met compliance-check) ERR_UNAUTHORIZED)
        ;; Update contract status
        (map-set legal-contracts { contract-id: contract-id }
            (merge contract-data { status: "active" })
        )
        (ok true)
    )
)

;; Entity Verification
(define-public (register-legal-entity
        (entity-type (string-ascii 16))
        (jurisdiction (string-ascii 8))
        (registration-number (string-ascii 32))
        (legal-name (string-ascii 128))
    )
    (begin
        ;; Validate jurisdiction
        (asserts! (is-jurisdiction-supported jurisdiction)
            ERR_INVALID_JURISDICTION
        )
        ;; Register entity
        (map-set legal-entities { entity: tx-sender } {
            entity-type: entity-type,
            jurisdiction: jurisdiction,
            registration-number: registration-number,
            verified-at: stacks-block-height,
            is-verified: false,
            legal-name: legal-name,
        })
        (ok true)
    )
)

(define-public (verify-legal-entity (entity principal))
    (let ((entity-data (unwrap! (get-legal-entity entity) ERR_CONTRACT_NOT_FOUND)))
        ;; Only contract owner can verify entities
        (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_UNAUTHORIZED)
        ;; Update verification status
        (map-set legal-entities { entity: entity }
            (merge entity-data {
                is-verified: true,
                verified-at: stacks-block-height,
            })
        )
        (ok true)
    )
)
