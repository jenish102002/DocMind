# DocMind Deployment — End-to-End Explained (Interview Study Guide)

A plain-English walkthrough of exactly what was deployed, every parameter chosen, and *why*.

---

## 0. The big picture

```
Browser
  │  https (443)
  ▼
Cloudflare Pages  ───────────────►  serves the React app (static HTML/JS/CSS)
(https://docmind-3hi.pages.dev)
  │
  │  the React app makes API calls (fetch) to:
  ▼
https://docmind-jenish.duckdns.org      (DuckDNS name → Elastic IP 13.126.178.89)
  │  https (443)
  ▼
AWS EC2 instance (t3.micro, Ubuntu)
  ┌──────────────────────────────────────────────┐
  │  Docker network (private)                     │
  │                                               │
  │  Caddy  ── reverse proxy, HTTPS ──► web:8000  │
  │  (80/443, only public container)              │
  │                                               │
  │  web (FastAPI)  ──► redis:6379  (auth/chat)   │
  │                 ──► qdrant:6333 (vectors)     │
  │                 ──► OpenAI API (internet)     │
  └──────────────────────────────────────────────┘
```

**Two hosting providers, on purpose:**
- **Frontend = static files** → best on a CDN (Cloudflare Pages). Free, fast, global.
- **Backend = a running server + databases** → needs a real machine (AWS EC2).

---

## 1. EC2 — every parameter and why

EC2 = "Elastic Compute Cloud" = a rented virtual machine (VM) in Amazon's data center.

| Wizard field | What we chose | Why |
|---|---|---|
| **AMI** (Amazon Machine Image) | Ubuntu Server 24.04 LTS (64-bit x86) | The OS + disk template the VM boots from. Ubuntu LTS = stable, huge community, great Docker support. "LTS" = Long Term Support (5 yrs). |
| **Instance type** | **t3.micro** (2 vCPU, 1 GiB RAM) | `t3` = *burstable* family (cheap; CPU can briefly "burst" above baseline using credits). `micro` = smallest size that's Free-Tier eligible. |
| **Key pair** | `docmind-key` (RSA, `.pem`) | Your SSH login credential. AWS keeps the *public* key on the VM; you keep the *private* `.pem`. No password login — much safer. |
| **Security Group** | inbound 22, 80, 443 from `0.0.0.0/0` | A **virtual firewall**. Only these ports are reachable from the internet. (SSH, HTTP, HTTPS). Everything else is blocked. |
| **Storage** | 30 GiB gp3 EBS | The VM's hard drive. `gp3` = general-purpose SSD. Free tier includes 30 GB, so we maxed it (8 GB default was too small for Docker images). EBS = network-attached disk that persists. |

### Burstable (t3) in one sentence
A t3.micro has a *baseline* CPU allowance and earns "CPU credits" when idle; it spends them to burst when busy. Perfect for a demo with spiky, low average load.

