/**
 * LandSure CLI — interact.js
 * ─────────────────────────────────────────────────────────────────────────
 * Menu-driven Node.js CLI that talks directly to the LandSure smart contract
 * deployed on Ganache.  Every option that modifies state sends a real
 * blockchain transaction.  View-only options use .call() and cost no gas.
 *
 * Usage:
 *   node scripts/interact.js
 *
 * Requirements:
 *   • Ganache Desktop running on 127.0.0.1:7545
 *   • Contract already deployed: npx truffle migrate --network development
 *   • CONTRACT_ADDRESS set in this file (or via CONTRACT_ADDRESS env var)
 * ─────────────────────────────────────────────────────────────────────────
 */

const Web3   = require("web3");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const readline = require("readline");

// ── Configuration ──────────────────────────────────────────────────────────
const GANACHE_RPC    = process.env.GANACHE_RPC    || "http://127.0.0.1:7545";
const CONTRACT_JSON  = path.join(__dirname, "../build/contracts/LandSure.json");

// ── Helpers ───────────────────────────────────────────────────────────────
const web3 = new Web3(GANACHE_RPC);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

// Role enum values (must match Solidity)
const ROLE = { NONE:0, ADMIN:1, REVENUE:2, SURVEY:3, REGISTRAR:4, BANK:5, COURT:6, CITIZEN:7 };

let contract;
let accounts;
let currentAccount;

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function init() {
  if (!fs.existsSync(CONTRACT_JSON)) {
    console.error("\n❌  build/contracts/LandSure.json not found.");
    console.error("   Run: npx truffle compile && npx truffle migrate --network development\n");
    process.exit(1);
  }

  const artifact   = JSON.parse(fs.readFileSync(CONTRACT_JSON, "utf8"));
  const abi        = artifact.abi;
  const networks   = artifact.networks;
  const networkIds = Object.keys(networks);

  if (networkIds.length === 0) {
    console.error("\n❌  Contract not yet deployed. Run: npx truffle migrate --network development\n");
    process.exit(1);
  }

  const networkId = networkIds[networkIds.length - 1];
  const address   = networks[networkId].address;

  const code = await web3.eth.getCode(address);
  if (code === "0x" || code === "0x0") {
    console.error("\n❌ Contract is not deployed on this Ganache session!");
    console.error("   Run: npx truffle migrate --network development --reset\n");
    process.exit(1);
  }

  contract = new web3.eth.Contract(abi, address);

  accounts = await web3.eth.getAccounts();
  currentAccount = accounts[0]; // default: Admin

  console.log("\n✅  Connected to Ganache:", GANACHE_RPC);
  console.log("✅  Contract at:", address);
  console.log("✅  Accounts available:", accounts.length);
}

// ── Utility functions ─────────────────────────────────────────────────────
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return "0x" + crypto.createHash("sha256").update(content).digest("hex");
}

function hashString(str) {
  return "0x" + crypto.createHash("sha256").update(str).digest("hex");
}

function printBanner() {
  console.clear();
  console.log("═══════════════════════════════════════════════════");
  console.log("              🏛️  LAND SURE  🏛️                    ");
  console.log("   Blockchain-Based Land Governance System         ");
  console.log("   Smart-Contract: Ganache + Truffle + Web3.js     ");
  console.log("═══════════════════════════════════════════════════");
}

async function printCurrentUser() {
  const role = await contract.methods.getRoleName(currentAccount).call();
  const bal  = web3.utils.fromWei(await web3.eth.getBalance(currentAccount), "ether");
  console.log(`\n👤  Current Account : ${currentAccount}`);
  console.log(`🎭  Role            : ${role}`);
  console.log(`💰  ETH Balance     : ${parseFloat(bal).toFixed(4)} ETH`);
  console.log("───────────────────────────────────────────────────");
}

