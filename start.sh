#!/bin/bash
# ==============================================================================
# Credora — Blockchain Certificate Verification System Startup Script
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env ]; then
  echo "❌ Root .env is missing. Copy .env.example to .env and fill in the required secrets."
  exit 1
fi

wait_for_http() {
  service_name="$1"
  health_url="$2"
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if curl --silent --fail "$health_url" > /dev/null 2>&1; then
      echo "  ✅ $service_name ready"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "  ❌ $service_name did not become ready. Check the Credora logs in /tmp."
  return 1
}

echo "=================================================="
echo "  🚀 Starting Credora Certificate System  "
echo "=================================================="

# 1. Start Redis
echo "➡️  Checking Redis..."
if ! redis-cli ping > /dev/null 2>&1; then
  brew services start redis > /dev/null 2>&1 || redis-server --daemonize yes
  sleep 1
fi
echo "  ✅ Redis running"

# 2. Check the configured MongoDB target without starting a local database.
echo "➡️  Checking MongoDB configuration..."
if grep -Eq '^MONGODB_URI=mongodb://(localhost|127\.0\.0\.1)(:|/)' .env; then
  if ! lsof -i :27017 > /dev/null 2>&1; then
    echo "  ❌ .env points to local MongoDB, but nothing is listening on :27017."
    exit 1
  fi
  echo "  ✅ Local MongoDB is running"
else
  echo "  ✅ Using the MongoDB connection configured in .env"
fi

# 3. Compile the current privacy-preserving contract.
echo "➡️  Compiling CertificateRegistry..."
if ! (cd blockchain && npm run compile); then
  echo "  ❌ Contract compilation failed"
  exit 1
fi
echo "  ✅ Contract compiled"

# 4. Start a local Hardhat node only when the backend is configured for it.
echo "➡️  Checking blockchain RPC..."
if ! grep -Eq '^HARDHAT_NETWORK_URL=https?://(127\.0\.0\.1|localhost):8545/?$' .env; then
  echo "  ✅ Using the configured remote blockchain RPC"
  if grep -Eq '^CONTRACT_ADDRESS=$' .env; then
    echo "  ⚠️  CONTRACT_ADDRESS is empty; blockchain writes remain in mock mode until deployment."
  fi
else
  needs_local_deployment=0
  if ! lsof -i :8545 > /dev/null 2>&1; then
    echo "  Starting local Hardhat node on :8545..."
    (cd blockchain && npx hardhat node > /tmp/credora-hardhat.log 2>&1) &
    sleep 3
    needs_local_deployment=1
  fi
  deployment_is_current="$(node -e "try { const d = require('./blockchain/deployment.json'); process.stdout.write(d.network === 'localhost' && d.contractVersion === 2 ? 'yes' : 'no'); } catch { process.stdout.write('no'); }")"
  if [ "$deployment_is_current" != "yes" ]; then
    needs_local_deployment=1
  fi
  if [ "$needs_local_deployment" = "1" ]; then
    echo "  Deploying CertificateRegistry contract..."
    (cd blockchain && npx hardhat run scripts/deploy.js --network localhost)
  fi
  echo "  ✅ Local Hardhat node & contract ready"
fi

# 5. Start Microservices in Background
echo "➡️  Starting Microservices..."
(cd services/auth-service && node src/index.js > /tmp/credora-auth.log 2>&1) &
(cd services/certificate-service && node src/index.js > /tmp/credora-cert.log 2>&1) &
(cd services/blockchain-service && node src/index.js > /tmp/credora-blockchain.log 2>&1) &
(cd services/ipfs-service && node src/index.js > /tmp/credora-ipfs.log 2>&1) &
wait_for_http "Auth service" "http://127.0.0.1:3001/health" || exit 1
wait_for_http "Certificate service" "http://127.0.0.1:3002/health" || exit 1
wait_for_http "Blockchain service" "http://127.0.0.1:3003/health" || exit 1
wait_for_http "IPFS service" "http://127.0.0.1:3004/health" || exit 1

# 6. Start API Gateway
echo "➡️  Starting API Gateway on :3000..."
(cd gateway && node src/index.js > /tmp/credora-gateway.log 2>&1) &
wait_for_http "API gateway" "http://127.0.0.1:3000/health" || exit 1

# 7. Start React Frontend
echo "➡️  Starting React Frontend on :5173..."
(cd client && npm run dev -- --host 127.0.0.1 > /tmp/credora-client.log 2>&1) &
wait_for_http "Web client" "http://127.0.0.1:5173" || exit 1

echo ""
echo "=================================================="
echo "  🎉 ALL SERVICES ARE LIVE!"
echo "=================================================="
echo "  🌐 Frontend:            http://localhost:5173"
echo "  🚪 API Gateway:         http://localhost:3000"
echo "  🔐 Auth Service:        http://localhost:3001"
echo "  📜 Certificate Service: http://localhost:3002"
echo "  ⛓️  Blockchain Service:  http://localhost:3003"
echo "  📦 IPFS Service:        http://localhost:3004"
if grep -Eq '^HARDHAT_NETWORK_URL=https?://(127\.0\.0\.1|localhost):8545/?$' .env; then
  echo "  ⛓️  Hardhat Node:        http://localhost:8545"
else
  echo "  ⛓️  Blockchain RPC:      configured in .env"
fi
echo "=================================================="
echo "  Logs saved to /tmp/credora-*.log"
echo "  Run ./stop.sh to terminate all services."
echo "=================================================="
