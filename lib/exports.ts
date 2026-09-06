import { cases, genders, type Lookup } from './types';

export const headers = [
  'Slovo',
  'Zdroj',
  'Heslo',
  'Rod',
  'Číslo',
  'Pád',
  'Tvary',
  'Stav zdroje',
  'Ověřeno',
  'Odkaz',
];

export function exportRows(results: Lookup[]): string[][] {
  return results.flatMap((result) => {
    const source = result.ijp;
    const sourceName = 'Internetová jazyková příručka';

    if (!source.entries.length) {
      return [
        [
          result.word,
          sourceName,
          '',
          '',
          '',
          '',
          '',
          source.message || source.status,
          result.checkedAt,
          source.url,
        ],
      ];
    }

    return source.entries.flatMap((entry) =>
      (['singular', 'plural'] as const).flatMap((number) =>
        entry[number].map((forms, index) => [
          result.word,
          sourceName,
          entry.lemma,
          entry.gender ? genders[entry.gender] : 'Neurčeno',
          number === 'singular' ? 'Jednotné' : 'Množné',
          cases[index],
          forms.join(', '),
          source.status,
          result.checkedAt,
          source.url,
        ]),
      ),
    );
  });
}

export function csvText(results: Lookup[]): string {
  const rows = [headers, ...exportRows(results)];
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safeValue = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
          return `"${safeValue.replaceAll('"', '""')}"`;
        })
        .join(';'),
    )
    .join('\r\n');

  return `\ufeff${csv}`;
}

function download(data: BlobPart, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function exportData(
  format: 'csv' | 'xlsx' | 'pdf',
  results: Lookup[],
): Promise<void> {
  if (!results.length) {
    throw new Error('Nejprve vyberte slova k exportu.');
  }

  const filename = `ceske-pady-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    download(csvText(results), 'text/csv;charset=utf-8', `${filename}.csv`);
    return;
  }

  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'České pády';

    const sheet = workbook.addWorksheet('České pády');
    sheet.addRows([headers, ...exportRows(results)]);
    const widths = [22, 32, 30, 24, 16, 12, 45, 30, 26, 60];
    sheet.columns.forEach((column, index) => {
      column.width = widths[index];
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2459DB' },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'J1' };

    const buffer = await workbook.xlsx.writeBuffer();
    download(
      buffer as ArrayBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `${filename}.xlsx`,
    );
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const fontResponse = await fetch(
    new URL('./fonts/NotoSans-Regular.ttf', document.baseURI),
  );

  if (!fontResponse.ok) {
    throw new Error('Písmo pro PDF se nepodařilo načíst. Zkuste export znovu.');
  }

  const bytes = new Uint8Array(await fontResponse.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8_192));
  }

  const documentPdf = new jsPDF();
  documentPdf.addFileToVFS('NotoSans.ttf', btoa(binary));
  documentPdf.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  documentPdf.setFont('NotoSans');

  let firstPage = true;
  for (const result of results) {
    const entries = result.ijp.entries.length ? result.ijp.entries : [null];

    for (const entry of entries) {
      if (!firstPage) documentPdf.addPage();
      firstPage = false;

      documentPdf.setFontSize(21);
      documentPdf.text(result.word, 14, 22);
      documentPdf.setFontSize(10);
      documentPdf.text('Internetová jazyková příručka · ÚJČ', 14, 32);

      const description = entry
        ? `${entry.lemma} · ${entry.gender ? genders[entry.gender] : 'Rod neurčen'}`
        : result.ijp.message || result.ijp.status;
      documentPdf.text(documentPdf.splitTextToSize(description, 180), 14, 40);

      if (entry) {
        autoTable(documentPdf, {
          startY: 55,
          tableWidth: 181,
          head: [['Pád', 'Jednotné číslo', 'Množné číslo']],
          body: cases.map((name, index) => [
            name,
            entry.singular[index].join(', ') || '—',
            entry.plural[index].join(', ') || '—',
          ]),
          styles: {
            font: 'NotoSans',
            fontStyle: 'normal',
            fontSize: 10,
            cellPadding: 4,
          },
          headStyles: {
            fontStyle: 'normal',
            fillColor: [36, 89, 219],
          },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 78 },
            2: { cellWidth: 78 },
          },
          margin: { bottom: 40 },
        });
      }

      documentPdf.setFontSize(8);
      documentPdf.text(
        `Ověřeno: ${new Date(result.checkedAt).toLocaleString('cs-CZ')}`,
        14,
        265,
      );
      documentPdf.textWithLink('Otevřít původní zdroj', 14, 273, {
        url: result.ijp.url,
      });
    }
  }

  download(
    documentPdf.output('arraybuffer'),
    'application/pdf',
    `${filename}.pdf`,
  );
}
