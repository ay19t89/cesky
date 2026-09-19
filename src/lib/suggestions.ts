const common = [
  'pes kočka kamarád kamarádka žena muž dítě město dům stůl strom škola',
  'kniha učitel učitelka student studentka přítel přítelkyně člověk ruka noha hlava oko',
  'ucho srdce moře kuře stavení nádraží auto kolo vlak autobus letadlo loď',
  'cesta práce peníze dveře nůžky prázdniny rodina matka otec bratr sestra dědeček',
  'babička syn dcera rodič chlapec dívka pán hrad stroj předseda soudce růže',
  'píseň kost vesnice ulice náměstí zahrada les pole louka hora řeka jezero',
  'oběd večeře snídaně jídlo chléb voda káva čaj mléko pivo víno ovoce',
  'jablko hruška banán pomeranč rajče brambora vejce maso ryba pták kůň kráva',
  'prase ovce myš slon lev medvěd králík motýl včela den týden měsíc',
  'rok hodina minuta čas ráno večer noc léto zima jaro podzim slunce',
  'déšť sníh vítr nebe světlo počítač telefon obraz okno pokoj postel židle',
  'skříň kuchyně koupelna klíč zahradník lékař doktor nemocnice obchod prodavač policista řidič',
  'programátor kolega kolegyně šéf nápad otázka odpověď jazyk slovo věta dopis příběh',
  'zpráva radost láska přání zdraví štěstí život smrt svoboda možnost věc sůl',
  'zub krev dlaň rameno koleno břicho záda ústa vlasy tvář peněženka batoh',
  'taška kabát boty tričko čepice čtenář návštěva přátelství zvíře kotě štěně Praha',
  'Brno Česko'
].flatMap((line) => line.split(' '));

const STORAGE_KEY = 'ceske-pady-recent-lookups';
const MAX_LEARNED_WORDS = 200;

export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');

export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next[j + 1] = Math.min(
        next[j] + 1,
        row[j + 1] + 1,
        row[j] + Number(a[i] !== b[j])
      );
    row = next;
  }
  return row[b.length];
}

function suggestionScore(query: string, candidate: string): number {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  return distance(query, candidate) + 3;
}

export function suggest(input: string, vocabulary: string[] = []): string[] {
  const q = fold(input.trim());
  if (!q) return [];
  return [...new Set([...vocabulary, ...common])]
    .map((word) => ({ word, key: fold(word) }))
    .map((x) => ({
      ...x,
      score: suggestionScore(q, x.key)
    }))
    .filter((x) => x.score <= (q.length > 4 ? 5 : 3))
    .sort((a, b) => a.score - b.score || a.word.localeCompare(b.word, 'cs'))
    .slice(0, 8)
    .map((x) => x.word);
}

export function loadLearnedSuggestions(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored)
      ? stored.filter((word): word is string => typeof word === 'string')
      : [];
  } catch {
    return [];
  }
}

export function rememberSuggestion(word: string): string[] {
  const learned = loadLearnedSuggestions().filter(
    (candidate) => fold(candidate) !== fold(word)
  );
  const updated = [word, ...learned].slice(0, MAX_LEARNED_WORDS);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Suggestions still work when storage is unavailable or full.
    }
  }
  return updated;
}
