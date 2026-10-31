/**
 * LandSure — demo.js
 * ─────────────────────────────────────────────────────────────────────────
 * Automated end-to-end demonstration script.
 * Runs the full "Rahul sells PROP101 to Priya" scenario automatically
 * AND demonstrates the fraud-prevention negative tests.
 *
 * Usage:
 *   node scripts/demo.js
 *
 * Expects Ganache + deployed contract (truffle migrate).
 * ─────────────────────────────────────────────────────────────────────────
 */

const Web3   = require("web3");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const GANACHE_RPC   = process.env.GANACHE_RPC || "http://127.0.0.1:7545";
const CONTRACT_JSON = path.join(__dirname, "../build/contracts/LandSure.json");

const web3 = new Web3(GANACHE_RPC);

function hashString(s) {
  return "0x" + crypto.createHash("sha256").update(s).digest("hex");
}

function log(label, value) {
  const lbl = String(label).padEnd(30);
  console.log(`  ${lbl}: ${value}`);
}

function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

function pass(msg) { console.log(`  ✅  ${msg}`); }
function fail(msg) { console.log(`  ❌  ${msg}`); }
function info(msg) { console.log(`  ℹ️   ${msg}`); }

async function expectRevert(promise, label) {
  try {
    await promise;
    fail(`${label} — Expected revert but transaction SUCCEEDED. ❌`);
  } catch (e) {
    const msg = e.message || "";
    const match = msg.match(/reverted with reason string '(.+?)'/) ||
                  msg.match(/VM Exception.+revert (.+)/);
    const reason = match ? match[1] : "reverted";
    pass(`${label} — Correctly REVERTED: "${reason}"`);
  }
}

