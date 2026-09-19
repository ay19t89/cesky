import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

await mkdir('.test-build', { recursive: true });

async function transpile(sourcePath, outputPath) {
  const source = await readFile(sourcePath, 'utf8');
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }).outputText;
  code = code.replace(
    /from ['"]((?:\.\.\/|\.\/)[^'"]+)['"]/g,
    (_, specifier) => `from '${specifier.replace(/\.ts$/, '')}.mjs'`
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, code);
}

for (const name of [
  'types',
  'declension-patterns',
  'czech-order',
  'ijp-url',
  'translation',
  'suggestions',
  'saved-word-order',
  'export/shared',
  'export/rows',
  'export/csv',
  'export/xlsx',
  'export/pdf',
  'exports'
]) {
  await transpile(`src/lib/${name}.ts`, `.test-build/${name}.mjs`);
}

for (const name of ['types', 'dictionary']) {
  await transpile(
    `supabase/functions/_shared/${name}.ts`,
    `.test-build/server/${name}.mjs`
  );
}

const { translationUrl } = await import('../.test-build/translation.mjs');
const {
  compareCzechWords,
  csvText,
  datedExportFilename,
  exportData,
  exportRows,
  headers
} = await import('../.test-build/exports.mjs');
const { lookup, parseIjp, validateWord } =
  await import('../.test-build/server/dictionary.mjs');
const { findLatestSavedId, sortSavedWords } =
  await import('../.test-build/saved-word-order.mjs');
const { suggest } = await import('../.test-build/suggestions.mjs');
const { canonicalPatterns, inferDeclensionPattern, patternsForGender } =
  await import('../.test-build/declension-patterns.mjs');

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

const ijpHtml = `
  <div class="hlavicka"><h2><strong>moře</strong></h2></div>
  <p class="polozky">rod: s.</p>
  <table class="para">
    <tr><th>Pád</th><th>jednotné číslo</th><th>množné číslo</th></tr>
    <tr><td>1. pád</td><td>moře</td><td>moře</td></tr>
    <tr><td>2. pád</td><td>moře</td><td>moří</td></tr>
  </table>
`;
const parsed = parseIjp(ijpHtml, 'more');
assert.equal(parsed.status, 'ok');
assert.equal(parsed.entries[0].lemma, 'moře');
assert.equal(parsed.entries[0].gender, 'N');
assert.deepEqual(parsed.entries[0].plural[1], ['moří']);
assert.equal(validateWord('  déšť  '), 'déšť');
assert.throws(() => validateWord('dvě slova'));
assert.throws(() => validateWord('123'));

const suggested = parseIjp(
  `<div id="dalsiz">
    <a href="?id=Baffinovo">Baffinovo <span>moře</span></a>
    <a href="?id=more">moře</a>
    <a href="?id=mor">mor</a>
  </div>`,
  'MORE'
);
assert.equal(suggested.status, 'not_found');
assert.deepEqual(suggested.suggestions, ['moře', 'mor']);

const originalFetch = globalThis.fetch;
const requestedUrls = [];
globalThis.fetch = async (url) => {
  requestedUrls.push(String(url));
  return new Response(String(url).includes('MORE') ? '<main></main>' : ijpHtml);
};
const lowercaseFallback = await lookup('MORE');
assert.equal(lowercaseFallback.word, 'moře');
assert.equal(lowercaseFallback.requested, 'MORE');
assert.equal(requestedUrls.length, 2);
assert.ok(requestedUrls[1].includes('more'));
globalThis.fetch = originalFetch;

const savedRows = [
  { id: '1', word: 'žena', updated_at: '2026-09-01T10:00:00Z' },
  { id: '2', word: 'čáp', updated_at: '2026-09-03T10:00:00Z' },
  { id: '3', word: 'auto', updated_at: '2026-09-02T10:00:00Z' }
];
assert.deepEqual(
  sortSavedWords(savedRows, 'alphabetical').map((row) => row.word),
  ['auto', 'čáp', 'žena']
);
assert.deepEqual(
  sortSavedWords(savedRows, 'recent').map((row) => row.id),
  ['2', '3', '1']
);
assert.equal(findLatestSavedId(savedRows), '2');
assert.equal(suggest('pocit', ['pocit'])[0], 'pocit');
assert.equal(
  datedExportFilename('auto', new Date('2026-09-19T20:30:00Z')),
  'auto_2026-09-19'
);
assert.equal(
  datedExportFilename('moje/auto', new Date('2026-09-19T20:30:00Z')),
  'mojeauto_2026-09-19'
);

for (const pattern of canonicalPatterns) {
  const match = inferDeclensionPattern(pattern);
  assert.equal(match?.name, pattern.name);
  assert.equal(match?.confidence, 'high');
  assert.equal(match?.score, 100);
}
assert.deepEqual(patternsForGender('N'), ['město', 'moře', 'kuře', 'stavení']);
assert.equal(
  inferDeclensionPattern({
    lemma: 'radost',
    gender: 'F',
    singular: rowForTest(
      'radost',
      'radosti',
      'radosti',
      'radost',
      'radosti',
      'radosti',
      'radostí'
    ),
    plural: rowForTest(
      'radosti',
      'radostí',
      'radostem',
      'radosti',
      'radosti',
      'radostech',
      'radostmi'
    )
  })?.name,
  'kost'
);

let downloaded;
let downloadedFilename;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
URL.createObjectURL = (blob) => {
  downloaded = blob;
  return 'blob:test';
};
URL.revokeObjectURL = () => {};
globalThis.document = {
  baseURI: 'https://example.com/',
  createElement: () => ({
    click() {
      downloadedFilename = this.download;
    }
  })
};

await exportData('xlsx', [fixture]);
assert.equal(
  downloadedFilename,
  `moře_${new Date().toISOString().slice(0, 10)}.xlsx`
);
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

console.log('PASS: dictionary parsing, validation, sorting, and exports.');

function rowForTest(...values) {
  return values.map((value) => [value]);
}