function printMenu() {
  console.log(`
  ── ROLE MANAGEMENT ─────────────────────────────
  1.  Assign Department Role
  2.  View My Role

  ── PROPERTY OPERATIONS ─────────────────────────
  3.  Register Property         [Revenue]
  4.  Update Land Details       [Survey]
  5.  View Property Details     [Anyone]
  6.  Check Transfer Eligibility[Anyone]

  ── MORTGAGE & COURT ────────────────────────────
  7.  Add Mortgage              [Bank]
  8.  Release Mortgage          [Bank]
  9.  Place Court Hold          [Court]
  10. Remove Court Hold         [Court]

  ── PROPERTY TRANSFER ───────────────────────────
  11. Initiate Transfer         [Owner]
  12. Accept Transfer           [Buyer]
  13. Approve Transfer          [Registrar]
  14. Execute Transfer          [Registrar]
  15. Reject Transfer           [Registrar]

  ── DOCUMENT VERIFICATION ───────────────────────
  16. Store Document Hash       [Authorized Dept]
  17. Verify Document           [Anyone]
  18. Hash a Local File         [Utility]

  ── HISTORY & ACCOUNTS ──────────────────────────
  19. View Property History     [Anyone]
  20. Switch Account
  21. List All Ganache Accounts

  0.  Exit
`);
}

// ── Menu Handlers ──────────────────────────────────────────────────────────

