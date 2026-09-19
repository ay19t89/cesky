import type { Lookup } from '../types';
import { exportRows } from './rows';
import { download, headers } from './shared';

export async function exportXlsx(
  results: Lookup[],
  filename: string
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'České pády';

  const sheet = workbook.addWorksheet('České pády', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
  });
  const rows = exportRows(results);
  sheet.addRows([headers, ...rows]);

  const widths = [16, 18, 11, 18, 18, 18, 18, 18, 18, 18, 42, 48];
  sheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.alignment = {
      vertical: 'middle',
      wrapText: index >= 3
    };
  });

  const header = sheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: 'FF174C3A' } };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F0E8' }
  };

  rows.forEach((_, index) => {
    const row = sheet.getRow(index + 2);
    row.height = 24;
    row.getCell(3).alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };

    for (const columnIndex of [headers.length - 1, headers.length]) {
      const linkCell = row.getCell(columnIndex);
      const link = rows[index][columnIndex - 1];
      linkCell.value = { text: link, hyperlink: link };
      linkCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    if (Math.floor(index / 2) % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF4F7FC' }
        };
      });
    }

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD5DEEB' } }
        };
      });
    }
  });

  sheet.autoFilter = { from: 'A1', to: 'L1' };
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    buffer as ArrayBuffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `${filename}.xlsx`
  );
}
