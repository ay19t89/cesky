import type { Gender, Paradigm } from './types';

export type DeclensionPatternConfidence = 'high' | 'medium' | 'low';

export type DeclensionPatternMatch = {
  name: string;
  score: number;
  confidence: DeclensionPatternConfidence;
  comparedForms: number;
};

type CanonicalPattern = Paradigm & {
  name: string;
};

const row = (...forms: string[]): string[][] =>
  forms.map((form) => form.split(',').map((variant) => variant.trim()));

export const canonicalPatterns: readonly CanonicalPattern[] = [
  {
    name: 'pán',
    lemma: 'pán',
    gender: 'M',
    singular: row(
      'pán',
      'pána',
      'pánovi,pánu',
      'pána',
      'pane',
      'pánovi,pánu',
      'pánem'
    ),
    plural: row(
      'páni,pánové',
      'pánů',
      'pánům',
      'pány',
      'páni,pánové',
      'pánech',
      'pány'
    )
  },
  {
    name: 'muž',
    lemma: 'muž',
    gender: 'M',
    singular: row(
      'muž',
      'muže',
      'muži,mužovi',
      'muže',
      'muži',
      'muži,mužovi',
      'mužem'
    ),
    plural: row(
      'muži,mužové',
      'mužů',
      'mužům',
      'muže',
      'muži,mužové',
      'mužích',
      'muži'
    )
  },
  {
    name: 'předseda',
    lemma: 'předseda',
    gender: 'M',
    singular: row(
      'předseda',
      'předsedy',
      'předsedovi',
      'předsedu',
      'předsedo',
      'předsedovi',
      'předsedou'
    ),
    plural: row(
      'předsedové',
      'předsedů',
      'předsedům',
      'předsedy',
      'předsedové',
      'předsedech',
      'předsedy'
    )
  },
  {
    name: 'soudce',
    lemma: 'soudce',
    gender: 'M',
    singular: row(
      'soudce',
      'soudce',
      'soudci,soudcovi',
      'soudce',
      'soudce',
      'soudci,soudcovi',
      'soudcem'
    ),
    plural: row(
      'soudci,soudcové',
      'soudců',
      'soudcům',
      'soudce',
      'soudci,soudcové',
      'soudcích',
      'soudci'
    )
  },
  {
    name: 'hrad',
    lemma: 'hrad',
    gender: 'I',
    singular: row(
      'hrad',
      'hradu',
      'hradu',
      'hrad',
      'hrade',
      'hradu,hradě',
      'hradem'
    ),
    plural: row(
      'hrady',
      'hradů',
      'hradům',
      'hrady',
      'hrady',
      'hradech',
      'hrady'
    )
  },
  {
    name: 'stroj',
    lemma: 'stroj',
    gender: 'I',
    singular: row(
      'stroj',
      'stroje',
      'stroji',
      'stroj',
      'stroji',
      'stroji',
      'strojem'
    ),
    plural: row(
      'stroje',
      'strojů',
      'strojům',
      'stroje',
      'stroje',
      'strojích',
      'stroji'
    )
  },
  {
    name: 'žena',
    lemma: 'žena',
    gender: 'F',
    singular: row('žena', 'ženy', 'ženě', 'ženu', 'ženo', 'ženě', 'ženou'),
    plural: row('ženy', 'žen', 'ženám', 'ženy', 'ženy', 'ženách', 'ženami')
  },
  {
    name: 'růže',
    lemma: 'růže',
    gender: 'F',
    singular: row('růže', 'růže', 'růži', 'růži', 'růže', 'růži', 'růží'),
    plural: row('růže', 'růží', 'růžím', 'růže', 'růže', 'růžích', 'růžemi')
  },
  {
    name: 'píseň',
    lemma: 'píseň',
    gender: 'F',
    singular: row(
      'píseň',
      'písně',
      'písni',
      'píseň',
      'písni',
      'písni',
      'písní'
    ),
    plural: row(
      'písně',
      'písní',
      'písním',
      'písně',
      'písně',
      'písních',
      'písněmi'
    )
  },
  {
    name: 'kost',
    lemma: 'kost',
    gender: 'F',
    singular: row('kost', 'kosti', 'kosti', 'kost', 'kosti', 'kosti', 'kostí'),
    plural: row(
      'kosti',
      'kostí',
      'kostem',
      'kosti',
      'kosti',
      'kostech',
      'kostmi'
    )
  },
  {
    name: 'město',
    lemma: 'město',
    gender: 'N',
    singular: row(
      'město',
      'města',
      'městu',
      'město',
      'město',
      'městě',
      'městem'
    ),
    plural: row('města', 'měst', 'městům', 'města', 'města', 'městech', 'městy')
  },
  {
    name: 'moře',
    lemma: 'moře',
    gender: 'N',
    singular: row('moře', 'moře', 'moři', 'moře', 'moře', 'moři', 'mořem'),
    plural: row('moře', 'moří', 'mořím', 'moře', 'moře', 'mořích', 'moři')
  },
  {
    name: 'kuře',
    lemma: 'kuře',
    gender: 'N',
    singular: row(
      'kuře',
      'kuřete',
      'kuřeti',
      'kuře',
      'kuře',
      'kuřeti',
      'kuřetem'
    ),
    plural: row(
      'kuřata',
      'kuřat',
      'kuřatům',
      'kuřata',
      'kuřata',
      'kuřatech',
      'kuřaty'
    )
  },
  {
    name: 'stavení',
    lemma: 'stavení',
    gender: 'N',
    singular: row(
      'stavení',
      'stavení',
      'stavení',
      'stavení',
      'stavení',
      'stavení',
      'stavením'
    ),
    plural: row(
      'stavení',
      'stavení',
      'stavením',
      'stavení',
      'stavení',
      'staveních',
      'staveními'
    )
  }
];

