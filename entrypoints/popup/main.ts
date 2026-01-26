import { browser } from 'wxt/browser';

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('power-toggle') as HTMLInputElement;
    const statusDot = document.getElementById('status-dot') as HTMLDivElement;
    const statusText = document.getElementById('status-text') as HTMLSpanElement;

    // 1. Load Initial Power State
    const res = await browser.storage.local.get('dpt_enabled');
    const isEnabled = res.dpt_enabled !== false; // Default to true
    toggle.checked = isEnabled;

    // 2. Check Page Status
    const updateStatus = async () => {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (!currentTab?.id) return;

            const isSupportedPage = currentTab?.url?.includes('expireddomains.net');
            const powerOn = toggle.checked;

            if (isSupportedPage) {
                if (!powerOn) {
                    statusDot.classList.remove('active');
                    statusText.classList.remove('active');
                    statusText.textContent = 'Extension is Powered Off';
                    return;
                }

                // Ping the content script to see if the Sidebar is mounted (i.e. table detected)
                const response = await browser.tabs.sendMessage(currentTab.id, { type: 'DPT_STATUS_CHECK' })
                    .catch(() => null);

                if (response?.active) {
                    statusDot.classList.add('active');
                    statusText.classList.add('active');
                    statusText.textContent = 'Active on this page';
                } else {
                    statusDot.classList.remove('active');
                    statusText.classList.remove('active');
                    statusText.textContent = 'No listing table detected';
                }
            } else {
                statusDot.classList.remove('active');
                statusText.classList.remove('active');
                statusText.textContent = 'Open expireddomains.net';
            }
        } catch (e) {
            statusText.textContent = 'Status unknown';
        }
    };

    updateStatus();

    // 3. Handle Toggle Changes
    toggle.addEventListener('change', async () => {
        await browser.storage.local.set({ dpt_enabled: toggle.checked });
        updateStatus();
        
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
            browser.tabs.sendMessage(tabs[0].id, { type: 'DPT_POWER_TOGGLE', enabled: toggle.checked }).catch(() => {});
        }
    });
});