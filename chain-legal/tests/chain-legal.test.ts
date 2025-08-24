
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

const contractName = "chain-legal";

describe("ChainLegal Core Contract Management", () => {

  describe("Initialization and Setup", () => {
    it("should initialize with correct default values", () => {
      // Check initial data variables
      const { result: contractOwner } = simnet.callReadOnlyFn(
        contractName,
        "get-legal-contract",
        [Cl.uint(999)], // Non-existent contract
        deployer
      );
      expect(contractOwner).toBeNone();

      // Check if jurisdictions are properly initialized
      const { result: usNyJurisdiction } = simnet.callReadOnlyFn(
        contractName,
        "get-jurisdiction-info",
        [Cl.stringAscii("US-NY")],
        deployer
      );
      expect(usNyJurisdiction).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("New York, United States"),
          "legal-system": Cl.stringAscii("common-law"),
          "compliance-requirements": Cl.stringAscii("UCC-compliant"),
          "is-supported": Cl.bool(true),
          "regulatory-body": Cl.none(),
        })
      );

      const { result: ukEngJurisdiction } = simnet.callReadOnlyFn(
        contractName,
        "get-jurisdiction-info", 
        [Cl.stringAscii("UK-ENG")],
        deployer
      );
      expect(ukEngJurisdiction).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("England and Wales"),
          "legal-system": Cl.stringAscii("common-law"),
          "compliance-requirements": Cl.stringAscii("UK-contract-law"),
          "is-supported": Cl.bool(true),
          "regulatory-body": Cl.none(),
        })
      );

      const { result: deJurisdiction } = simnet.callReadOnlyFn(
        contractName,
        "get-jurisdiction-info",
        [Cl.stringAscii("DE-BW")],
        deployer
      );
      expect(deJurisdiction).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Baden-Wurttemberg, Germany"),
          "legal-system": Cl.stringAscii("civil-law"),
          "compliance-requirements": Cl.stringAscii("BGB-compliant"),
          "is-supported": Cl.bool(true),
          "regulatory-body": Cl.none(),
        })
      );
    });

    it("should check jurisdiction support correctly", () => {
      // Test supported jurisdiction
      const { result: supportedJurisdiction } = simnet.callReadOnlyFn(
        contractName,
        "is-jurisdiction-supported",
        [Cl.stringAscii("US-NY")],
        deployer
      );
      expect(supportedJurisdiction).toBeBool(true);

      // Test unsupported jurisdiction
      const { result: unsupportedJurisdiction } = simnet.callReadOnlyFn(
        contractName,
        "is-jurisdiction-supported",
        [Cl.stringAscii("INVALID")],
        deployer
      );
      expect(unsupportedJurisdiction).toBeBool(false);
    });
  });

  describe("Contract Template Management", () => {
    it("should create a contract template successfully", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Employment Agreement"),
          Cl.stringAscii("employment"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("hash123456789"),
          Cl.stringAscii("standard")
        ],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("should fail to create template with invalid jurisdiction", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Invalid Template"),
          Cl.stringAscii("employment"),
          Cl.stringAscii("INVALID"),
          Cl.stringAscii("hash123456789"),
          Cl.stringAscii("standard")
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(403)); // ERR_INVALID_JURISDICTION
    });

    it("should retrieve created template correctly", () => {
      // First create a template
      simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Commercial Agreement"),
          Cl.stringAscii("commercial"),
          Cl.stringAscii("UK-ENG"),
          Cl.stringAscii("hash987654321"),
          Cl.stringAscii("premium")
        ],
        wallet1
      );

      // Then retrieve it
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-template",
        [Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Commercial Agreement"),
          category: Cl.stringAscii("commercial"),
          jurisdiction: Cl.stringAscii("UK-ENG"),
          creator: Cl.principal(wallet1),
          "template-hash": Cl.stringAscii("hash987654321"),
          "compliance-level": Cl.stringAscii("premium"),
          "usage-count": Cl.uint(0),
          "is-verified": Cl.bool(false),
          "created-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should return none for non-existent template", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-template",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("should increment template IDs correctly", () => {
      // Create first template
      const { result: firstTemplate } = simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Template 1"),
          Cl.stringAscii("category1"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("hash1"),
          Cl.stringAscii("standard")
        ],
        wallet1
      );
      expect(firstTemplate).toBeOk(Cl.uint(1));

      // Create second template
      const { result: secondTemplate } = simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Template 2"),
          Cl.stringAscii("category2"),
          Cl.stringAscii("DE-BW"),
          Cl.stringAscii("hash2"),
          Cl.stringAscii("premium")
        ],
        wallet2
      );
      expect(secondTemplate).toBeOk(Cl.uint(2));
    });
  });

  describe("Legal Contract Creation", () => {
    beforeEach(() => {
      // Create a template for testing contracts
      simnet.callPublicFn(
        contractName,
        "create-contract-template",
        [
          Cl.stringAscii("Test Template"),
          Cl.stringAscii("test"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("template-hash"),
          Cl.stringAscii("standard")
        ],
        wallet1
      );
    });

    it("should create a legal contract successfully", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;

      const { result } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1), // template-id
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000), // total-value
          Cl.uint(2) // required-signatures
        ],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("should fail with invalid template ID", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;

      const { result } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(999), // invalid template-id
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(402)); // ERR_CONTRACT_NOT_FOUND
    });

    it("should fail with invalid jurisdiction", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;

      const { result } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("INVALID"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(403)); // ERR_INVALID_JURISDICTION
    });

    it("should fail with past expiration date", () => {
      const parties = [wallet1, wallet2];
      const pastExpiration = simnet.blockHeight - 1;

      const { result } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(pastExpiration),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(405)); // ERR_CONTRACT_EXPIRED
    });

    it("should fail with more required signatures than parties", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;

      const { result } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000),
          Cl.uint(5) // More than number of parties
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(407)); // ERR_INSUFFICIENT_SIGNATURES
    });

    it("should retrieve created contract correctly", () => {
      const parties = [wallet1, wallet2, wallet3];
      const expiresAt = simnet.blockHeight + 1000;

      // Create contract
      simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("DE-BW"),
          Cl.stringAscii("commercial"),
          Cl.uint(expiresAt),
          Cl.stringAscii("unique-terms-hash"),
          Cl.stringAscii("https://metadata.example.com"),
          Cl.uint(100000),
          Cl.uint(2)
        ],
        wallet2
      );

      // Retrieve contract
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-legal-contract",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          "template-id": Cl.uint(1),
          creator: Cl.principal(wallet2),
          parties: Cl.list(parties.map(p => Cl.principal(p))),
          jurisdiction: Cl.stringAscii("DE-BW"),
          "contract-type": Cl.stringAscii("commercial"),
          "created-at": Cl.uint(simnet.blockHeight),
          "expires-at": Cl.uint(expiresAt),
          status: Cl.stringAscii("pending"),
          "terms-hash": Cl.stringAscii("unique-terms-hash"),
          "metadata-uri": Cl.stringAscii("https://metadata.example.com"),
          "total-value": Cl.uint(100000),
          "required-signatures": Cl.uint(2),
          "current-signatures": Cl.uint(0),
        })
      );
    });

    it("should update template usage count when contract is created", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;
      const initialBlockHeight = simnet.blockHeight;

      // Check initial usage count
      const { result: initialTemplate } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-template",
        [Cl.uint(1)],
        deployer
      );
      expect(initialTemplate).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Test Template"),
          category: Cl.stringAscii("test"),
          jurisdiction: Cl.stringAscii("US-NY"),
          creator: Cl.principal(wallet1),
          "template-hash": Cl.stringAscii("template-hash"),
          "compliance-level": Cl.stringAscii("standard"),
          "usage-count": Cl.uint(0),
          "is-verified": Cl.bool(false),
          "created-at": Cl.uint(initialBlockHeight),
        })
      );

      // Create contract
      simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-123"),
          Cl.stringAscii("https://example.com/metadata"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );

      // Check updated usage count
      const { result: updatedTemplate } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-template",
        [Cl.uint(1)],
        deployer
      );
      expect(updatedTemplate).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Test Template"),
          category: Cl.stringAscii("test"),
          jurisdiction: Cl.stringAscii("US-NY"),
          creator: Cl.principal(wallet1),
          "template-hash": Cl.stringAscii("template-hash"),
          "compliance-level": Cl.stringAscii("standard"),
          "usage-count": Cl.uint(1),
          "is-verified": Cl.bool(false),
          "created-at": Cl.uint(initialBlockHeight),
        })
      );
    });

    it("should increment contract IDs correctly", () => {
      const parties = [wallet1, wallet2];
      const expiresAt = simnet.blockHeight + 1000;

      // Create first contract
      const { result: firstContract } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-1"),
          Cl.stringAscii("https://example.com/metadata1"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );
      expect(firstContract).toBeOk(Cl.uint(1));

      // Create second contract
      const { result: secondContract } = simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(1),
          Cl.list(parties.map(p => Cl.principal(p))),
          Cl.stringAscii("UK-ENG"),
          Cl.stringAscii("commercial"),
          Cl.uint(expiresAt),
          Cl.stringAscii("terms-hash-2"),
          Cl.stringAscii("https://example.com/metadata2"),
          Cl.uint(75000),
          Cl.uint(2)
        ],
        wallet2
      );
      expect(secondContract).toBeOk(Cl.uint(2));
    });
  });

  describe("Legal Entity Registration", () => {
    it("should register legal entity successfully", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("corporation"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("REG123456789"),
          Cl.stringAscii("Example Corp LLC")
        ],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should fail with invalid jurisdiction", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("corporation"),
          Cl.stringAscii("INVALID"),
          Cl.stringAscii("REG123456789"),
          Cl.stringAscii("Example Corp LLC")
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(403)); // ERR_INVALID_JURISDICTION
    });

    it("should retrieve registered entity correctly", () => {
      // Register entity
      simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("partnership"),
          Cl.stringAscii("DE-BW"),
          Cl.stringAscii("REG987654321"),
          Cl.stringAscii("German Partnership GmbH")
        ],
        wallet2
      );

      // Retrieve entity
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-legal-entity",
        [Cl.principal(wallet2)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          "entity-type": Cl.stringAscii("partnership"),
          jurisdiction: Cl.stringAscii("DE-BW"),
          "registration-number": Cl.stringAscii("REG987654321"),
          "verified-at": Cl.uint(simnet.blockHeight),
          "is-verified": Cl.bool(false),
          "legal-name": Cl.stringAscii("German Partnership GmbH"),
        })
      );
    });

    it("should verify legal entity (only by contract owner)", () => {
      // Register entity first
      simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("llc"),
          Cl.stringAscii("UK-ENG"),
          Cl.stringAscii("REG111222333"),
          Cl.stringAscii("UK Limited Company")
        ],
        wallet3
      );

      // Verify by contract owner (deployer)
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-legal-entity",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check verification status
      const { result: entityResult } = simnet.callReadOnlyFn(
        contractName,
        "get-legal-entity",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(entityResult).toBeSome(
        Cl.tuple({
          "entity-type": Cl.stringAscii("llc"),
          jurisdiction: Cl.stringAscii("UK-ENG"),
          "registration-number": Cl.stringAscii("REG111222333"),
          "verified-at": Cl.uint(simnet.blockHeight),
          "is-verified": Cl.bool(true),
          "legal-name": Cl.stringAscii("UK Limited Company"),
        })
      );
    });

    it("should fail verification by non-owner", () => {
      // Register entity first
      simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("sole-prop"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("REG444555666"),
          Cl.stringAscii("Sole Proprietorship")
        ],
        wallet4
      );

      // Try to verify by non-owner
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-legal-entity",
        [Cl.principal(wallet4)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(401)); // ERR_UNAUTHORIZED
    });

    it("should return none for non-existent entity", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-legal-entity",
        [Cl.principal(wallet4)],
        deployer
      );
      expect(result).toBeNone();
    });
  });
});