const CASE_WEIGHTS = [0, 1.5, 1.2, 1, 0.8, 1.1, 1.4] as const;

function normalize(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('cs-CZ').trim();
}

function commonPrefixLength(left: string, right: string): number {
  let index = 0;
  while (index < left.length && left[index] === right[index]) index += 1;
  return index;
}

function endingChange(lemma: string, form: string) {
  const normalizedLemma = normalize(lemma);
  const normalizedForm = normalize(form);
  const prefixLength = commonPrefixLength(normalizedLemma, normalizedForm);

  return {
    removed: normalizedLemma.slice(prefixLength),
    added: normalizedForm.slice(prefixLength),
    unchanged: normalizedLemma === normalizedForm
  };
}

function compareForms(
  actualLemma: string,
  actualForm: string,
  canonicalLemma: string,
  canonicalForm: string
): number {
  const actual = endingChange(actualLemma, actualForm);
  const canonical = endingChange(canonicalLemma, canonicalForm);

  if (actual.unchanged && canonical.unchanged) return 1;
  if (
    actual.removed === canonical.removed &&
    actual.added === canonical.added
  ) {
    return 1;
  }
  if (actual.added === canonical.added) return 0.9;
  if (canonical.added && actual.added.endsWith(canonical.added)) return 0.72;
  if (actual.added && canonical.added.endsWith(actual.added)) return 0.55;
  if (actual.added.at(-1) === canonical.added.at(-1)) return 0.35;
  return 0;
}

function compareVariants(
  actualLemma: string,
  actualForms: string[],
  canonicalLemma: string,
  canonicalForms: string[]
): number {
  let best = 0;
  for (const actualForm of actualForms) {
    for (const canonicalForm of canonicalForms) {
      best = Math.max(
        best,
        compareForms(actualLemma, actualForm, canonicalLemma, canonicalForm)
      );
    }
  }
  return best;
}

function lemmaEndingScore(actual: string, canonical: string): number {
  const left = normalize(actual);
  const right = normalize(canonical);
  if (left.slice(-2) === right.slice(-2)) return 1;
  if (left.at(-1) === right.at(-1)) return 0.55;
  return 0;
}

function patternEndingPrior(
  paradigm: Paradigm,
  pattern: CanonicalPattern
): number {
  if (paradigm.gender !== 'F') return 0;
  const lemma = normalize(paradigm.lemma);
  if (/[aá]$/u.test(lemma)) return pattern.name === 'žena' ? 1 : -1;
  if (/[eě]$/u.test(lemma)) return pattern.name === 'růže' ? 1 : -1;
  return pattern.name === 'kost' || pattern.name === 'píseň' ? 1 : -1;
}

function scorePattern(paradigm: Paradigm, pattern: CanonicalPattern) {
  const endingPrior = patternEndingPrior(paradigm, pattern);
  let score = lemmaEndingScore(paradigm.lemma, pattern.lemma) + endingPrior;
  let possible = paradigm.gender === 'F' ? 2 : 1;
  let comparedForms = 0;

  for (const number of ['singular', 'plural'] as const) {
    for (let index = 0; index < CASE_WEIGHTS.length; index += 1) {
      const actualForms = paradigm[number][index] ?? [];
      const canonicalForms = pattern[number][index] ?? [];
      if (!actualForms.length || !canonicalForms.length) continue;

      const weight = CASE_WEIGHTS[index];
      if (!weight) continue;
      score +=
        compareVariants(
          paradigm.lemma,
          actualForms,
          pattern.lemma,
          canonicalForms
        ) * weight;
      possible += weight;
      comparedForms += 1;
    }
  }

  return { score: score / possible, comparedForms };
}

function confidenceFor(
  score: number,
  margin: number,
  comparedForms: number
): DeclensionPatternConfidence {
  if (score >= 0.82 && margin >= 0.08 && comparedForms >= 8) return 'high';
  if (score >= 0.67 && margin >= 0.035 && comparedForms >= 5) return 'medium';
  return 'low';
}

export function inferDeclensionPattern(
  paradigm: Paradigm
): DeclensionPatternMatch | null {
  return inferDeclensionPatterns(paradigm, 1)[0] || null;
}

export function inferDeclensionPatterns(
  paradigm: Paradigm,
  limit = 2
): DeclensionPatternMatch[] {
  if (!paradigm.gender) return [];

  const candidates = canonicalPatterns
    .filter((pattern) => pattern.gender === paradigm.gender)
    .map((pattern) => ({ ...pattern, ...scorePattern(paradigm, pattern) }))
    .sort((left, right) => right.score - left.score);
  if (!candidates[0] || candidates[0].comparedForms < 3) return [];

  return candidates.slice(0, Math.max(1, limit)).map((candidate, index) => ({
    name: candidate.name,
    score: Math.round(candidate.score * 100),
    confidence: confidenceFor(
      candidate.score,
      candidate.score - (candidates[index + 1]?.score ?? 0),
      candidate.comparedForms
    ),
    comparedForms: candidate.comparedForms
  }));
}

export function patternsForGender(gender: Gender): string[] {
  return canonicalPatterns
    .filter((pattern) => pattern.gender === gender)
    .map((pattern) => pattern.name);
}