### Security Group deep-dive (a favorite interview topic)
- It is **stateful**: if you allow inbound on 443, the response traffic is automatically allowed back out. You don't need a matching outbound rule.
- `0.0.0.0/0` means "any IPv4 address on earth." Fine for 80/443 (a public website). For 22 (SSH) it's acceptable for a demo because the `.pem` key still protects you, but tightening to "My IP" is the hardening move.
- Ports: **22 = SSH** (admin login), **80 = HTTP** (needed so Caddy can talk to Let's Encrypt), **443 = HTTPS** (real traffic).

---

## 2. Networking — Elastic IP + DuckDNS

**Problem:** a fresh EC2 gets a *random* public IP that **changes** every time you Stop/Start it. You can't point a domain at a moving target.

**Elastic IP** = a *static* public IP you reserve and "associate" to the instance. Now the IP is permanent: `13.126.178.89`.
- Parameter set: Resource type = **Instance**, chose our instance, left private IP auto.
- ⚠️ Cost gotcha (interview trivia): an Elastic IP is free **while attached to a running instance**; AWS charges for it only when it's left **unattached/idle**.

**DuckDNS** = free Dynamic-DNS. It maps a name → your IP:
- `docmind-jenish.duckdns.org` → `13.126.178.89`
- We need a **name** (not just an IP) because HTTPS certificates are issued to *domain names*, not raw IPs.

**DNS in one line:** DNS is the internet's phonebook — it translates human names into IP addresses.

---

## 3. Getting in — SSH & key permissions

```bash
chmod 400 docmind-key.pem                       # lock the key (owner read-only)
ssh -i docmind-key.pem ubuntu@13.126.178.89     # log in
```
- `chmod 400` — SSH **refuses** a private key that others can read. `400` = only you can read it.
- `ubuntu@` — the default admin username baked into the Ubuntu AMI (Amazon Linux uses `ec2-user`).
- `-i` — "identity file" = which private key to authenticate with.

**How SSH auth works:** the server has your *public* key; it challenges your client to prove you hold the matching *private* key. Nothing secret crosses the wire.

---

## 4. Preparing the server — swap + Docker

### Swap (virtual memory)
t3.micro has only **1 GiB RAM**. Docker builds + Qdrant can exceed that → the Linux "OOM killer" murders processes. **Swap** = a file on disk used as overflow RAM.
```bash
sudo fallocate -l 2G /swapfile      # create a 2 GB file
sudo chmod 600 /swapfile            # only root can read it
sudo mkswap /swapfile               # format it as swap
sudo swapon /swapfile               # enable it now
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # re-enable on every reboot
```
Swap is slower than RAM (it's disk), but it prevents crashes on a tiny box.

### Docker + Docker Compose
```bash
curl -fsSL https://get.docker.com | sudo sh   # official install script
sudo usermod -aG docker ubuntu                # run docker without sudo (next login)
```
- **Docker** = runs apps in **containers** (isolated, self-contained bundles of code + dependencies). "Works on my machine" → "works everywhere."
- **Docker Compose** = describes *multiple* containers + their network + volumes in one YAML file, started with one command.
- `usermod -aG docker` adds your user to the `docker` group so you don't need `sudo` each time (takes effect on the next SSH session).

---

## 5. The container stack (`deploy/docker-compose.prod.yml`)

Four containers on one private Docker network:

| Container | Image | Public? | Job | Persistence |
|---|---|---|---|---|
| **caddy** | `caddy:2-alpine` | **Yes** (80/443) | HTTPS + reverse proxy | volume for certs |
| **web** | built from our `Dockerfile` | No | FastAPI backend | — |
| **redis** | `redis:7-alpine` | No | users, sessions, chat history | `redis_data` volume |
| **qdrant** | `qdrant/qdrant` | No | vector embeddings | `qdrant_data` volume |

**Key design ideas an interviewer will like:**
1. **Only Caddy exposes ports.** `web`, `redis`, `qdrant` have **no** `ports:` mapping, so they're unreachable from the internet — reachable only *inside* the Docker network. This is a security best practice (minimize attack surface).
2. **Service names are hostnames.** Inside the network, `web` reaches Redis at `redis://redis:6379` and Qdrant at `http://qdrant:6333` — Docker's built-in DNS resolves the service name. No IPs hard-coded.
3. **Named volumes = durable data.** Containers are disposable; volumes (`redis_data`, `qdrant_data`, `caddy_data`) live on the EBS disk, so data + SSL certs survive `docker compose down` and reboots.
4. **`restart: unless-stopped`** — Docker restarts the containers automatically if they crash or the VM reboots. That's what makes the site "always on."

Start command:
```bash
docker compose -f docker-compose.prod.yml --env-file env.prod up -d --build
```
- `--env-file env.prod` — inject secrets/config (see §7).
- `up -d` — start in the background ("detached").
- `--build` — build the `web` image from our `Dockerfile` first.

---

## 6. HTTPS — Caddy + Let's Encrypt, and *why it's mandatory here*

**Why we couldn't skip HTTPS:** the Cloudflare frontend is served over `https://`. Browsers **block** an HTTPS page from calling an `http://` backend — this is the "mixed content" rule. So the backend *had* to be HTTPS too.

**Caddy** is a web server whose superpower is **automatic HTTPS**:
- On startup it sees `DOMAIN=docmind-jenish.duckdns.org` and asks **Let's Encrypt** (a free certificate authority) for a TLS certificate.
- Let's Encrypt verifies you actually control that domain (the **ACME challenge** — it connects back to your server on 80/443). That's why those ports are open in the Security Group.
- Caddy stores the cert in the `caddy_data` volume and **auto-renews** it forever.

**Reverse proxy** = Caddy is the single public front door. It terminates HTTPS, then forwards the request *inside* the network to `web:8000` (plain HTTP is fine there — it never leaves the box). Our `Caddyfile`:
```
{$DOMAIN} {
    reverse_proxy web:8000 {
        flush_interval -1      # don't buffer → streaming LLM answers work
    }
    encode gzip
}
```
`flush_interval -1` matters for this app specifically: it keeps the token-by-token **streaming** responses flowing instead of buffering them.

---

## 7. Secrets — `env.prod` (never in Git)

The app needs secrets: `OPENAI_API_KEY`, `JWT_SECRET`, plus config `DOMAIN` and `FRONTEND_URL`.
- These live **only** in `~/DocMind/deploy/env.prod` on the server, with perms `600` (owner-only).
- `.gitignore` excludes `env.prod`, so secrets **never** reach the public GitHub repo. Only `env.prod.example` (placeholders) is tracked.
- `JWT_SECRET` was generated fresh with `openssl rand -hex 32` — a long random string used to sign login tokens. Anyone who knows it could forge logins, hence keep it secret and per-environment.

**JWT (JSON Web Token) auth in one line:** on login the server signs a token with `JWT_SECRET`; the browser sends it on every request in the `Authorization: Bearer …` header; the server verifies the signature to know who you are — no server-side session storage needed.

---

## 8. Frontend — Cloudflare Pages + the CORS handshake

**Cloudflare Pages** builds your React app from GitHub and serves the static output on a global CDN.

Build settings we used:
| Setting | Value | Why |
|---|---|---|
| Root directory | `frontend` | the React app lives in a subfolder |
| Build command | `npm run build` | Vite compiles React → static files |
| Output directory | `dist` | Vite's build output |
| `VITE_API_URL` | `https://docmind-jenish.duckdns.org` | **baked into the build**; tells React where the backend is |
| `NODE_VERSION` | `20` | Vite 8 / React 19 need modern Node |

`VITE_...` variables are read at **build time** and hard-compiled into the JS bundle (that's a Vite rule). Change it → you must rebuild.

**CORS (Cross-Origin Resource Sharing):** the frontend origin (`docmind-3hi.pages.dev`) differs from the backend origin (`docmind-jenish.duckdns.org`). By default browsers block cross-origin API calls. The backend must explicitly *allow* the frontend origin. That's why the final step set `FRONTEND_URL` on the backend — FastAPI's CORS middleware then returns:
```
access-control-allow-origin: https://docmind-3hi.pages.dev
access-control-allow-credentials: true
```
Before a POST, the browser sends a **preflight** `OPTIONS` request to check permission; only if the server approves does the real request go.

---

## 9. Full request trace (memorize this for interviews)

**User signs up:**
1. Browser loads React app from **Cloudflare Pages** (HTTPS).
2. React `fetch('https://docmind-jenish.duckdns.org/api/auth/register', …)`.
3. DNS resolves the DuckDNS name → **Elastic IP** → the EC2 box.
4. Packet hits the **Security Group** (443 allowed) → **Caddy**.
5. Caddy terminates **TLS**, reverse-proxies to **`web:8000`** over the private network.
6. **FastAPI** hashes the password, stores the user in **Redis**, signs a **JWT**, returns it.
7. Response flows back out through Caddy (HTTPS) → browser stores the token.

**User asks a question about a PDF:** same path to FastAPI, which embeds the query (OpenAI), does an **MMR vector search in Qdrant**, builds a prompt with the top chunks + chat history (Redis), and **streams** the answer from OpenAI back through Caddy (kept live by `flush_interval -1`).

---

## 10. Rapid-fire interview Q&A

- **Why EC2 and not Lambda?** The app streams responses and runs background ingestion jobs, and self-hosts Redis + Qdrant — none of which fit Lambda's stateless, short-lived model. Lambda would also need a NAT Gateway (~$32/mo) to reach the internet + databases.
- **Why one instance for everything?** It's a demo — cheapest, simplest, and it showcases containers, networking, and reverse-proxy skills. Production would split DBs onto managed services (ElastiCache) and run multiple app instances behind a load balancer.
- **How does it stay up after reboot?** `restart: unless-stopped` on every container + swap enabled via `/etc/fstab`.
- **How is data persisted?** Docker **named volumes** on the EBS disk (Redis AOF file, Qdrant storage). Containers are stateless and replaceable.
- **How do you get HTTPS for free?** Caddy auto-obtains and renews a Let's Encrypt certificate via the ACME protocol.
- **Where are secrets?** In `env.prod` on the server (perms 600, gitignored) — never in the image or repo.
- **How would you scale it?** Move Redis → ElastiCache, run Qdrant on its own node/cluster, containerize web behind an Application Load Balancer with auto-scaling, and put a CI/CD pipeline (GitHub Actions) in front.
- **Biggest risk on t3.micro?** Memory. Mitigated with 2 GB swap; the real fix is a larger instance.

---

## Cheat-sheet commands

```bash
# SSH in
ssh -i ~/Downloads/docmind-key.pem ubuntu@13.126.178.89

# See running containers
cd ~/DocMind/deploy
docker compose -f docker-compose.prod.yml --env-file env.prod ps

# Tail backend logs
docker compose -f docker-compose.prod.yml --env-file env.prod logs web --tail 50

# Redeploy after a git push
git pull && docker compose -f docker-compose.prod.yml --env-file env.prod up -d --build

# Restart everything
docker compose -f docker-compose.prod.yml --env-file env.prod restart
```
