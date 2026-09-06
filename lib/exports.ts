import {cases,genders,type Lookup} from './types';
export const headers=['Slovo','Zdroj','Heslo / význam','Rod','Číslo','Pád','Tvary','Stav zdroje','Odhad','Ověřeno','Odkaz'];
export function exportRows(results:Lookup[]):string[][]{
  return results.flatMap(r=>(['ijp','morphodita'] as const).flatMap(key=>{
    const source=r[key],name=key==='ijp'?'Internetová jazyková příručka':'MorphoDiTa';
    if(!source.entries.length)return [[r.word,name,'','','','','',source.message||source.status,'',r.checkedAt,source.url]];
    return source.entries.flatMap(p=>(['singular','plural'] as const).flatMap(n=>p[n].map((forms,i)=>[r.word,name,p.lemma,p.gender?genders[p.gender]:'Neurčeno',n==='singular'?'Jednotné':'Množné',cases[i],forms.join(', '),source.status,source.guessed?'Ano':'Ne',r.checkedAt,source.url])));
  }));
}
export function csvText(results:Lookup[]){return '\ufeff'+[headers,...exportRows(results)].map(row=>row.map(value=>'"'+(/^[=+@\-\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')+'"').join(';')).join('\r\n');}
function download(data:BlobPart,type:string,name:string){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportData(format:'csv'|'xlsx'|'pdf',results:Lookup[]){
  if(!results.length)throw new Error('Nejprve vyberte slova k exportu.');
  const filename='ceske-pady-'+new Date().toISOString().slice(0,10);
  if(format==='csv'){download(csvText(results),'text/csv;charset=utf-8',filename+'.csv');return;}
  if(format==='xlsx'){
    const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();workbook.creator='České pády';
    const sheet=workbook.addWorksheet('České pády');sheet.addRows([headers,...exportRows(results)]);
    sheet.columns.forEach((col,i)=>{col.width=[22,32,30,24,16,12,45,30,12,26,60][i];});
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2459DB'}};
    sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:'K1'};
    download(await workbook.xlsx.writeBuffer() as ArrayBuffer,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename+'.xlsx');return;
  }
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const font=await fetch(new URL('./fonts/NotoSans-Regular.ttf',document.baseURI));if(!font.ok)throw new Error('Písmo pro PDF se nepodařilo načíst. Zkuste export znovu.');
  const bytes=new Uint8Array(await font.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const doc=new jsPDF();doc.addFileToVFS('NotoSans.ttf',btoa(binary));doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans');
  let first=true;
  for(const result of results){for(const key of ['ijp','morphodita'] as const){const source=result[key];const entries=source.entries.length?source.entries:[null];for(const entry of entries){
    if(!first)doc.addPage();first=false;doc.setFontSize(21);doc.text(result.word,14,22);doc.setFontSize(10);
    doc.text(key==='ijp'?'Internetová jazyková příručka · ÚJČ':'MorphoDiTa · ÚFAL',14,32);
    doc.text(doc.splitTextToSize(entry?`${entry.lemma} · ${entry.gender?genders[entry.gender]:'Rod neurčen'}`:source.message||source.status,180),14,40);
    if(entry)autoTable(doc,{startY:55,tableWidth:181,head:[['Pád','Jednotné číslo','Množné číslo']],body:cases.map((name,i)=>[name,entry.singular[i].join(', ')||'—',entry.plural[i].join(', ')||'—']),styles:{font:'NotoSans',fontStyle:'normal',fontSize:10,cellPadding:4},headStyles:{fontStyle:'normal',fillColor:[36,89,219]},columnStyles:{0:{cellWidth:25},1:{cellWidth:78},2:{cellWidth:78}},margin:{bottom:40}});
    doc.setFontSize(8);doc.text('Ověřeno: '+new Date(result.checkedAt).toLocaleString('cs-CZ')+(source.guessed?' · Tvary odhadnuté modelem':''),14,265);doc.textWithLink('Otevřít původní zdroj',14,273,{url:source.url});
  }}}
  download(doc.output('arraybuffer'),'application/pdf',filename+'.pdf');
}


