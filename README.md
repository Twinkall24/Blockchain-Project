# 🏛️ LandSure — Smart-Contract-Based Multi-Department Land Governance System

> **Blockchain-Based Land Governance and Fraud Prevention Architecture**  
> Built with Solidity · Ganache · Truffle · Node.js · Web3.js

---

## 📌 Project Overview

**LandSure** is a permissioned blockchain solution that digitizes and coordinates multi-departmental land administration. Unlike single-registry platforms, LandSure enforces departmental consensus at the smart contract level: a property transfer is only permitted once verified across the **Revenue**, **Survey**, **Banking**, **Judiciary (Court)**, and **Registration** authorities.

### Key Architectural Highlights
- **Role-Based Access Control (RBAC)**: Smart contract modifiers strictly isolate authority to authenticated departmental blockchain addresses.
- **Automated Fraud Prevention**: Prevents illegal property transfers if active bank mortgages or court injunctions exist.
- **Cryptographic Deed Integrity**: SHA-256 digests (`bytes32`) of legal title deeds are anchored on-chain for tamper detection.
- **Auditable Lifecycle Tracking**: Persistent on-chain event logs and state-transition histories for complete provenance tracking.

---

## 🏗️ System Architecture

```
                       User / Operator Interfaces
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       Interactive CLI (Web3.js)     Automated Simulation Harness
                │                             │
                └──────────────┬──────────────┘
                               │ JSON-RPC
                               ▼
        ┌──────────────────────────────────────────────────┐
        │                 LandSure.sol                     │
        │  ┌────────────────────────────────────────────┐  │
        │  │ Module 1: Role-Based Access Control (RBAC) │  │
        │  │ Module 2: Property & Survey Registry       │  │
        │  │ Module 3: Mortgage & Court Injunctions     │  │
        │  │ Module 4: Multi-Step Transfer Workflow     │  │
        │  │ Module 5: Cryptographic Hash Verification  │  │
        │  │ Module 6: Historical Audit Log             │  │
        │  └────────────────────────────────────────────┘  │
        └──────────────────────────────────────────────────┘
                               │ EVM Execution
                               ▼
            Ganache Local Blockchain (Port 7545)
            10 Provisioned Accounts · Gas & Block Mining
```

---

## 👥 Departmental Role Allocation

| Account Index | Entity / Department | Role Identifier | Assigned Permissions |
|:---:|:---|:---|:---|
| 0 | System Administrator | `ADMIN` | Role allocation and initial configuration |
| 1 | Revenue Department | `REVENUE` | Initial property onboarding and ownership title creation |
| 2 | Survey Department | `SURVEY` | Cadastral verification, plot boundary and area updates |
| 3 | Land Registrar | `REGISTRAR` | Pre-transfer regulatory verification and title deed execution |
| 4 | Commercial Bank | `BANK` | Mortgage collateral registration and NOC clearance |
| 5 | Civil / High Court | `COURT` | Injunction stay orders and dispute hold management |
| 6 | Property Owner (Citizen) | `CITIZEN` | Title custody, transfer request initiation |
| 7 | Prospective Buyer | `CITIZEN` | Purchase intent verification and title inspection |
| 8 | Unverified Entity | `NONE` | Public inspection access only |

---

## 🛠️ Quick Start & Execution

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- npm package manager

### 1. Installation
```bash
git clone <repository-url>
cd BLOCKCHAIN_PROJECT
npm install
```

### 2. Local Blockchain & Execution
You can launch the entire system using the integrated runner script:

```bash
./run.sh
```
This runner automatically detects the local Ganache node, validates deployment bytecode, and provides a menu:
- **1) Automated End-to-End Simulation**: Executes the complete multi-department scenario with real on-chain transactions.
- **2) Interactive CLI**: Menu-driven management console for manual department actions.
- **3) Test Suite**: Executes 33 automated unit tests verifying all security reverts and state flows.

### Alternative: Direct npm Commands
```bash
# Start local blockchain RPC node:
npm run ganache

# Deploy contracts:
npm run migrate:reset

# Run automated workflow simulation:
npm run demo

# Run interactive terminal console:
npm run cli

# Run test suite:
npm test
```

---

## 📋 Smart Contract Interface (`LandSure.sol`)

### State-Changing Functions

