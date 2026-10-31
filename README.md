# 🏛️ LandSure — Smart-Contract-Based Multi-Department Land Governance System

> **Blockchain for Land Governance** | Solidity · Ganache · Truffle · Node.js · Web3.js
> Final Practical Examination Project

---

## 📌 Project Overview

LandSure is a **CLI-based blockchain application** that simulates a multi-department land governance system. Government departments have different smart-contract-enforced permissions. A property can only be transferred after the contract verifies ownership, buyer acceptance, bank clearance, court restrictions, and registrar approval.

### Why LandSure is unique
- Combines Solutions 3, 4, 5, 7, 8, and 10 into **one integrated system**
- Smart contract **enforces fraud prevention** — not just the frontend
- Multi-step transfer with **automated eligibility checks**
- **Cryptographic document verification** (SHA-256 hashing on-chain)
- Immutable **ownership history** of every event

---

## 🏗️ System Architecture

```
CLI (Node.js + Web3.js)
        │
        ▼
  LandSure.sol (Solidity)
  ┌──────────────────────────────────────┐
  │  Module 1: Role-Based Access Control │
  │  Module 2: Property Registration     │
  │  Module 3: Mortgage Management       │
  │  Module 3b: Court Hold Management    │
  │  Module 4: Transfer Workflow         │
  │  Module 5: Document Hash Storage     │
  │  Module 6: Verification (view)       │
  └──────────────────────────────────────┘
        │
        ▼
  Ganache (Local Ethereum Blockchain)
  Accounts · Transactions · Blocks · Gas
```

---

## 👥 Department Accounts (Ganache)

| Account Index | Department   | Role       | Permissions                         |
|:---:|:---|:---|:---|
| 0 | Admin          | ADMIN      | Assign all roles                    |
| 1 | Revenue Dept   | REVENUE    | Register property                   |
| 2 | Survey Dept    | SURVEY     | Update land details                 |
| 3 | Registration   | REGISTRAR  | Approve & execute transfers         |
| 4 | Bank (SBI)     | BANK       | Add / release mortgage              |
| 5 | Court          | COURT      | Place / remove legal restrictions   |
| 6 | Rahul (Seller) | CITIZEN    | Own property, initiate transfer     |
| 7 | Priya (Buyer)  | CITIZEN    | Accept transfer, verify property    |
| 8 | (Intruder)     | NONE       | For negative test demonstration     |

---

