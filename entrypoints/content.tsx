import ReactDOM from 'react-dom/client';
import Sidebar from '@/components/Sidebar';
import '@/assets/main.css';

export default defineContentScript({
  matches: ['*://member.expireddomains.net/*', '*://www.expireddomains.net/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Only mount if the table exists
    const table = document.querySelector('table.base1');
    if (!table) return;

    const ui = await createShadowRootUi(ctx, {
      name: 'domain-powertools-sidebar',
      position: 'inline',
      onMount: (container) => {
        // Create a wrapper for our app to separate it from page styles
        const app = document.createElement('div');
        container.append(app);

        // Mount React
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
