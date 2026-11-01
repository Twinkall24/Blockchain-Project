// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LandSure
 * @notice Smart-Contract-Based Multi-Department Land Governance & Fraud Prevention System
 * @dev   Implements role-based access control, property registration, mortgage/court hold
 *        management, a multi-step ownership transfer workflow and SHA-256 document hashing.
 *        Designed to run on Ganache (local Ethereum) via Truffle – no Remix required.
 *
 * Department accounts (assigned from Ganache):
 *   Account 0  → Admin      (contract deployer)
 *   Account 1  → Revenue    (register property, verify ownership)
 *   Account 2  → Survey     (update land / survey details)
 *   Account 3  → Registrar  (approve and execute transfers)
 *   Account 4  → Bank       (add / release mortgage)
 *   Account 5  → Court      (place / remove legal restrictions)
 *   Account 6+ → Citizens   (request transfer, verify property)
 */
contract LandSure {

    // ─────────────────────────────────────────────────────────────
    // MODULE 1 — ROLES & ACCESS CONTROL
    // ─────────────────────────────────────────────────────────────

    enum Role {
        NONE,       // 0 – no role assigned
        ADMIN,      // 1 – can assign roles
        REVENUE,    // 2 – can register properties
        SURVEY,     // 3 – can update land details
        REGISTRAR,  // 4 – can approve / execute transfers
        BANK,       // 5 – can record / release mortgages
        COURT,      // 6 – can place / remove court holds
        CITIZEN     // 7 – owner / buyer
    }

    mapping(address => Role) public roles;
    address public admin;

    // ─────────────────────────────────────────────────────────────
    // MODULE 2 — PROPERTY DATA STRUCTURES
    // ─────────────────────────────────────────────────────────────

    enum PropertyStatus {
        UNREGISTERED,       // 0
        REGISTERED,         // 1
        TRANSFER_REQUESTED, // 2
        UNDER_VERIFICATION, // 3
        TRANSFER_APPROVED,  // 4
        TRANSFERRED         // 5
    }

    struct Property {
        string  propertyId;
        string  surveyNumber;
        string  location;
        string  area;
        address owner;
        PropertyStatus status;
        bool    hasMortgage;
        bool    hasCourtHold;
        string  mortgageRef;       // e.g. "SBI-LOAN-2024"
        string  courtOrderRef;     // e.g. "COURT-ORDER-789"
        bytes32 documentHash;      // SHA-256 hash of property deed
        uint256 registeredAt;
        uint256 lastUpdatedAt;
        bool    exists;
    }

    struct TransferRequest {
        string  propertyId;
        address seller;
        address buyer;
        bool    buyerAccepted;
        bool    registrarApproved;
        string  rejectionReason;
        uint256 initiatedAt;
        bool    active;
    }

    struct HistoryRecord {
        string  action;
        address actor;
        uint256 timestamp;
        string  details;
    }

    // propertyId string → Property
    mapping(string => Property) public properties;

    // propertyId string → TransferRequest
    mapping(string => TransferRequest) public pendingTransfers;

    // propertyId string → history array
    mapping(string => HistoryRecord[]) private propertyHistory;

    // All registered property IDs for enumeration
    string[] public allPropertyIds;

    // ─────────────────────────────────────────────────────────────
    // EVENTS — emitted for every significant state change
    // ─────────────────────────────────────────────────────────────

    event RoleAssigned(address indexed account, Role role, address indexed assignedBy);
    event PropertyRegistered(string indexed propertyId, address indexed owner, uint256 timestamp);
    event LandDetailsUpdated(string indexed propertyId, string surveyNumber, string area);
    event MortgageAdded(string indexed propertyId, string mortgageRef, address indexed bank);
    event MortgageReleased(string indexed propertyId, address indexed bank);
    event CourtHoldPlaced(string indexed propertyId, string courtOrderRef, address indexed court);
    event CourtHoldRemoved(string indexed propertyId, address indexed court);
    event TransferInitiated(string indexed propertyId, address indexed seller, address indexed buyer);
    event TransferAccepted(string indexed propertyId, address indexed buyer);
    event TransferApproved(string indexed propertyId, address indexed registrar);
    event TransferExecuted(string indexed propertyId, address indexed oldOwner, address indexed newOwner);
    event TransferRejected(string indexed propertyId, string reason);
    event DocumentHashRecorded(string indexed propertyId, bytes32 docHash);

    // ─────────────────────────────────────────────────────────────
    // CONSTRUCTOR — Initializes deployer as Administrator
    // ─────────────────────────────────────────────────────────────

    /**
     * @dev Initializes the contract. The deploying account automatically
     *      becomes the ADMIN with permission to provision departmental accounts.
     */
    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.ADMIN;
        emit RoleAssigned(msg.sender, Role.ADMIN, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // MODIFIERS — enforce role-based access control
    // ─────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(roles[msg.sender] == Role.ADMIN, "LandSure: Caller is not Admin");
        _;
    }

    modifier onlyRevenue() {
        require(roles[msg.sender] == Role.REVENUE, "LandSure: Caller is not Revenue Dept");
        _;
    }

    modifier onlySurvey() {
        require(roles[msg.sender] == Role.SURVEY, "LandSure: Caller is not Survey Dept");
        _;
    }

    modifier onlyRegistrar() {
        require(roles[msg.sender] == Role.REGISTRAR, "LandSure: Caller is not Registrar");
        _;
    }

    modifier onlyBank() {
        require(roles[msg.sender] == Role.BANK, "LandSure: Caller is not Bank");
        _;
    }

    modifier onlyCourt() {
        require(roles[msg.sender] == Role.COURT, "LandSure: Caller is not Court");
        _;
    }

    modifier propertyExists(string memory propertyId) {
        require(properties[propertyId].exists, "LandSure: Property does not exist");
        _;
    }

    modifier onlyPropertyOwner(string memory propertyId) {
        require(properties[propertyId].owner == msg.sender, "LandSure: Caller is not the property owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 1 — ROLE MANAGEMENT (transaction functions)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Admin assigns a role to any Ganache account.
     * @param  account  The address of the account (from Ganache UI)
     * @param  role     The Role enum value to assign
     */
    function assignRole(address account, Role role) external onlyAdmin {
        require(account != address(0), "LandSure: Invalid address");
        require(role != Role.NONE, "LandSure: Cannot assign NONE role");
        roles[account] = role;
        emit RoleAssigned(account, role, msg.sender);
    }

    /**
     * @notice Returns the role name string for a given address.
     */
    function getRoleName(address account) external view returns (string memory) {
        Role r = roles[account];
        if (r == Role.ADMIN)     return "ADMIN";
        if (r == Role.REVENUE)   return "REVENUE";
        if (r == Role.SURVEY)    return "SURVEY";
        if (r == Role.REGISTRAR) return "REGISTRAR";
        if (r == Role.BANK)      return "BANK";
        if (r == Role.COURT)     return "COURT";
        if (r == Role.CITIZEN)   return "CITIZEN";
        return "NONE";
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 2 — PROPERTY REGISTRATION (transaction function)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Revenue Dept registers a new property on the blockchain.
     * @param  propertyId   Unique identifier, e.g. "PROP101"
     * @param  surveyNumber e.g. "245/A"
     * @param  location     e.g. "Ahmedabad, Gujarat"
     * @param  area         e.g. "1500 sq.ft"
     * @param  owner        Blockchain address of the initial owner (citizen)
     * @param  documentHash SHA-256 hash of the property deed (bytes32)
     */
    function registerProperty(
        string  memory propertyId,
        string  memory surveyNumber,
        string  memory location,
        string  memory area,
        address        owner,
        bytes32        documentHash
    ) external onlyRevenue {
        require(!properties[propertyId].exists,       "LandSure: Property already registered");
        require(owner != address(0),                  "LandSure: Invalid owner address");
        require(bytes(propertyId).length > 0,         "LandSure: Empty property ID");
        require(roles[owner] == Role.CITIZEN ||
                roles[owner] == Role.NONE,            "LandSure: Owner must be a citizen");

        properties[propertyId] = Property({
            propertyId:    propertyId,
            surveyNumber:  surveyNumber,
            location:      location,
            area:          area,
            owner:         owner,
            status:        PropertyStatus.REGISTERED,
            hasMortgage:   false,
            hasCourtHold:  false,
            mortgageRef:   "",
            courtOrderRef: "",
            documentHash:  documentHash,
            registeredAt:  block.timestamp,
            lastUpdatedAt: block.timestamp,
            exists:        true
        });

        allPropertyIds.push(propertyId);

        _addHistory(propertyId, "PROPERTY_REGISTERED", msg.sender,
            string(abi.encodePacked("Owner: ", _addressToString(owner), " | Survey: ", surveyNumber)));

        emit PropertyRegistered(propertyId, owner, block.timestamp);
        emit DocumentHashRecorded(propertyId, documentHash);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 2b — LAND DETAILS UPDATE (transaction function)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Survey Dept updates land details after physical verification.
     */
    function updateLandDetails(
        string memory propertyId,
        string memory newSurveyNumber,
        string memory newArea
    ) external onlySurvey propertyExists(propertyId) {
        Property storage p = properties[propertyId];
        p.surveyNumber    = newSurveyNumber;
        p.area            = newArea;
        p.lastUpdatedAt   = block.timestamp;

        _addHistory(propertyId, "LAND_DETAILS_UPDATED", msg.sender,
            string(abi.encodePacked("Survey: ", newSurveyNumber, " | Area: ", newArea)));

        emit LandDetailsUpdated(propertyId, newSurveyNumber, newArea);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 3 — MORTGAGE MANAGEMENT (transaction functions)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Bank records an active mortgage against a property.
     * @param  propertyId  Target property
     * @param  mortgageRef Bank loan reference number, e.g. "SBI-LOAN-2024"
     */
    function addMortgage(
        string memory propertyId,
        string memory mortgageRef
    ) external onlyBank propertyExists(propertyId) {
        Property storage p = properties[propertyId];
        require(!p.hasMortgage, "LandSure: Property already has an active mortgage");

        p.hasMortgage    = true;
        p.mortgageRef    = mortgageRef;
        p.lastUpdatedAt  = block.timestamp;

        _addHistory(propertyId, "MORTGAGE_ADDED", msg.sender,
            string(abi.encodePacked("Ref: ", mortgageRef)));

        emit MortgageAdded(propertyId, mortgageRef, msg.sender);
    }

    /**
     * @notice Bank releases / clears the mortgage (issues NOC).
     */
    function releaseMortgage(string memory propertyId)
        external onlyBank propertyExists(propertyId)
    {
        Property storage p = properties[propertyId];
        require(p.hasMortgage, "LandSure: No active mortgage to release");

        string memory oldRef = p.mortgageRef;
        p.hasMortgage   = false;
        p.mortgageRef   = "";
        p.lastUpdatedAt = block.timestamp;

        _addHistory(propertyId, "MORTGAGE_RELEASED", msg.sender,
            string(abi.encodePacked("Cleared ref: ", oldRef)));

        emit MortgageReleased(propertyId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 3b — COURT HOLD MANAGEMENT (transaction functions)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Court places a legal restriction on a property.
     * @param  courtOrderRef Court order number, e.g. "COURT-ORDER-789"
     */
    function placeCourtHold(
        string memory propertyId,
        string memory courtOrderRef
    ) external onlyCourt propertyExists(propertyId) {
        Property storage p = properties[propertyId];
        require(!p.hasCourtHold, "LandSure: Court hold already active");

        p.hasCourtHold   = true;
        p.courtOrderRef  = courtOrderRef;
        p.lastUpdatedAt  = block.timestamp;

        _addHistory(propertyId, "COURT_HOLD_PLACED", msg.sender,
            string(abi.encodePacked("Order: ", courtOrderRef)));

        emit CourtHoldPlaced(propertyId, courtOrderRef, msg.sender);
    }

    /**
     * @notice Court removes a legal restriction from a property.
     */
    function removeCourtHold(string memory propertyId)
        external onlyCourt propertyExists(propertyId)
    {
        Property storage p = properties[propertyId];
        require(p.hasCourtHold, "LandSure: No active court hold");

        string memory oldRef = p.courtOrderRef;
        p.hasCourtHold   = false;
        p.courtOrderRef  = "";
        p.lastUpdatedAt  = block.timestamp;

        _addHistory(propertyId, "COURT_HOLD_REMOVED", msg.sender,
            string(abi.encodePacked("Removed order: ", oldRef)));

        emit CourtHoldRemoved(propertyId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 4 — PROPERTY TRANSFER WORKFLOW (transaction functions)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Owner initiates a transfer request to a buyer.
     *         Does NOT immediately transfer — begins the multi-step process.
     * @param  propertyId  Property to transfer
     * @param  buyer       Buyer's blockchain address
     */
    function initiateTransfer(
        string  memory propertyId,
        address        buyer
    ) external propertyExists(propertyId) onlyPropertyOwner(propertyId) {
        Property storage p = properties[propertyId];
        require(p.status == PropertyStatus.REGISTERED ||
                p.status == PropertyStatus.TRANSFERRED,
                "LandSure: Property is not in a transferable state");
        require(buyer != address(0),        "LandSure: Invalid buyer address");
        require(buyer != msg.sender,        "LandSure: Seller cannot be the buyer");
        require(!pendingTransfers[propertyId].active, "LandSure: A pending transfer already exists");

        p.status        = PropertyStatus.TRANSFER_REQUESTED;
        p.lastUpdatedAt = block.timestamp;

        pendingTransfers[propertyId] = TransferRequest({
            propertyId:         propertyId,
            seller:             msg.sender,
            buyer:              buyer,
            buyerAccepted:      false,
            registrarApproved:  false,
            rejectionReason:    "",
            initiatedAt:        block.timestamp,
            active:             true
        });

        _addHistory(propertyId, "TRANSFER_INITIATED", msg.sender,
            string(abi.encodePacked("Buyer: ", _addressToString(buyer))));

        emit TransferInitiated(propertyId, msg.sender, buyer);
    }

    /**
     * @notice Buyer accepts the transfer request (confirms intent to buy).
     *         Sets status to UNDER_VERIFICATION.
     */
    function acceptTransfer(string memory propertyId)
        external propertyExists(propertyId)
    {
        TransferRequest storage tr = pendingTransfers[propertyId];
        require(tr.active,              "LandSure: No active transfer request");
        require(tr.buyer == msg.sender, "LandSure: Caller is not the designated buyer");
        require(!tr.buyerAccepted,      "LandSure: Buyer already accepted");

        tr.buyerAccepted = true;
        properties[propertyId].status       = PropertyStatus.UNDER_VERIFICATION;
        properties[propertyId].lastUpdatedAt = block.timestamp;

        _addHistory(propertyId, "TRANSFER_ACCEPTED_BY_BUYER", msg.sender, "Buyer confirmed purchase intent");

        emit TransferAccepted(propertyId, msg.sender);
    }

    /**
     * @notice Registrar reviews and approves a valid transfer request.
     *         The smart contract automatically checks:
     *           1. Buyer has accepted
     *           2. No active mortgage (or mortgage already cleared)
     *           3. No active court hold
     * @return eligibility  Human-readable string explaining the decision
     */
    function approveTransfer(string memory propertyId)
        external onlyRegistrar propertyExists(propertyId)
        returns (string memory eligibility)
    {
        TransferRequest storage tr = pendingTransfers[propertyId];
        Property        storage p  = properties[propertyId];

        require(tr.active,          "LandSure: No active transfer request");
        require(tr.buyerAccepted,   "LandSure: Buyer has not yet accepted the transfer");

        // ── Fraud-prevention checks ──────────────────────────────
        if (!tr.buyerAccepted) {
            eligibility = "BLOCKED: Buyer acceptance pending";
            _rejectTransfer(propertyId, eligibility);
            return eligibility;
        }
        if (p.hasCourtHold) {
            eligibility = string(abi.encodePacked("BLOCKED: Active court restriction (", p.courtOrderRef, ")"));
            _rejectTransfer(propertyId, eligibility);
            return eligibility;
        }
        if (p.hasMortgage) {
            eligibility = string(abi.encodePacked("BLOCKED: Active mortgage pending clearance (", p.mortgageRef, ")"));
            _rejectTransfer(propertyId, eligibility);
            return eligibility;
        }

        // ── All checks passed ─────────────────────────────────────
        tr.registrarApproved = true;
        p.status             = PropertyStatus.TRANSFER_APPROVED;
        p.lastUpdatedAt      = block.timestamp;

        eligibility = "APPROVED: All conditions satisfied. Ready for execution.";

        _addHistory(propertyId, "TRANSFER_APPROVED", msg.sender, eligibility);
        emit TransferApproved(propertyId, msg.sender);
        return eligibility;
    }

    /**
     * @notice Registrar executes the approved transfer — ownership changes here.
     *         This is the ONLY way ownership can change in LandSure.
     */
    function executeTransfer(string memory propertyId)
        external onlyRegistrar propertyExists(propertyId)
    {
        TransferRequest storage tr = pendingTransfers[propertyId];
        Property        storage p  = properties[propertyId];

        require(tr.active,             "LandSure: No active transfer request");
        require(tr.registrarApproved,  "LandSure: Transfer not yet approved");
        require(p.status == PropertyStatus.TRANSFER_APPROVED, "LandSure: Status is not TRANSFER_APPROVED");

        address oldOwner = p.owner;
        address newOwner = tr.buyer;

        // ── Execute ownership change ──────────────────────────────
        p.owner         = newOwner;
        p.status        = PropertyStatus.TRANSFERRED;
        p.lastUpdatedAt = block.timestamp;

        // Archive and clear the pending transfer
        tr.active = false;

        _addHistory(propertyId, "OWNERSHIP_TRANSFERRED", msg.sender,
            string(abi.encodePacked(
                "From: ", _addressToString(oldOwner),
                " To: ",  _addressToString(newOwner)
            ))
        );

        emit TransferExecuted(propertyId, oldOwner, newOwner);
    }

    /**
     * @notice Registrar rejects a transfer request with a reason.
     */
    function rejectTransfer(string memory propertyId, string memory reason)
        external onlyRegistrar propertyExists(propertyId)
    {
        _rejectTransfer(propertyId, reason);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 5 — DOCUMENT HASH MANAGEMENT (transaction function)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Authorized departments can update the document hash on record
     *         (e.g., after a court-ordered amendment or updated survey deed).
     */
    function updateDocumentHash(string memory propertyId, bytes32 newHash)
        external propertyExists(propertyId)
    {
        require(
            roles[msg.sender] == Role.REVENUE   ||
            roles[msg.sender] == Role.SURVEY     ||
            roles[msg.sender] == Role.REGISTRAR  ||
            roles[msg.sender] == Role.ADMIN,
            "LandSure: Not authorized to update document hash"
        );

        properties[propertyId].documentHash  = newHash;
        properties[propertyId].lastUpdatedAt = block.timestamp;

        _addHistory(propertyId, "DOCUMENT_HASH_UPDATED", msg.sender, "New document hash recorded");
        emit DocumentHashRecorded(propertyId, newHash);
    }

    // ─────────────────────────────────────────────────────────────
    // MODULE 6 — VIEW / VERIFICATION FUNCTIONS (read-only)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Returns full property details for the public verification dashboard.
     */
    function getProperty(string memory propertyId)
        external view propertyExists(propertyId)
        returns (
            string  memory id,
            string  memory surveyNumber,
            string  memory location,
            string  memory area,
            address        owner,
            string  memory status,
            bool           hasMortgage,
            string  memory mortgageRef,
            bool           hasCourtHold,
            string  memory courtOrderRef,
            bytes32        documentHash,
            uint256        registeredAt
        )
    {
        Property memory p = properties[propertyId];
        return (
            p.propertyId,
            p.surveyNumber,
            p.location,
            p.area,
            p.owner,
            _statusToString(p.status),
            p.hasMortgage,
            p.mortgageRef,
            p.hasCourtHold,
            p.courtOrderRef,
            p.documentHash,
            p.registeredAt
        );
    }

    /**
     * @notice Returns a transfer eligibility report for a property.
     *         The buyer can call this BEFORE initiating to understand blockers.
     */
    function checkTransferEligibility(string memory propertyId)
        external view propertyExists(propertyId)
        returns (
            bool   ownershipVerified,
            bool   mortgageClear,
            bool   courtClear,
            bool   eligible,
            string memory report
        )
    {
        Property memory p = properties[propertyId];

        ownershipVerified = p.owner != address(0);
        mortgageClear     = !p.hasMortgage;
        courtClear        = !p.hasCourtHold;
        eligible          = ownershipVerified && mortgageClear && courtClear &&
                            (p.status == PropertyStatus.REGISTERED ||
                             p.status == PropertyStatus.TRANSFERRED);

        if (!ownershipVerified)
            report = "BLOCKED: No valid owner on record.";
        else if (p.hasCourtHold)
            report = string(abi.encodePacked("BLOCKED: Active court restriction [", p.courtOrderRef, "]. Resolve before transfer."));
        else if (p.hasMortgage)
            report = string(abi.encodePacked("BLOCKED: Active mortgage [", p.mortgageRef, "]. Bank clearance required."));
        else if (p.status == PropertyStatus.TRANSFER_REQUESTED ||
                 p.status == PropertyStatus.UNDER_VERIFICATION  ||
                 p.status == PropertyStatus.TRANSFER_APPROVED)
            report = "BLOCKED: Another transfer is already in progress.";
        else
            report = "ELIGIBLE: Property is clear for transfer.";
    }

    /**
     * @notice Verifies whether a given document matches the hash stored on-chain.
     * @param  propertyId   The property to verify against
     * @param  uploadedHash SHA-256 hash of the document the user is presenting
     * @return match_       true if hashes match (document unmodified)
     * @return storedHash   The hash stored on the blockchain
     */
    function verifyDocument(string memory propertyId, bytes32 uploadedHash)
        external view propertyExists(propertyId)
        returns (bool match_, bytes32 storedHash)
    {
        storedHash = properties[propertyId].documentHash;
        match_     = (storedHash == uploadedHash);
    }

    /**
     * @notice Returns the full ownership / event history of a property.
     */
    function getPropertyHistory(string memory propertyId)
        external view propertyExists(propertyId)
        returns (
            string[]  memory actions,
            address[] memory actors,
            uint256[] memory timestamps,
            string[]  memory details
        )
    {
        HistoryRecord[] memory h = propertyHistory[propertyId];
        uint256 len = h.length;

        actions    = new string[](len);
        actors     = new address[](len);
        timestamps = new uint256[](len);
        details    = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            actions[i]    = h[i].action;
            actors[i]     = h[i].actor;
            timestamps[i] = h[i].timestamp;
            details[i]    = h[i].details;
        }
    }

    /**
     * @notice Returns the count of all registered properties.
     */
    function getTotalProperties() external view returns (uint256) {
        return allPropertyIds.length;
    }

    /**
     * @notice Returns the pending transfer info for a property.
     */
    function getPendingTransfer(string memory propertyId)
        external view propertyExists(propertyId)
        returns (
            address seller,
            address buyer,
            bool    buyerAccepted,
            bool    registrarApproved,
            string  memory rejectionReason,
            uint256 initiatedAt,
            bool    active
        )
    {
        TransferRequest memory tr = pendingTransfers[propertyId];
        return (
            tr.seller,
            tr.buyer,
            tr.buyerAccepted,
            tr.registrarApproved,
            tr.rejectionReason,
            tr.initiatedAt,
            tr.active
        );
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────

    function _addHistory(
        string  memory propertyId,
        string  memory action,
        address        actor,
        string  memory details_
    ) internal {
        propertyHistory[propertyId].push(HistoryRecord({
            action:    action,
            actor:     actor,
            timestamp: block.timestamp,
            details:   details_
        }));
    }

    function _rejectTransfer(string memory propertyId, string memory reason) internal {
        TransferRequest storage tr = pendingTransfers[propertyId];
        Property        storage p  = properties[propertyId];

        tr.active          = false;
        tr.rejectionReason = reason;
        p.status           = PropertyStatus.REGISTERED;
        p.lastUpdatedAt    = block.timestamp;

        _addHistory(propertyId, "TRANSFER_REJECTED", msg.sender, reason);
        emit TransferRejected(propertyId, reason);
    }

    function _statusToString(PropertyStatus s) internal pure returns (string memory) {
        if (s == PropertyStatus.UNREGISTERED)      return "UNREGISTERED";
        if (s == PropertyStatus.REGISTERED)        return "REGISTERED";
        if (s == PropertyStatus.TRANSFER_REQUESTED)return "TRANSFER_REQUESTED";
        if (s == PropertyStatus.UNDER_VERIFICATION)return "UNDER_VERIFICATION";
        if (s == PropertyStatus.TRANSFER_APPROVED) return "TRANSFER_APPROVED";
        if (s == PropertyStatus.TRANSFERRED)       return "TRANSFERRED";
        return "UNKNOWN";
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data     = abi.encodePacked(addr);
        bytes memory str      = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2]     = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2]     = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
