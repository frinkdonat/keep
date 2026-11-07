# Keep — Minimalist Watch Later & Bookmarking

A self-hosted, stripped-down alternative to Karakeep / Hoarder designed to look fabulous while remaining blazing fast and distraction-free.

Save YouTube videos and interesting websites in **one click** via the Chrome extension or web UI, watch videos directly in an embedded theater lightbox, and keep everything in a clean curated library.

---

## ✨ Features

- **Linear / Raycast Dark Aesthetic**: Deep zinc tones, subtle glowing borders, refined typography, and smooth micro-interactions.
- **1-Click Chrome Extension**: Click the extension icon on any webpage or YouTube video to instantly save it. Displays a subtle on-page toast notification and toolbar checkmark `✓`.
- **YouTube Native Player**: High-resolution video previews and an embedded theater mode modal so you can watch your saved videos without leaving the app.
- **Smart Metadata Extraction**: Automatically fetches OpenGraph titles, descriptions, preview images, domain favicons, and YouTube channel info.
- **Curation & Watch Later Flow**:
  - 📥 **Watch Later (Inbox)**: Your active unread / unwatched queue.
  - 🎬 **Videos**: Filter YouTube videos with 1 click.
  - 📰 **Articles & Sites**: Filter web reads and links.
  - ⭐ **Favorites** & 🗃️ **Archive**: Keep your favorite gems and history cleanly organized.
- **Fast Command Bar (`⌘K` / `Ctrl+K`)**: Search through your saved links in real-time or paste any URL and hit Enter to save immediately.
- **Zero-Friction Self-Hosting**: Built on Next.js 16 and Node's native SQLite with zero heavy native dependencies or external database requirements. Packaged with Docker and Docker Compose.

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Node.js 22+ (or Node 26)

### 2. Run the Web App
```bash
# Clone or navigate to the directory
cd keep

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Self-Hosting with Docker

You can run Keep with a single command on your home server, VPS, or NAS:

```bash
docker compose up -d
```

Your database will be persisted in `./data/keep.db`.

---

## 🧩 Installing the Chrome Extension

1. In Google Chrome, go to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button in the top left.
4. Select the `extension` folder located inside this project (`keep/extension`).
5. (Optional) Right-click the Keep icon in your Chrome toolbar, click **Options**, and ensure your **Server URL** (`http://localhost:3000`) and **API Key** match your `.env` configuration. You can click **Test Connection** to verify in 1 second.

Now, whenever you are on a YouTube video or article, just click the Keep extension icon in your Chrome toolbar:
- The icon badge will turn green with a `✓`.
- A floating toast will notify you that the item was saved.
- The item is immediately available in your Keep library!

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `API_KEY` | `keep_secret_token_12345` | Secret token used by the Chrome Extension to authenticate with your server. |
| `MASTER_PASSCODE` | *(empty)* | Optional master passcode to protect the web UI. Leave empty to disable passcode lock. |
| `PORT` | `3000` | Port for the web server. |
| `DATA_DIR` | `./data` | Directory where SQLite database `keep.db` is stored. |

---

## ⌨️ Keyboard Shortcuts

- `Ctrl + K` or `Cmd + K`: Focus search & quick-add command bar.
- `Enter` (when pasting a URL): Instantly save link to Watch Later.
- `Esc`: Close open modal / clear search.
