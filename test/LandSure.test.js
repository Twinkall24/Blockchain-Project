/**
 * LandSure — LandSure.test.js
 * ─────────────────────────────────────────────────────────────────────────
 * Truffle automated test suite.
 * Run with: npx truffle test
 *
 * Tests cover:
 *  1. Deployment & constructor
 *  2. Role management
 *  3. Property registration
 *  4. Land details update
 *  5. Mortgage management
 *  6. Court hold management
 *  7. Property transfer workflow
 *  8. Document hash verification
 *  9. Negative / security tests (unauthorized access)
 *  10. Ownership history
 * ─────────────────────────────────────────────────────────────────────────
 */

const LandSure = artifacts.require("LandSure");
const crypto = require("crypto");

// Plain helper — avoids needing @openzeppelin/test-helpers
async function expectRevert(promise, expectedMsg) {
  try {
    await promise;
    assert.fail(`Expected revert with "${expectedMsg}" but transaction succeeded`);
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("assert.fail")) throw e; // re-throw our own assertion
    const hasMsg = msg.includes(expectedMsg);
    assert.ok(hasMsg, `Expected revert message "${expectedMsg}" but got: "${msg.substring(0, 300)}"`);
  }
}

function sha256hex(str) {
  return "0x" + crypto.createHash("sha256").update(str).digest("hex");
}