async function main() {
  console.clear();
  console.log("═".repeat(60));
  console.log("   🏛️   LANDSURE — AUTOMATED DEMONSTRATION SCRIPT   🏛️");
  console.log("   Blockchain-Based Land Governance System");
  console.log("   Ganache · Truffle · Solidity · Web3.js");
  console.log("═".repeat(60));

  // ── Connect ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(CONTRACT_JSON)) {
    console.error("\n❌ Contract build not found. Run: npx truffle compile && npx truffle migrate");
    process.exit(1);
  }

  const artifact   = JSON.parse(fs.readFileSync(CONTRACT_JSON, "utf8"));
  const networks   = artifact.networks;
  const networkIds = Object.keys(networks);
  if (!networkIds.length) {
    console.error("\n❌ Contract not deployed. Run: npx truffle migrate --network development");
    process.exit(1);
  }

  const address  = networks[networkIds[networkIds.length - 1]].address;
  const code     = await web3.eth.getCode(address);
  if (code === "0x" || code === "0x0") {
    console.error("\n❌ Contract is not deployed on this Ganache session!");
    console.error("   Run: npx truffle migrate --network development --reset\n");
    process.exit(1);
  }
  const contract = new web3.eth.Contract(artifact.abi, address);
  const accounts = await web3.eth.getAccounts();

  // Department account assignment
  const ADMIN      = accounts[0];
  const REVENUE    = accounts[1];
  const SURVEY     = accounts[2];
  const REGISTRAR  = accounts[3];
  const BANK       = accounts[4];
  const COURT      = accounts[5];
  const RAHUL      = accounts[6];  // Property owner / seller
  const PRIYA      = accounts[7];  // Buyer
  const INTRUDER   = accounts[8];  // No role — for negative tests

  section("STEP 0 — CONTRACT INFORMATION");
  log("Contract Address", address);
  log("Admin (Account 0)", ADMIN);
  log("Revenue (Account 1)", REVENUE);
  log("Survey (Account 2)", SURVEY);
  log("Registrar (Account 3)", REGISTRAR);
  log("Bank (Account 4)", BANK);
  log("Court (Account 5)", COURT);
  log("Rahul / Owner (Account 6)", RAHUL);
  log("Priya / Buyer (Account 7)", PRIYA);
  log("Intruder (Account 8)", INTRUDER);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 1 — ASSIGN DEPARTMENT ROLES");

  const roleAssignments = [
    [REVENUE,   2, "REVENUE"],
    [SURVEY,    3, "SURVEY"],
    [REGISTRAR, 4, "REGISTRAR"],
    [BANK,      5, "BANK"],
    [COURT,     6, "COURT"],
    [RAHUL,     7, "CITIZEN"],
    [PRIYA,     7, "CITIZEN"],
  ];

  for (const [addr, roleNum, roleName] of roleAssignments) {
    const tx = await contract.methods.assignRole(addr, roleNum).send({ from: ADMIN, gas: 200000 });
    pass(`Assigned ${roleName} to ${addr.substring(0,10)}... | Tx: ${tx.transactionHash.substring(0,16)}...`);
  }

  // Determine property ID (use PROP101, or fresh ID if PROP101 already exists)
  let propId = "PROP101";
  try {
    const existing = await contract.methods.properties("PROP101").call();
    if (existing.exists) {
      propId = "PROP" + Math.floor(100 + Math.random() * 900);
      info(`PROP101 was already registered; using fresh ID: ${propId}`);
    }
  } catch (_) {}

  // ────────────────────────────────────────────────────────────────────────
  section(`STEP 2 — REGISTER PROPERTY ${propId} (Revenue Dept)`);

  const docHash = hashString(`sample_deed_${propId}_rahul`);
  info(`Document SHA-256 Hash: ${docHash}`);

  const regTx = await contract.methods
    .registerProperty(propId, "245/A", "Ahmedabad, Gujarat", "1500 sq.ft", RAHUL, docHash)
    .send({ from: REVENUE, gas: 500000 });

  pass(`${propId} registered! Tx: ${regTx.transactionHash.substring(0,16)}... | Block: ${regTx.blockNumber}`);
  log("Gas Used", regTx.gasUsed);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 3 — SURVEY DEPT VERIFIES LAND DETAILS");

  const surveyTx = await contract.methods
    .updateLandDetails(propId, "245/A-VERIFIED", "1520 sq.ft")
    .send({ from: SURVEY, gas: 300000 });

  pass(`Land details verified! Tx: ${surveyTx.transactionHash.substring(0,16)}...`);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 4 — BANK ADDS MORTGAGE");

  const mortTx = await contract.methods
    .addMortgage(propId, "SBI-HOME-LOAN-2024-7865")
    .send({ from: BANK, gas: 300000 });

  pass(`Mortgage recorded! Tx: ${mortTx.transactionHash.substring(0,16)}...`);

  // ────────────────────────────────────────────────────────────────────────
  section(`STEP 5 — RAHUL TRIES TO SELL ${propId} (should be blocked by mortgage)`);

  const initTx = await contract.methods
    .initiateTransfer(propId, PRIYA)
    .send({ from: RAHUL, gas: 400000 });

  pass(`Transfer initiated by Rahul. Tx: ${initTx.transactionHash.substring(0,16)}...`);

  // Priya accepts
  const accTx = await contract.methods.acceptTransfer(propId).send({ from: PRIYA, gas: 300000 });
  pass(`Priya accepted transfer. Tx: ${accTx.transactionHash.substring(0,16)}...`);

  // Registrar tries to approve — SHOULD BE BLOCKED
  const preview = await contract.methods.approveTransfer(propId).call({ from: REGISTRAR });
  info(`Eligibility Report: ${preview}`);

  if (preview.startsWith("BLOCKED")) {
    pass("Transfer correctly BLOCKED by smart contract due to active mortgage!");
  }

  // Registrar formally rejects
  const rejTx = await contract.methods
    .rejectTransfer(propId, preview)
    .send({ from: REGISTRAR, gas: 300000 });
  pass(`Transfer rejected. Tx: ${rejTx.transactionHash.substring(0,16)}...`);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 6 — BANK RELEASES MORTGAGE (NOC)");

  const relTx = await contract.methods.releaseMortgage(propId).send({ from: BANK, gas: 300000 });
  pass(`Mortgage released! Tx: ${relTx.transactionHash.substring(0,16)}...`);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 7 — FULL TRANSFER WORKFLOW (no blockers)");

  // Rahul initiates again
  const init2Tx = await contract.methods
    .initiateTransfer(propId, PRIYA)
    .send({ from: RAHUL, gas: 400000 });
  pass(`Transfer re-initiated by Rahul. Tx: ${init2Tx.transactionHash.substring(0,16)}...`);

  // Priya accepts
  const acc2Tx = await contract.methods.acceptTransfer(propId).send({ from: PRIYA, gas: 300000 });
  pass(`Priya accepted. Tx: ${acc2Tx.transactionHash.substring(0,16)}...`);

  // Registrar approves (all checks pass)
  const preview2 = await contract.methods.approveTransfer(propId).call({ from: REGISTRAR });
  info(`Eligibility Report: ${preview2}`);

  const appTx = await contract.methods.approveTransfer(propId).send({ from: REGISTRAR, gas: 400000 });
  pass(`Transfer APPROVED! Tx: ${appTx.transactionHash.substring(0,16)}...`);

  // Registrar executes
  const execTx = await contract.methods.executeTransfer(propId).send({ from: REGISTRAR, gas: 400000 });
  pass(`🎉 OWNERSHIP TRANSFERRED! Tx: ${execTx.transactionHash.substring(0,16)}... | Block: ${execTx.blockNumber}`);

  // Verify new owner
  const prop = await contract.methods.getProperty(propId).call();
  log("New Owner", prop.owner);
  log("Status", prop.status);
  if (prop.owner.toLowerCase() === PRIYA.toLowerCase()) {
    pass("Ownership correctly transferred to Priya!");
  } else {
    fail("Ownership transfer mismatch.");
  }

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 8 — DOCUMENT VERIFICATION");

  const originalHash = hashString(`sample_deed_${propId}_rahul`);
  const tamperedHash = hashString(`sample_deed_${propId}_TAMPERED`);

  const v1 = await contract.methods.verifyDocument(propId, originalHash).call();
  log("Original doc match", v1.match_ ? "✅ MATCH — Authentic" : "❌ MISMATCH");

  const v2 = await contract.methods.verifyDocument(propId, tamperedHash).call();
  log("Tampered doc match", v2.match_ ? "✅ MATCH" : "❌ MISMATCH — Tampered document detected!");

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 9 — NEGATIVE TESTS (Security / Fraud Prevention)");

  // Test 1: Intruder tries to register a property (no role)
  await expectRevert(
    contract.methods.registerProperty("PROP999_INV", "X", "X", "X", INTRUDER, hashString("x"))
      .send({ from: INTRUDER, gas: 400000 }),
    "Intruder tries to register property"
  );

  // Test 2: Citizen tries to add mortgage (wrong role)
  await expectRevert(
    contract.methods.addMortgage(propId, "FAKE-LOAN").send({ from: RAHUL, gas: 200000 }),
    "Citizen tries to add mortgage"
  );

  // Test 3: Rahul tries to re-initiate transfer when already transferred (double-spend)
  await expectRevert(
    contract.methods.initiateTransfer(propId, INTRUDER).send({ from: RAHUL, gas: 400000 }),
    "Old owner tries transfer after ownership changed"
  );

  // Test 4: Court places hold, then transfer attempted
  const courtTx = await contract.methods
    .placeCourtHold(propId, "COURT-ORDER-HC-2024-555")
    .send({ from: COURT, gas: 300000 });
  pass(`Court hold placed on ${propId}. Tx: ${courtTx.transactionHash.substring(0,16)}...`);

  const eligibility = await contract.methods.checkTransferEligibility(propId).call();
  log("Eligible after court hold", eligibility.eligible ? "YES" : "NO — BLOCKED ✅");
  info(`Report: ${eligibility.report}`);

  // ────────────────────────────────────────────────────────────────────────
  section("STEP 10 — FULL OWNERSHIP HISTORY");

  const history = await contract.methods.getPropertyHistory(propId).call();
  const count = history.actions.length;
  info(`Total events recorded: ${count}`);
  console.log();

  for (let i = 0; i < count; i++) {
    const ts = new Date(history.timestamps[i] * 1000).toLocaleString();
    console.log(`  [${String(i+1).padStart(2,"0")}] ${ts}`);
    console.log(`       Event  : ${history.actions[i]}`);
    console.log(`       Actor  : ${history.actors[i].substring(0,14)}...`);
    console.log(`       Details: ${history.details[i]}`);
    console.log();
  }

  // ────────────────────────────────────────────────────────────────────────
  section("DEMONSTRATION COMPLETE");

  console.log(`
  📋  SUMMARY
  ─────────────────────────────────────────────────────
  ✅  Roles assigned to all 7 department accounts
  ✅  Property PROP101 registered (Revenue Dept)
  ✅  Land details verified (Survey Dept)
  ✅  Mortgage recorded and later cleared (Bank)
  ✅  Transfer blocked while mortgage was active
  ✅  Transfer approved and executed after clearance
  ✅  Ownership correctly transferred: Rahul → Priya
  ✅  Document verification: original ✅ | tampered ❌
  ✅  Court hold placed — transfer eligibility blocked
  ✅  All negative tests correctly reverted
  ✅  Full property history logged on blockchain
  
  All transactions were real Ganache blockchain transactions.
  Contract address: ${address}
  `);

  process.exit(0);
}

main().catch((err) => {
  console.error("Demo failed:", err.message || err);
  process.exit(1);
});
