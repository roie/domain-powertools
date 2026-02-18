import ReactDOM from 'react-dom/client';
import Sidebar from '@/components/Sidebar';
import '@/assets/main.css';

const TABLE_SELECTOR = '#listing table.base1';

export default defineContentScript({
  matches: ['*://member.expireddomains.net/*', '*://www.expireddomains.net/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Synchronous state tracking for immediate e.preventDefault()
    let isInstantNavEnabled = true;
    let isExtensionEnabled = true;

    const updateStateFromStorage = async () => {
      const res = await browser.storage.local.get(['dpt_instant_nav', 'dpt_enabled']);
      isInstantNavEnabled = res.dpt_instant_nav !== false;
      isExtensionEnabled = res.dpt_enabled !== false;
    };
    
    await updateStateFromStorage();

    // Listen for setting changes in real-time
    browser.storage.onChanged.addListener((changes) => {
      if (changes.dpt_instant_nav) isInstantNavEnabled = changes.dpt_instant_nav.newValue !== false;
      if (changes.dpt_enabled) isExtensionEnabled = changes.dpt_enabled.newValue !== false;
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'domain-powertools-sidebar',
      position: 'overlay',
      onMount: (container) => {
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<Sidebar />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();

    // --- Global Pagination Hijacker ---
    const handlePaginationClick = (e: MouseEvent) => {
      // Check link synchronously to prevent browser delay
      const target = e.target as HTMLElement;
      const link = target.closest('a') as HTMLAnchorElement;
      if (!link || !link.href) return;

      const text = link.textContent || '';
      const isNext = text.toLowerCase().includes('next') || text.includes('»');
      const isPrev = text.toLowerCase().includes('prev') || text.includes('«');
      const isPager = link.closest('.listingpager, .pager, .pagination') || link.classList.contains('next') || link.classList.contains('prev');

      if (isPager && (isNext || isPrev)) {
        if (isInstantNavEnabled && isExtensionEnabled) {
          // MUST be synchronous
          e.preventDefault();
          e.stopPropagation();
          
          browser.runtime.sendMessage({ type: 'DPT_NAVIGATE', url: link.href }).catch(() => {
            window.postMessage({ type: 'DPT_NAVIGATE_UI', url: link.href }, '*');
          });
        }
      }
    };

    const handlePopState = () => {
      if (isInstantNavEnabled && isExtensionEnabled) {
        window.postMessage({ type: 'DPT_NAVIGATE_UI', url: window.location.href }, '*');
      }
    };

    document.addEventListener('click', handlePaginationClick, true);
    window.addEventListener('popstate', handlePopState);
  },
});
