// Keep - Chrome Extension Background Service Worker (Manifest V3)

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const DEFAULT_API_KEY = 'keep_secret_api_key';

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        serverUrl: DEFAULT_SERVER_URL,
        apiKey: DEFAULT_API_KEY,
      },
      (items) => {
        let serverUrl = items.serverUrl.trim();
        // Remove trailing slash
        serverUrl = serverUrl.replace(/\/+$/, '');
        resolve({
          serverUrl,
          apiKey: items.apiKey.trim(),
        });
      }
    );
  });
}

function showToastOnTab(tabId, message, isError = false) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, err) => {
      const existing = document.getElementById('keep-save-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'keep-save-toast';
      toast.style.position = 'fixed';
      toast.style.top = '24px';
      toast.style.right = '24px';
      toast.style.zIndex = '2147483647';
      toast.style.display = 'flex';
      toast.style.alignItems = 'center';
      toast.style.gap = '10px';
      toast.style.padding = '12px 18px';
      toast.style.borderRadius = '12px';
      toast.style.backgroundColor = err ? '#1c1114' : '#111817';
      toast.style.color = '#f4f4f5';
      toast.style.fontSize = '13px';
      toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      toast.style.fontWeight = '500';
      toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.1)';
      toast.style.border = err ? '1px solid #f43f5e' : '1px solid #10b981';
      toast.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';

      const icon = document.createElement('span');
      icon.innerHTML = err ? '⚠️' : '✨';
      icon.style.fontSize = '14px';

      const text = document.createElement('span');
      text.textContent = msg;

      toast.appendChild(icon);
      toast.appendChild(text);
      document.body.appendChild(toast);

      // Animate in
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });

      // Animate out & remove
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 250);
      }, 2600);
    },
    args: [message, isError],
  }).catch(() => {
    // Ignore restricted internal pages (e.g. chrome://)
  });
}

// 1-Click Save Action
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    return;
  }

  const { serverUrl, apiKey } = await getSettings();

  if (!serverUrl || !apiKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  // Set pending badge
  chrome.action.setBadgeText({ tabId: tab.id, text: '...' });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#f59e0b' });

  try {
    const res = await fetch(`${serverUrl}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title || '',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const isYouTube = tab.url.includes('youtube.com') || tab.url.includes('youtu.be');
      const toastMsg = data.reactivated 
        ? 'Re-activated in Watch Later!' 
        : isYouTube 
        ? 'Saved video to Watch Later!' 
        : 'Saved website to Keep!';

      // Set success badge
      chrome.action.setBadgeText({ tabId: tab.id, text: '✓' });
      chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#10b981' });
      showToastOnTab(tab.id, toastMsg, false);

      setTimeout(() => {
        chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      }, 2800);
    } else {
      let errorMsg = 'Failed to save to Keep';
      try {
        const errData = await res.json();
        if (errData && errData.error) {
          errorMsg = `Keep: ${errData.error} (${res.status})`;
        }
      } catch {
        errorMsg = `Keep error: HTTP ${res.status}`;
      }

      if (res.status === 401) {
        errorMsg = 'Keep: Invalid API Key. Check extension settings.';
      }

      chrome.action.setBadgeText({ tabId: tab.id, text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ef4444' });
      showToastOnTab(tab.id, errorMsg, true);

      setTimeout(() => {
        chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      }, 3500);
    }
  } catch (err) {
    console.error('Keep extension fetch error:', err);
    chrome.action.setBadgeText({ tabId: tab.id, text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ef4444' });
    showToastOnTab(tab.id, `Could not reach Keep at ${serverUrl}`, true);

    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    }, 3500);
  }
});
