import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

await mkdir('.test-build', { recursive: true });

for (const name of [
  'types',
  'config',
  'ijp-url',
  'dictionary',
  'handler',
  'suggestions',
  'translation',
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
const { translationUrl } = await import('../.test-build/translation.mjs');
const { headers, compareCzechWords, csvText, exportRows, exportData } =
  await import('../.test-build/exports.mjs');

assert.equal(
  translationUrl('anglicky', 'moře'),
  'https://slovnik.seznam.cz/preklad/cesky_anglicky/mo%C5%99e',
);
assert.equal(
  translationUrl('rusky', 'pes'),
  'https://slovnik.seznam.cz/preklad/cesky_rusky/pes',
);

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
assert.equal(
  parseIjp(
    `<div class="hlavicka"><h2><strong>moře</strong></h2></div>
     <p class="polozky">rod: s.</p>
     <table class="para">
       <tr><td></td><td>jednotné číslo</td><td>množné číslo</td></tr>
       ${Array.from(
         { length: 7 },
         (_, index) =>
           `<tr><td>${index + 1}. pád</td><td>moře</td><td>moře</td></tr>`,
       ).join('')}
     </table>`,
    'more',
  ).url,
  'https://prirucka.ujc.cas.cz/?slovo=mo%C5%99e',
);
const fixture = {
  word: 'žena',
  requested: 'žena',
  checkedAt: '2026-09-06T12:00:00Z',
  ijp: fixtureSource,
};

assert.ok(csvText([fixture]).startsWith('\ufeff'));
assert.ok(csvText([fixture]).includes('ženě'));
assert.deepEqual(headers, [
  'Rod',
  'Slovo',
  'Číslo',
  '1. pád',
  '2. pád',
  '3. pád',
  '4. pád',
  '5. pád',
  '6. pád',
  '7. pád',
  'Odkaz',
]);
assert.deepEqual(
  ['žena', 'chata', 'hrad', 'čáp', 'citron', 'auto'].sort(compareCzechWords),
  ['auto', 'citron', 'čáp', 'hrad', 'chata', 'žena'],
);

const rows = exportRows([fixture]);
assert.equal(rows.length, 2);
assert.equal(rows[0][0], 'Ž · ženský');
assert.equal(rows[0][2], 'Jednotné');
assert.equal(rows[1][2], 'Množné');
assert.equal(rows[0][5], 'ženě');
assert.equal(rows[0][10], fixture.ijp.url);

const correctedFixture = {
  ...fixture,
  word: 'moře',
  requested: 'more',
  ijp: {
    ...fixture.ijp,
    url: 'https://prirucka.ujc.cas.cz/?slovo=more',
    entries: fixture.ijp.entries.map((entry) => ({
      ...entry,
      lemma: 'moře',
    })),
  },
};
assert.equal(
  exportRows([correctedFixture])[0][10],
  'https://prirucka.ujc.cas.cz/?slovo=mo%C5%99e',
);

const csv = csvText([fixture]);
assert.ok(csv.startsWith('\ufeff"Rod","Slovo","Číslo"'));
assert.ok(!csv.includes('Stav zdroje'));
assert.ok(!csv.includes('Ověřeno'));
assert.ok(
  csv.includes(
    '"=HYPERLINK(""https://prirucka.ujc.cas.cz/?slovo=%C5%BEena"",""https://prirucka.ujc.cas.cz/?slovo=%C5%BEena"")"',
  ),
);
await writeFile('.test-build/export-layout.csv', csv);

const formulaFixture = {
  ...fixture,
  ijp: {
    ...fixture.ijp,
    entries: fixture.ijp.entries.map((entry) => ({
      ...entry,
      lemma: '=SUM(1)',
    })),
  },
};
assert.ok(csvText([formulaFixture]).includes("'=SUM(1)"));
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
const xlsxBuffer = Buffer.from(await downloaded.arrayBuffer());
await writeFile('.test-build/export-layout.xlsx', xlsxBuffer);
await workbook.xlsx.load(xlsxBuffer);
assert.equal(workbook.worksheets[0].getCell('F2').value, 'ženě');
assert.equal(workbook.worksheets[0].getCell('C2').value, 'Jednotné');
assert.equal(workbook.worksheets[0].getCell('C3').value, 'Množné');
assert.deepEqual(workbook.worksheets[0].getCell('K2').value, {
  text: fixture.ijp.url,
  hyperlink: fixture.ijp.url,
});
assert.equal(workbook.worksheets[0].getColumn(1).width, 16);
assert.equal(workbook.worksheets[0].getColumn(2).width, 18);
assert.equal(workbook.worksheets[0].getColumn(3).width, 11);
assert.equal(
  workbook.worksheets[0].getCell('A1').fill.fgColor.argb,
  'FFD9EFE5',
);
assert.equal(workbook.worksheets[0].getCell('A1').font.bold, true);

globalThis.fetch = async (url) => {
  assert.equal(
    String(url),
    'https://example.com/repo/fonts/NotoSans-Regular.ttf',
  );
  return new Response(await readFile('public/fonts/NotoSans-Regular.ttf'));
};
const basePdfFixtures = [
  ['žena', 'F'],
  ['pes', 'M'],
  ['hrad', 'I'],
  ['město', 'N'],
].map(([word, gender]) => ({
  ...fixture,
  word,
  requested: word,
  ijp: {
    ...fixture.ijp,
    url: `https://prirucka.ujc.cas.cz/?slovo=${encodeURIComponent(word)}`,
    entries: fixture.ijp.entries.map((entry) => ({
      ...entry,
      lemma: word,
      gender,
    })),
  },
}));

const pdfFixtures = Array.from({ length: 6 }, (_, index) => ({
  ...basePdfFixtures[index % basePdfFixtures.length],
  word: `slovo-a4-${index + 1}`,
  ijp: {
    ...basePdfFixtures[index % basePdfFixtures.length].ijp,
    entries: basePdfFixtures[index % basePdfFixtures.length].ijp.entries.map(
      (entry) => ({ ...entry, lemma: `slovo-a4-${index + 1}` }),
    ),
  },
}));

await exportData('pdf-a4', pdfFixtures);
const pdfA4 = Buffer.from(await downloaded.arrayBuffer());
assert.equal(pdfA4.subarray(0, 5).toString(), '%PDF-');
assert.ok(pdfA4.includes(Buffer.from('/ToUnicode')));
assert.ok(pdfA4.includes(Buffer.from('/MediaBox [0 0 595.')));
assert.equal(pdfA4.toString('latin1').match(/\/Type \/Page\b/g)?.length, 1);
await writeFile('.test-build/export-layout-a4.pdf', pdfA4);

const pdfA3Fixtures = Array.from({ length: 12 }, (_, index) => ({
  ...basePdfFixtures[index % basePdfFixtures.length],
  word: `slovo${index + 1}`,
  ijp: {
    ...basePdfFixtures[index % basePdfFixtures.length].ijp,
    entries: basePdfFixtures[index % basePdfFixtures.length].ijp.entries.map(
      (entry) => ({ ...entry, lemma: `slovo${index + 1}` }),
    ),
  },
}));
await exportData('pdf-a3', pdfA3Fixtures);
const pdfA3 = Buffer.from(await downloaded.arrayBuffer());
assert.equal(pdfA3.subarray(0, 5).toString(), '%PDF-');
assert.ok(pdfA3.includes(Buffer.from('/ToUnicode')));
assert.ok(pdfA3.includes(Buffer.from('/MediaBox [0 0 841.')));
assert.equal(pdfA3.toString('latin1').match(/\/Type \/Page\b/g)?.length, 1);
await writeFile('.test-build/export-layout-a3.pdf', pdfA3);

globalThis.fetch = originalFetch;
URL.createObjectURL = originalCreateObjectUrl;
URL.revokeObjectURL = originalRevokeObjectUrl;
delete globalThis.document;

console.log(
  'PASS: IJP parsing, four genders, seven cases, footnotes, plural-only nouns, input validation, suggestions, auth rejection, transposed CSV/XLSX exports, six-card A4 PDF and twelve-card A3 PDF.',
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
