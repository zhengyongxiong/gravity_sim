import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outDir = resolve('dist');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyFile(resolve('index.html'), resolve(outDir, 'index.html'));
await cp(resolve('src'), resolve(outDir, 'src'), { recursive: true });

console.log(`Built static site to ${outDir}`);
