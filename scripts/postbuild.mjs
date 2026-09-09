/**
 * Static-host post-build step.
 *
 * GitHub Pages has no history fallback, so deep links such as /projects/PRJ-0001
 * are served by 404.html. Copying index.html there lets the SPA router take over.
 * .nojekyll stops Pages from stripping the /assets directory.
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const index = resolve(dist, 'index.html');

if (!existsSync(index)) {
  console.error('postbuild: dist/index.html not found — run the build first.');
  process.exit(1);
}

copyFileSync(index, resolve(dist, '404.html'));
writeFileSync(resolve(dist, '.nojekyll'), '');

console.log('postbuild: wrote dist/404.html and dist/.nojekyll');
