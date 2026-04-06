import PDFDocument from "pdfkit";

export interface ReceiptData {
  businessName: string;
  clienteNombre: string;
  monto: number;
  concepto: string;
  metodo: string;
  fecha: string;
  referencia?: string;
  notas?: string;
  folio: number;
}

const METODO_LABELS: Record<string, string> = {
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo",
  otro: "Otro",
};

/**
 * Genera un comprobante de pago en PDF y lo devuelve como Buffer.
 */
export function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "A5" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const folioStr = String(data.folio).padStart(6, "0");
    const fechaFmt = new Date(data.fecha + "T12:00:00").toLocaleDateString("es-DO", {
      year: "numeric", month: "long", day: "numeric",
    });

    // ── ENCABEZADO ──────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill("#e11d48");
    doc.fillColor("#ffffff")
       .fontSize(20).font("Helvetica-Bold")
       .text(data.businessName, 60, 22, { align: "left" });
    doc.fontSize(10).font("Helvetica")
       .text("COMPROBANTE DE PAGO", 60, 50, { align: "left" });

    // Folio en esquina superior derecha
    doc.fontSize(9).fillColor("#fecdd3")
       .text(`#${folioStr}`, 0, 30, { align: "right", width: doc.page.width - 60 });

    doc.moveDown(3);

    // ── FECHA ────────────────────────────────────────────────────────────
    doc.fillColor("#6b7280").fontSize(9).font("Helvetica")
       .text(`Fecha: ${fechaFmt}`, { align: "right" });
    doc.moveDown(0.5);

    // ── LÍNEA SEPARADORA ─────────────────────────────────────────────────
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y)
       .strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.moveDown(1);

    // ── DATOS DEL PAGO ───────────────────────────────────────────────────
    const rows: [string, string][] = [
      ["Cliente:", data.clienteNombre],
      ["Concepto:", data.concepto],
      [
        "Monto:",
        `RD$ ${data.monto.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      ["Método:", METODO_LABELS[data.metodo] ?? data.metodo],
    ];
    if (data.referencia) rows.push(["Referencia:", data.referencia]);
    if (data.notas) rows.push(["Notas:", data.notas]);

    const labelW = 110;
    const valueX = 60 + labelW + 8;

    for (const [label, value] of rows) {
      const y = doc.y;
      doc.fillColor("#374151").font("Helvetica-Bold").fontSize(10)
         .text(label, 60, y, { width: labelW, lineBreak: false });
      const isAmount = label === "Monto:";
      doc.fillColor(isAmount ? "#e11d48" : "#111827")
         .font(isAmount ? "Helvetica-Bold" : "Helvetica")
         .fontSize(isAmount ? 13 : 10)
         .text(value, valueX, y, { width: doc.page.width - valueX - 60 });
      doc.moveDown(0.8);
    }

    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y)
       .strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.moveDown(1);

    // ── PIE ──────────────────────────────────────────────────────────────
    doc.fillColor("#9ca3af").fontSize(8).font("Helvetica")
       .text("Este documento es válido como comprobante de pago.", { align: "center" })
       .moveDown(0.3)
       .text(`Generado automáticamente por ${data.businessName}.`, { align: "center" });

    doc.end();
  });
}

/**
 * Genera un reporte mensual de pagos recibidos en PDF.
 */
export interface ReportePagoRow {
  fecha: string;
  clienteNombre: string;
  concepto: string;
  monto: number;
  metodo: string;
  referencia?: string;
}

export function generateMonthlyReportPDF(options: {
  businessName: string;
  mes: string;   // "Abril 2025"
  rows: ReportePagoRow[];
  totalIngresos: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { businessName, mes, rows, totalIngresos } = options;

    // Encabezado
    doc.rect(0, 0, doc.page.width, 80).fill("#e11d48");
    doc.fillColor("#ffffff")
       .fontSize(22).font("Helvetica-Bold")
       .text(businessName, 50, 20);
    doc.fontSize(12).font("Helvetica")
       .text(`Reporte Mensual – ${mes}`, 50, 50);
    doc.moveDown(3);

    // Total
    doc.fillColor("#111827").fontSize(14).font("Helvetica-Bold")
       .text(`Total ingresado: RD$ ${totalIngresos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`, { align: "right" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
       .strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.moveDown(1);

    if (rows.length === 0) {
      doc.fillColor("#6b7280").fontSize(12).font("Helvetica")
         .text("No hay pagos registrados en este período.", { align: "center" });
    } else {
      // Encabezado de tabla
      const colX = [50, 130, 260, 360, 440, 510];
      const headers = ["Fecha", "Cliente", "Concepto", "Método", "Monto"];
      doc.fillColor("#374151").fontSize(9).font("Helvetica-Bold");
      headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] - colX[i] - 4, lineBreak: false }));
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
         .strokeColor("#d1d5db").lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      // Filas
      for (const row of rows) {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.moveDown(1);
        }
        const y = doc.y;
        const cols = [
          row.fecha,
          row.clienteNombre,
          row.concepto.length > 20 ? row.concepto.slice(0, 18) + "…" : row.concepto,
          METODO_LABELS[row.metodo] ?? row.metodo,
          `RD$ ${row.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
        ];
        doc.fillColor("#111827").fontSize(8).font("Helvetica");
        cols.forEach((c, i) =>
          doc.text(c, colX[i], y, { width: colX[i + 1] - colX[i] - 4, lineBreak: false })
        );
        doc.moveDown(0.6);
      }
    }

    // Pie
    doc.moveDown(1);
    doc.fillColor("#9ca3af").fontSize(8).font("Helvetica")
       .text(`Generado el ${new Date().toLocaleDateString("es-DO")} por ${businessName}.`, { align: "center" });

    doc.end();
  });
}
