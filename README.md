# Credora

Credora is a prototype for issuing and checking academic credentials. An approved university account creates a credential and a PDF. A recipient can share its QR link so another person can review the displayed details, the credential proof recorded on an EVM chain, and its current revocation status.

## What it does

- Lets administrators add institutions, approve them, and manage account roles.
- Lets approved university accounts preview and issue credentials one at a time.
- Gives students a workspace to view their own credentials and download their PDFs.
- Gives credential recipients a public verification page and QR link.
- Lets an institution request revocation and shows its pending, failed, or confirmed state.
- Provides a transaction explorer link for confirmed on-chain transactions.

CSV or bulk issuance is not implemented.

## Data and trust model

- Credential names and details are not written to the blockchain. The contract stores a salted credential commitment and its issuer/status metadata.
- Readable PDFs are encrypted with AES-256-GCM before storage in MongoDB. When Pinata is configured, the background worker stores an encrypted backup there.
- A QR/share URL is a bearer link: anyone who obtains it can view that credential's public verification details. Share it intentionally and use fictional data in public demos.
- The institution account initiates issuance, while Credora's configured service wallet submits the on-chain transaction. Separate university wallet signatures and independent validation of source records are not implemented.
- Registration does not verify email ownership, and password reset/email recovery is not implemented. Do not use real student records or treat this prototype as a production identity system.

## Architecture

```text
React/Vite client
       │ /api
       ▼
API gateway ───── Auth service ───── MongoDB
       ├──────── Certificate service ─ MongoDB
       │                 ├─────────── Redis/BullMQ workers
       │                 ├─────────── Blockchain service ─ EVM RPC
       │                 └─────────── IPFS service ─────── Pinata
       └──────── rate limiting / CORS
```

The API gateway is the browser-facing backend. The blockchain and IPFS write endpoints require the private internal-service token and should not be exposed directly to the public internet.

## Repository layout

```text
client/                         React and Vite application
gateway/                        API gateway, proxy, rate limit, CORS
services/auth-service/          accounts, login, roles, institutions
services/certificate-service/   credential, PDF, QR, and queue workers
services/blockchain-service/    EVM contract operations
services/ipfs-service/           Pinata integration
blockchain/                      Solidity contract and Hardhat scripts/tests
shared/                          shared backend authentication/config helpers
docker-compose.yml               local backend and infrastructure stack
start.sh / stop.sh                local host-process workflow
```

## Requirements

- Node.js 20 or newer and npm 10 or newer
- MongoDB 7 locally or a MongoDB Atlas cluster
- Redis 7 locally or through Docker
- Docker Engine and the Docker Compose plugin for the container workflow
- Sepolia RPC endpoint and test ETH only if using Sepolia
- Pinata API credentials are optional; without them, encrypted PDF data remains in MongoDB

## Quick start: local development

### 1. Clone and create private environment files

```bash
git clone https://github.com/Anuj-er/Credora.git
cd Credora
cp .env.example .env
cp client/.env.example client/.env
```

The `.env` files are ignored by Git. Never commit real credentials or put backend secrets in `client/.env`.

Generate distinct secrets for `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, and `CERTIFICATE_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Run it separately for each value. Keep `CERTIFICATE_ENCRYPTION_KEY` backed up and unchanged: changing it prevents existing encrypted PDFs from being decrypted. If an existing database has PDFs encrypted using the JWT fallback, migrate/re-encrypt those PDFs before changing the encryption secret.

### 2. Configure MongoDB and Redis

For Atlas-backed local development, set `MONGODB_URI` in the root `.env` to a development database URI, for example:

```env
MONGODB_URI=mongodb+srv://<db_user>:<url_encoded_password>@<cluster-host>.mongodb.net/credora_local?retryWrites=true&w=majority&appName=credora
```