## 🛠️ Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org) (v18+)
- [Ganache Desktop](https://trufflesuite.com/ganache/) (v2.x)
- VS Code

### 1. Install dependencies
```bash
cd BLOCKCHAIN_PROJECT
npm install
```

### 2. Start Ganache
- Open **Ganache Desktop**
- Click **New Workspace** → **Ethereum**
- Verify RPC: `HTTP://127.0.0.1:7545`
- Click **Start**

### 3. Compile the smart contract
```bash
npx truffle compile
```

### 4. Deploy to Ganache
```bash
npx truffle migrate --network development
```
Note the contract address printed in the output.

### 5. Run the interactive CLI
```bash
node scripts/interact.js
```

### 6. Run the automated demo (for professor)
```bash
node scripts/demo.js
```

### 7. Run the test suite
```bash
npx truffle test
```

---

## 📋 Smart Contract Functions

### Transaction Functions (modify blockchain state, cost gas)

| Function | Called By | Purpose |
|:---|:---|:---|
| `assignRole(addr, role)` | Admin | Assign department role |
| `registerProperty(...)` | Revenue | Register new property |
| `updateLandDetails(...)` | Survey | Update survey info |
| `addMortgage(id, ref)` | Bank | Record mortgage |
| `releaseMortgage(id)` | Bank | Clear mortgage / NOC |
| `placeCourtHold(id, ref)` | Court | Restrict property |
| `removeCourtHold(id)` | Court | Remove restriction |
| `initiateTransfer(id, buyer)` | Owner | Start transfer request |
| `acceptTransfer(id)` | Buyer | Confirm purchase intent |
| `approveTransfer(id)` | Registrar | Validate & approve |
| `executeTransfer(id)` | Registrar | Change ownership |
| `rejectTransfer(id, reason)` | Registrar | Reject transfer |
| `updateDocumentHash(id, hash)` | Dept | Update deed hash |

### View Functions (free, no gas)

| Function | Purpose |
|:---|:---|
| `getProperty(id)` | Full property details |
| `checkTransferEligibility(id)` | Fraud-prevention report |
| `verifyDocument(id, hash)` | Document authenticity |
| `getPropertyHistory(id)` | Full event history |
| `getPendingTransfer(id)` | Active transfer info |
| `getRoleName(addr)` | Role string for address |

---

## 🔄 Property Transfer Workflow

```
REGISTERED
    │
    ▼ (owner calls initiateTransfer)
TRANSFER_REQUESTED
    │
    ▼ (buyer calls acceptTransfer)
UNDER_VERIFICATION
    │
    ▼ (registrar calls approveTransfer)
    │
    ├─── BLOCKED (mortgage / court hold) ──► REGISTERED (rejected)
    │
    ▼ (registrar calls executeTransfer)
TRANSFERRED
```

---

## 🔐 Fraud Prevention Checks

Before a transfer is approved, the smart contract automatically verifies:

1. ✅ Property is registered
2. ✅ Caller is the actual property owner
3. ✅ Buyer has explicitly accepted
4. ✅ **No active mortgage** (bank clearance required)
5. ✅ **No court restriction**
6. ✅ No other pending transfer

---

## 🧪 Demo Scenario: Rahul → Priya

| Step | Action | Result |
|:---:|:---|:---|
| 1 | Admin assigns all roles | ✅ Roles set |
| 2 | Revenue registers PROP101 | ✅ Property created |
| 3 | Survey updates land details | ✅ Verified |
| 4 | Bank adds mortgage | ✅ Mortgage active |
| 5 | Rahul initiates transfer to Priya | ✅ Request created |
| 6 | Priya accepts | ✅ Buyer confirmed |
| 7 | Registrar tries to approve | ❌ **BLOCKED: Active mortgage** |
| 8 | Registrar rejects | ✅ Transfer reset |
| 9 | Bank releases mortgage | ✅ NOC issued |
| 10 | Rahul re-initiates, Priya accepts | ✅ |
| 11 | Registrar approves (all clear) | ✅ Approved |
| 12 | Registrar executes | 🎉 **Priya is new owner** |
| 13 | Verify document hash | ✅ Authentic |
| 14 | Intruder tries to register | ❌ **Reverted by contract** |

---

## 📁 Project Structure

```
BLOCKCHAIN_PROJECT/
├── contracts/
│   ├── LandSure.sol          ← Main smart contract (all 6 modules)
│   └── Migrations.sol        ← Truffle standard
│
├── migrations/
│   ├── 1_initial_migration.js
│   └── 2_deploy_landsure.js  ← Deploys LandSure
│
├── test/
│   └── LandSure.test.js      ← 30+ automated test cases
│
├── scripts/
│   ├── interact.js           ← Interactive CLI (21 menu options)
│   └── demo.js               ← Automated professor demo
│
├── documents/
│   └── sample_deed_PROP101.txt
│
├── truffle-config.js         ← Ganache network config
└── package.json
```

---

## ⚠️ Important Notes for Viva

1. **Ganache is a local blockchain** — accounts simulate departments, not real government nodes.
2. **MetaMask proves key control**, not real-world legal identity. Our system associates accounts with roles.
3. **Blockchain doesn't establish legal ownership** — it protects and tracks records after initial verified registration.

---

## 🎓 Marks Coverage

| Criteria | How LandSure covers it |
|:---|:---|
| Working smart contract | ✅ `LandSure.sol` fully working |
| Constructor | ✅ Sets admin, assigns first role |
| Transaction functions | ✅ 13 state-changing functions |
| Ganache (not Remix) | ✅ Truffle + Ganache only |
| Concepts & architecture | ✅ Roles, modifiers, structs, enums, events, mappings |
| Unique approach | ✅ Multi-dept + fraud prevention + doc verification |

---

*Made with ❤️ for the final practical examination — Blockchain Technology*
