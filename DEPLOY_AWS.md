# 🚀 Deploying DocMind — Cloudflare (frontend) + AWS (backend + database)

A complete, beginner-friendly guide. No prior AWS knowledge needed. Follow it top
to bottom. Total cost: **~$0** for the first 12 months (AWS Free Tier + Cloudflare
free + DuckDNS free).

## What we're building

```
   Browser
      │  (HTTPS)
      ▼
┌──────────────────────┐        ┌───────────────────────────────────────────┐
│  Cloudflare Pages    │        │            AWS EC2 (one t3.micro box)       │
│  React frontend      │──────▶ │  Caddy (HTTPS) ─▶ FastAPI ─┬─▶ Redis        │
│  https://*.pages.dev │ HTTPS  │                            └─▶ Qdrant       │
└──────────────────────┘        └───────────────────────────────────────────┘
                                        (Redis + Qdrant = your "database")
```

- **Frontend** → Cloudflare Pages (free, global CDN)
- **Backend + database** → one AWS EC2 instance running Docker (FastAPI + Redis + Qdrant)
- **HTTPS** → free & automatic via Caddy + Let's Encrypt
- **Domain** → free subdomain from DuckDNS (needed so HTTPS works)

> **Why Redis + Qdrant are your "database":** DocMind doesn't use a SQL database.
> Redis stores users, sessions and chat history; Qdrant stores the PDF vector
> embeddings. Both run as containers on your EC2 box and save their data to disk,
> so nothing is lost when the server restarts.

---

# Part A — Prepare AWS (create account + a server)

## Step 1: Create an AWS account

1. Go to **https://aws.amazon.com** → **Create an AWS Account**.
2. Enter email, account name, and a password.
3. AWS **requires a credit/debit card** to verify identity. You will **not** be
   charged as long as you stay on Free Tier resources (this guide does).
4. Choose the **Basic (Free)** support plan.
5. Verify your phone number.

> 💡 After signing in, in the top-right corner pick a region close to you (e.g.
> **Mumbai `ap-south-1`** or **N. Virginia `us-east-1`**). Remember your choice —
> always work in the same region.

## Step 2: Launch an EC2 instance (your server)

1. In the AWS Console search bar, type **EC2** and open it.
2. Click **Launch instance**.
3. **Name:** `docmind-server`
4. **Application and OS Image:** choose **Ubuntu Server 24.04 LTS** (Free tier eligible).
5. **Instance type:** choose **`t3.micro`** (Free tier eligible). *(If `t3.micro`
   isn't marked free in your region, pick whichever `t2.micro`/`t3.micro` says
   "Free tier eligible".)*
6. **Key pair (login):** click **Create new key pair**.
   - Name: `docmind-key`
   - Type: RSA, Format: **.pem**
   - Click **Create** → a `docmind-key.pem` file downloads. **Keep this file safe —
     it's the only way to log into your server.**
7. **Network settings** → click **Edit**, and under *Firewall (security groups)*
   check these boxes / add rules so the following are **Allow**ed from `0.0.0.0/0`:
   - **SSH** (port 22) — so you can log in
   - **HTTP** (port 80) — for Caddy / certificate issuance
   - **HTTPS** (port 443) — for your API traffic
8. **Configure storage:** 30 GB gp3 (Free tier includes 30 GB — leave default or set 30).
9. Click **Launch instance**.

## Step 3: Give it a permanent IP (Elastic IP)

By default an EC2 IP changes if the box restarts. We pin it:

1. EC2 left menu → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select the new IP → **Actions → Associate Elastic IP address**.
3. Choose your `docmind-server` instance → **Associate**.
4. **Copy this IP** (e.g. `13.234.56.78`). You'll use it next. Call it `YOUR_EC2_IP`.

> ⚠️ Keep exactly **one** Elastic IP and keep it associated. An Elastic IP is only
> free while it's attached to a running instance.

---

# Part B — Free HTTPS domain (DuckDNS)

Cloudflare serves your frontend over HTTPS, and browsers refuse to let an HTTPS
page talk to a plain-HTTP backend. So the backend needs HTTPS too — which needs a
domain name. DuckDNS gives you one for free.

1. Go to **https://www.duckdns.org** → sign in (GitHub/Google).
2. Pick a subdomain, e.g. `docmind-demo` → it becomes **`docmind-demo.duckdns.org`**.
3. In the **current ip** box for that subdomain, paste **`YOUR_EC2_IP`** → **update ip**.
4. Your backend domain is now `docmind-demo.duckdns.org`. Call it `YOUR_DOMAIN`.

> Have your own domain instead? You can skip DuckDNS — just create a DNS **A record**
> pointing e.g. `api.yourdomain.com` → `YOUR_EC2_IP`, and use that as `YOUR_DOMAIN`.

---

# Part C — Put the app on the server

## Step 4: Connect to your server (SSH)

Open a terminal **on your Mac** (this project folder). Then:

```bash
chmod 400 ~/Downloads/docmind-key.pem
ssh -i ~/Downloads/docmind-key.pem ubuntu@YOUR_EC2_IP
```

- Replace `YOUR_EC2_IP` with your Elastic IP.
- Adjust the `.pem` path if you saved it elsewhere.
- Type `yes` when asked to trust the host.

You are now "inside" the server (your prompt changes to `ubuntu@...`).

## Step 5: Install Docker on the server

Paste this whole block into the server terminal:

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Then **log out and back in** so the docker permission applies:

```bash
exit
```
```bash
ssh -i ~/Downloads/docmind-key.pem ubuntu@YOUR_EC2_IP
```

Verify:

```bash
docker --version && docker compose version
```

## Step 5.5: Add swap (important on t3.micro — 1 GiB RAM)

