/**
 * Aprovado Tools - Background Service Worker (Manifest V3)
 * Follows strict ephemeral state guidelines and explicit triggers for UI panels.
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  // Setup context menu entries
  chrome.contextMenus.create({
    id: 'aprovado_open_dashboard',
    title: '📊 Abrir Dashboard de Métricas',
    contexts: ['action', 'page']
  });

  chrome.contextMenus.create({
    id: 'aprovado_open_sidepanel',
    title: '📑 Abrir Painel Lateral de Estudos',
    contexts: ['action', 'page']
  });

  if (details.reason === 'install') {
    await chrome.storage.local.set({
      installDate: Date.now(),
      theme: 'dark'
    });
  }
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'aprovado_open_dashboard') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  } else if (info.menuItemId === 'aprovado_open_sidepanel') {
    if (tab && tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }
});

// Message Passing Router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'OPEN_DASHBOARD') {
        const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
        sendResponse({ success: true, tabId: tab.id });
      } else if (message.type === 'OPEN_SIDEPANEL') {
        const windowId = sender.tab ? sender.tab.windowId : (await chrome.windows.getLastFocused()).id;
        await chrome.sidePanel.open({ windowId });
        sendResponse({ success: true });
      } else if (message.type === 'CHECK_LOGIN_STATUS') {
        // Test if cookie exists
        const cookie = await chrome.cookies.get({
          url: 'https://aprovadoapp.com',
          name: 'aprovado'
        });
        sendResponse({ hasCookie: Boolean(cookie && cookie.value) });
      } else {
        sendResponse({ error: 'Comando desconhecido' });
      }
    } catch (err) {
      console.error('Erro no service worker:', err);
      sendResponse({ error: err.message });
    }
  })();
  return true; // Keep channel open for async response
});
