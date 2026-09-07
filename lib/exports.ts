import { cases, genders, type Lookup, type Paradigm } from './types';
import { ijpUrlForWord } from './ijp-url';

export const headers = ['Rod', 'Slovo', 'Číslo', ...cases, 'Odkaz'];

const czechCollator = new Intl.Collator('cs', {
  sensitivity: 'base',
  numeric: true,
});

export function compareCzechWords(left: string, right: string): number {
  return czechCollator.compare(left, right);
}

type ExportEntry = {
  result: Lookup;
  entry: Paradigm | null;
};

function entriesForExport(results: Lookup[]): ExportEntry[] {
  return results
    .flatMap((result) => {
      const entries = result.ijp.entries.length ? result.ijp.entries : [null];
      return entries.map((entry) => ({ result, entry }));
    })
    .sort((left, right) =>
      compareCzechWords(
        left.entry?.lemma || left.result.word,
        right.entry?.lemma || right.result.word,
      ),
    );
}

function genderLabel(entry: Paradigm | null): string {
  return entry?.gender ? genders[entry.gender] : 'Rod neurčen';
}

export function exportRows(results: Lookup[]): string[][] {
  return entriesForExport(results).flatMap(({ result, entry }) => {
    const word = entry?.lemma || result.word;
    const link = ijpUrlForWord(word);

    return (['singular', 'plural'] as const).map((number) => [
      genderLabel(entry),
      word,
      number === 'singular' ? 'Jednotné' : 'Množné',
      ...cases.map((_, index) => entry?.[number][index].join(', ') || '—'),
      link,
    ]);
  });
}

function csvCell(value: string, allowFormula = false): string {
  const safeValue =
    !allowFormula && /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function csvHyperlink(url: string): string {
  if (!url.startsWith('https://prirucka.ujc.cas.cz/')) return url;
  const formulaUrl = url.replaceAll('"', '""');
  return `=HYPERLINK("${formulaUrl}","${formulaUrl}")`;
}

export function csvText(results: Lookup[]): string {
  const rows = [headers, ...exportRows(results)];
  return `\ufeff${rows
    .map((row, rowIndex) =>
      row
        .map((value, columnIndex) =>
          csvCell(
            rowIndex > 0 && columnIndex === headers.length - 1
              ? csvHyperlink(value)
              : value,
            rowIndex > 0 && columnIndex === headers.length - 1,
          ),
        )
        .join(','),
    )
    .join('\r\n')}`;
}

function download(data: BlobPart, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function exportXlsx(results: Lookup[], filename: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'České pády';

  const sheet = workbook.addWorksheet('České pády', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
  });
  const rows = exportRows(results);
  sheet.addRows([headers, ...rows]);

  const widths = [20, 22, 14, 18, 18, 18, 18, 18, 18, 18, 52];
  sheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.alignment = {
      vertical: 'middle',
      wrapText: index >= 3,
    };
  });

  const header = sheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2459DB' },
  };

  rows.forEach((_, index) => {
    const row = sheet.getRow(index + 2);
    row.height = 24;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    const linkCell = row.getCell(headers.length);
    const link = rows[index][headers.length - 1];
    if (link.startsWith('https://prirucka.ujc.cas.cz/')) {
      linkCell.value = {
        text: link,
        hyperlink: link,
      };
      linkCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    if (Math.floor(index / 2) % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF4F7FC' },
        };
      });
    }

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD5DEEB' } },
        };
      });
    }
  });

  sheet.autoFilter = { from: 'A1', to: 'K1' };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    buffer as ArrayBuffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `${filename}.xlsx`,
  );
}

async function loadPdfFont(): Promise<string> {
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
  return btoa(binary);
}

type PdfSize = 'a4' | 'a3';

async function exportPdf(
  results: Lookup[],
  filename: string,
  size: PdfSize,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, font] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadPdfFont(),
  ]);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: size });
  pdf.addFileToVFS('NotoSans.ttf', font);
  pdf.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  pdf.setFont('NotoSans');

  const cards = entriesForExport(results);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const gap = 6;
  const columns = size === 'a3' ? 3 : 2;
  const rows = size === 'a3' ? 3 : 2;
  const cardsPerPage = columns * rows;
  const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
  const cardHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;

  cards.forEach(({ result, entry }, index) => {
    const word = entry?.lemma || result.word;
    const sourceUrl = ijpUrlForWord(word);
    const position = index % cardsPerPage;
    if (index > 0 && position === 0) pdf.addPage();

    const column = position % columns;
    const row = Math.floor(position / columns);
    const x = margin + column * (cardWidth + gap);
    const y = margin + row * (cardHeight + gap);
    const contentX = x + 4;
    const contentWidth = cardWidth - 8;

    pdf.setDrawColor(218, 227, 238);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2);

    pdf.setFontSize(15);
    pdf.text(word, contentX, y + 10);

    pdf.setFontSize(6.8);
    pdf.setTextColor(75, 94, 119);
    pdf.textWithLink('Internetová jazyková příručka · ÚJČ', contentX, y + 16, {
      url: sourceUrl,
    });

    pdf.setFontSize(8);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Rod: ${genderLabel(entry)}`, contentX, y + 23);

    if (entry) {
      autoTable(pdf, {
        startY: y + 28,
        tableWidth: contentWidth,
        head: [['Pád', 'Jednotné číslo', 'Množné číslo']],
        body: cases.map((name, caseIndex) => [
          name,
          entry.singular[caseIndex].join(', ') || '—',
          entry.plural[caseIndex].join(', ') || '—',
        ]),
        styles: {
          font: 'NotoSans',
          fontStyle: 'normal',
          fontSize: 7.2,
          cellPadding: 1.6,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fontStyle: 'normal',
          fillColor: [36, 89, 219],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: {
          0: { cellWidth: 14 },
          1: { cellWidth: (contentWidth - 14) / 2 },
          2: { cellWidth: (contentWidth - 14) / 2 },
        },
        margin: { left: contentX, right: pageWidth - contentX - contentWidth },
        pageBreak: 'avoid',
      });
    } else {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const message = result.ijp.message || 'Tvary nebyly nalezeny.';
      pdf.text(pdf.splitTextToSize(message, contentWidth), contentX, y + 32);
    }
  });

  download(pdf.output('arraybuffer'), 'application/pdf', `${filename}.pdf`);
}

export async function exportData(
  format: 'csv' | 'xlsx' | 'pdf-a4' | 'pdf-a3',
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
    await exportXlsx(results, filename);
    return;
  }

  const size = format === 'pdf-a3' ? 'a3' : 'a4';
  await exportPdf(results, `${filename}-${size}`, size);
}
