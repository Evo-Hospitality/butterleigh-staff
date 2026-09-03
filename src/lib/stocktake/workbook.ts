import "server-only";

import ExcelJS from "exceljs";
import type { StockTakeSheet } from "@/lib/stocktake/sheet";
import { formatDateOnly, formatDateTime } from "@/lib/format";

// Quantities and values go in as real numbers with number formats, not as
// pre-formatted text. The point of asking for a spreadsheet rather than a
// CSV is being able to total a column or sort by value once it's open —
// which you can't do with "£143.98" as a string.
const MONEY = '£#,##0.00';
const QTY = "0.00";

export async function stockTakeWorkbook(sheet: StockTakeSheet): Promise<Buffer> {
  const { stockTake, locations, groups, grandTotal } = sheet;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Butterleigh Inn Staff Portal";
  wb.created = new Date();

  const typeLabel = stockTake.type === "wet" ? "Wet" : "Dry";
  const ws = wb.addWorksheet(`${typeLabel} stocktake`);

  const headers = [
    "Group",
    "Name",
    "Unit",
    "Unit price",
    ...locations.map((l) => l.name),
    "Total qty",
    "Value",
  ];

  ws.addRow([`${typeLabel} Stocktake`]).font = { bold: true, size: 14 };
  // submitted_at, not created_at — a stocktake can be started as a draft
  // days before it's submitted, and the page shows the submission date.
  const submitted = stockTake.submitted_at ?? stockTake.created_at;
  ws.addRow([
    `Stock as at ${formatDateOnly(stockTake.stock_date)} · Submitted by ${
      stockTake.submitted_by_name
    } on ${formatDateTime(submitted)}`,
  ]).font = { italic: true, color: { argb: "FF666666" } };
  if (stockTake.notes) {
    ws.addRow([stockTake.notes]).font = { italic: true, color: { argb: "FF666666" } };
  }
  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEAE2" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFBBBBBB" } } };
  });
  // Keeps the headings visible when scrolling a long count.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRow.number }];

  for (const group of groups) {
    const groupRow = ws.addRow([group.groupName]);
    groupRow.font = { bold: true };

    for (const { entry, quantities } of group.rows) {
      const row = ws.addRow([
        group.groupName,
        entry.item_name,
        entry.unit ?? "",
        entry.unit_price === null ? null : Number(entry.unit_price),
        ...locations.map((l) => quantities.get(l.key) ?? 0),
        Number(entry.total_qty),
        Number(entry.value),
      ]);
      row.getCell(4).numFmt = MONEY;
      for (let i = 0; i < locations.length; i++) {
        row.getCell(5 + i).numFmt = QTY;
      }
      row.getCell(5 + locations.length).numFmt = QTY;
      row.getCell(6 + locations.length).numFmt = MONEY;
    }
  }

  ws.addRow([]);
  const totalRow = ws.addRow([
    "",
    "Total",
    "",
    "",
    ...locations.map(() => null),
    null,
    Math.round(grandTotal * 100) / 100,
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(6 + locations.length).numFmt = MONEY;

  ws.columns.forEach((column, i) => {
    if (i === 0) column.width = 26;
    else if (i === 1) column.width = 34;
    else if (i === 2) column.width = 10;
    else column.width = 14;
  });

  // exceljs types this as its own Buffer interface; it's a Node Buffer.
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

export function stockTakeFileName(sheet: StockTakeSheet): string {
  const { stockTake } = sheet;
  // yyyy-mm-dd so a folder of these sorts chronologically, unlike dd/mm.
  const date = String(stockTake.stock_date).slice(0, 10);
  return `stocktake-${stockTake.type}-${date}.xlsx`;
}
