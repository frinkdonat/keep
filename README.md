# Keep

A minimal, self-hosted Watch Later and bookmarking queue. Save YouTube videos and articles in one click, and browse them in a clean, distraction-free dashboard.

---

## Quick Start (ZimaOS / Docker)

Download [`docker-compose.yml`](https://github.com/frinkdonat/keep/releases/latest) from the latest release, or use the configuration below:

```yaml
name: keep

services:
  keep:
    image: frinkdonat/keep:latest
    container_name: keep-app
    restart: unless-stopped
    network_mode: bridge
    ports:
      - "3000:3000"
    environment:
      - USERNAME=admin
      - PASSWORD=changeme
      - API_KEY=keep_secret_api_key
      - DATA_DIR=/app/data
      - NODE_ENV=production
    volumes:
      - /DATA/AppData/keep/data:/app/data
    labels:
      icon: https://raw.githubusercontent.com/frinkdonat/keep/main/extension/icons/icon128.png
    x-casaos:
      envs:
        - container: USERNAME
          description:
            en_us: Admin username for Web UI login
            en_US: Admin username for Web UI login
        - container: PASSWORD
          description:
            en_us: Admin password for Web UI login
            en_US: Admin password for Web UI login
        - container: API_KEY
          description:
            en_us: Secret API key for Chrome Extension sync
            en_US: Secret API key for Chrome Extension sync
        - container: DATA_DIR
          description:
            en_us: SQLite database directory inside the container
            en_US: SQLite database directory inside the container
      ports:
        - container: "3000"
          description:
            en_us: Web UI HTTP port
            en_US: Web UI HTTP port
      volumes:
        - container: /app/data
          description:
            en_us: Persistent SQLite database directory
            en_US: Persistent SQLite database directory

x-casaos:
  id: io.github.frinkdonat.keep
  main: keep
  index: /
  port_map: "3000"
  scheme: http
  version: "2.0.1"
  icon: https://raw.githubusercontent.com/frinkdonat/keep/main/extension/icons/icon128.png
  title:
    en_us: Keep
    en_US: Keep
  tagline:
    en_us: Minimal self-hosted Watch Later and bookmarking queue
    en_US: Minimal self-hosted Watch Later and bookmarking queue
  description:
    en_us: A minimal, self-hosted Watch Later and bookmarking queue. Save YouTube videos and articles in one click, and browse them in a clean, distraction-free dashboard.
    en_US: A minimal, self-hosted Watch Later and bookmarking queue. Save YouTube videos and articles in one click, and browse them in a clean, distraction-free dashboard.
  author: frinkdonat
  developer: frinkdonat
  category: Productivity
  architectures:
    - amd64
  tips:
    before_install:
      en_us: Default credentials are USERNAME=admin, PASSWORD=changeme, and API_KEY=keep_secret_api_key. Update them in the environment variables before installing.
      en_US: Default credentials are USERNAME=admin, PASSWORD=changeme, and API_KEY=keep_secret_api_key. Update them in the environment variables before installing.
```

### Install on ZimaOS

1. Open your ZimaOS dashboard and click **+** (top-right corner) → **Install a customized app**.
2. Click **Import** (top-right of the modal) and paste or upload `docker-compose.yml`.
3. Click **Submit**, update `USERNAME`, `PASSWORD`, and `API_KEY` in the form, then click **Install**.

### Install via Docker Compose CLI

```bash
docker compose up -d
```

Open `http://localhost:3000` (or your ZimaOS server IP on port `3000`) to access Keep.

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
