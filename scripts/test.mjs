import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

await mkdir('.test-build', { recursive: true });

for (const name of [
  'types',
  'ijp-url',
  'translation',
  'suggestions',
  'exports'
]) {
  const source = await readFile(`src/lib/${name}.ts`, 'utf8');
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }).outputText;
  code = code.replace(/from ['"](\.\/[^'"]+)['"]/g, "from '$1.mjs'");
  await writeFile(`.test-build/${name}.mjs`, code);
}

const { translationUrl } = await import('../.test-build/translation.mjs');
const { compareCzechWords, csvText, exportData, exportRows, headers } =
  await import('../.test-build/exports.mjs');

const forms = Array.from({ length: 7 }, (_, index) => [`tvar${index + 1}`]);
const sourceUrl = 'https://prirucka.ujc.cas.cz/?slovo=mo%C5%99e';
const fixture = {
  word: 'moře',
  requested: 'more',
  checkedAt: '2026-09-08T12:00:00Z',
  ijp: {
    status: 'ok',
    url: sourceUrl,
    entries: [{ lemma: 'moře', gender: 'N', singular: forms, plural: forms }]
  }
};

assert.deepEqual(headers.slice(-2), ['Překlad', 'Odkaz']);
assert.deepEqual(
  ['žena', 'chata', 'hrad', 'čáp', 'citron', 'auto'].sort(compareCzechWords),
  ['auto', 'citron', 'čáp', 'hrad', 'chata', 'žena']
);
const rows = exportRows([fixture]);
assert.equal(rows[0][10], translationUrl('anglicky', 'moře'));
assert.equal(rows[1][10], translationUrl('rusky', 'moře'));
assert.equal(rows[0][11], sourceUrl);

const csv = csvText([fixture]);
assert.ok(csv.startsWith('\ufeff'));
assert.ok(csv.includes('cesky_anglicky/mo%C5%99e'));
assert.ok(csv.includes('cesky_rusky/mo%C5%99e'));
assert.ok(csv.includes('=HYPERLINK'));

let downloaded;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
URL.createObjectURL = (blob) => {
  downloaded = blob;
  return 'blob:test';
};
URL.revokeObjectURL = () => {};
globalThis.document = {
  baseURI: 'https://example.com/',
  createElement: () => ({ click() {} })
};

await exportData('xlsx', [fixture]);
const { default: ExcelJS } = await import('exceljs');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(await downloaded.arrayBuffer()));
assert.deepEqual(workbook.worksheets[0].getCell('K2').value, {
  text: translationUrl('anglicky', 'moře'),
  hyperlink: translationUrl('anglicky', 'moře')
});
assert.deepEqual(workbook.worksheets[0].getCell('K3').value, {
  text: translationUrl('rusky', 'moře'),
  hyperlink: translationUrl('rusky', 'moře')
});
assert.equal(
  workbook.worksheets[0].getCell('A1').fill.fgColor.argb,
  'FFE0F0E8'
);

URL.createObjectURL = originalCreateObjectUrl;
URL.revokeObjectURL = originalRevokeObjectUrl;
delete globalThis.document;

console.log('PASS: Czech sorting and Unicode CSV/XLSX translation exports.');
