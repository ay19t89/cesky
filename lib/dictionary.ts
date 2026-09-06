import { load } from 'cheerio';
import type { Gender, Lookup, Paradigm, Source } from './types';

const IJP_BASE = 'https://prirucka.ujc.cas.cz/';

function emptyParadigm(lemma: string, gender: Gender | null): Paradigm {
  return {
    lemma,
    gender,
    singular: Array.from({ length: 7 }, () => []),
    plural: Array.from({ length: 7 }, () => []),
  };
}

export function validateWord(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Zadejte jedno podstatné jméno.');
  }

  const word = value.trim().normalize('NFC');
  const validWord = /^[\p{L}\p{M}][\p{L}\p{M}'’\-]{0,79}$/u;

  if (!validWord.test(word)) {
    throw new Error(
      'Zadejte jedno slovo (nejvýše 80 znaků), bez číslic a mezer.',
    );
  }

  return word;
}

export function parseIjp(html: string, word: string): Source {
  const $ = load(html);
  const entries: Paradigm[] = [];

  $('table.para').each((_, table) => {
    const currentTable = $(table);
    const heading = currentTable.prevAll('.hlavicka').first();
    const lemma = (
      heading.find('h2 strong').first().text() ||
      $('.hlavicka h2 strong').first().text() ||
      word
    ).trim();

    const genderText =
      currentTable
        .prevAll('p.polozky')
        .map((_, paragraph) => $(paragraph).text())
        .get()
        .find((text) => /^rod:/.test(text)) || '';

    const foundGenders: Gender[] = [];
    if (/m\.\s*neživ\./.test(genderText)) foundGenders.push('I');
    if (/m\.\s*živ\./.test(genderText)) foundGenders.push('M');
    if (/(?:ž\.|žen\.)/.test(genderText)) foundGenders.push('F');
    if (/s\.|stř\./.test(genderText)) foundGenders.push('N');

    const paradigm = emptyParadigm(lemma, foundGenders[0] || null);
    let rowCount = 0;

    currentTable.find('tr').each((_, row) => {
      const cells = $(row).find('td,th');
      const match = cells
        .first()
        .text()
        .trim()
        .match(/^([1-7])\.\s*pád/);
      if (!match) return;

      rowCount += 1;
      const caseIndex = Number(match[1]) - 1;
      const header = currentTable.find('tr').first().text();
      const onlyPlural =
        cells.length === 2 && /množné/.test(header) && !/jednotné/.test(header);

      for (let column = 1; column < cells.length && column <= 2; column += 1) {
        const cell = cells.eq(column).clone();
        cell.find('sup,script,style').remove();
        cell.find('br').replaceWith(', ');

        const forms = cell
          .text()
          .normalize('NFC')
          .replace(/\u00a0/g, ' ')
          .split(/\s*,\s*/)
          .map((form) => form.trim())
          .filter((form) => form && !/^[—–-]$/.test(form));

        const bucket =
          column === 2 || onlyPlural ? paradigm.plural : paradigm.singular;
        bucket[caseIndex] = [...new Set(forms)];
      }
    });

    if (rowCount) {
      for (const gender of foundGenders.length ? foundGenders : [null]) {
        entries.push({ ...paradigm, gender });
      }
    }
  });

  return {
    status: entries.length ? 'ok' : 'not_found',
    url: `${IJP_BASE}?slovo=${encodeURIComponent(word)}`,
    entries,
    message: entries.length
      ? undefined
      : 'Příručka nevrátila tabulku skloňování. Ověřte heslo přímo ve zdroji.',
  };
}

async function fetchRemote(url: string): Promise<Response> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) {
    throw new Error(`Zdroj je dočasně nedostupný (${response.status}).`);
  }

  return response;
}

function failedSource(url: string): Source {
  return {
    status: 'error',
    url,
    entries: [],
    message:
      'Zdroj neodpovídá nebo vrátil neplatná data. Zkuste ověření znovu.',
  };
}

export async function fetchIjp(word: string): Promise<Source> {
  const url = `${IJP_BASE}?slovo=${encodeURIComponent(word)}`;
  return parseIjp(await (await fetchRemote(url)).text(), word);
}

export async function lookup(raw: unknown): Promise<Lookup> {
  const requested = validateWord(raw);
  const url = `${IJP_BASE}?slovo=${encodeURIComponent(requested)}`;
  const ijp = await fetchIjp(requested).catch(() => failedSource(url));
  const word = ijp.entries[0]?.lemma || requested;

  return {
    requested,
    word,
    checkedAt: new Date().toISOString(),
    ijp,
  };
}
