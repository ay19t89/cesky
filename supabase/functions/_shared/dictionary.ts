import { load } from 'cheerio';
import type { Gender, Lookup, Paradigm, Source } from './types.ts';

const IJP_BASE = 'https://prirucka.ujc.cas.cz/';

function emptyParadigm(lemma: string, gender: Gender | null): Paradigm {
  return {
    lemma,
    gender,
    singular: Array.from({ length: 7 }, () => []),
    plural: Array.from({ length: 7 }, () => [])
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
      'Zadejte jedno slovo (nejvýše 80 znaků), bez číslic a mezer.'
    );
  }

  return word;
}

export function parseIjp(
  html: string,
  word: string,
  url = `${IJP_BASE}?slovo=${encodeURIComponent(word)}`
): Source {
  const $ = load(html);
  const entries: Paradigm[] = [];
  const suggestions = [
    ...new Set(
      $('#dalsiz a')
        .map((_, link) => $(link).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((candidate) => {
          try {
            validateWord(candidate);
            return (
              candidate.toLocaleLowerCase('cs-CZ') !==
              word.toLocaleLowerCase('cs-CZ')
            );
          } catch {
            return false;
          }
        })
    )
  ].slice(0, 8);

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

  const pageText = $('body').text().replace(/\s+/g, ' ');
  const trafficLimited =
    /příliš mnoho (?:požadavků|dotazů)|velk(?:ý|é|ému) (?:provoz|zatížení)|zkuste (?:to )?později/iu.test(
      pageText
    );

  return {
    status: entries.length ? 'ok' : trafficLimited ? 'error' : 'not_found',
    url,
    entries,
    message: entries.length
      ? undefined
      : trafficLimited
        ? 'Příručka je dočasně přetížená. Zkuste hledání později.'
        : 'Příručka nevrátila tabulku skloňování. Ověřte heslo přímo ve zdroji.',
    suggestions: suggestions.length ? suggestions : undefined
  };
}

async function fetchRemote(url: string): Promise<Response> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'text/html' }
  });

  if (!response.ok) {
    throw new Error(`Zdroj je dočasně nedostupný (${response.status}).`);
  }

  return response;
}

function failedSource(url: string, cause?: unknown): Source {
  const detail = cause instanceof Error ? cause.message : '';
  return {
    status: 'error',
    url,
    entries: [],
    message:
      detail ||
      'Zdroj neodpovídá nebo vrátil neplatná data. Zkuste ověření znovu.'
  };
}

export async function fetchIjp(word: string): Promise<Source> {
  const searchUrl = `${IJP_BASE}?slovo=${encodeURIComponent(word)}`;
  const searchSource = parseIjp(
    await (await fetchRemote(searchUrl)).text(),
    word,
    searchUrl
  );
  if (searchSource.entries.length || searchSource.status === 'error') {
    return searchSource;
  }

  const entryUrl = `${IJP_BASE}?id=${encodeURIComponent(word)}`;
  const entrySource = parseIjp(
    await (await fetchRemote(entryUrl)).text(),
    word,
    entryUrl
  );
  if (entrySource.entries.length || entrySource.status === 'error') {
    return entrySource;
  }

  return combineMissingSources([searchSource, entrySource]);
}

function combineMissingSources(sources: Source[]): Source {
  const usable = sources.find((source) => source.status === 'not_found');
  const base = usable || sources[0];
  const suggestions = [
    ...new Set(sources.flatMap((source) => source.suggestions || []))
  ].slice(0, 8);

  return {
    ...base,
    suggestions: suggestions.length ? suggestions : undefined
  };
}

async function lookupWithCaseFallback(requested: string): Promise<Source> {
  const lowercase = requested.toLocaleLowerCase('cs-CZ');
  const candidates = [...new Set([requested, lowercase])];
  const attempted: Source[] = [];

  for (const candidate of candidates) {
    const url = `${IJP_BASE}?slovo=${encodeURIComponent(candidate)}`;
    const source = await fetchIjp(candidate).catch((cause) =>
      failedSource(url, cause)
    );
    if (source.entries.length) return source;
    if (source.status === 'error') return source;
    attempted.push(source);
  }

  return combineMissingSources(attempted);
}

export async function lookup(raw: unknown): Promise<Lookup> {
  const requested = validateWord(raw);
  const ijp = await lookupWithCaseFallback(requested);
  const word = ijp.entries[0]?.lemma || requested;

  return {
    requested,
    word,
    checkedAt: new Date().toISOString(),
    ijp
  };
}
