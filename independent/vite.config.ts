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
      durable_objects: { bindings: [{ name: 'MAP_AUTHORITY', class_name: 'OwnerAuthority' }] },
      // Prospective candidate metadata; never deployed by local build/tests.
      migrations: [{ tag: 'map-owner-v1', new_sqlite_classes: ['OwnerAuthority'] }],
    },
  })] };
});