| Function Signature | Access Scope | Description |
|:---|:---|:---|
| `assignRole(address, Role)` | Admin only | Provisions departmental access to an account |
| `registerProperty(string, string, string, string, address, bytes32)` | Revenue only | Registers initial parcel title and stores initial deed digest |
| `updateLandDetails(string, string, string)` | Survey only | Updates verified parcel boundaries and surveyed area |
| `addMortgage(string, string)` | Bank only | Places a financial lien / mortgage against the parcel |
| `releaseMortgage(string)` | Bank only | Clears the mortgage and records NOC clearance on-chain |
| `placeCourtHold(string, string)` | Court only | Enforces judicial stay order blocking all transfer operations |
| `removeCourtHold(string)` | Court only | Rescinds court hold following judicial resolution |
| `initiateTransfer(string, address)` | Current Owner | Begins transfer request to a designated buyer address |
| `acceptTransfer(string)` | Designated Buyer | Buyer cryptographic confirmation of intent to acquire |
| `approveTransfer(string)` | Registrar only | Evaluates all encumbrance conditions and designates status as approved |
| `executeTransfer(string)` | Registrar only | Atomically updates parcel ownership pointer to buyer |
| `rejectTransfer(string, string)` | Registrar only | Rejects pending transfer with an immutable reason |
| `updateDocumentHash(string, bytes32)` | Authorized Depts | Records updated SHA-256 digest of amended title deeds |

### View / Inspection Functions (Zero Gas Cost)

| Function Signature | Description |
|:---|:---|
| `getProperty(string)` | Returns complete parcel record including mortgage/court status |
| `checkTransferEligibility(string)` | Comprehensive pre-transfer audit report with specific block reasons |
| `verifyDocument(string, bytes32)` | Cryptographically compares presented document hash against on-chain record |
| `getPropertyHistory(string)` | Returns complete timeline of all historical actions, timestamps, and actors |
| `getPendingTransfer(string)` | Returns state of active transfer request |
| `getRoleName(address)` | Resolves human-readable role name for any address |

---

## 🔄 State-Machine Transfer Protocol

```
                     [ REGISTERED ]
                           │
                           ▼  initiateTransfer() (Seller)
                 [ TRANSFER_REQUESTED ]
                           │
                           ▼  acceptTransfer() (Buyer)
                 [ UNDER_VERIFICATION ]
                           │
             approveTransfer() (Registrar)
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Checks Failed:              All Checks Passed:
   - Mortgage Active           - No Mortgages Active
   - Court Hold Active         - No Court Injunctions
             │                 - Buyer Accepted
             ▼                           │
     [ REJECTED ]                        ▼
    (Resets status)            [ TRANSFER_APPROVED ]
                                         │
                                         ▼  executeTransfer() (Registrar)
                                  [ TRANSFERRED ]
```

---

## 🔐 Automated Fraud Prevention Mechanisms

Before any transfer can be approved by the Registrar, the smart contract evaluates:

1. **Title Verification**: The initiating seller matches `properties[propertyId].owner`.
2. **Buyer Consent**: The acquiring party has explicitly confirmed purchase intent.
3. **Mortgage Check**: `properties[propertyId].hasMortgage == false`. Requires bank NOC release.
4. **Judicial Clearance**: `properties[propertyId].hasCourtHold == false`. Requires court order rescission.
5. **Atomic Execution**: Transfer execution is restricted exclusively to the `REGISTRAR` role.

---

## 📁 Repository Structure

```
BLOCKCHAIN_PROJECT/
├── contracts/
│   ├── LandSure.sol          # Core smart contract (6 modules, RBAC, state machine)
│   └── Migrations.sol        # Truffle deployment migration coordinator
│
├── migrations/
│   ├── 1_initial_migration.js
│   └── 2_deploy_landsure.js  # Automated contract deployment script
│
├── test/
│   └── LandSure.test.js      # 33 comprehensive unit & regression test cases
│
├── scripts/
│   ├── interact.js           # Multi-role interactive CLI console
│   └── demo.js               # End-to-end workflow simulation harness
│
├── documents/
│   └── sample_deed_PROP101.txt # Sample registered title deed for SHA-256 verification
│
├── SYSTEM_DESIGN.md          # Technical design specification & EVM architecture analysis
├── truffle-config.js         # Network configuration & Yul viaIR compiler settings
├── package.json              # Project metadata, dependencies and scripts
└── run.sh                    # Orchestration and launcher script
```

---

## 📑 Technical Architecture & Design Reference

For in-depth EVM design rationale, gas optimization analysis, and implementation details (such as the Yul `viaIR` pipeline and `bytes32` digest storage), refer to [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md).
