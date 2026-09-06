const common =
  'pes kočka kamarád kamarádka žena muž dítě město dům stůl strom škola kniha učitel učitelka student studentka přítel přítelkyně člověk ruka noha hlava oko ucho srdce moře kuře stavení nádraží auto kolo vlak autobus letadlo loď cesta práce peníze dveře nůžky prázdniny rodina matka otec bratr sestra dědeček babička syn dcera rodič chlapec dívka pán hrad stroj předseda soudce růže píseň kost vesnice ulice náměstí zahrada les pole louka hora řeka jezero oběd večeře snídaně jídlo chléb voda káva čaj mléko pivo víno ovoce jablko hruška banán pomeranč rajče brambora vejce maso ryba pták kůň kráva prase ovce myš slon lev medvěd králík motýl včela den týden měsíc rok hodina minuta čas ráno večer noc léto zima jaro podzim slunce déšť sníh vítr nebe světlo počítač telefon obraz okno pokoj postel židle skříň kuchyně koupelna klíč zahradník lékař doktor nemocnice obchod prodavač policista řidič programátor kolega kolegyně šéf nápad otázka odpověď jazyk slovo věta dopis příběh zpráva radost láska přání zdraví štěstí život smrt svoboda možnost věc sůl zub krev dlaň rameno koleno břicho záda ústa vlasy tvář peněženka batoh taška kabát boty tričko čepice čtenář návštěva přátelství zvíře kotě štěně Praha Brno Česko'.split(
    ' ',
  );
export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');
export function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next[j + 1] = Math.min(
        next[j] + 1,
        row[j + 1] + 1,
        row[j] + Number(a[i] !== b[j]),
      );
    row = next;
  }
  return row[b.length];
}
export function suggest(input: string, saved: string[] = []) {
  const q = fold(input.trim());
  if (!q) return [];
  return [...new Set([...saved, ...common])]
    .map((word) => ({ word, key: fold(word) }))
    .map((x) => ({
      ...x,
      score: x.key === q ? 0 : x.key.startsWith(q) ? 1 : distance(q, x.key) + 2,
    }))
    .filter((x) => x.score <= (q.length > 4 ? 4 : 3))
    .sort((a, b) => a.score - b.score || a.word.localeCompare(b.word, 'cs'))
    .slice(0, 7)
    .map((x) => x.word);
}
