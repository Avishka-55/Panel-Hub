<div align="center">

# 🛡️ PanelHub

### Enterprise Multi-Tenant SaaS Orchestrator for 3x-ui VPN Panels

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_Ready-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PM2](https://img.shields.io/badge/PM2-Clustered-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io)
[![CI/CD](https://img.shields.io/badge/GitHub_Actions-Automated_Deploy-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>A unified, provider-agnostic command center to monitor, administer, and orchestrate distributed 3x-ui (Xray) nodes across any cloud or bare-metal infrastructure.</b>
</p>

[Key Features](#-key-features) •
[Architecture](#-system-architecture) •
[Quickstart](#-quickstart-guide) •
[Production Deployment](#-production-deployment-ubuntu--pm2--nginx) •
[API Reference](#-api-specification) •
[Security & Vault](#-enterprise-cryptography--security)

</div>

---

## 🌟 Executive Overview

**PanelHub** transforms standalone [3x-ui](https://github.com/MHSanaei/3x-ui) instances into a centralized, resilient SaaS platform. Designed for infrastructure operators, service providers, and multi-cloud administrators, PanelHub eliminates the friction of managing disparate panels across different cloud providers, domains, and credentials.

Built with a **Zero-Client-Storage** architecture and **AES-256-GCM** hardware cryptographic envelope, PanelHub queries and mutates proxy tunnels directly in memory—ensuring sensitive client traffic, passwords, and private UUIDs never reside at rest on the orchestrator.

---

## 🚀 Key Features

### 🖥️ Multi-Panel Central Command
- **Provider Agnostic**: Connect and orchestrate any number of 3x-ui panels running on Hetzner, DigitalOcean, Oracle Cloud, AWS, Linode, or on-premise bare-metal.
- **Universal Protocol Orchestration**: Native live lifecycle management for **VLESS**, **VMess**, **Trojan**, and **Shadowsocks** inbounds.
- **Live Hardware Telemetry**: Real-time streaming metrics per node: **CPU load**, **RAM consumption**, **Disk/Storage volume**, **System Uptime**, and **Network I/O throughput**.

### ⚡ Xray Core Engine Management
- **Remote Core Engine Restart**: Restart the underlying Xray process on any connected node with a single click (`POST /panel/api/server/restartXrayService`) with automatic fallbacks for older panel forks.
- **Tunnel Safety Safeguards**: Built-in confirmation modals warning of momentary client reconnection cycles before dispatch.

### 🛡️ Enterprise Cryptography & Tenant Isolation
- **AES-256-GCM Encryption**: Server passwords and API keys are encrypted at rest with a unique 96-bit Initialization Vector (IV) and 128-bit authentication tag.
- **In-Memory Decryption Only**: Raw credentials and ciphertexts are never returned in API payloads or written to application logs. Decryption occurs strictly in-memory during outbound proxy dispatches.
- **Strict Multi-Tenancy**: Tenant boundary enforcement at the database query layer. Every server, inbound, and client action validates authenticated JWT tenancy.

### 👥 Live Client Lifecycle & Batch Administration
- **Zero Client Storage**: Inbounds and clients are **never** stored in MongoDB. All quotas, expirations, and traffic metrics are queried live from downstream panels.
- **Instant Client Activation / Deactivation**: Toggle client access on the fly with live status badges.
- **Bulk Client Operations**: Select all or multiple clients to execute mass activation or deactivation in a single atomic batch.
- **Compact UUID Management**: Clean formatted UUID display with one-click full clipboard copy.
- **Traffic Counter Resets**: Reset upstream/downstream client consumption directly from the dashboard.

### 🔔 Autonomous Health Monitoring & Email Alerts
- **Autonomous Node Sentinel**: Background poller sweeps all connected panels every 5 minutes, tracking latency, network reachability, and hardware status.
- **Brevo Email Notifications**: Automatic, instant alerts delivered via Brevo REST API / SMTP when a server becomes unreachable or recovers from downtime.
- **Granular Threshold Configuration**: Customize consecutive failure sensitivity (1, 2, or 3 failures) and optional high-resource thresholds (CPU / RAM > 90%).
- **Scheduled Daily Operations Digest**: Daily morning executive digest detailing online status, active inbound counts, registered clients, and cumulative platform bandwidth.

### 🌐 Cloud-Ready & Ultra-Low Footprint
- **MongoDB Atlas Integration**: Native support for cloud MongoDB Atlas (M0 Free Tier). Runs without any local database overhead, saving ~250 MB VM memory.
- **Minimal Resource Footprint**: Runs comfortably in **< 40 MB RAM** on low-spec VMs (e.g. 1 GB RAM / 2 Core instances) side-by-side with existing applications.
- **Collapsible Responsive Workspace**: Modern sidebar with quick-access badges, <kbd>Ctrl</kbd>+<kbd>B</kbd> toggle shortcut, and mobile drawer mode.
- **Automated CI/CD**: Built-in GitHub Actions workflow compiling frontend assets in the cloud and deploying zero-downtime updates over SSH with PM2.

---

## 🏛️ System Architecture

```
                                  [ Administrators / Tenants ]
                                                │
                                    HTTPS / 443 │ (Reverse Proxy)
                                                ▼
                                   +-------------------------+
                                   |       NGINX Engine      |
                                   |  hub.yourdomain.com:443 |
                                   +------------+------------+
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
          Static Assets│ (SPA)                              REST API /   │ WebSockets
          /var/www/dist│                                    127.0.0.1    │ :5000
                       ▼                                                 ▼
        +-----------------------------+                  +-------------------------------+
        |    React 18 + Vite Frontend |                  |   PanelHub Express Backend    |
        |  - Collapsible Navigation   |                  |  - Rate Limiting & Helmet     |
        |  - Live Hardware Telemetry  |                  |  - JWT Tenancy Guard          |
        |  - Client CRUD & Modals     |                  |  - Autonomous Health Monitor  |
        +-----------------------------+                  |  - Scheduled Daily Reporter   |
                                                         +---------------+---------------+
                                                                         │
                                         ┌───────────────────────────────┴───────────────────────────────┐
                                         │                                                               │
                         AES-256-GCM     │                                             Live In-Memory    │ HTTPS (Self-Signed OK)
                         Encrypted Creds │                                             Proxy Requests    │ (Port 2053)
                                         ▼                                                               ▼
                        +--------------------------------+                             +--------------------------------+
                        |     MongoDB Atlas (Cloud)      |                             |   Distributed 3x-ui Panels     |
                        |   - Tenants (Admins)           |                             |   Node 1 (Hetzner)             |
                        |   - Server Connection Profiles |                             |   Node 2 (DigitalOcean)        |
                        |   - Alert Configuration        |                             |   Node 3 (Oracle Cloud)        |
                        |   * Zero Clients Stored at Rest|                             |   - Live Inbounds & Clients    |
                        +--------------------------------+                             |   - Hardware Resources & Xray  |
                                                                                       +--------------------------------+
```

---

## 🛠️ Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite | High-performance Single Page Application with optimized bundle chunking |
| **Styling & Icons** | Tailwind CSS, Lucide React | Clean, hardware-accelerated dark theme UI with responsive drawers |
| **Backend Runtime** | Node.js (v20+ LTS), Express | Asynchronous event-driven REST API orchestrator |
| **Process Manager** | PM2 | Production clustered daemon with auto-recovery and memory monitoring |
| **Database** | MongoDB Atlas / Mongoose | Encrypted tenant profiles, server metadata, and monitoring preferences |
| **Cryptography** | Node.js `crypto` (`aes-256-gcm`) | Hardware-accelerated NIST SP 800-38D envelope encryption |
| **Email Transport** | Brevo API & SMTP Relay | Transactional password resets, OTP verification, and downtime alerts |
| **Reverse Proxy** | Nginx | TLS termination, HTTP/2, Gzip compression, and asset caching |
| **CI/CD Pipeline** | GitHub Actions | Automated cloud asset compilation and zero-downtime SSH deployment |

---

## ⚡ Quickstart Guide

### Prerequisites
- Node.js v20+ LTS
- A MongoDB database (Local Docker or [MongoDB Atlas Free Tier](https://www.mongodb.com/atlas))
- (Optional) Free [Brevo Account](https://www.brevo.com) for email alerts

### 1. Clone & Configure
```bash
git clone https://github.com/Avishka-55/Panel-Hub.git
cd Panel-Hub
```

### 2. Configure Environment Variables
Copy the example environment configuration into `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your preferred settings:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/panelhub?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-random-secure-jwt-key
MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
START_MOCK_PANEL=true

# Brevo Email Alerts (Optional)
BREVO_API_KEY=xkeysib-your-brevo-api-key
EMAIL_FROM=admin@yourdomain.com
EMAIL_FROM_NAME="PanelHub Security"
HEALTH_CHECK_INTERVAL_MINUTES=5
```

> **Tip:** Generate a cryptographically secure 32-byte (64-character hex) `MASTER_KEY`:
> ```bash
> openssl rand -hex 32
> ```

### 3. Install & Start Development Servers

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd ../frontend
npm install
npm run dev
```

Open your browser at **`http://localhost:3000`**.  
*(The backend includes an automatic Mock 3x-ui panel at `http://127.0.0.1:2053` with username `admin` and password `password123` for instant out-of-the-box testing without needing an external VPS!)*

---

## 🚢 Production Deployment (Ubuntu + PM2 + Nginx)

PanelHub is optimized to run smoothly on small VMs (e.g. **1 GB RAM / 2 vCPUs**) alongside other production services.

### 1. Build the Frontend
```bash
cd frontend
npm install
npm run build
```
The compiled, production-ready static files are written to `frontend/dist/`.

### 2. Run the Backend with PM2
Install PM2 globally and start the Node.js backend:
```bash
sudo npm install -g pm2
cd ../backend
npm install --omit=dev
pm2 start src/server.js --name "panelhub"
pm2 save
pm2 startup
```

### 3. Nginx Reverse Proxy & SSL Configuration
Create a dedicated site configuration file at `/etc/nginx/sites-available/panelhub`:

```nginx
# 1. HTTP Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name hub.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hub.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/hub.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hub.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;
    keepalive_timeout 65;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Serve Frontend (React SPA)
    root /var/www/panelhub/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache Static Bundles
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Proxy API & MCP Requests to Backend (Port 5000)
    location ~ ^/(api|mcp)/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/panelhub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hub.yourdomain.com
```

---

## 🔄 Automated CI/CD Pipeline (GitHub Actions)

PanelHub includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that automatically builds and deploys to your production server on every `git push origin main`.

### How it Works:
1. **Cloud Compilation**: The React SPA is built inside GitHub's free runners (7 GB RAM), saving your VM from memory exhaustion.
2. **Rsync Transfer**: Code and built assets are synced over SSH directly to `/var/www/panelhub/`.
3. **Environment Injection**: Production secrets are injected into `/var/www/panelhub/backend/.env`.
4. **Zero-Downtime Reload**: PM2 gracefully reloads the process with zero dropped connections.

### Required GitHub Secrets:
Add the following secrets in **Settings ➔ Secrets and variables ➔ Actions**:

| Secret Name | Example Value | Description |
| :--- | :--- | :--- |
| `VM_SSH_HOST` | `203.0.113.10` / `hub.yourdomain.com` | Public IP or hostname of your production VM |
| `VM_SSH_USER` | `ubuntu` | Remote SSH user |
| `VM_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Private SSH key authorized in `~/.ssh/authorized_keys` |
| `VM_SSH_PORT` | `22` | SSH port (defaults to 22) |
| `PROD_MONGODB_URI` | `mongodb+srv://...` | Cloud MongoDB Atlas connection string |
| `PROD_JWT_SECRET` | `your-secure-jwt-secret` | Cryptographic secret for signing JWT sessions |
| `PROD_MASTER_KEY` | `64-character-hex-string` | 32-byte AES-256 master credential key |
| `PROD_BREVO_API_KEY` | `xkeysib-...` | Brevo transactional API key |
| `PROD_EMAIL_FROM` | `admin@yourdomain.com` | Verified Brevo sender email |

---

## 📡 API Specification

All endpoints (except public authentication routes) require a JWT Bearer token:
`Authorization: Bearer <token>`

### 🔑 Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new platform administrator |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated administrator profile |
| `POST` | `/api/auth/forgot-password` | Dispatch 6-digit password reset OTP to email |
| `POST` | `/api/auth/reset-password` | Validate reset OTP and apply new password |

### 🖥️ Server Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/servers` | List all connected panels for this tenant |
| `POST` | `/api/servers` | Connect new 3x-ui panel (encrypts credentials) |
| `GET` | `/api/servers/:id` | Fetch specific panel configuration |
| `DELETE` | `/api/servers/:id` | Disconnect panel from orchestrator |
| `POST` | `/api/servers/:id/test` | Test live panel reachability and credentials |
| `GET` | `/api/servers/:id/status` | Fetch real-time hardware telemetry (CPU, RAM, Disk, Uptime) |
| `POST` | `/api/servers/:id/restart-xray` | Trigger Xray Core engine restart on downstream panel |

### 👥 Live Inbounds & Client Proxy
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/servers/:id/inbounds` | Fetch live inbounds directly from 3x-ui panel |
| `GET` | `/api/servers/:id/inbounds/:inboundId/clients` | Fetch live clients with traffic consumption & status |
| `POST` | `/api/servers/:id/inbounds/:inboundId/clients` | Provision new client directly onto panel inbound |
| `PATCH` | `/api/servers/:id/clients/:clientId` | Update client quota, expiration, or enable/disable state |
| `POST` | `/api/servers/:id/clients/:clientId/reset-traffic` | Reset client upload/download counters on panel |
| `DELETE` | `/api/servers/:id/clients/:clientId` | Delete client live from 3x-ui panel |

### 🔔 Health & Monitoring
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/servers/health/check-all` | Trigger immediate health sweep across all tenant servers |
| `PATCH` | `/api/servers/:id/monitoring` | Update notification preferences & failure thresholds |
| `POST` | `/api/servers/:id/monitoring/test-alert` | Dispatch verification sample email to test inbox |
| `GET` | `/api/reports/daily/preview` | Preview real-time metrics for daily operations digest |
| `PATCH` | `/api/reports/daily/preferences` | Configure preferred delivery UTC hour and enabled state |
| `POST` | `/api/reports/daily/send-now` | Force immediate dispatch of daily operations digest |

### 🤖 Model Context Protocol (MCP) & AI Integration
Connect Claude Desktop, Cursor, ChatGPT, and AI agents directly to PanelHub via Server-Sent Events (SSE).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/mcp` / `/mcp` | MCP service discovery and capabilities manifest |
| `GET` | `/api/mcp/sse` / `/mcp/sse` | Establish persistent SSE transport connection (`Bearer` or `?apiKey=`) |
| `POST` | `/api/mcp/messages` / `/mcp/messages` | Dispatch JSON-RPC tool calls and messages for active SSE session |

#### Available MCP Tools
- `list_vpn_servers`: List all connected 3x-ui servers owned by the user, including health & stats.
- `get_server_status`: Fetch real-time hardware telemetry and Xray health for a server.
- `list_inbounds`: List inbounds, ports, protocols (VLESS/VMess/Trojan/Shadowsocks), client counts.
- `list_clients`: Inspect active clients, traffic consumption, and expiration dates.
- `add_client`: Provision new VPN client with quota and expiration.
- `delete_client`: Delete a client by ID/UUID from an inbound.
- `reset_client_traffic`: Reset uploaded/downloaded bandwidth counters for a client email.
- `restart_xray`: Reboot the live Xray core engine.
- `get_client_link`: Retrieve the direct connection URI (vless://, vmess://, trojan://, shadowsocks://) and 3x-ui subscription URL for any client.

---

## 🔒 Enterprise Cryptography & Security

### 1. AES-256-GCM Envelope Encryption
Panel passwords and API tokens are never stored in plaintext:
- **Cipher**: `aes-256-gcm`
- **Key**: 32-byte (256-bit) cryptographically random master key (`MASTER_KEY`)
- **Initialization Vector (IV)**: 12-byte (96-bit) unique IV generated per record via `crypto.randomBytes(12)`
- **Integrity Authentication Tag**: 16-byte (128-bit) GCM authentication tag verifying ciphertext authenticity
- **Tamper Protection**: Any bit modification in ciphertext or auth tag immediately throws `ERR_CRYPTO_INITIALIZATION_ERROR` and rejects decryption.

### 2. Tenant Isolation
Every database query enforces tenant boundaries:
```javascript
const server = await Server.findOne({ _id: serverId, ownerId: req.user._id });
if (!server) {
  return res.status(404).json({ success: false, error: 'Server not found or access denied' });
}
```

### 3. Password Hashing & Brute-Force Rate Limiting
- Administrative account passwords are salted and hashed using **bcrypt** with a work factor of 10.
- Sensitive routes (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`) are guarded by rate limiters to prevent credential stuffing.

---

## 🧪 Automated Testing Suite

PanelHub includes a comprehensive unit and integration test suite executing 45 automated test scenarios:
- **Cryptographic verification**: Roundtrips, tampering resistance, and corrupted tag detection.
- **3x-ui API client tests**: Inbounds querying, client updates, traffic resets, and Xray restarts against an automated mock server.
- **Multi-tenant isolation**: Query validation ensuring User B cannot inspect or mutate User A's panels.
- **Email isolation**: Safe test-mode mocking ensuring test runs **never consume production Brevo credits**.

To execute the test suite:
```bash
cd backend
npm test
```

```text
✔ Crypto utility: encrypt and decrypt roundtrip (2ms)
✔ Tenant Isolation: User B cannot view User A servers (12ms)
✔ Server Status Proxy: GET /api/servers/:id/status fetches instance telemetry (21ms)
✔ Xray Restart Proxy: POST /api/servers/:id/restart-xray restarts Xray engine (34ms)
✔ Clients Proxy: PATCH /api/servers/:id/clients/:clientId updates client live (18ms)
ℹ tests 45
ℹ pass 45
ℹ fail 0
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <b>Built with precision for modern infrastructure operators.</b>
</div>