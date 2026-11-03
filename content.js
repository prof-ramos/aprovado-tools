/**
 * Aprovado Tools - Content Script
 * Injects helpful shortcuts directly into the AprovadoApp web interface.
 */

(function () {
  'use strict';

  function injectInterfaceShortcuts() {
    if (document.getElementById('aprovado-tools-injected-btn')) return;

    // Search for header or navigation bar
    const navbar = document.querySelector('.navbar-nav, .nav, header nav, .navbar-collapse') || document.querySelector('header');

    if (navbar && !navbar.querySelector('#aprovado-tools-injected-btn')) {
      window.requestAnimationFrame(() => {
        const btn = document.createElement('button');
        btn.id = 'aprovado-tools-injected-btn';
        btn.className = 'aprovado-tools-nav-btn';
        btn.innerHTML = `
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 13.5h12M4 10.5v-3M8 10.5V4.5M12 10.5v-5"/>
          </svg>
          <span>Exportar e métricas</span>
        `;
        btn.title = 'Abrir painel completo de métricas e exportação de estudos';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
        });

        navbar.appendChild(btn);
      });
    }

    // Also add a subtle floating badge if user is logged in (not on login page)
    if (!document.getElementById('aprovado-tools-floating-btn') && !window.location.pathname.toLowerCase().includes('login')) {
      window.requestAnimationFrame(() => {
        const floatBtn = document.createElement('div');
        floatBtn.id = 'aprovado-tools-floating-btn';
        floatBtn.className = 'aprovado-tools-floating-badge';
        floatBtn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6"></path>
          </svg>
          <span>Métricas de Estudo</span>
        `;
        floatBtn.title = 'Aprovado Tools: Clique para abrir o dashboard de métricas e exportações';

        floatBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
        });

        document.body.appendChild(floatBtn);
      });
    }
  }

  // Run on page load and observe DOM changes (ASP.NET Knockout SPA rendering)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectInterfaceShortcuts);
  } else {
    injectInterfaceShortcuts();
  }

  // Observe potential SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('aprovado-tools-injected-btn')) {
      injectInterfaceShortcuts();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
