import type { AccountingReport } from "@/lib/accounting/types";

const PAYMENT_HEADERS = [
  "Data",
  "Client",
  "Firma",
  "CUI/CIF",
  "Email",
  "Adresa",
  "Tara",
  "Plan",
  "Perioada",
  "Stripe Customer",
  "Stripe Subscription",
  "Stripe Invoice",
  "Numar Invoice",
  "Payment",
  "Moneda",
  "Subtotal",
  "TVA",
  "Total",
  "Platit",
  "Refund",
  "Net",
  "Status",
] as const;

const MONEY_COLUMNS = new Set([
  "Subtotal",
  "TVA",
  "Total",
  "Platit",
  "Refund",
  "Net",
]);

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

type Cell = { kind: "text"; value: string } | { kind: "number"; value: number; money?: boolean };

function cellXml(cell: Cell, ref: string): string {
  if (cell.kind === "text") {
    if (!cell.value) return "";
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(cell.value)}</t></is></c>`;
  }
  if (!Number.isFinite(cell.value)) return "";
  const style = cell.money ? ` s="1"` : "";
  return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          cellXml(cell, `${columnName(columnIndex)}${rowIndex + 1}`),
        )
        .filter(Boolean)
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function text(value: string | null | undefined): Cell {
  return { kind: "text", value: value ?? "" };
}

function money(value: number | null): Cell {
  if (value == null) return { kind: "text", value: "" };
  return { kind: "number", value, money: true };
}

function integer(value: number): Cell {
  return { kind: "number", value };
}

function paymentsSheet(report: AccountingReport): string {
  const rows: Cell[][] = [
    PAYMENT_HEADERS.map((header) => text(header)),
    ...report.rows.map((row) => {
      const values: Array<string | number | null> = [
        row.paidAt,
        row.salon,
        row.company,
        row.taxId,
        row.email,
        row.address,
        row.country,
        row.plan,
        row.periodLabel,
        row.stripeCustomerId,
        row.stripeSubscriptionId,
        row.stripeInvoiceId,
        row.stripeInvoiceNumber,
        row.paymentId,
        row.currency,
        row.subtotal,
        row.tax,
        row.total,
        row.paid,
        row.refunded,
        row.net,
        row.status,
      ];
      return PAYMENT_HEADERS.map((header, index) => {
        const value = values[index];
        if (MONEY_COLUMNS.has(header)) return money(value as number | null);
        return text(value == null ? "" : String(value));
      });
    }),
  ];
  return sheetXml(rows);
}

function summarySheet(report: AccountingReport): string {
  const rows: Cell[][] = [
    [text("Camp"), text("Valoare")],
    [text("Perioada"), text(`${report.period.from} – ${report.period.to}`)],
    [text("Fus orar"), text(report.period.timeZone)],
    [text("Generat la"), text(report.generatedAt)],
    [text("Numar plati"), integer(report.paymentCount)],
    [text(""), text("")],
    [text("Moneda"), text("Plati"), text("Incasat"), text("Refundat"), text("Net")],
    ...report.totalsByCurrency.map((total) => [
      text(total.currency),
      integer(total.paymentCount),
      money(total.collected),
      money(total.refunded),
      money(total.net),
    ]),
    [text(""), text("")],
    [
      text(
        "Nota: sumele provin din plati Stripe incasate. Stripe Invoice nu este factura fiscala romaneasca. Totalurile sunt separate pe moneda.",
      ),
      text(""),
    ],
  ];
  return sheetXml(rows);
}

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Plati" sheetId="1" r:id="rId1"/><sheet name="Sumar" sheetId="2" r:id="rId2"/></sheets></workbook>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
}

function storeZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const time = 0;
  const date = ((2026 - 1980) << 9) | (10 << 5) | 1;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralDirectory, end]);
}

export function accountingWorkbookFilename(report: AccountingReport): string {
  return `frizeo-contabilitate-${report.period.from}_${report.period.to}.xlsx`;
}

export function buildAccountingWorkbook(report: AccountingReport): Buffer {
  const files = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml()) },
    { name: "_rels/.rels", data: Buffer.from(rootRels()) },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml()) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels()) },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml()) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(paymentsSheet(report)) },
    { name: "xl/worksheets/sheet2.xml", data: Buffer.from(summarySheet(report)) },
  ];
  return storeZip(files);
}

export const ACCOUNTING_XLSX_SHEETS = ["Plati", "Sumar"] as const;
