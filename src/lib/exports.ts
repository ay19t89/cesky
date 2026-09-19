import type { Lookup } from './types';
import { csvText } from './export/csv';
import { exportPdf } from './export/pdf';
import { exportXlsx } from './export/xlsx';
import { datedExportFilename, download } from './export/shared';

export { csvText } from './export/csv';
export { exportRows } from './export/rows';
export { compareCzechWords, headers } from './export/shared';

export async function exportData(
  format: 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3',
  results: Lookup[]
): Promise<void> {
  if (!results.length) {
    throw new Error('Nejprve vyberte slova k exportu.');
  }

  const filename = datedExportFilename();

  if (format === 'csv') {
    download(csvText(results), 'text/csv;charset=utf-8', `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    await exportXlsx(results, filename);
    return;
  }

  const size = format === 'pdf-a3' ? 'a3' : 'a4';
  await exportPdf(results, `${filename}-${size}`, size);
}
