import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

await mkdir('.test-build', { recursive: true });

for (const name of [
  'types',
  'config',
  'dictionary',
  'handler',
  'suggestions',
  'exports',
]) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  code = code.replace(/from ['"](\.\/[^'"]+)['"]/g, "from '$1.mjs'");
  await writeFile(`.test-build/${name}.mjs`, code);
}

const { parseIjp, validateWord, lookup } =
  await import('../.test-build/dictionary.mjs');
const { handleDictionary } = await import('../.test-build/handler.mjs');
const { suggest } = await import('../.test-build/suggestions.mjs');
const { csvText, exportRows, exportData } =
  await import('../.test-build/exports.mjs');

const caseRows = Array.from(
  { length: 7 },
  (_, index) =>
    `<tr><td>${index + 1}. pád</td><td>kůň<sup>9</sup>, koník</td><td>koně</td></tr>`,
).join('');

for (const [genderText, expectedGender] of [
  ['m. živ.', 'M'],
  ['m. neživ.', 'I'],
  ['ž.', 'F'],
  ['s.', 'N'],
]) {
  const parsed = parseIjp(
    `<div class="hlavicka"><h2><strong>kůň</strong></h2></div>
     <p class="polozky">rod: ${genderText}</p>
     <table class="para">
       <tr><td></td><td>jednotné číslo</td><td>množné číslo</td></tr>
       ${caseRows}
     </table>`,
    'kůň',
  );

  assert.equal(parsed.entries[0].gender, expectedGender);
  assert.deepEqual(parsed.entries[0].singular[0], ['kůň', 'koník']);
  assert.equal(parsed.entries[0].plural.length, 7);
}

assert.equal(parseIjp('<b>nenalezeno</b>', 'xyz').status, 'not_found');

const pluralOnly = parseIjp(
  `<div class="hlavicka"><h2><strong>dveře</strong></h2></div>
   <p class="polozky">rod: ž.</p>
   <table class="para">
     <tr><td></td><td>množné číslo</td></tr>
     <tr><td>1. pád</td><td>dveře</td></tr>
   </table>`,
  'dveře',
);
assert.deepEqual(pluralOnly.entries[0].singular[0], []);
assert.deepEqual(pluralOnly.entries[0].plural[0], ['dveře']);

assert.throws(() => validateWord('x\ny'));
assert.throws(() => validateWord('https://example.com'));
assert.equal(validateWord(' kůň '), 'kůň');

assert.equal(suggest('kamarad')[0], 'kamarád');
assert.ok(suggest('kamard').includes('kamarád'));
assert.equal(suggest('želez', ['železo'])[0], 'železo');

assert.equal(
  (await handleDictionary(new Request('https://example.com?word=pes'))).status,
  401,
);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{}', { status: 401 });
assert.equal(
  (
    await handleDictionary(
      new Request('https://example.com?word=pes', {
        headers: { Authorization: 'Bearer fake' },
      }),
    )
  ).status,
  401,
);

const fixtureSource = parseIjp(
  `<div class="hlavicka"><h2><strong>žena</strong></h2></div>
   <p class="polozky">rod: ž.</p>
   <table class="para">
     <tr><td></td><td>jednotné číslo</td><td>množné číslo</td></tr>
     ${Array.from(
       { length: 7 },
       (_, index) =>
         `<tr><td>${index + 1}. pád</td><td>${index === 2 ? 'ženě' : 'žena'}</td><td>ženy</td></tr>`,
     ).join('')}
   </table>`,
  'žena',
);
const fixture = {
  word: 'žena',
  requested: 'žena',
  checkedAt: '2026-09-06T12:00:00Z',
  ijp: fixtureSource,
};

assert.ok(csvText([fixture]).startsWith('\ufeff'));
assert.ok(csvText([fixture]).includes('ženě'));
assert.equal(exportRows([fixture]).length, 14);
assert.ok(csvText([{ ...fixture, word: '=SUM(1)' }]).includes("'=SUM(1)"));
let downloaded;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
URL.createObjectURL = (blob) => {
  downloaded = blob;
  return 'blob:test';
};
URL.revokeObjectURL = () => {};
globalThis.document = {
  baseURI: 'https://example.com/repo/',
  createElement: () => ({ click() {} }),
};

await exportData('xlsx', [fixture]);
const { default: ExcelJS } = await import('exceljs');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await downloaded.arrayBuffer());
assert.equal(workbook.worksheets[0].getCell('G4').value, 'ženě');

globalThis.fetch = async (url) => {
  assert.equal(
    String(url),
    'https://example.com/repo/fonts/NotoSans-Regular.ttf',
  );
  return new Response(await readFile('public/fonts/NotoSans-Regular.ttf'));
};
await exportData('pdf', [fixture]);
const pdf = Buffer.from(await downloaded.arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
assert.ok(pdf.includes(Buffer.from('/ToUnicode')));
await writeFile('.test-build/unicode.pdf', pdf);

globalThis.fetch = originalFetch;
URL.createObjectURL = originalCreateObjectUrl;
URL.revokeObjectURL = originalRevokeObjectUrl;
delete globalThis.document;

console.log(
  'PASS: IJP parsing, four genders, seven cases, footnotes, plural-only nouns, input validation, suggestions, auth rejection, single-source CSV/XLSX/PDF exports and embedded Unicode PDF font.',
);

if (process.env.LIVE_TEST === '1') {
  for (const [word, expectedGender] of [
    ['pes', 'M'],
    ['hrad', 'I'],
    ['žena', 'F'],
    ['město', 'N'],
  ]) {
    const result = await lookup(word);
    assert.equal(result.ijp.status, 'ok', JSON.stringify(result.ijp));
    assert.ok(
      result.ijp.entries.some((entry) => entry.gender === expectedGender),
    );
    assert.ok(
      result.ijp.entries[0].singular.every((forms) => forms.length > 0),
    );
    console.log('LIVE PASS', word, expectedGender);
  }

  const corrected = await lookup('kamarad');
  assert.equal(corrected.word, 'kamarád');
  console.log('LIVE PASS accent correction');
}