contract("LandSure", (accounts) => {
  const ADMIN      = accounts[0];
  const REVENUE    = accounts[1];
  const SURVEY     = accounts[2];
  const REGISTRAR  = accounts[3];
  const BANK       = accounts[4];
  const COURT      = accounts[5];
  const RAHUL      = accounts[6];
  const PRIYA      = accounts[7];
  const INTRUDER   = accounts[8];

  const PROP_ID    = "PROP101";
  const DOC_HASH   = sha256hex("deed_prop101");
  const ROLE       = { NONE:0, ADMIN:1, REVENUE:2, SURVEY:3, REGISTRAR:4, BANK:5, COURT:6, CITIZEN:7 };

  let contract;

  beforeEach(async () => {
    contract = await LandSure.new({ from: ADMIN });
    // Assign roles
    await contract.assignRole(REVENUE,   ROLE.REVENUE,   { from: ADMIN });
    await contract.assignRole(SURVEY,    ROLE.SURVEY,    { from: ADMIN });
    await contract.assignRole(REGISTRAR, ROLE.REGISTRAR, { from: ADMIN });
    await contract.assignRole(BANK,      ROLE.BANK,      { from: ADMIN });
    await contract.assignRole(COURT,     ROLE.COURT,     { from: ADMIN });
    await contract.assignRole(RAHUL,     ROLE.CITIZEN,   { from: ADMIN });
    await contract.assignRole(PRIYA,     ROLE.CITIZEN,   { from: ADMIN });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. DEPLOYMENT & CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────
  describe("1. Deployment & Constructor", () => {
    it("should set the deployer as admin", async () => {
      const adminAddr = await contract.admin();
      assert.equal(adminAddr, ADMIN, "Admin should be the deployer");
    });

    it("should assign ADMIN role to deployer", async () => {
      const role = await contract.roles(ADMIN);
      assert.equal(role.toNumber(), ROLE.ADMIN, "Deployer should have ADMIN role");
    });

    it("should return ADMIN for getRoleName of deployer", async () => {
      const name = await contract.getRoleName(ADMIN);
      assert.equal(name, "ADMIN");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ROLE MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  describe("2. Role Management", () => {
    it("should correctly assign roles to all departments", async () => {
      assert.equal((await contract.getRoleName(REVENUE)).toString(),   "REVENUE");
      assert.equal((await contract.getRoleName(SURVEY)).toString(),    "SURVEY");
      assert.equal((await contract.getRoleName(REGISTRAR)).toString(), "REGISTRAR");
      assert.equal((await contract.getRoleName(BANK)).toString(),      "BANK");
      assert.equal((await contract.getRoleName(COURT)).toString(),     "COURT");
      assert.equal((await contract.getRoleName(RAHUL)).toString(),     "CITIZEN");
    });

    it("should revert when non-admin tries to assign roles", async () => {
      await expectRevert(
        contract.assignRole(INTRUDER, ROLE.REVENUE, { from: INTRUDER }),
        "LandSure: Caller is not Admin"
      );
    });

    it("should revert when assigning NONE role", async () => {
      await expectRevert(
        contract.assignRole(INTRUDER, ROLE.NONE, { from: ADMIN }),
        "LandSure: Cannot assign NONE role"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. PROPERTY REGISTRATION
  // ─────────────────────────────────────────────────────────────
  describe("3. Property Registration", () => {
    it("should allow Revenue to register a property", async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.id, PROP_ID);
      assert.equal(p.owner, RAHUL);
      assert.equal(p.status, "REGISTERED");
      assert.equal(p.documentHash, DOC_HASH);
    });

    it("should revert when registering duplicate property ID", async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
      await expectRevert(
        contract.registerProperty(PROP_ID, "246/B", "Mumbai", "2000 sq.ft", PRIYA, DOC_HASH, { from: REVENUE }),
        "LandSure: Property already registered"
      );
    });

    it("should revert when non-Revenue tries to register", async () => {
      await expectRevert(
        contract.registerProperty(PROP_ID, "X", "X", "X", RAHUL, DOC_HASH, { from: INTRUDER }),
        "LandSure: Caller is not Revenue Dept"
      );
    });

    it("should increment total property count", async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
      const total = await contract.getTotalProperties();
      assert.equal(total.toNumber(), 1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. LAND DETAILS UPDATE
  // ─────────────────────────────────────────────────────────────
  describe("4. Land Details Update", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should allow Survey to update land details", async () => {
      await contract.updateLandDetails(PROP_ID, "245/A-VERIFIED", "1520 sq.ft", { from: SURVEY });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.surveyNumber, "245/A-VERIFIED");
      assert.equal(p.area, "1520 sq.ft");
    });

    it("should revert when non-Survey tries to update land details", async () => {
      await expectRevert(
        contract.updateLandDetails(PROP_ID, "X", "X", { from: INTRUDER }),
        "LandSure: Caller is not Survey Dept"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. MORTGAGE MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  describe("5. Mortgage Management", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should allow Bank to add mortgage", async () => {
      await contract.addMortgage(PROP_ID, "SBI-LOAN-001", { from: BANK });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.hasMortgage, true);
      assert.equal(p.mortgageRef, "SBI-LOAN-001");
    });

    it("should allow Bank to release mortgage", async () => {
      await contract.addMortgage(PROP_ID, "SBI-LOAN-001", { from: BANK });
      await contract.releaseMortgage(PROP_ID, { from: BANK });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.hasMortgage, false);
    });

    it("should revert adding duplicate mortgage", async () => {
      await contract.addMortgage(PROP_ID, "SBI-LOAN-001", { from: BANK });
      await expectRevert(
        contract.addMortgage(PROP_ID, "SBI-LOAN-002", { from: BANK }),
        "LandSure: Property already has an active mortgage"
      );
    });

    it("should revert releasing mortgage when none exists", async () => {
      await expectRevert(
        contract.releaseMortgage(PROP_ID, { from: BANK }),
        "LandSure: No active mortgage to release"
      );
    });

    it("should revert when non-Bank tries to add mortgage", async () => {
      await expectRevert(
        contract.addMortgage(PROP_ID, "FAKE-LOAN", { from: RAHUL }),
        "LandSure: Caller is not Bank"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. COURT HOLD MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  describe("6. Court Hold Management", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should allow Court to place a hold", async () => {
      await contract.placeCourtHold(PROP_ID, "ORDER-789", { from: COURT });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.hasCourtHold, true);
      assert.equal(p.courtOrderRef, "ORDER-789");
    });

    it("should allow Court to remove a hold", async () => {
      await contract.placeCourtHold(PROP_ID, "ORDER-789", { from: COURT });
      await contract.removeCourtHold(PROP_ID, { from: COURT });
      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.hasCourtHold, false);
    });

    it("should revert when non-Court places hold", async () => {
      await expectRevert(
        contract.placeCourtHold(PROP_ID, "FAKE", { from: INTRUDER }),
        "LandSure: Caller is not Court"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. PROPERTY TRANSFER WORKFLOW
  // ─────────────────────────────────────────────────────────────
  describe("7. Property Transfer Workflow", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should execute full transfer when all conditions are clear", async () => {
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      await contract.approveTransfer(PROP_ID, { from: REGISTRAR });
      await contract.executeTransfer(PROP_ID, { from: REGISTRAR });

      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.owner.toLowerCase(), PRIYA.toLowerCase(), "Priya should be new owner");
      assert.equal(p.status, "TRANSFERRED");
    });

    it("should block transfer when mortgage is active", async () => {
      await contract.addMortgage(PROP_ID, "SBI-001", { from: BANK });
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      const result = await contract.approveTransfer.call(PROP_ID, { from: REGISTRAR });
      assert.ok(result.startsWith("BLOCKED"), "Should be blocked due to mortgage");
    });

    it("should block transfer when court hold is active", async () => {
      await contract.placeCourtHold(PROP_ID, "HC-ORDER-555", { from: COURT });
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      const result = await contract.approveTransfer.call(PROP_ID, { from: REGISTRAR });
      assert.ok(result.startsWith("BLOCKED"), "Should be blocked due to court hold");
    });

    it("should allow transfer after mortgage is released", async () => {
      await contract.addMortgage(PROP_ID, "SBI-001", { from: BANK });
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });

      // Rejected due to mortgage
      await contract.rejectTransfer(PROP_ID, "Mortgage active", { from: REGISTRAR });

      // Bank clears mortgage
      await contract.releaseMortgage(PROP_ID, { from: BANK });

      // Retry transfer
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      await contract.approveTransfer(PROP_ID, { from: REGISTRAR });
      await contract.executeTransfer(PROP_ID, { from: REGISTRAR });

      const p = await contract.getProperty(PROP_ID);
      assert.equal(p.owner.toLowerCase(), PRIYA.toLowerCase());
    });

    it("should revert when non-owner initiates transfer", async () => {
      await expectRevert(
        contract.initiateTransfer(PROP_ID, PRIYA, { from: PRIYA }),
        "LandSure: Caller is not the property owner"
      );
    });

    it("should revert when wrong buyer tries to accept", async () => {
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await expectRevert(
        contract.acceptTransfer(PROP_ID, { from: INTRUDER }),
        "LandSure: Caller is not the designated buyer"
      );
    });

    it("should revert executing unapproved transfer", async () => {
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      await expectRevert(
        contract.executeTransfer(PROP_ID, { from: REGISTRAR }),
        "LandSure: Transfer not yet approved"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. DOCUMENT VERIFICATION
  // ─────────────────────────────────────────────────────────────
  describe("8. Document Verification", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should return match=true for correct document hash", async () => {
      const result = await contract.verifyDocument(PROP_ID, DOC_HASH);
      assert.equal(result.match_, true, "Hashes should match");
    });

    it("should return match=false for tampered document hash", async () => {
      const tamperedHash = sha256hex("tampered_deed");
      const result = await contract.verifyDocument(PROP_ID, tamperedHash);
      assert.equal(result.match_, false, "Tampered document should not match");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. TRANSFER ELIGIBILITY CHECK
  // ─────────────────────────────────────────────────────────────
  describe("9. Transfer Eligibility", () => {
    beforeEach(async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
    });

    it("should return eligible=true when property is clear", async () => {
      const r = await contract.checkTransferEligibility(PROP_ID);
      assert.equal(r.eligible, true);
    });

    it("should return eligible=false when mortgage is active", async () => {
      await contract.addMortgage(PROP_ID, "SBI-001", { from: BANK });
      const r = await contract.checkTransferEligibility(PROP_ID);
      assert.equal(r.eligible, false);
      assert.equal(r.mortgageClear, false);
    });

    it("should return eligible=false when court hold is active", async () => {
      await contract.placeCourtHold(PROP_ID, "HC-ORDER", { from: COURT });
      const r = await contract.checkTransferEligibility(PROP_ID);
      assert.equal(r.eligible, false);
      assert.equal(r.courtClear, false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. OWNERSHIP HISTORY
  // ─────────────────────────────────────────────────────────────
  describe("10. Ownership History", () => {
    it("should record complete transaction history", async () => {
      await contract.registerProperty(PROP_ID, "245/A", "Ahmedabad", "1500 sq.ft", RAHUL, DOC_HASH, { from: REVENUE });
      await contract.addMortgage(PROP_ID, "SBI-001", { from: BANK });
      await contract.releaseMortgage(PROP_ID, { from: BANK });
      await contract.initiateTransfer(PROP_ID, PRIYA, { from: RAHUL });
      await contract.acceptTransfer(PROP_ID, { from: PRIYA });
      await contract.approveTransfer(PROP_ID, { from: REGISTRAR });
      await contract.executeTransfer(PROP_ID, { from: REGISTRAR });

      const h = await contract.getPropertyHistory(PROP_ID);
      assert.ok(h.actions.length >= 6, "Should have at least 6 history entries");
      assert.include(h.actions, "PROPERTY_REGISTERED");
      assert.include(h.actions, "MORTGAGE_ADDED");
      assert.include(h.actions, "MORTGAGE_RELEASED");
      assert.include(h.actions, "TRANSFER_INITIATED");
      assert.include(h.actions, "TRANSFER_ACCEPTED_BY_BUYER");
      assert.include(h.actions, "OWNERSHIP_TRANSFERRED");
    });
  });
});
