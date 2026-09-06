import {SUPABASE_URL,SUPABASE_KEY} from './config';
import {fetchIjp,lookup,validateWord} from './dictionary';
export async function handleDictionary(request:Request):Promise<Response>{
  const token=request.headers.get('Authorization');
  if(!token?.startsWith('Bearer '))return Response.json({error:'Přihlaste se pro ověření slova.'},{status:401});
  try{
    const headers={apikey:SUPABASE_KEY,Authorization:token};
    const user=await fetch(SUPABASE_URL+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
    if(!user.ok)return Response.json({error:'Přihlášení vypršelo. Přihlaste se znovu.'},{status:401});
    const profile=await user.json() as {email?:string};
    const member=await fetch(SUPABASE_URL+'/rest/v1/dictionary_members?select=user_id&limit=1',{headers,signal:AbortSignal.timeout(8000)});
    if(!member.ok)return Response.json({error:'Přihlášení funguje, ale tabulka dictionary_members není správně nastavená. Spusťte opravný SQL soubor v Supabase.'},{status:503});
    const members=await member.json();
    if(!Array.isArray(members)||!members.length)return Response.json({error:`Přihlášení funguje, ale účet ${profile.email||''} ještě není přidaný v dictionary_members. Spusťte opravný SQL soubor v Supabase.`},{status:403});
    const url=new URL(request.url);const word=validateWord(url.searchParams.get('word'));
    if(url.searchParams.get('action')==='suggest'){
      const data=await fetchIjp(word);
      return Response.json({suggestions:[...new Set(data.entries.map(x=>x.lemma))]},{headers:{'Cache-Control':'private, max-age=300'}});
    }
    return Response.json(await lookup(word),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Ověření se nezdařilo.'},{status:400});}
}

