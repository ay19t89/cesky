import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('supabase/functions/_shared', { recursive: true });
for (const name of ['types', 'config', 'dictionary', 'handler']) {
  let source = await readFile(`lib/${name}.ts`, 'utf8');
  source = source.replace(/from '(\.\/[^']+)'/g, "from '$1.ts'");
  await writeFile(`supabase/functions/_shared/${name}.ts`, source);
}
