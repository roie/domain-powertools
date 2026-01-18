import ReactDOM from 'react-dom/client';
import Sidebar from '@/components/Sidebar';
import '@/assets/main.css';

const TABLE_SELECTOR = '#listing table.base1';

export default defineContentScript({
  matches: ['*://member.expireddomains.net/*', '*://www.expireddomains.net/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    console.log('Domain Powertools: Content script loaded.');

    // Helper to wait for the table
    const waitForTable = () => {
      return new Promise<Element>((resolve) => {
        const table = document.querySelector(TABLE_SELECTOR);
        if (table) return resolve(table);

        const observer = new MutationObserver(() => {
          const table = document.querySelector(TABLE_SELECTOR);
          if (table) {
            observer.disconnect();
            resolve(table);
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          observer.disconnect();
        }, 5000);
      });
    };

    const table = await waitForTable();
    if (!table) {
      console.log('Domain Powertools: Table not found on this page. Sidebar skipped.');
      return;
    }

    console.log('Domain Powertools: Table detected. Mounting sidebar...');

    const ui = await createShadowRootUi(ctx, {
      name: 'domain-powertools-sidebar',
      position: 'inline',
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
  },
});