Create a database user limited to the development database and allow-list your current IP in Atlas. URL-encode reserved characters in the database password. See the [Atlas connection guide](https://www.mongodb.com/docs/atlas/driver-connection/) and [IP access list guide](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).

For local development, start Redis on `localhost:6379`, or use the Docker workflow below. The host-process workflow reads `REDIS_HOST`, `REDIS_PORT`, and optional `REDIS_PASSWORD` from the root `.env`.

### 3. Install dependencies

Run `npm ci` in each package directory:

```bash
npm ci --prefix gateway
npm ci --prefix services/auth-service
npm ci --prefix services/certificate-service
npm ci --prefix services/blockchain-service
npm ci --prefix services/ipfs-service
npm ci --prefix blockchain
npm ci --prefix client
```

### 4. Configure the blockchain

For a local Hardhat chain, set `HARDHAT_NETWORK_URL=http://127.0.0.1:8545` and `LOCAL_HARDHAT_RPC_URL=http://127.0.0.1:8545` in `.env`.

In one terminal:

```bash
cd blockchain
npm run node
```

In another terminal, deploy the contract:

```bash
cd blockchain
npm run deploy:local
```

The deployment script writes the new contract address to the root `.env` and deployment metadata to `blockchain/deployment.json`. Hardhat's local test accounts and keys are public development fixtures; never use them on Sepolia or another public network.

For Sepolia, set `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in the root `.env`, fund a dedicated test wallet with Sepolia ETH, and run:

```bash
cd blockchain
npm run deploy:sepolia
```

Set `HARDHAT_NETWORK_URL` to the same Sepolia RPC endpoint and use the resulting `CONTRACT_ADDRESS`. Use a new contract for the current privacy-preserving contract version; older public-data deployments are incompatible. Keep the private key on the backend only.

### 5. Create the first administrator

Set `LOCAL_ADMIN_EMAIL` and a private `LOCAL_ADMIN_PASSWORD` of at least 24 characters in `.env`, then run once:

```bash
npm run bootstrap-admin --prefix services/auth-service
```

The bootstrap creates an administrator only when the configured database has no admin. Public registration cannot create admin accounts.

### 6. Start Credora

```bash
./start.sh
```

The script starts the backend services and Vite client, waits for health checks, and starts a local Hardhat node only when the configured RPC is localhost. The app is at `http://localhost:5173`; the API gateway is at `http://localhost:3000`.

To stop the host processes:

```bash
./stop.sh
```

Alternatively, start each backend package with `npm run dev` in separate terminals and start the frontend with `npm run dev --prefix client`.

## Local Docker workflow

The root Compose file starts MongoDB, Redis, a local Hardhat node and deployer, the four backend services, and the API gateway:

```bash
docker compose up --build
```

The React client is not included in Compose. Start it separately:

```bash
npm run dev --prefix client
```

Compose defaults to its local MongoDB and Hardhat chain. The host ports bind to loopback. For Atlas-backed Compose, set `DOCKER_MONGODB_URI`. To point the containerized blockchain service to Sepolia, set all three values to matching deployment settings: `DOCKER_HARDHAT_NETWORK_URL`, `DOCKER_CONTRACT_ADDRESS`, and `DOCKER_DEPLOYER_PRIVATE_KEY`. The Compose defaults are for local development only.

Stop containers while preserving the MongoDB volume:

```bash
docker compose down
```

Delete the local MongoDB volume as well (this permanently deletes its data):

```bash
docker compose down --volumes
```

## Environment variables

The commented [.env.example](.env.example) is the complete root environment template. The client has a separate [client/.env.example](client/.env.example); its only current setting is the public API base path. Main settings:

| Group | Variables | Purpose |
|---|---|---|
| Runtime | `NODE_ENV`, `LOG_LEVEL`, `SERVICE_NAME`, service port variables | Runtime mode, logging, and local ports |
| Data services | `MONGODB_URI`, `DOCKER_MONGODB_URI`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | MongoDB and Redis connection settings; Compose overrides host names for its network |
| Secrets | `JWT_SECRET`, `JWT_EXPIRES_IN`, `INTERNAL_SERVICE_TOKEN`, `CERTIFICATE_ENCRYPTION_KEY` | User sessions, internal service calls, and encrypted PDFs |
| Admin bootstrap | `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD` | One-time first-admin setup |
| Browser/service URLs | `CORS_ORIGIN`, `FRONTEND_URL`, `AUTH_SERVICE_URL`, `CERTIFICATE_SERVICE_URL`, `BLOCKCHAIN_SERVICE_URL`, `IPFS_SERVICE_URL`, `VITE_API_URL` | Browser origin, QR link origin, service routing, and client API path |
| Blockchain | `HARDHAT_NETWORK_URL`, `LOCAL_HARDHAT_RPC_URL`, `CONTRACT_ADDRESS`, `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY` | Backend RPC, contract, and deployment wallet configuration |
| Docker blockchain overrides | `DOCKER_HARDHAT_NETWORK_URL`, `DOCKER_CONTRACT_ADDRESS`, `DOCKER_DEPLOYER_PRIVATE_KEY` | Compose blockchain service settings; set all three together for Sepolia |
| Pinata | `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `PINATA_GATEWAY` | Optional encrypted IPFS backup configuration |

Use separate values for development and hosting. `VITE_API_URL` is compiled into the browser bundle and must never contain a private key or backend secret.

## AWS demo hosting status

The repository currently contains a local-development Compose stack, not a ready-to-launch public deployment. It has no production frontend server, uses local Hardhat/MongoDB defaults, and currently hard-codes the QR origin in Compose. A public AWS Lightsail/EC2 demo therefore needs a demo-specific deployment configuration before starting it on a public server.

For a demo, use a fresh Sepolia wallet and contract, a separate Atlas database such as `credora_demo`, a stable encryption key, and an HTTPS `FRONTEND_URL`/`CORS_ORIGIN`. Expose only the HTTPS entrypoint publicly; keep MongoDB, Redis, the gateway's internal services, and RPC ports private. Use fictional student data. Do not deploy with a wallet key that has been shared or committed.

## API reference

All browser API calls go through the gateway at `http://localhost:3000` in local development.

### Authentication and institutions — `/api/auth`

| Method | Path | Access |
|---|---|---|
| `POST` | `/register` | Public registration (no email verification currently) |
| `POST` | `/login` | Public login |
| `POST` | `/logout` | Signed-in user |
| `GET` | `/profile` | Signed-in user |
| `PUT` | `/profile` | Signed-in user |
| `GET` | `/users` | Admin |
| `PUT` | `/users/:id/role` | Admin |
| `POST` | `/institutions` | Admin; add institution |
| `GET` | `/institutions` | Admin; list institutions |
| `PUT` | `/institutions/:id/approve` | Admin; approve institution |

### Credentials — `/api/certificates`

| Method | Path | Access |
|---|---|---|
| `GET` | `/verify/:certId` | Public bearer/share link |
| `POST` | `/preview` | University or admin |
| `POST` | `/issue` | University or admin |
| `GET` | `/stats` | Signed-in admin, university, or student |
| `GET` | `/student/:email` | Student or admin; ownership is checked |
| `GET` | `/institution/:id` | University or admin; institution access is checked |
| `GET` | `/all` | Admin |
| `GET` | `/audit/:certId` | Signed-in user |
| `GET` | `/:certId/pdf` | Student, university, or admin; ownership/access is checked |
| `GET` | `/:certId` | Student, university, or admin; ownership/access is checked |
| `PUT` | `/revoke/:certId` | University or admin |

### Internal services

Blockchain routes are under `/api/blockchain`. Write operations require `x-internal-service-token`; read verification and audit routes are available through the gateway. IPFS routes are under `/api/ipfs` and require the same internal token. They are intended for backend workers, not direct browser use.

### Health checks

| Local endpoint | Service |
|---|---|
| `http://localhost:3000/health` | API gateway |
| `http://localhost:3001/health` | Auth |
| `http://localhost:3002/health` | Certificate |
| `http://localhost:3003/health` | Blockchain |
| `http://localhost:3004/health` | IPFS |

## Checks

```bash
npm run build --prefix client
npm test --prefix blockchain
npm run compile --prefix blockchain
docker compose config --quiet
docker compose build
```

The contract tests run against the local Hardhat test environment; they do not issue transactions to Sepolia.

## Known prototype limitations

- No email ownership verification or password recovery.
- No CSV/bulk issuance.
- No separate university wallet signature or external source-data validation.
- The public QR/share link is a bearer link to credential details.
- This repository does not yet include production/demo Compose, frontend hosting, backup, or monitoring configuration.

## License

No software license is included yet. All rights are reserved unless the project maintainers add a license file.
