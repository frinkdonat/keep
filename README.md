# Keep

A minimal, self-hosted Watch Later and bookmarking queue. Save YouTube videos and articles in one click, and browse them in a clean, distraction-free dashboard.

---

## Quick Start (Docker)

Download [`docker-compose.yml`](https://github.com/frinkdonat/keep/releases/latest) from the latest release, or create it directly:

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
      - PASSWORD=changeme
      - API_KEY=keep_secret_api_key
      - DATA_DIR=/app/data
    volumes:
      - ./data:/app/data
```

Start the container:

```bash
docker compose up -d
```

Open `http://localhost:3000` to access Keep.

---

## Chrome Extension

1. Download **`keep-extension-webstore.zip`** from [**Releases**](https://github.com/frinkdonat/keep/releases/latest).
2. In Google Chrome, navigate to `chrome://extensions` and enable **Developer mode**.
3. Drag and drop the `.zip` (or extract and click **Load unpacked**).
4. Right-click the Keep extension icon → **Options** → set your Keep server URL and API key.

> **Note on Chrome Enhanced Safe Browsing**: Unpacked and newly published extensions may show an informational reputation banner until recognized by Google. Standard protection is Chrome's default and does not display this advisory.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `USERNAME` | `admin` | Admin username |
| `PASSWORD` | `changeme` | Admin password |
| `API_KEY` | `keep_secret_api_key` | Secret key for extension sync |
| `DATA_DIR` | `/app/data` | SQLite database directory |
| `PORT` | `3000` | HTTP port |

---

## Privacy

Keep is self-hosted software. No telemetry, analytics, or third-party tracking scripts. See the in-app privacy policy at [`/privacy`](src/app/privacy/page.tsx).
