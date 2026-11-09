// Keep - Options Script

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const DEFAULT_API_KEY = 'keep_secret_api_key';

const serverUrlInput = document.getElementById('serverUrl');
const apiKeyInput = document.getElementById('apiKey');
const statusMsg = document.getElementById('status-msg');
const form = document.getElementById('settings-form');
const btnTest = document.getElementById('btn-test');

// Load stored settings
chrome.storage.sync.get(
  {
    serverUrl: DEFAULT_SERVER_URL,
    apiKey: DEFAULT_API_KEY,
  },
  (items) => {
    serverUrlInput.value = (typeof items?.serverUrl === 'string' && items.serverUrl) ? items.serverUrl : DEFAULT_SERVER_URL;
    apiKeyInput.value = (typeof items?.apiKey === 'string' && items.apiKey) ? items.apiKey : DEFAULT_API_KEY;
  }
);

function showStatus(text, isError = false) {
  statusMsg.textContent = text;
  statusMsg.className = isError ? 'status-error' : 'status-success';
  statusMsg.style.display = 'block';
}

// Test Connection
btnTest.addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
  const apiKey = apiKeyInput.value.trim();

  if (!serverUrl) {
    showStatus('Please enter a server URL first.', true);
    return;
  }

  showStatus('Testing connection to ' + serverUrl + '...');

  try {
    const res = await fetch(`${serverUrl}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      showStatus('✓ Connected successfully! Authenticated with Keep server.', false);
    } else if (res.status === 401) {
      showStatus('⚠️ Connected, but API Key was rejected (401 Unauthorized). Check your API Key.', true);
    } else {
      showStatus(`⚠️ Server returned HTTP ${res.status}: ${res.statusText}`, true);
    }
  } catch {
    showStatus(`✗ Connection failed: Could not reach ${serverUrl}. Is Keep running?`, true);
  }
});

// Save Settings
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
  const apiKey = apiKeyInput.value.trim();

  chrome.storage.sync.set(
    {
      serverUrl,
      apiKey,
    },
    () => {
      showStatus('✓ Settings saved successfully!', false);
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 3000);
    }
  );
});
