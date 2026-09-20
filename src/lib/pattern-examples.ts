import {
  canonicalPatterns,
  inferDeclensionPattern
} from './declension-patterns';
import { ijpUrlForWord } from './ijp-url';
import type { Lookup, Saved } from './types';

export type PatternSection = {
  title?: string;
  patterns: readonly string[];
};

export type PatternGroup = {
  title: string;
  count: number;
  sections: readonly PatternSection[];
};

export const patternGroups: readonly PatternGroup[] = [
  {
    title: 'Mužský rod',
    count: 6,
    sections: [
      {
        title: 'Životný',
        patterns: ['pán', 'muž', 'předseda', 'soudce']
      },
      { title: 'Neživotný', patterns: ['hrad', 'stroj'] }
    ]
  },
  {
    title: 'Ženský rod',
    count: 4,
    sections: [{ patterns: ['žena', 'růže', 'píseň', 'kost'] }]
  },
  {
    title: 'Střední rod',
    count: 4,
    sections: [{ patterns: ['město', 'moře', 'kuře', 'stavení'] }]
  }
];

export function examplesByPattern(saved: Saved[]): Map<string, string[]> {
  const examples = new Map<string, Set<string>>();

  for (const row of saved) {
    for (const paradigm of row.result.ijp.entries) {
      const pattern = inferDeclensionPattern(paradigm)?.name;
      if (!pattern) continue;
      const words = examples.get(pattern) || new Set<string>();
      words.add(row.word);
      examples.set(pattern, words);
    }
  }

  return new Map(
    [...examples].map(([pattern, words]) => [
      pattern,
      [...words].sort((left, right) => left.localeCompare(right, 'cs'))
    ])
  );
}

export function canonicalPatternLookups(): Lookup[] {
  const checkedAt = new Date().toISOString();
  return canonicalPatterns.map((pattern) => ({
    requested: pattern.lemma,
    word: pattern.lemma,
    checkedAt,
    ijp: {
      status: 'ok',
      url: ijpUrlForWord(pattern.lemma),
      entries: [pattern]
    }
  }));
}
