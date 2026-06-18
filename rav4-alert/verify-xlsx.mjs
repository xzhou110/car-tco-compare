// Verify buildWorkbook emits clickable hyperlinks for vdp + carfaxUrl.
import ExcelJS from 'exceljs';
import { buildWorkbook } from './digest.mjs';

const buf = await buildWorkbook([{ tab: 'Test', cars: [{
  vin: 'X1', make: 'Toyota', model: 'RAV4 Hybrid', trim: 'XLE', year: 2022,
  miles: 30000, price: 31000, location: 'Sacramento, CA',
  vdp: 'https://example.com/listing/x1', carfaxUrl: 'https://carfax.com/report/x1',
  tco: { total: 40000, perYear: 8000 },
}] }]);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const ws = wb.worksheets[0];
const header = ws.getRow(1).values;
const vdpCell = ws.getRow(2).getCell(header.indexOf('vdp'));
const cfCell = ws.getRow(2).getCell(header.indexOf('carfaxUrl'));
console.log('vdp cell:', JSON.stringify(vdpCell.value));
console.log('carfax cell:', JSON.stringify(cfCell.value));
console.log('vdp is hyperlink:', !!vdpCell.value?.hyperlink, '| carfax is hyperlink:', !!cfCell.value?.hyperlink);
