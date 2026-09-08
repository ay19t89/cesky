import { load } from 'cheerio';
import { translationUrl } from './translation.ts';
import type {
  TranslationLanguage,
  TranslationSense,
  TranslationSource,
  Translations
} from './types.ts';

function cleanText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function parseTranslation(
  html: string,
  word: string,
  language: TranslationLanguage
): TranslationSource {
  const $ = load(html);
  const targetLanguage = language === 'rusky' ? 'ru' : 'en';
  const article = $('.TranslatePage-results article.Box').first();
  const senses: TranslationSense[] = [];

  article.find('section.Box-content > ol > li').each((_, item) => {
    const lines = $(item).children('.Box-content-line');
    const primary = lines.first();
    const meaning = cleanText(
      primary
        .find('.c')
        .map((__, element) => $(element).text())
        .get()
        .join(' ')
    );
    const translations = [
      ...new Set(
        primary
          .find(`a[lang="${targetLanguage}"]`)
          .map((__, element) => cleanText($(element).text()))
          .get()
          .filter(Boolean)
      )
    ];
    const phrases = lines
      .slice(1)
      .map((__, line) => {
        const source = cleanText($(line).find('[lang="cs"]').first().text());
        const target = cleanText(
          $(line).find(`[lang="${targetLanguage}"].note`).last().text()
        );
        return source && target ? { source, target } : null;
      })
      .get()
      .filter((phrase): phrase is { source: string; target: string } =>
        Boolean(phrase)
      );

    if (translations.length || phrases.length) {
      senses.push({
        ...(meaning ? { meaning } : {}),
        translations,
        phrases
      });
    }
  });

  return {
    status: senses.length ? 'ok' : 'not_found',
    url: translationUrl(language, word),
    senses,
    message: senses.length ? undefined : 'Překlad nebyl nalezen.'
  };
}

function failedTranslation(
  language: TranslationLanguage,
  word: string
): TranslationSource {
  return {
    status: 'error',
    url: translationUrl(language, word),
    senses: [],
    message: 'Překlad se nepodařilo načíst.'
  };
}

async function fetchTranslation(
  word: string,
  language: TranslationLanguage
): Promise<TranslationSource> {
  const url = translationUrl(language, word);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'text/html' }
  });

  if (!response.ok) {
    throw new Error(
      `Seznam Slovník je dočasně nedostupný (${response.status}).`
    );
  }

  return parseTranslation(await response.text(), word, language);
}

export async function fetchTranslations(word: string): Promise<Translations> {
  const [rusky, anglicky] = await Promise.all([
    fetchTranslation(word, 'rusky').catch(() =>
      failedTranslation('rusky', word)
    ),
    fetchTranslation(word, 'anglicky').catch(() =>
      failedTranslation('anglicky', word)
    )
  ]);

  return { rusky, anglicky };
}
