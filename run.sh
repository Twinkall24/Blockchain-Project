#!/bin/bash

# ==============================================================================
# LandSure — Quick Launcher Script
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR" || exit 1

check_ganache() {
    curl -s -X POST http://127.0.0.1:7545 \
      -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1
    return $?
}

start_ganache() {
    echo "⚡ Starting Ganache in the background on port 7545..."
    npx ganache --port 7545 --wallet.totalAccounts 10 --quiet > /dev/null 2>&1 &
    sleep 3
    if check_ganache; then
        echo "✅ Ganache started successfully!"
    else
        echo "❌ Failed to start Ganache automatically. Please run: npm run ganache"
        exit 1
    fi
}

echo "========================================================"
echo "          🏛️  LANDSURE MANAGEMENT LAUNCHER  🏛️          "
echo "========================================================"

if check_ganache; then
    echo "✅ Ganache is already running on http://127.0.0.1:7545"
else
    start_ganache
fi

ensure_contract_deployed() {
    local is_deployed=$(node -e "
      const Web3 = require('web3');
      const fs = require('fs');
      try {
        const artifact = JSON.parse(fs.readFileSync('build/contracts/LandSure.json'));
        const netId = Object.keys(artifact.networks).pop();
        const addr = artifact.networks[netId]?.address;
        const web3 = new Web3('http://127.0.0.1:7545');
        web3.eth.getCode(addr).then(c => console.log(c !== '0x' && c !== '0x0')).catch(() => console.log('false'));
      } catch(e) { console.log('false'); }
    " 2>/dev/null)

    if [ "$is_deployed" != "true" ]; then
        echo "⚙️  Contract not detected on the current Ganache instance."
        echo "🔄 Auto-deploying contracts to Ganache..."
        npx truffle migrate --network development --reset
        echo "✅ Contract deployed!"
    fi
}

echo ""
echo "Select an action:"
echo "  1) Run Automated Demo (Recommended for Professor presentation)"
echo "  2) Open Interactive CLI"
echo "  3) Run Full Unit Test Suite (33 Tests)"
echo "  4) Re-deploy Contracts (Reset state)"
echo "  5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        ensure_contract_deployed
        echo ""
        echo "🚀 Running Automated Professor Demo..."
        node scripts/demo.js
        ;;
    2)
        ensure_contract_deployed
        echo ""
        echo "💻 Launching Interactive Menu CLI..."
        node scripts/interact.js
        ;;
    3)
        echo ""
        echo "🧪 Running Unit Test Suite..."
        npx truffle test
        ;;
    4)
        echo ""
        echo "🔄 Re-deploying contracts to Ganache..."
        npx truffle migrate --network development --reset
        echo "✅ Deploy complete! You can now run the demo or CLI."
        ;;
    5)
        echo "Exiting."
        exit 0
        ;;
    *)
        echo "Invalid selection."
        exit 1
        ;;
esac
