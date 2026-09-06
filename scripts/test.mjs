import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
await mkdir('.test-build',{recursive:true});
for(const name of ['types','config','dictionary','handler','suggestions','exports']){
 const source=await readFile(`lib/${name}.ts`,'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/from ['"](\.\/[^'"]+)['"]/g,"from '$1.mjs'");
 await writeFile(`.test-build/${name}.mjs`,code);
}
const {parseIjp,parseMorph,validateWord,lookup}=await import('../.test-build/dictionary.mjs');
const {handleDictionary}=await import('../.test-build/handler.mjs');
const {suggest}=await import('../.test-build/suggestions.mjs');
const {csvText,exportRows,exportData}=await import('../.test-build/exports.mjs');
const rows=Array.from({length:7},(_,i)=>`<tr><td>${i+1}. pád</td><td>kůň<sup>9</sup>, koník</td><td>koně</td></tr>`).join('');
for(const [rod,gender]of [['m. živ.','M'],['m. neživ.','I'],['ž.','F'],['s.','N']]){
 const p=parseIjp(`<div class="hlavicka"><h2><strong>kůň</strong></h2></div><p class="polozky">rod: ${rod}</p><table class="para"><tr><td/><td>jednotné číslo</td><td>množné číslo</td></tr>${rows}</table>`,'kůň');
 assert.equal(p.entries[0].gender,gender);assert.deepEqual(p.entries[0].singular[0],['kůň','koník']);assert.equal(p.entries[0].plural.length,7);
}
assert.equal(parseIjp('<b>nenalezeno</b>','xyz').status,'not_found');
const plural=parseIjp('<div class="hlavicka"><h2><strong>dveře</strong></h2></div><p class="polozky">rod: ž.</p><table class="para"><tr><td/><td>množné číslo</td></tr><tr><td>1. pád</td><td>dveře</td></tr></table>','dveře');
assert.deepEqual(plural.entries[0].singular[0],[]);assert.deepEqual(plural.entries[0].plural[0],['dveře']);
const parsed=parseMorph({result:'žena\tžena\tNNFS1-----A----\tžena\tžena\tNNFS1-----A----\tženě\tžena\tNNFS3-----A----\tženy\tžena\tNNFP1-----A----\tženoucí\tženoucí\tAGFS1-----A----\tpaní\tpaní-1\tNNFS1-----A----\tpaní\tpaní-2\tNNFS1-----A----'},'žena');
assert.equal(parsed.entries.length,3);assert.deepEqual(parsed.entries[0].singular[0],['žena']);assert.deepEqual(parsed.entries[0].plural[0],['ženy']);
for(const g of ['M','I','F','N'])assert.equal(parseMorph({result:`x\tx\tNN${g}S1-----A----`},'x').entries[0].gender,g);
assert.equal(parseMorph({result:'hezký\thezký\tAAIS1----1A----'},'hezký').status,'not_found');
assert.throws(()=>validateWord('x\ny'));assert.throws(()=>validateWord('https://example.com'));assert.equal(validateWord(' kůň '),'kůň');
assert.equal(suggest('kamarad')[0],'kamarád');assert.ok(suggest('kamard').includes('kamarád'));assert.equal(suggest('želez', ['železo'])[0],'železo');
assert.equal((await handleDictionary(new Request('https://example.com?word=pes'))).status,401);
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response('{}',{status:401});
assert.equal((await handleDictionary(new Request('https://example.com?word=pes',{headers:{Authorization:'Bearer fake'}}))).status,401);
globalThis.fetch=async url=>String(url).includes('/auth/v1/user')?Response.json({id:'test'}):Response.json([]);
assert.equal((await handleDictionary(new Request('https://example.com?word=pes',{headers:{Authorization:'Bearer fake'}}))).status,403);
globalThis.fetch=originalFetch;
const fixture={word:'žena',requested:'žena',checkedAt:'2026-09-06T12:00:00Z',ijp:parsed,morphodita:parsed};
assert.ok(csvText([fixture]).startsWith('\ufeff'));assert.ok(csvText([fixture]).includes('ženě'));assert.equal(exportRows([fixture]).length,84);
assert.ok(csvText([{...fixture,word:'=SUM(1)'}]).includes("'=SUM(1)"));
let downloaded;
const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};
globalThis.document={baseURI:'https://example.com/repo/',createElement:()=>({click(){}})};
await exportData('xlsx',[fixture]);
const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await downloaded.arrayBuffer());
assert.equal(workbook.worksheets[0].getCell('G4').value,'ženě');
globalThis.fetch=async url=>{assert.equal(String(url),'https://example.com/repo/fonts/NotoSans-Regular.ttf');return new Response(await readFile('public/fonts/NotoSans-Regular.ttf'));};
await exportData('pdf',[fixture]);
const pdf=Buffer.from(await downloaded.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.includes(Buffer.from('/ToUnicode')));await writeFile('.test-build/unicode.pdf',pdf);
globalThis.fetch=originalFetch;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;delete globalThis.document;
console.log('PASS: four genders, seven cases, footnotes, plural-only nouns, ambiguity, deduplication, noun filtering, input validation, suggestions, auth rejection, CSV, XLSX round-trip and embedded Unicode PDF font.');
if(process.env.LIVE_TEST==='1'){
 for(const [word,gender] of [['pes','M'],['hrad','I'],['žena','F'],['město','N']]){
  const r=await lookup(word);assert.equal(r.ijp.status,'ok',JSON.stringify(r.ijp));assert.equal(r.morphodita.status,'ok',JSON.stringify(r.morphodita));assert.ok(r.ijp.entries.some(x=>x.gender===gender));assert.ok(r.morphodita.entries.some(x=>x.gender===gender));for(const s of [r.ijp,r.morphodita])assert.ok(s.entries[0].singular.every(x=>x.length>0));console.log('LIVE PASS',word,gender);
 }
 const corrected=await lookup('kamarad');assert.equal(corrected.word,'kamarád');assert.equal(corrected.morphodita.status,'ok');console.log('LIVE PASS accent correction');
}
