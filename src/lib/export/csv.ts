import type { Lookup } from '../types';
import { exportRows } from './rows';
import { headers } from './shared';

function csvCell(value: string, allowFormula = false): string {
  const safeValue =
    !allowFormula && /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function csvHyperlink(url: string): string {
  const allowedHosts = [
    'https://prirucka.ujc.cas.cz/',
    'https://slovnik.seznam.cz/preklad/'
  ];

  if (!allowedHosts.some((host) => url.startsWith(host))) return url;
  const formulaUrl = url.replaceAll('"', '""');
  return `=HYPERLINK("${formulaUrl}","${formulaUrl}")`;
}

export function csvText(results: Lookup[]): string {
  const rows = [headers, ...exportRows(results)];

  return `\ufeff${rows
    .map((row, rowIndex) =>
      row
        .map((value, columnIndex) => {
          const isLink = rowIndex > 0 && columnIndex >= headers.length - 2;
          return csvCell(isLink ? csvHyperlink(value) : value, isLink);
        })
        .join(',')
    )
    .join('\r\n')}`;
}
