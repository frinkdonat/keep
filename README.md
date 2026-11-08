# Keep — Minimalist Watch Later & Bookmarking

A self-hosted, ultra-minimalist Watch Later & bookmarking queue designed to be blazing fast, distraction-free, and maintenance-free.

Save YouTube videos and interesting websites in **one click** via the Chrome Extension or mobile share sheet, launch videos directly in the native YouTube app or in a new tab in `0ms`, and keep everything in a clean, curated queue.

---

## ✨ Features

- **Linear / Raycast Dark Aesthetic**: Deep zinc tones, subtle glowing borders, refined typography, and smooth 180ms card exit animations.
- **Whole-Card Tap / Click**: The entire card body is a single tap target — on phones and desktop, tapping anywhere on a card instantly opens the link or launches the native YouTube app.
- **1-Click Chrome Extension**: Click the extension icon on any page or video to save it instantly with zero lag and toolbar checkmark `✓` feedback.
- **Mobile Share Target (`/share`)**: Share directly from your phone's browser or YouTube app; saves in `< 1ms` and displays a lightweight 1-second auto-closing confirmation pill.
- **Bulletproof Favicons & Thumbnails**: Uses built-in SVG play badges for YouTube (0 network requests) and Google's S2 Favicon CDN for websites with automatic `<Globe />` fallback (never broken by external site icon tags).
- **Streamlined 2-Tab Queue**:
  - 📥 **Watch Later**: Your active unread / unwatched queue.
  - 🗃️ **Archive**: Completed items that you can restore or permanently clear with 2-click inline confirmation.
- **Multi-User Workspaces**: Dedicated Admin account configured via Docker environment variables + isolated secondary user workspaces with individual Chrome Extension API keys.
- **Hardened Public Security**:
  - Worker-pool asynchronous `scrypt` password hashing (immune to CPU-exhaustion DoS).
  - Strict Content-Security-Policy (`frame-src 'none'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`).
  - Unforgeable IP rate limiting (`CF-Connecting-IP` / proxy-aware + global limiter).
  - CSRF origin checks on all cookie mutations and cross-site redirect protection on `/share`.
- **Zero-Maintenance SQLite WAL**: Built on Next.js 16 and Node's native SQLite with automatic checkpointing and zero background timer locks.

---

## 🐳 Self-Hosting with Docker

You can run Keep with a single command on your home server, VPS, or NAS (ZimaOS, CasaOS, unRAID, etc.):

```bash
docker compose up -d
```

### Docker Compose Example (`docker-compose.yml`)

```yaml
services:
  keep:
    image: frinkdonat/keep:latest
    container_name: keep-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - USERNAME=admin
      - PASSWORD=your_secure_password
      - API_KEY=your_secret_api_key
      - DATA_DIR=/app/data
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

Your database will be persisted in `./data/keep.db`.

---

## 🧩 Installing the Chrome Extension

1. In Google Chrome, go to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button and select the `extension` folder located inside this repository (`keep/extension`), or install from [`dist/keep-extension-webstore.zip`](dist/keep-extension-webstore.zip).
4. Right-click the Keep icon in your Chrome toolbar, click **Options**, and set your **Server URL** (e.g. `http://localhost:3000` or your domain) and **API Key**. Click **Test Connection** to verify in 1 second.

Now, whenever you are on a YouTube video or article, just click the Keep extension icon in your Chrome toolbar to save it immediately.

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `USERNAME` | `admin` | Admin username for Web UI login. |
| `PASSWORD` | `changeme` | Admin password for Web UI login. |
| `API_KEY` | `keep_secret_api_key` | Secret API key for Chrome Extension authentication. |
| `DATA_DIR` | `/app/data` (or `./data`) | Directory where SQLite database `keep.db` is stored. |
| `PORT` | `3000` | Port for the web server. |

---

## 📄 License & Privacy

Keep is open-source software. Read the [Privacy Policy](PRIVACY.md) for details on data handling.
