import './style.css';
import { App } from './app';
import { loadConfig } from './config/load';

async function boot(): Promise<void> {
  try {
    const cfg = await loadConfig();
    const app = new App(cfg);
    // Dev-only handle for debugging/automated verification.
    if (import.meta.env.DEV) (window as unknown as { __bmApp: App }).__bmApp = app;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    document.body.innerHTML = `<pre style="color:#ffb0a0;background:#1b2b31;margin:0;height:100vh;padding:32px;white-space:pre-wrap;font:14px ui-monospace,monospace">Failed to start:\n\n${msg}</pre>`;
    throw err;
  }
}

void boot();
