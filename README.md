# PanelHub - Multi-Tenant SaaS Admin Platform for 3x-ui VPN Panels

**PanelHub** is a provider-agnostic, multi-tenant SaaS management platform for orchestrating and administering multiple [3x-ui](https://github.com/MHSanaei/3x-ui) VPN panels from a single, centralized dashboard.

---

## Key Features & Highlights

- **Provider-Agnostic Dashboard**: Connect to any number of 3x-ui panels running on standard VPS providers (DigitalOcean, Hetzner, AWS, Linode, bare-metal).
- **AES-256-GCM Credential Encryption**: Panel passwords are encrypted at rest using AES-256-GCM with a dedicated 96-bit IV and 128-bit authentication tag.
- **In-Memory Decryption Only**: Plaintext passwords and ciphertexts are **never** returned in any API response and **never** written to application logs. Decryption occurs only in memory right before dispatching HTTP calls to the downstream 3x-ui panel.
- **Zero Inbound or Client Storage**: Inbounds and clients are **never** stored in MongoDB. All client metrics, bandwidth usage, and expiration statuses are fetched live from the 3x-ui API on request.
- **Strict Multi-Tenancy**: Complete tenant isolation guaranteed at the query level by validating that `ownerId` matches the authenticated JWT user on every server and client action.
- **Universal Protocol Support**: Live client administration across **VLESS**, **VMess**, **Trojan**, and **Shadowsocks** inbounds.
- **Live Client Lifecycle Actions**:
  - Update Client: expiry date, bandwidth quota (`totalGB`), and enabled/disabled state.
  - Reset Client Traffic: reset upstream and downstream counters live on the 3x-ui panel.
  - Delete Client: remove clients live from the panel.
  - Add Client: provision clients directly onto designated inbounds.
- **Production-Grade Rate Limiting**: Built-in rate limiters on authentication routes (prevent brute force) and 3x-ui proxy endpoints (protect downstream panels from overloading).
- **Self-Signed SSL Support**: Seamlessly connects to 3x-ui panels configured with self-signed SSL certificates or IP-based HTTPS.
- **Integrated Dev Mock Panel**: Includes a built-in mock 3x-ui panel for rapid local testing and development without requiring an active remote VPS.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js (v20+), Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs |
| **Cryptography** | Node.js built-in `crypto` (`aes-256-gcm`) |
| **Deployment** | Docker, Docker Compose |

---

## Architecture & Data Flow

```
                      +-----------------------------------+
                      |   React Web Dashboard (SPA)       |
                      | (Cards, Tables, Modals, Lucide)   |
                      +-----------------+-----------------+
                                        |
                            JWT Bearer  |  REST API
                                        v
                      +-----------------+-----------------+
                      |     PanelHub Express Backend      |
                      |  - Rate Limiters (Auth & Proxy)   |
                      |  - JWT Authentication Guard       |
                      |  - Strict Multi-Tenancy Guards    |
                      +-------+-------------------+-------+
                              |                   |
        AES-256-GCM Encrypted |                   | Live In-Memory
            Credential Store  |                   | Proxy Calls
                              v                   v
                   +----------+----+     +--------+--------+
                   |    MongoDB    |     |   3x-ui Panels  |
                   | (User, Server)|     |  (Live Inbounds |
                   |  Zero Client  |     |   & Live Client |
                   |  Collections  |     |   Statistics)   |
                   +---------------+     +-----------------+
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` — Register a platform administrator account.
- `POST /api/auth/login` — Authenticate and receive a JWT session token.
- `GET /api/auth/me` — Return current authenticated user profile.

### Server Management
- `GET /api/servers` — List this user's connected panels (credentials never returned).
- `POST /api/servers` — Connect a panel (password is encrypted using AES-256-GCM before saving).
- `GET /api/servers/:id` — Retrieve details for a specific server owned by the user.
- `DELETE /api/servers/:id` — Disconnect/remove a server from the platform.
- `POST /api/servers/:id/test` — Test live reachability and credentials against the 3x-ui panel.

### Live 3x-ui Inbounds & Client Proxy
- `GET /api/servers/:id/inbounds` — Backend decrypts creds in memory, logs into 3x-ui panel, fetches inbound list live.
- `GET /api/servers/:id/inbounds/:inboundId/clients` — Fetch clients for that inbound live with up/down usage and expiration.
- `POST /api/servers/:id/inbounds/:inboundId/clients` — Provision a new client live onto the panel inbound.
- `PATCH /api/servers/:id/clients/:clientId` — Update expiry, bandwidth quota (`totalGB`), or enabled state live.
- `DELETE /api/servers/:id/clients/:clientId` — Delete client live from 3x-ui panel.
- `POST /api/servers/:id/clients/:clientId/reset-traffic` — Reset upload and download counters live on the panel.

---

## How 3x-ui API Works Under the Hood

PanelHub integrates directly with standard 3x-ui panels (MHSanaei / FranzKafkaYu):

1. **Authentication**:
   - `POST /login` with `{ username, password }`
   - Response sets session cookies (`Set-Cookie: session=...; Path=/; HttpOnly`).
   - PanelHub retains the session cookie for subsequent operations.
2. **Inbounds Retrieval**:
   - `GET /panel/api/inbounds/list`
   - Returns array of inbounds with protocol, port, up/down traffic, and embedded `settings` JSON string containing clients.
3. **Client Identification**:
   - VMESS / VLESS: Uses client UUID (`client.id`).
   - TROJAN: Uses client password (`client.password`).
   - Shadowsocks: Uses client email (`client.email`).
4. **Client Updating**:
   - `POST /panel/api/inbounds/updateClient/:clientId`
   - Payload: `{ id: inboundId, settings: JSON.stringify({ clients: [ ...updatedClient ] }) }`
5. **Client Deletion**:
   - `POST /panel/api/inbounds/:inboundId/delClient/:clientId`
6. **Traffic Reset**:
   - `POST /panel/api/inbounds/:inboundId/resetClientTraffic/:email`

---

## Cryptography & Security Specifications

### Master Key (`process.env.MASTER_KEY`)
The master key is supplied via the environment variable `MASTER_KEY`. It must be a 32-byte key (e.g. 64 hexadecimal characters):

```bash
# Generate a secure 32-byte key
openssl rand -hex 32
```

### Encryption Function (`encrypt.js`)
- Generates a random 12-byte (96-bit) IV via `crypto.randomBytes(12)` (NIST SP 800-38D recommended for GCM).
- Cipher: `crypto.createCipheriv('aes-256-gcm', key, iv)`.
- Obtains a 16-byte authentication tag via `cipher.getAuthTag()`.
- Persists:
  - `panelPasswordEncrypted` (hex)
  - `panelPasswordIv` (hex)
  - `panelPasswordAuthTag` (hex)

### Decryption Function (`decrypt.js`)
- Recreates `crypto.createDecipheriv('aes-256-gcm', key, ivBuffer)`.
- Sets auth tag with `decipher.setAuthTag(authTagBuffer)`.
- Throws an authentication error if ciphertext or tag has been tampered with.

---

## Getting Started

### Prerequisites
- Node.js v20+ and npm
- MongoDB running locally or via Docker

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `MASTER_KEY` is configured:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/panelhub
JWT_SECRET=your_jwt_secret_key_here
MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
START_MOCK_PANEL=true
```

### 2. Run with Docker Compose

To run MongoDB and PanelHub together:

```bash
docker compose up -d --build
```

Access the dashboard at `http://localhost:5000`.

### 3. Run Locally

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies and build:

```bash
cd ../frontend
npm install
npm run build
```

Start the backend:

```bash
cd ../backend
npm start
```

Open your browser at `http://localhost:5000`.

---

## Running the Automated Test Suite

PanelHub includes a full suite of unit and end-to-end integration tests:
- Cryptographic roundtrips, tampering detection, and invalid input checks.
- 3x-ui API client tests against an automated mock panel.
- Full HTTP end-to-end multi-tenant isolation tests.
- Live client update, reset-traffic, and delete verification.

To run tests:

```bash
cd backend
npm test
```

---

## License

MIT