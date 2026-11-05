import './sites-env.mjs';
import { cp, mkdir, rm, symlink, readFile, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
async function outputDigest(directory) {
  try {
    const hash=createHash('sha256');
    for (const file of (await readdir(directory,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>path.join(f.parentPath,f.name)).sort()) {
      hash.update(path.relative(directory,file));hash.update(await readFile(file));
    }
    return hash.digest('hex');
  } catch(error) { if(error.code==='ENOENT') return null;throw error; }
}
const sitesBefore=await outputDigest('dist');
const root = process.cwd();
const stage = path.join(root, '.independent-build');
await rm(stage, { recursive: true, force: true }); await mkdir(stage);
// Explicit allowlist excludes env files, Sites metadata, credentials and data.
for (const item of ['app','components','lib','services','hooks','public','vendor','independent','package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','components.json']) await cp(item, path.join(stage,item), { recursive:true });
await symlink(path.join(root,'node_modules'),path.join(stage,'node_modules'),'dir');
await cp('independent/vite.config.ts',path.join(stage,'vite.config.ts'));
await cp('independent/auth-adapter.ts',path.join(stage,'app/chatgpt-auth.ts'));
await cp('independent/sw.js',path.join(stage,'public/sw.js'));
await mkdir(path.join(stage,'app/install')); await cp('independent/install-page.tsx',path.join(stage,'app/install/page.tsx'));
let layout = await readFile(path.join(stage,'app/layout.tsx'),'utf8');
layout = "import OwnerControls from '@/independent/OwnerControls';\n" + layout.replace('{children}</body>', '<OwnerControls/>{children}</body>');
await writeFile(path.join(stage,'app/layout.tsx'),layout);
for (const file of ['lib/api.ts','components/NearbyExplorer.tsx','app/privacy/page.tsx']) {
  const target=path.join(stage,file); let source=await readFile(target,'utf8');
  source=source.replaceAll('ChatGPT에 로그인한 뒤 사이트를 다시 열어 주세요.','소유자로 로그인한 뒤 앱을 다시 열어 주세요.').replaceAll('/signin-with-chatgpt?return_to=%2F','/auth/login').replaceAll('ChatGPT로 다시 로그인하고 검색하기','소유자로 다시 로그인하고 검색하기').replaceAll('소유자의 ChatGPT 로그인','독립 소유자 로그인');
  await writeFile(target,source);
}
const result = spawnSync(process.execPath,[path.join(root,'node_modules/vinext/dist/cli.js'),'build'],{cwd:stage,stdio:'inherit'});
if(result.status!==0) process.exit(result.status||1);
await rm('dist-independent',{recursive:true,force:true});
await cp(path.join(stage,'dist'),'dist-independent',{recursive:true});
if (await outputDigest('dist') !== sitesBefore) throw new Error('Sites dist/ changed during independent build');
await writeFile('dist-independent/build-isolation.json',JSON.stringify({sites_dist_sha256:sitesBefore,node:process.version,isolated:true},null,2));
console.log('Independent output: dist-independent (Sites dist/ preserved).');
