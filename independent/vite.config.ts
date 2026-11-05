import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return { plugins: [vinext(), cloudflare({
    viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] }, inspectorPort: false,
    config: { name: 'map-independent-candidate', main: './independent/worker.ts', compatibility_date: '2026-05-15', compatibility_flags: ['nodejs_compat'],
      observability: { enabled: false },
      assets: { binding: 'ASSETS', run_worker_first: true },
      kv_namespaces: [{ binding: 'MAP_SESSIONS', id: '00000000000000000000000000000000' }],
    },
  })] };
});
