import {load} from 'cheerio';
import type {Gender,Paradigm,Source,Lookup} from './types.ts';
const ijpBase='https://prirucka.ujc.cas.cz/';
const morphBase='https://lindat.mff.cuni.cz/services/morphodita/api/generate';
const empty=(lemma:string,gender:Gender|null):Paradigm=>({lemma,gender,singular:Array.from({length:7},()=>[]),plural:Array.from({length:7},()=>[])});
export function validateWord(value:unknown):string{
  if(typeof value!=='string')throw new Error('Zadejte jedno podstatné jméno.');
  const word=value.trim().normalize('NFC');
  if(!/^[\p{L}\p{M}][\p{L}\p{M}'’\-]{0,79}$/u.test(word))throw new Error('Zadejte jedno slovo (nejvýše 80 znaků), bez číslic a mezer.');
  return word;
}
export function parseIjp(html:string,word:string):Source{
  const $=load(html); const entries:Paradigm[]=[];
  $('table.para').each((_,table)=>{
    const t=$(table), heading=t.prevAll('.hlavicka').first();
    const lemma=(heading.find('h2 strong').first().text()||$('.hlavicka h2 strong').first().text()||word).trim();
    const rod=t.prevAll('p.polozky').map((_,p)=>$(p).text()).get().find(x=>/^rod:/.test(x))||'';
    const found:Gender[]=[];
    if(/m\.\s*neživ\./.test(rod))found.push('I');
    if(/m\.\s*živ\./.test(rod))found.push('M');
    if(/(?:ž\.|žen\.)/.test(rod))found.push('F');
    if(/s\.|stř\./.test(rod))found.push('N');
    const p=empty(lemma,found[0]||null);let rowCount=0;
    t.find('tr').each((_,row)=>{
      const cells=$(row).find('td,th'); const match=cells.first().text().trim().match(/^([1-7])\.\s*pád/);
      if(!match)return;rowCount++;const index=Number(match[1])-1;
      const header=t.find('tr').first().text();
      const onlyPlural=cells.length===2&&/množné/.test(header)&&!/jednotné/.test(header);
      for(let col=1;col<cells.length&&col<=2;col++){
        const cell=cells.eq(col).clone();cell.find('sup,script,style').remove();cell.find('br').replaceWith(', ');
        const forms=cell.text().normalize('NFC').replace(/\u00a0/g,' ').split(/\s*,\s*/).map(x=>x.trim()).filter(x=>x&&!/^[—–-]$/.test(x));
        const bucket=col===2||onlyPlural?p.plural:p.singular;bucket[index]=[...new Set(forms)];
      }
    });
    if(rowCount){for(const gender of found.length?found:[null])entries.push({...p,gender});}
  });
  return {status:entries.length?'ok':'not_found',url:ijpBase+'?slovo='+encodeURIComponent(word),entries,message:entries.length?undefined:'Příručka nevrátila tabulku skloňování. Ověřte heslo přímo ve zdroji.'};
}
export function parseMorph(json:{result?:unknown;model?:string;acknowledgements?:string[]},word:string):Source{
  if(typeof json.result!=='string')throw new Error('Neplatná odpověď MorphoDiTa.');
  const groups=new Map<string,Paradigm>();const parts=json.result.trim().split(/\t|\r?\n/);
  for(let i=0;i+2<parts.length;i+=3){
    const [form,lemma,tag]=parts.slice(i,i+3);const gender=tag[2] as Gender;
    if(!tag.startsWith('NN')||!['M','I','F','N'].includes(gender)||!['S','P'].includes(tag[3])||!/[1-7]/.test(tag[4]||''))continue;
    const key=lemma+'|'+gender;let p=groups.get(key);
    if(!p){p=empty(lemma,gender);p.tags={};groups.set(key,p);}
    const bucket=tag[3]==='S'?p.singular:p.plural;const index=Number(tag[4])-1;
    if(!bucket[index].includes(form))bucket[index].push(form);
    (p.tags![form]??=[]).push(tag);
  }
  return {status:groups.size?'ok':'not_found',url:morphBase+'?'+new URLSearchParams({model:'czech-morfflex',data:word,guesser:'yes'}),entries:[...groups.values()],model:json.model,acknowledgements:json.acknowledgements,message:groups.size?undefined:'MorphoDiTa nenašla tvary podstatného jména.'};
}
async function remote(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/html, application/json'}});if(!r.ok)throw new Error('Zdroj je dočasně nedostupný ('+r.status+').');return r;}
const failed=(url:string):Source=>({status:'error',url,entries:[],message:'Zdroj neodpovídá nebo vrátil neplatná data. Zkuste ověření znovu.'});
export async function fetchIjp(word:string){return parseIjp(await(await remote(ijpBase+'?slovo='+encodeURIComponent(word))).text(),word);}
export async function lookup(raw:unknown):Promise<Lookup>{
  const requested=validateWord(raw);
  // Resolve IJP's accent correction first so both sources check the same lemma.
  const ijp=await fetchIjp(requested).catch(()=>failed(ijpBase+'?slovo='+encodeURIComponent(requested)));
  const word=ijp.entries[0]?.lemma||requested;
  let morphodita:Source;
  try{
    const params={model:'czech-morfflex',data:word,guesser:'no'};
    morphodita=parseMorph(await(await remote(morphBase+'?'+new URLSearchParams(params))).json(),word);
    morphodita.guessed=false;
    if(morphodita.status==='not_found'){
      morphodita=parseMorph(await(await remote(morphBase+'?'+new URLSearchParams({...params,guesser:'yes'}))).json(),word);
      morphodita.guessed=morphodita.status==='ok';
    }
  }catch{morphodita=failed(morphBase);}
  return {requested,word,checkedAt:new Date().toISOString(),ijp,morphodita};
}