describe("ChainLegal Digital Signatures & Compliance", () => {
  let contractId: number;
  let templateId: number;

  beforeEach(() => {
    // Create a template and contract for signature testing
    const templateResult = simnet.callPublicFn(
      contractName,
      "create-contract-template",
      [
        Cl.stringAscii("Signature Test Template"),
        Cl.stringAscii("employment"),
        Cl.stringAscii("US-NY"),
        Cl.stringAscii("template-hash-sig"),
        Cl.stringAscii("standard")
      ],
      wallet1
    );
    templateId = 1;

    const parties = [wallet1, wallet2, wallet3];
    const expiresAt = simnet.blockHeight + 1000;
    
    const contractResult = simnet.callPublicFn(
      contractName,
      "create-legal-contract",
      [
        Cl.uint(templateId),
        Cl.list(parties.map(p => Cl.principal(p))),
        Cl.stringAscii("US-NY"),
        Cl.stringAscii("employment"),
        Cl.uint(expiresAt),
        Cl.stringAscii("contract-terms-hash"),
        Cl.stringAscii("https://example.com/contract"),
        Cl.uint(75000),
        Cl.uint(2)
      ],
      wallet1
    );
    contractId = 1;
  });

  describe("Contract Signing", () => {
    it("should allow valid party to sign contract", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-hash-wallet1"),
          Cl.none()
        ],
        wallet1
      );
      expect(result).toBeOk(Cl.stringAscii("signature-recorded"));
    });

    it("should allow signing with witness", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-hash-wallet2"),
          Cl.some(Cl.principal(wallet4))
        ],
        wallet2
      );
      expect(result).toBeOk(Cl.stringAscii("signature-recorded"));
    });

    it("should prevent non-party from signing", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("invalid-signature"),
          Cl.none()
        ],
        wallet4 // Not a party to the contract
      );
      expect(result).toBeErr(Cl.uint(406)); // ERR_INVALID_PARTY
    });

    it("should prevent double signing by same party", () => {
      // First signature
      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("first-signature"),
          Cl.none()
        ],
        wallet1
      );

      // Attempt second signature
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("second-signature"),
          Cl.none()
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(404)); // ERR_CONTRACT_ALREADY_SIGNED
    });

    it("should prevent signing expired contract", () => {
      // Create contract with very short expiration
      const currentBlockHeight = simnet.blockHeight;
      simnet.callPublicFn(
        contractName,
        "create-legal-contract",
        [
          Cl.uint(templateId),
          Cl.list([Cl.principal(wallet1), Cl.principal(wallet2)]),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("employment"),
          Cl.uint(currentBlockHeight + 2), // Expires in 2 blocks
          Cl.stringAscii("expired-contract-terms"),
          Cl.stringAscii("https://example.com/expired"),
          Cl.uint(50000),
          Cl.uint(2)
        ],
        wallet1
      );
      const expiredContractId = 2;

      // Advance time to expire the contract
      simnet.mineEmptyBlocks(5);

      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(expiredContractId),
          Cl.stringAscii("too-late-signature"),
          Cl.none()
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(405)); // ERR_CONTRACT_EXPIRED
    });

    it("should finalize contract when all required signatures collected", () => {
      // First signature
      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-1"),
          Cl.none()
        ],
        wallet1
      );

      // Second signature should finalize
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-2"),
          Cl.none()
        ],
        wallet2
      );
      expect(result).toBeOk(Cl.stringAscii("contract-signed-and-finalized"));

      // Check contract status - focus on the key status fields
      const { result: statusResult } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-status",
        [Cl.uint(contractId)],
        deployer
      );
      
      // Verify the essential contract finalization data
      const status = statusResult as any;
      expect(status.data.status).toBeAscii("active");
      expect(status.data.signatures).toBeUint(2);
      expect(status.data["required-signatures"]).toBeUint(2);
      expect(status.data["is-compliant"].data["signatures-met"]).toBeBool(true);
      expect(status.data["is-compliant"].data["witness-requirement-met"]).toBeBool(true);
      expect(status.data["is-compliant"].data["notarization-requirement-met"]).toBeBool(true);
      expect(status.data["is-compliant"].data["value-limit-met"]).toBeBool(true);
    });

    it("should prevent signing non-existent contract", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(999), // Non-existent contract
          Cl.stringAscii("invalid-signature"),
          Cl.none()
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(402)); // ERR_CONTRACT_NOT_FOUND
    });
  });

  describe("Notarization", () => {
    beforeEach(() => {
      // Register a legal entity for notarization
      simnet.callPublicFn(
        contractName,
        "register-legal-entity",
        [
          Cl.stringAscii("notary"),
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("NOTARY123"),
          Cl.stringAscii("Professional Notary Services")
        ],
        wallet4
      );

      // Verify the notary entity
      simnet.callPublicFn(
        contractName,
        "verify-legal-entity",
        [Cl.principal(wallet4)],
        deployer
      );

      // Have wallet1 sign the contract first
      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-for-notarization"),
          Cl.none()
        ],
        wallet1
      );
    });

    it("should allow verified entity to notarize signature", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "notarize-signature",
        [
          Cl.uint(contractId),
          Cl.principal(wallet1)
        ],
        wallet4
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent unverified entity from notarizing", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "notarize-signature",
        [
          Cl.uint(contractId),
          Cl.principal(wallet1)
        ],
        wallet2 // Not a verified entity
      );
      expect(result).toBeErr(Cl.uint(401)); // ERR_UNAUTHORIZED
    });

    it("should prevent notarizing non-existent signature", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "notarize-signature",
        [
          Cl.uint(contractId),
          Cl.principal(wallet3) // wallet3 hasn't signed
        ],
        wallet4
      );
      expect(result).toBeErr(Cl.uint(402)); // ERR_CONTRACT_NOT_FOUND
    });
  });

  describe("Compliance Validation", () => {
    it("should check compliance for unsigned contract", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "check-compliance",
        [Cl.uint(contractId)],
        deployer
      );

      expect(result).toBeTuple({
        "signatures-met": Cl.bool(false),
        "witness-requirement-met": Cl.bool(true),
        "notarization-requirement-met": Cl.bool(true),
        "value-limit-met": Cl.bool(true),
      });
    });

    it("should check compliance for partially signed contract", () => {
      // Sign with one party
      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("partial-signature"),
          Cl.none()
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "check-compliance",
        [Cl.uint(contractId)],
        deployer
      );

      expect(result).toBeTuple({
        "signatures-met": Cl.bool(false), // Still needs one more signature
        "witness-requirement-met": Cl.bool(true),
        "notarization-requirement-met": Cl.bool(true),
        "value-limit-met": Cl.bool(true),
      });
    });

    it("should check compliance for fully signed contract", () => {
      // Sign with both required parties
      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-1"),
          Cl.none()
        ],
        wallet1
      );

      simnet.callPublicFn(
        contractName,
        "sign-contract",
        [
          Cl.uint(contractId),
          Cl.stringAscii("signature-2"),
          Cl.none()
        ],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "check-compliance",
        [Cl.uint(contractId)],
        deployer
      );

      expect(result).toBeTuple({
        "signatures-met": Cl.bool(true),
        "witness-requirement-met": Cl.bool(true),
        "notarization-requirement-met": Cl.bool(true),
        "value-limit-met": Cl.bool(true),
      });
    });

    it("should return default compliance for non-existent contract", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "check-compliance",
        [Cl.uint(999)],
        deployer
      );

      expect(result).toBeTuple({
        "signatures-met": Cl.bool(false),
        "witness-requirement-met": Cl.bool(false),
        "notarization-requirement-met": Cl.bool(false),
        "value-limit-met": Cl.bool(false),
      });
    });
  });

  describe("Arbitrator Management", () => {
    it("should register arbitrator successfully", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-arbitrator",
        [
          Cl.stringAscii("US-NY"),
          Cl.stringAscii("commercial-disputes"),
          Cl.stringAscii("arbitrator-cert-hash")
        ],
        wallet4
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should fail to register arbitrator with invalid jurisdiction", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "register-arbitrator",
        [
          Cl.stringAscii("INVALID"),
          Cl.stringAscii("commercial-disputes"),
          Cl.stringAscii("arbitrator-cert-hash")
        ],
        wallet4
      );
      expect(result).toBeErr(Cl.uint(403)); // ERR_INVALID_JURISDICTION
    });

    it("should allow contract owner to activate arbitrator", () => {
      // Register arbitrator first
      simnet.callPublicFn(
        contractName,
        "register-arbitrator",
        [
          Cl.stringAscii("UK-ENG"),
          Cl.stringAscii("employment-law"),
          Cl.stringAscii("uk-arbitrator-cert")
        ],
        wallet4
      );

      // Activate by contract owner
      const { result } = simnet.callPublicFn(
        contractName,
        "activate-arbitrator",
        [Cl.principal(wallet4)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-owner from activating arbitrator", () => {
      // Register arbitrator first
      simnet.callPublicFn(
        contractName,
        "register-arbitrator",
        [
          Cl.stringAscii("DE-BW"),
          Cl.stringAscii("contract-law"),
          Cl.stringAscii("de-arbitrator-cert")
        ],
        wallet4
      );

      // Try to activate by non-owner
      const { result } = simnet.callPublicFn(
        contractName,
        "activate-arbitrator",
        [Cl.principal(wallet4)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(401)); // ERR_UNAUTHORIZED
    });

    it("should fail to activate non-existent arbitrator", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "activate-arbitrator",
        [Cl.principal(wallet3)], // Not registered as arbitrator
        deployer
      );
      expect(result).toBeErr(Cl.uint(402)); // ERR_CONTRACT_NOT_FOUND
    });
  });

  describe("Platform Fee Management", () => {
    it("should allow contract owner to set platform fee", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee",
        [Cl.uint(500)], // 5%
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-owner from setting platform fee", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee",
        [Cl.uint(300)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(401)); // ERR_UNAUTHORIZED
    });

    it("should prevent setting excessive platform fee", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee",
        [Cl.uint(1500)], // 15% - exceeds 10% maximum
        deployer
      );
      expect(result).toBeErr(Cl.uint(401)); // ERR_UNAUTHORIZED
    });

    it("should allow setting platform fee at maximum limit", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-platform-fee",
        [Cl.uint(1000)], // 10% - at maximum
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });
  });
});

