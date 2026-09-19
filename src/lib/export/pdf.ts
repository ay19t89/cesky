import { cases, type Lookup } from '../types';
import { ijpUrlForWord } from '../ijp-url';
import { download, entriesForExport, genderLabel } from './shared';

type PdfSize = 'a4' | 'a3';

async function loadPdfFont(): Promise<string> {
  const fontUrl = new URL('./fonts/NotoSans-Regular.ttf', document.baseURI);
  const fontResponse = await fetch(fontUrl);

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

export async function exportPdf(
  results: Lookup[],
  filename: string,
  size: PdfSize
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, font] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadPdfFont()
  ]);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: size });
  pdf.addFileToVFS('NotoSans.ttf', font);
  pdf.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  pdf.addFont('NotoSans.ttf', 'NotoSans', 'bold');
  pdf.setFont('NotoSans');

  const cards = entriesForExport(results);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const gap = 9;
  const columns = size === 'a3' ? 3 : 2;
  const rows = size === 'a3' ? 4 : 3;
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
      url: sourceUrl
    });

    pdf.setFontSize(8);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Rod: ${genderLabel(entry)}`, contentX, y + 23);

    if (!entry) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const message = result.ijp.message || 'Tvary nebyly nalezeny.';
      pdf.text(pdf.splitTextToSize(message, contentWidth), contentX, y + 32);
      return;
    }

    autoTable(pdf, {
      startY: y + 28,
      tableWidth: contentWidth,
      head: [['Pád', 'Jednotné číslo', 'Množné číslo']],
      body: cases.map((name, caseIndex) => [
        name,
        entry.singular[caseIndex].join(', ') || '—',
        entry.plural[caseIndex].join(', ') || '—'
      ]),
      styles: {
        font: 'NotoSans',
        fontStyle: 'normal',
        fontSize: 7.2,
        cellPadding: 1.6,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: [224, 240, 232],
        textColor: [23, 76, 58]
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: (contentWidth - 14) / 2 },
        2: { cellWidth: (contentWidth - 14) / 2 }
      },
      margin: {
        left: contentX,
        right: pageWidth - contentX - contentWidth
      },
      pageBreak: 'avoid'
    });
  });

  download(pdf.output('arraybuffer'), 'application/pdf', `${filename}.pdf`);
}
