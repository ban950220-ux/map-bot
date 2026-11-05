// Synthetic loopback preview only. No cloud credentials and no live providers.
import { writeFile } from 'node:fs/promises';
import { createIndependentHarness, syntheticPassword } from '../tests/independent/harness.mjs';
const h=await createIndependentHarness({preview:true});
await writeFile('.sites-runtime/independent-preview.json',JSON.stringify({url:h.url,mode:'synthetic-loopback-only',pid:process.pid},null,2));
console.log(`MAP synthetic preview: ${h.url}\nSynthetic password: ${syntheticPassword}\nNo real providers. Browser CSP permits only same-origin resources.`);
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await h.close();process.exit(0);});
