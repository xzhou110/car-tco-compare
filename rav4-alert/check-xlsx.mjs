// Verify the generated workbook: sheet names, header order (camelCase, vin before
// URL cols), column widths, and that URL cells are real hyperlinks.
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(new URL('./out/preview-deal-alerts.xlsx', import.meta.url).pathname.replace(/^\//, ''));
for (const ws of wb.worksheets) {
  const headers = ws.getRow(1).values.slice(1);
  const widths = ws.columns.map((c) => c.width);
  console.log(`\nTAB: "${ws.name}"  rows=${ws.rowCount - 1}`);
  console.log('  headers:', headers.join(', '));
  const vinIdx = headers.indexOf('vin'), vdpIdx = headers.indexOf('vdp');
  console.log(`  vin@${vinIdx} before vdp@${vdpIdx}? ${vinIdx > -1 && vinIdx < vdpIdx}`);
  console.log('  widths:', widths.map((w, i) => `${headers[i] ?? ''}:${w ?? '-'}`).slice(0, 999).join('  '));
  const r2 = ws.getRow(2);
  for (const k of ['vin', 'vdp', 'primaryImage', 'carfaxUrl']) {
    const i = headers.indexOf(k); if (i < 0) continue;
    const cell = r2.getCell(i + 1);
    const link = cell.value && typeof cell.value === 'object' ? cell.value.hyperlink : null;
    console.log(`  row2 ${k}: ${link ? 'HYPERLINK ✓ ' + String(link).slice(0, 40) : (cell.value ? String(cell.value).slice(0, 30) : '(empty)')}`);
  }
}
