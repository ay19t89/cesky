import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { rolldown } from 'rolldown';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('build', 'dist/client', { recursive: true });

const bundle = await rolldown({
  input: 'src/worker.ts',
  platform: 'browser'
});
await bundle.write({
  file: 'dist/server/index.js',
  format: 'esm',
  minify: true
});
await bundle.close();

const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
await writeFile(
  'dist/.openai/hosting.json',
  `${JSON.stringify(hosting, null, 2)}\n`
);
