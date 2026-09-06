export function registerLookup(action:(word:string)=>Promise<unknown>){
  const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
  if(!context)return()=>{};const lifecycle=new AbortController();
  try{void Promise.resolve(context.registerTool({name:'check_czech_noun',title:'Ověřit české podstatné jméno',description:'Look up a Czech noun in both sources and display its declension. Does not save the result. Requires a signed-in Supabase account.',inputSchema:{type:'object',properties:{word:{type:'string',minLength:1,maxLength:80}},required:['word'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:unknown)=>{const word=(input as {word?:unknown})?.word;if(typeof word!=='string'||!word.trim()||word.length>80)throw new Error('Invalid word');return action(word);}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
}
