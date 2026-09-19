import { supabase } from './supabase';
import type { Lookup, Saved } from './types';

const PAGE_SIZE = 500;

export async function loadSavedWords(): Promise<Saved[]> {
  const rows: Saved[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await supabase
      .from('czech_words')
      .select('id,word,result,updated_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (response.error) throw response.error;
    rows.push(...(response.data as Saved[]));
    if (response.data.length < PAGE_SIZE) return rows;
  }
}

export async function saveWord(userId: string, result: Lookup): Promise<void> {
  const response = await supabase.from('czech_words').upsert(
    {
      word: result.word,
      result,
      user_id: userId,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,word' }
  );

  if (response.error) throw response.error;
}

export async function removeWord(userId: string, word: string): Promise<void> {
  const response = await supabase
    .from('czech_words')
    .delete()
    .eq('user_id', userId)
    .eq('word', word);

  if (response.error) throw response.error;
}