t3.micro has only 1 GiB of RAM. Qdrant + the Docker build can exceed that and get
killed ("OOM"). A 2 GB swap file (free, uses disk) prevents this. Run once on the server:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # you should now see 2.0Gi of Swap
```

## Step 6: Get your code onto the server

**Option A — clone from GitHub (recommended if your repo is on GitHub):**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git docmind
cd docmind
```

**Option B — copy from your Mac** (run this in a **new terminal on your Mac**, not
the server):

```bash
cd ~/Downloads/Doc_Mind_aws
rsync -av --exclude node_modules --exclude .git --exclude 'backend/qdrant_local_db' \
  --exclude 'backend/temp_uploads' --exclude '.env' \
  -e "ssh -i ~/Downloads/docmind-key.pem" ./ ubuntu@YOUR_EC2_IP:~/docmind/
```

Then back on the **server**:

```bash
cd ~/docmind
```

## Step 7: Configure secrets on the server

```bash
cd ~/docmind/deploy
cp env.prod.example env.prod
nano env.prod
```

Fill in the values (arrow keys to move, type to edit):

| Variable | What to put |
|---|---|
| `DOMAIN` | `docmind-demo.duckdns.org` (your `YOUR_DOMAIN`, no `https://`) |
| `FRONTEND_URL` | your Cloudflare URL — set later; for now `https://your-app.pages.dev` |
| `OPENAI_API_KEY` | your real OpenAI key |
| `JWT_SECRET` | run `openssl rand -hex 32` in another terminal and paste the result |

Save in nano: **Ctrl+O → Enter**, then exit: **Ctrl+X**.

## Step 8: Start everything 🚀

```bash
cd ~/docmind/deploy
docker compose -f docker-compose.prod.yml --env-file env.prod up -d --build
```

First build takes a few minutes. Check it's healthy:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # Ctrl+C to stop watching
```

Now test HTTPS from your Mac's browser or terminal:

```bash
curl https://YOUR_DOMAIN/docs
```

You should get HTML back (FastAPI's API docs). 🎉 Your backend is live over HTTPS.

> If the certificate isn't ready instantly, wait ~30–60 seconds and retry — Caddy
> is fetching the Let's Encrypt cert. Make sure ports 80 and 443 are open in the
> security group (Step 2.7) and DuckDNS points at the right IP.

---

# Part D — Deploy the frontend to Cloudflare Pages

## Step 9: Push your code to GitHub (if not already)

Cloudflare Pages builds from a Git repo. From your **Mac**, in the project folder:

```bash
git add . && git commit -m "Add AWS + Cloudflare deployment config"
git push
```

## Step 10: Create the Cloudflare Pages project

1. Go to **https://dash.cloudflare.com** → create a free account / sign in.
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorize GitHub and pick your DocMind repo.
4. **Build settings:**
   - **Framework preset:** `Vite`
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Expand **Environment variables** and add:
   - Name: `VITE_API_URL`  Value: `https://YOUR_DOMAIN`  (e.g. `https://docmind-demo.duckdns.org`)
6. Click **Save and Deploy**. Wait for the build.
7. You get a URL like **`https://docmind-xyz.pages.dev`**. Open it — the app loads.

## Step 11: Connect the two sides (CORS)

The backend must trust your exact Cloudflare URL:

1. On the **server**: `nano ~/docmind/deploy/env.prod`
2. Set `FRONTEND_URL=https://docmind-xyz.pages.dev` (your real Pages URL, no trailing slash).
3. Restart the backend so it picks up the change:

```bash
cd ~/docmind/deploy
docker compose -f docker-compose.prod.yml --env-file env.prod up -d
```

Now open your `*.pages.dev` site → sign up → upload a PDF → chat. Done. ✅

---

# 🧰 Everyday commands (run on the server, in `~/docmind/deploy`)

```bash
# View status
docker compose -f docker-compose.prod.yml ps

# View logs (all services, or one)
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f web

# Restart after changing env.prod
docker compose -f docker-compose.prod.yml --env-file env.prod up -d

# Pull new code and rebuild
cd ~/docmind && git pull && cd deploy && \
  docker compose -f docker-compose.prod.yml --env-file env.prod up -d --build

# Stop everything (data is kept in volumes)
docker compose -f docker-compose.prod.yml down
```

---

# 🛟 Troubleshooting

| Symptom | Fix |
|---|---|
| `curl https://YOUR_DOMAIN/docs` hangs / cert error | Ports 80 & 443 must be open in the EC2 security group. Confirm DuckDNS IP = your Elastic IP. Check `docker compose logs -f caddy`. |
| Frontend loads but calls fail with CORS error | `FRONTEND_URL` in `env.prod` must exactly match your `*.pages.dev` URL (no trailing slash), then restart. |
| `docker: permission denied` | You skipped the logout/login in Step 5. `exit` and SSH back in. |
| Login works but data gone after reboot | Data lives in Docker volumes (`redis_data`, `qdrant_data`) — it persists. Don't run `docker compose down -v` (the `-v` deletes volumes). |
| Backend 500 on chat | Check `docker compose logs -f web` — usually a bad/empty `OPENAI_API_KEY`. |

---

# 💰 Cost & staying free

- **EC2 `t3.micro` + 30 GB storage:** Free for 12 months (750 hrs/month = one box
  running 24/7). After 12 months ≈ **$7–9/month**.
- **1 Elastic IP attached to a running instance:** free. (An *unattached* Elastic IP
  is billed — so if you terminate the instance, also **release** the Elastic IP.)
- **Cloudflare Pages:** free.
- **DuckDNS:** free.
- **OpenAI:** pay-per-use on your own key (unchanged by this deployment).

To avoid any charges when you're done demoing: EC2 → select instance → **Terminate**,
then **Elastic IPs → Release**.
