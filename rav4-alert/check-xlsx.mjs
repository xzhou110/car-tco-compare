// Verify the generated workbook: Title-Case headers, that Vehicle is a clickable
// listing link, that Carfax URL is a hyperlink, and that the standalone
// Listing URL / Photo URL columns are gone.
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(new URL('./out/preview-deal-alerts.xlsx', import.meta.url).pathname.replace(/^\//, ''));
for (const ws of wb.worksheets) {
  const headers = ws.getRow(1).values.slice(1);
  console.log(`\nTAB: "${ws.name}"  rows=${ws.rowCount - 1}`);
  console.log('  headers:', headers.join(', '));
  console.log(`  removed Listing URL? ${!headers.includes('Listing URL')} · removed Photo URL? ${!headers.includes('Photo URL')}`);
  const r2 = ws.getRow(2);
  for (const label of ['Vehicle', 'Carfax URL']) {
    const i = headers.indexOf(label);
    if (i < 0) { console.log(`  ${label}: (column absent)`); continue; }
    const v = r2.getCell(i + 1).value;
    const link = v && typeof v === 'object' ? v.hyperlink : null;
    const text = v && typeof v === 'object' ? v.text : v;
    console.log(`  row2 ${label}: "${String(text).slice(0, 28)}" → ${link ? 'HYPERLINK ✓ ' + String(link).slice(0, 44) : 'NO LINK'}`);
  }
}