// 1. Assign Role
async function assignRole() {
  console.log("\n── ASSIGN DEPARTMENT ROLE ──────────────────────────");
  console.log("Available accounts:");
  for (let i = 0; i < accounts.length; i++) {
    const r = await contract.methods.getRoleName(accounts[i]).call();
    console.log(`  [${i}] ${accounts[i]}  →  ${r}`);
  }
  const idx  = parseInt(await ask("\nEnter account index to assign role to: "));
  console.log("\nRole options:");
  console.log("  1=ADMIN | 2=REVENUE | 3=SURVEY | 4=REGISTRAR | 5=BANK | 6=COURT | 7=CITIZEN");
  const roleNum = parseInt(await ask("Enter role number: "));

  if (isNaN(idx) || idx < 0 || idx >= accounts.length) { console.log("❌ Invalid index."); return; }
  if (isNaN(roleNum) || roleNum < 1 || roleNum > 7)     { console.log("❌ Invalid role."); return; }

  try {
    const tx = await contract.methods.assignRole(accounts[idx], roleNum).send({
      from: currentAccount, gas: 200000
    });
    console.log(`\n✅  Role assigned successfully!`);
    console.log(`   Tx Hash: ${tx.transactionHash}`);
    console.log(`   Gas Used: ${tx.gasUsed}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 2. View My Role
async function viewRole() {
  console.log("\n── MY ROLE ─────────────────────────────────────────");
  const role = await contract.methods.getRoleName(currentAccount).call();
  console.log(`   Account : ${currentAccount}`);
  console.log(`   Role    : ${role}`);
}

// 3. Register Property
async function registerProperty() {
  console.log("\n── REGISTER PROPERTY ───────────────────────────────");
  const propId  = await ask("Property ID (e.g. PROP101): ");
  const survey  = await ask("Survey Number (e.g. 245/A): ");
  const loc     = await ask("Location (e.g. Ahmedabad, Gujarat): ");
  const area    = await ask("Area (e.g. 1500 sq.ft): ");

  console.log("\nOwner account index:");
  for (let i = 0; i < accounts.length; i++) {
    const r = await contract.methods.getRoleName(accounts[i]).call();
    console.log(`  [${i}] ${accounts[i]}  (${r})`);
  }
  const ownerIdx = parseInt(await ask("Enter owner account index: "));

  const useFile = (await ask("Hash from file? (y/n): ")).trim().toLowerCase() === "y";
  let docHash;
  if (useFile) {
    const fp = await ask("Enter file path: ");
    if (!fs.existsSync(fp)) { console.log("❌ File not found."); return; }
    docHash = hashFile(fp);
    console.log(`   Computed SHA-256: ${docHash}`);
  } else {
    const label = await ask("Enter document label to hash (e.g. sale_deed_prop101): ");
    docHash = hashString(label);
    console.log(`   Computed SHA-256: ${docHash}`);
  }

  try {
    const tx = await contract.methods
      .registerProperty(propId, survey, loc, area, accounts[ownerIdx], docHash)
      .send({ from: currentAccount, gas: 500000 });
    console.log(`\n✅  Property ${propId} registered successfully!`);
    console.log(`   Tx Hash : ${tx.transactionHash}`);
    console.log(`   Block   : ${tx.blockNumber}`);
    console.log(`   Gas Used: ${tx.gasUsed}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 4. Update Land Details
async function updateLandDetails() {
  console.log("\n── UPDATE LAND DETAILS ─────────────────────────────");
  const propId    = await ask("Property ID: ");
  const survey    = await ask("New Survey Number: ");
  const area      = await ask("New Area: ");

  try {
    const tx = await contract.methods
      .updateLandDetails(propId, survey, area)
      .send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Land details updated!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 5. View Property Details
async function viewProperty() {
  console.log("\n── VIEW PROPERTY DETAILS ───────────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const p = await contract.methods.getProperty(propId).call();
    console.log("\n┌─────────────────────────────────────────────────┐");
    console.log(`│  PROPERTY VERIFICATION REPORT                   │`);
    console.log(`├─────────────────────────────────────────────────┤`);
    console.log(`│  ID           : ${p.id}`);
    console.log(`│  Survey No.   : ${p.surveyNumber}`);
    console.log(`│  Location     : ${p.location}`);
    console.log(`│  Area         : ${p.area}`);
    console.log(`│  Owner        : ${p.owner}`);
    console.log(`│  Status       : ${p.status}`);
    console.log(`│  Mortgage     : ${p.hasMortgage ? "⚠️  ACTIVE (" + p.mortgageRef + ")" : "✅ CLEAR"}`);
    console.log(`│  Court Hold   : ${p.hasCourtHold ? "⚠️  ACTIVE (" + p.courtOrderRef + ")" : "✅ NONE"}`);
    console.log(`│  Doc Hash     : ${p.documentHash}`);
    console.log(`│  Registered   : ${new Date(p.registeredAt * 1000).toLocaleString()}`);
    console.log("└─────────────────────────────────────────────────┘");
  } catch (e) {
    console.log("\n❌  Error:", extractError(e));
  }
}

// 6. Check Transfer Eligibility
async function checkEligibility() {
  console.log("\n── TRANSFER ELIGIBILITY CHECK ──────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const r = await contract.methods.checkTransferEligibility(propId).call();
    console.log("\n┌─────────────────────────────────────────────────┐");
    console.log("│  TRANSFER ELIGIBILITY REPORT                    │");
    console.log("├─────────────────────────────────────────────────┤");
    console.log(`│  Ownership Verified : ${r.ownershipVerified ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`│  Mortgage Clear     : ${r.mortgageClear     ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`│  Court Clear        : ${r.courtClear        ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`│  Overall Eligible   : ${r.eligible          ? "✅ YES"  : "❌ NO"}`);
    console.log(`├─────────────────────────────────────────────────┤`);
    console.log(`│  ${r.report}`);
    console.log("└─────────────────────────────────────────────────┘");
  } catch (e) {
    console.log("\n❌  Error:", extractError(e));
  }
}

// 7. Add Mortgage
async function addMortgage() {
  console.log("\n── ADD MORTGAGE ────────────────────────────────────");
  const propId = await ask("Property ID: ");
  const ref    = await ask("Mortgage Reference (e.g. SBI-LOAN-2024): ");

  try {
    const tx = await contract.methods.addMortgage(propId, ref).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Mortgage recorded!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 8. Release Mortgage
async function releaseMortgage() {
  console.log("\n── RELEASE MORTGAGE ────────────────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const tx = await contract.methods.releaseMortgage(propId).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Mortgage released (NOC issued)!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 9. Place Court Hold
async function placeCourtHold() {
  console.log("\n── PLACE COURT HOLD ────────────────────────────────");
  const propId = await ask("Property ID: ");
  const ref    = await ask("Court Order Reference (e.g. COURT-ORDER-789): ");

  try {
    const tx = await contract.methods.placeCourtHold(propId, ref).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Court hold placed!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 10. Remove Court Hold
async function removeCourtHold() {
  console.log("\n── REMOVE COURT HOLD ───────────────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const tx = await contract.methods.removeCourtHold(propId).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Court hold removed!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 11. Initiate Transfer
async function initiateTransfer() {
  console.log("\n── INITIATE TRANSFER ───────────────────────────────");
  const propId = await ask("Property ID: ");

  console.log("\nBuyer account index:");
  for (let i = 0; i < accounts.length; i++) {
    const r = await contract.methods.getRoleName(accounts[i]).call();
    console.log(`  [${i}] ${accounts[i]}  (${r})`);
  }
  const buyerIdx = parseInt(await ask("Enter buyer account index: "));

  try {
    const tx = await contract.methods
      .initiateTransfer(propId, accounts[buyerIdx])
      .send({ from: currentAccount, gas: 400000 });
    console.log(`\n✅  Transfer initiated!  Tx: ${tx.transactionHash}`);
    console.log(`   Next step: buyer must accept (option 12)`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 12. Accept Transfer (Buyer)
async function acceptTransfer() {
  console.log("\n── ACCEPT TRANSFER (BUYER) ─────────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const tx = await contract.methods.acceptTransfer(propId).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Transfer accepted by buyer!  Tx: ${tx.transactionHash}`);
    console.log(`   Next step: Registrar must approve (option 13)`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 13. Approve Transfer (Registrar)
async function approveTransfer() {
  console.log("\n── APPROVE TRANSFER (REGISTRAR) ────────────────────");
  const propId = await ask("Property ID: ");

  try {
    // approveTransfer returns a string report — use .call() first to preview
    const preview = await contract.methods.approveTransfer(propId).call({ from: currentAccount });
    console.log(`\n📋  Eligibility Report: ${preview}`);

    if (preview.startsWith("APPROVED")) {
      const confirm = (await ask("\nSend approval transaction? (y/n): ")).trim().toLowerCase();
      if (confirm === "y") {
        const tx = await contract.methods.approveTransfer(propId).send({ from: currentAccount, gas: 400000 });
        console.log(`\n✅  Transfer approved!  Tx: ${tx.transactionHash}`);
        console.log(`   Next step: Execute transfer (option 14)`);
      } else {
        console.log("   Cancelled.");
      }
    } else {
      console.log("   Transfer cannot be approved due to above reason.");
      const reject = (await ask("Auto-reject? (y/n): ")).trim().toLowerCase();
      if (reject === "y") {
        const tx = await contract.methods.rejectTransfer(propId, preview).send({ from: currentAccount, gas: 300000 });
        console.log(`\n❌  Transfer rejected.  Tx: ${tx.transactionHash}`);
      }
    }
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 14. Execute Transfer (Registrar)
async function executeTransfer() {
  console.log("\n── EXECUTE TRANSFER (REGISTRAR) ────────────────────");
  const propId = await ask("Property ID: ");

  // show current pending transfer
  try {
    const tr = await contract.methods.getPendingTransfer(propId).call();
    console.log(`\n   Seller   : ${tr.seller}`);
    console.log(`   Buyer    : ${tr.buyer}`);
    console.log(`   Approved : ${tr.registrarApproved}`);
    console.log(`   Active   : ${tr.active}`);

    const confirm = (await ask("\nProceed with execution? (y/n): ")).trim().toLowerCase();
    if (confirm !== "y") { console.log("   Cancelled."); return; }

    const tx = await contract.methods.executeTransfer(propId).send({ from: currentAccount, gas: 400000 });
    console.log(`\n🎉  OWNERSHIP TRANSFERRED SUCCESSFULLY!`);
    console.log(`   Tx Hash : ${tx.transactionHash}`);
    console.log(`   Block   : ${tx.blockNumber}`);
    console.log(`   Gas Used: ${tx.gasUsed}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 15. Reject Transfer (Registrar)
async function rejectTransfer() {
  console.log("\n── REJECT TRANSFER (REGISTRAR) ─────────────────────");
  const propId = await ask("Property ID: ");
  const reason = await ask("Rejection reason: ");

  try {
    const tx = await contract.methods.rejectTransfer(propId, reason).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Transfer rejected.  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 16. Store Document Hash
async function storeDocumentHash() {
  console.log("\n── STORE DOCUMENT HASH ─────────────────────────────");
  const propId  = await ask("Property ID: ");
  const useFile = (await ask("Hash from file? (y/n): ")).trim().toLowerCase() === "y";
  let docHash;
  if (useFile) {
    const fp = await ask("File path: ");
    if (!fs.existsSync(fp)) { console.log("❌ File not found."); return; }
    docHash = hashFile(fp);
  } else {
    const label = await ask("Document label to hash: ");
    docHash = hashString(label);
  }
  console.log(`   SHA-256: ${docHash}`);

  try {
    const tx = await contract.methods.updateDocumentHash(propId, docHash).send({ from: currentAccount, gas: 300000 });
    console.log(`\n✅  Document hash stored!  Tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log("\n❌  Transaction failed:", extractError(e));
  }
}

// 17. Verify Document
async function verifyDocument() {
  console.log("\n── VERIFY DOCUMENT ─────────────────────────────────");
  const propId  = await ask("Property ID: ");
  const useFile = (await ask("Hash from file? (y/n): ")).trim().toLowerCase() === "y";
  let docHash;
  if (useFile) {
    const fp = await ask("File path: ");
    if (!fs.existsSync(fp)) { console.log("❌ File not found."); return; }
    docHash = hashFile(fp);
  } else {
    const label = await ask("Document label to hash: ");
    docHash = hashString(label);
  }
  console.log(`   Computed SHA-256: ${docHash}`);

  try {
    const result = await contract.methods.verifyDocument(propId, docHash).call();
    console.log(`\n┌─────────────────────────────────────────────────┐`);
    console.log(`│  DOCUMENT VERIFICATION RESULT                   │`);
    console.log(`├─────────────────────────────────────────────────┤`);
    console.log(`│  Uploaded Hash  : ${docHash.substring(0, 42)}...`);
    console.log(`│  Stored Hash    : ${result.storedHash.substring(0, 42)}...`);
    console.log(`│  Result         : ${result.match_ ? "✅ MATCH — Document is authentic" : "❌ MISMATCH — Document may be tampered"}`);
    console.log(`└─────────────────────────────────────────────────┘`);
  } catch (e) {
    console.log("\n❌  Error:", extractError(e));
  }
}

// 18. Hash a Local File
async function hashLocalFile() {
  console.log("\n── HASH LOCAL FILE ─────────────────────────────────");
  const fp = await ask("Enter file path: ");
  if (!fs.existsSync(fp)) { console.log("❌ File not found."); return; }
  const h = hashFile(fp);
  console.log(`\n   File      : ${fp}`);
  console.log(`   SHA-256   : ${h}`);
  console.log(`   (Use this bytes32 value when registering or verifying)`);
}

// 19. View Property History
async function viewHistory() {
  console.log("\n── PROPERTY OWNERSHIP HISTORY ──────────────────────");
  const propId = await ask("Property ID: ");

  try {
    const h = await contract.methods.getPropertyHistory(propId).call();
    const len = h.actions.length;
    if (len === 0) { console.log("   No history found."); return; }

    console.log(`\n   History for ${propId} (${len} events):`);
    console.log("   ─────────────────────────────────────────────");
    for (let i = 0; i < len; i++) {
      const ts      = new Date(h.timestamps[i] * 1000).toLocaleString();
      const action  = h.actions[i].padEnd(30);
      const actor   = h.actors[i].substring(0, 10) + "...";
      console.log(`   [${String(i+1).padStart(2,"0")}] ${ts}  |  ${action}  |  ${actor}`);
      console.log(`        Details: ${h.details[i]}`);
    }
  } catch (e) {
    console.log("\n❌  Error:", extractError(e));
  }
}

// 20. Switch Account
async function switchAccount() {
  console.log("\n── SWITCH ACCOUNT ──────────────────────────────────");
  for (let i = 0; i < accounts.length; i++) {
    const r   = await contract.methods.getRoleName(accounts[i]).call();
    const bal = parseFloat(web3.utils.fromWei(await web3.eth.getBalance(accounts[i]), "ether")).toFixed(3);
    const cur = accounts[i] === currentAccount ? " ◄ CURRENT" : "";
    console.log(`  [${i}] ${accounts[i]}  |  ${r.padEnd(10)}  |  ${bal} ETH${cur}`);
  }
  const idx = parseInt(await ask("\nEnter account index to switch to: "));
  if (isNaN(idx) || idx < 0 || idx >= accounts.length) {
    console.log("❌ Invalid index."); return;
  }
  currentAccount = accounts[idx];
  const role = await contract.methods.getRoleName(currentAccount).call();
  console.log(`\n✅  Switched to account [${idx}]: ${currentAccount}  (${role})`);
}

// 21. List All Accounts
async function listAccounts() {
  console.log("\n── ALL GANACHE ACCOUNTS ────────────────────────────");
  console.log("  #   Address                                       Role         ETH Balance");
  console.log("  ─────────────────────────────────────────────────────────────────────────");
  for (let i = 0; i < accounts.length; i++) {
    const r   = await contract.methods.getRoleName(accounts[i]).call();
    const bal = parseFloat(web3.utils.fromWei(await web3.eth.getBalance(accounts[i]), "ether")).toFixed(3);
    const cur = accounts[i] === currentAccount ? " ◄" : "";
    console.log(`  [${i}] ${accounts[i]}  ${r.padEnd(10)}   ${bal} ETH${cur}`);
  }
}

// ── Error extractor ────────────────────────────────────────────────────────
function extractError(e) {
  const msg = e.message || e.toString();
  // Extract the revert reason from the Ganache error message
  const match = msg.match(/reverted with reason string '(.+?)'/);
  if (match) return "❌ Smart Contract Rejected: " + match[1];
  const match2 = msg.match(/VM Exception.+revert (.+)/);
  if (match2) return "❌ Smart Contract Rejected: " + match2[1];
  return msg.substring(0, 200);
}

// ── Main Loop ──────────────────────────────────────────────────────────────
async function main() {
  await init();

  let running = true;
  while (running) {
    printBanner();
    await printCurrentUser();
    printMenu();

    const choice = (await ask("Enter your choice: ")).trim();

    switch (choice) {
      case "1":  await assignRole();       break;
      case "2":  await viewRole();         break;
      case "3":  await registerProperty(); break;
      case "4":  await updateLandDetails();break;
      case "5":  await viewProperty();     break;
      case "6":  await checkEligibility(); break;
      case "7":  await addMortgage();      break;
      case "8":  await releaseMortgage();  break;
      case "9":  await placeCourtHold();   break;
      case "10": await removeCourtHold();  break;
      case "11": await initiateTransfer(); break;
      case "12": await acceptTransfer();   break;
      case "13": await approveTransfer();  break;
      case "14": await executeTransfer();  break;
      case "15": await rejectTransfer();   break;
      case "16": await storeDocumentHash();break;
      case "17": await verifyDocument();   break;
      case "18": await hashLocalFile();    break;
      case "19": await viewHistory();      break;
      case "20": await switchAccount();    break;
      case "21": await listAccounts();     break;
      case "0":
        console.log("\n👋  Goodbye! LandSure CLI exiting...\n");
        running = false;
        break;
      default:
        console.log("   ⚠️  Invalid option. Try again.");
    }

    if (running) await ask("\n   [Press ENTER to continue...]");
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  rl.close();
  process.exit(1);
});
