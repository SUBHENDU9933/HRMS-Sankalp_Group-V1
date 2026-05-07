/** Premium branded payslip PDF — dynamic from company_settings. */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS } from "./utils-app";

// Brand palette
const NAVY        = [30, 58, 138];
const NAVY_DEEP   = [23, 37, 84];
const BLUE_SOFT   = [219, 234, 254];
const BLUE_LINE   = [191, 219, 254];
const ORANGE      = [249, 115, 22];
const ORANGE_SOFT = [255, 237, 213];
const ORANGE_PALE = [255, 247, 237];
const TEXT_DARK   = [15, 23, 42];
const TEXT_GRAY   = [100, 116, 139];
const WHITE       = [255, 255, 255];

/**
 * @param {object} p     payroll row
 * @param {object} emp   employee row
 * @param {object} co    company_settings row
 * @param {array}  disbs disbursement entries (optional)
 */
export async function generatePayslipPdf(p, emp, co = null, disbs = []) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // ====== HEADER DECORATIONS (compact, contained in top 30mm) ======
  drawHeaderDecorations(doc, W);

  // ====== LOGO ======
  let nameLeft = 14;
  if (co?.logo_url) {
    try {
      const dataUrl = await urlToDataUrl(co.logo_url);
      const fmtL = (dataUrl.match(/^data:image\/(\w+)/) || [])[1] || "png";
      const f = fmtL.toUpperCase() === "JPG" ? "JPEG" : fmtL.toUpperCase();
      doc.addImage(dataUrl, f, 14, 10, 26, 26, undefined, "FAST");
      nameLeft = 46;
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.5);
      doc.line(nameLeft - 3, 12, nameLeft - 3, 36);
    } catch { /* skip */ }
  }

  // ====== COMPANY NAME ======
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  const name = co?.name || "Sankalp Interior Solution";
  let nameSize = 21;
  if (name.length > 32) nameSize = 18;
  if (name.length > 40) nameSize = 15;
  doc.setFontSize(nameSize);
  doc.text(name, nameLeft, 21);

  const nameWidth = doc.getTextWidth(name);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.7);
  doc.line(nameLeft, 24, Math.min(nameLeft + nameWidth + 8, W - 14), 24);

  // ====== TAGLINE (orange italic) — only ASCII (jsPDF default font has no Bengali glyphs) ======
  if (co?.tagline && /^[\x20-\x7E]+$/.test(co.tagline)) {
    doc.setTextColor(...ORANGE);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text(co.tagline, nameLeft, 31);
  }

  // ====== CONTACT ROW (website · phone · email) — placed BELOW header decorations ======
  let cy = 44;
  const contacts = [];
  if (co?.website) contacts.push({ icon: "globe", text: co.website });
  if (co?.phone)   contacts.push({ icon: "phone", text: co.phone });
  if (co?.email)   contacts.push({ icon: "mail",  text: co.email });

  if (contacts.length > 0) {
    const colWidth = (W - 28) / contacts.length;
    contacts.forEach((c, i) => {
      const x = 14 + i * colWidth;
      drawIconCircle(doc, x + 4, cy, c.icon);
      doc.setTextColor(...TEXT_DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(c.text, x + 11, cy + 1.2, { maxWidth: colWidth - 13 });
      // Vertical separator between contacts (except last)
      if (i < contacts.length - 1) {
        doc.setDrawColor(...BLUE_LINE);
        doc.setLineWidth(0.3);
        doc.line(x + colWidth - 2, cy - 4, x + colWidth - 2, cy + 4);
      }
    });
    cy += 10;
  }

  // ====== ADDRESS ROW (centered, with pin icon) ======
  if (co?.address) {
    const addrText = co.address;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const tw = doc.getTextWidth(addrText);
    const ax = (W - tw) / 2;
    drawIconCircle(doc, ax - 7, cy, "pin");
    doc.setTextColor(...TEXT_DARK);
    doc.text(addrText, ax, cy + 1.2);
    cy += 8;
  }

  // ====== DECORATIVE WAVE BELOW HEADER ======
  // Orange wave bottom-left
  doc.setFillColor(...ORANGE);
  doc.ellipse(0, cy + 4, 90, 14, "F");
  // Inner white to make it a wave
  doc.setFillColor(...WHITE);
  doc.ellipse(0, cy + 1, 86, 12, "F");
  // Blue accent on right
  doc.setFillColor(...NAVY);
  doc.ellipse(W, cy + 5, 70, 11, "F");
  doc.setFillColor(...WHITE);
  doc.ellipse(W, cy + 2, 67, 9, "F");
  cy += 10;

  // ====== PAGE TITLE: "PAYSLIP — May 2026" with calendar icon ======
  drawIconCircle(doc, 16, cy + 2, "calendar", 4.5);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(`PAYSLIP — ${MONTHS[p.month]} ${p.year}`, 25, cy + 4);
  cy += 12;

  // ====== EMPLOYEE DETAILS GRID ======
  const empRows = buildEmployeeRows(emp);
  autoTable(doc, {
    startY: cy,
    margin: { left: 14, right: 14 },
    body: empRows,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: { top: 2.6, bottom: 2.6, left: 4, right: 4 },
      lineColor: BLUE_LINE,
      lineWidth: 0.2,
      textColor: TEXT_DARK,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", valign: "middle" },                          // icon
      1: { fontStyle: "bold", cellWidth: 32, fillColor: BLUE_SOFT, textColor: NAVY },    // label
      2: { cellWidth: "auto" },                                                          // value
      3: { cellWidth: 12, halign: "center", valign: "middle" },                          // icon
      4: { fontStyle: "bold", cellWidth: 32, fillColor: BLUE_SOFT, textColor: NAVY },    // label
      5: { cellWidth: "auto" },                                                          // value
    },
    didDrawCell: (data) => {
      // Draw icons in icon columns (0 and 3)
      if (data.section === "body" && (data.column.index === 0 || data.column.index === 3)) {
        const icon = data.cell.raw?.iconType;
        if (icon) {
          const cx = data.cell.x + data.cell.width / 2;
          const cy2 = data.cell.y + data.cell.height / 2;
          drawIconCircle(doc, cx, cy2, icon, 3.4);
        }
      }
    },
  });
  cy = doc.lastAutoTable.finalY + 5;

  // ====== ATTENDANCE SUMMARY ======
  drawSectionHeader(doc, "ATTENDANCE SUMMARY", "people", NAVY, cy);
  cy += 9;

  autoTable(doc, {
    startY: cy,
    margin: { left: 14, right: 14 },
    body: [
      ["Present Days", String(p.present_days ?? 0)],
      ["Half Days",    String(p.half_days ?? 0)],
      ["Absent Days",  String(p.absent_days ?? 0)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.6, lineColor: BLUE_LINE, lineWidth: 0.2, textColor: TEXT_DARK },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 40, fontStyle: "bold" },
    },
  });
  cy = doc.lastAutoTable.finalY + 5;

  // ====== SALARY BREAKDOWN ======
  drawSectionHeader(doc, "SALARY BREAKDOWN", "rupee", ORANGE, cy, "AMOUNT (INR)");
  cy += 9;

  const fmt = (n) => Number(n || 0).toFixed(2);
  autoTable(doc, {
    startY: cy,
    margin: { left: 14, right: 14 },
    body: [
      ["Base Salary", fmt(p.base_salary)],
      ["Incentive",   fmt(p.incentive)],
      ["Bonus",       fmt(p.bonus)],
      ["Overtime",    fmt(p.overtime)],
      ["Deductions",  `-${fmt(p.deductions)}`],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.6, lineColor: BLUE_LINE, lineWidth: 0.2, textColor: TEXT_DARK },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 40 },
    },
  });
  cy = doc.lastAutoTable.finalY;

  // NET PAYABLE highlight row
  autoTable(doc, {
    startY: cy,
    margin: { left: 14, right: 14 },
    body: [[
      { content: "NET PAYABLE", styles: { fontStyle: "bold", fontSize: 11, fillColor: ORANGE_PALE, textColor: NAVY } },
      { content: fmt(p.net_salary), styles: { halign: "right", fontStyle: "bold", fontSize: 12, fillColor: ORANGE_PALE, textColor: ORANGE } },
    ]],
    theme: "grid",
    styles: { cellPadding: 3.2, lineColor: ORANGE, lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40 },
    },
  });
  cy = doc.lastAutoTable.finalY + 5;

  // ====== PAYMENT STATUS ======
  drawSectionHeader(doc, "PAYMENT STATUS", "wallet", NAVY, cy);
  cy += 9;

  const paid = (disbs || []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const out  = Number(p.net_salary || 0) - paid;
  const status = paid <= 0 ? "UNPAID" : (out > 0.01 ? "PARTIAL" : "PAID");
  const statusColors = {
    PAID:    [22, 101, 52],
    PARTIAL: [194, 65, 12],
    UNPAID:  [153, 27, 27],
  };
  const statusFills = {
    PAID:    [220, 252, 231],
    PARTIAL: [254, 215, 170],
    UNPAID:  [254, 226, 226],
  };

  autoTable(doc, {
    startY: cy,
    margin: { left: 14, right: 14 },
    body: [
      ["Total Payable (Net)", fmt(p.net_salary)],
      ["Disbursed",           fmt(paid)],
      [
        { content: "Outstanding", styles: { fontStyle: "bold", fillColor: ORANGE_PALE, textColor: NAVY } },
        {
          content: `${fmt(Math.max(0, out))}    (${status})`,
          styles: {
            halign: "right", fontStyle: "bold", fillColor: statusFills[status],
            textColor: statusColors[status],
          },
        },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.6, lineColor: BLUE_LINE, lineWidth: 0.2, textColor: TEXT_DARK },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 60 },
    },
  });
  cy = doc.lastAutoTable.finalY + 4;

  // ====== DISBURSEMENT DETAILS (if any) ======
  if (disbs && disbs.length > 0) {
    autoTable(doc, {
      startY: cy + 2,
      margin: { left: 14, right: 14 },
      head: [["Date", "Mode", "Reference", "Amount"]],
      body: disbs.map(d => [
        (d.entry_date || "").slice(0, 10),
        (d.payment_mode || "—").toUpperCase(),
        d.transfer_ref || "—",
        fmt(d.amount),
      ]),
      theme: "grid",
      headStyles: { fillColor: BLUE_SOFT, textColor: NAVY, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.4, lineColor: BLUE_LINE, lineWidth: 0.2 },
      columnStyles: { 3: { halign: "right" } },
    });
    cy = doc.lastAutoTable.finalY + 4;
  }

  // ====== FOOTER ======
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(`Generated on ${new Date().toLocaleString()} · Computer-generated payslip — no signature required.`, 14, cy + 4);

  const safeName = (emp?.name || "employee").replace(/\s+/g, "_");
  doc.save(`payslip_${safeName}_${MONTHS[p.month]}_${p.year}.pdf`);
}

/* ----------------------- Helper builders ----------------------- */
function buildEmployeeRows(emp) {
  // Each cell in icon column carries iconType in raw, the actual content is empty (drawn via didDrawCell)
  const ic = (t) => ({ content: "", iconType: t });
  return [
    [ic("person"),    "Employee Name",  emp?.name || "—",            ic("idcard"),   "Employee Code", emp?.employee_code || "—"],
    [ic("briefcase"), "Designation",    emp?.designation || "—",     ic("orgchart"), "Department",    emp?.department || "—"],
    [ic("mail"),      "Email",          emp?.email || "—",           ic("phone"),    "Phone",         emp?.phone || "—"],
    [ic("bank"),      "Bank A/C",       emp?.bank_account || "—",    ic("idcard"),   "IFSC",          emp?.bank_ifsc || "—"],
  ];
}

function drawSectionHeader(doc, title, iconType, color, y, rightLabel) {
  const W = doc.internal.pageSize.getWidth();
  // Bar
  doc.setFillColor(...color);
  doc.rect(14, y, W - 28, 8, "F");
  // Icon (white circle on top of bar)
  drawIconCircle(doc, 19.5, y + 4, iconType, 3, true);
  // Title
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(title, 26, y + 5.6);
  if (rightLabel) {
    doc.setFontSize(10);
    doc.text(rightLabel, W - 18, y + 5.6, { align: "right" });
  }
}

/* ----------------------- Header decorations (corner swooshes) ----------------------- */
function drawHeaderDecorations(doc, W) {
  // ===== TOP-RIGHT layered swooshes (using concentric ellipses centered at corner) =====
  doc.setFillColor(...NAVY);
  doc.ellipse(W, 0, 95, 70, "F");
  doc.setFillColor(...ORANGE);
  doc.ellipse(W, 0, 80, 60, "F");
  doc.setFillColor(...NAVY);
  doc.ellipse(W, 0, 70, 52, "F");
  doc.setFillColor(...WHITE);
  doc.ellipse(W, 0, 62, 46, "F");

  // ===== TOP-LEFT corner accent =====
  doc.setFillColor(...ORANGE);
  doc.triangle(0, 0, 22, 0, 0, 32, "F");
  doc.setFillColor(...NAVY);
  doc.triangle(0, 0, 14, 0, 0, 22, "F");
  doc.setFillColor(...WHITE);
  doc.triangle(0, 0, 7, 0, 0, 11, "F");
}

/* ----------------------- Icons inside light-blue circles ----------------------- */
function drawIconCircle(doc, cx, cy, type, r = 4, onColor = false) {
  if (onColor) {
    doc.setFillColor(...WHITE);
  } else {
    doc.setFillColor(...BLUE_SOFT);
  }
  doc.circle(cx, cy, r, "F");
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  drawIcon(doc, cx, cy, type, r * 0.6);
}

function drawIcon(doc, cx, cy, type, s) {
  switch (type) {
    case "globe": {
      doc.circle(cx, cy, s, "S");
      doc.line(cx - s, cy, cx + s, cy);
      doc.ellipse(cx, cy, s * 0.45, s, "S");
      break;
    }
    case "phone": {
      // Speech-bubble style handset
      doc.roundedRect(cx - s * 0.45, cy - s, s * 0.9, s * 2, s * 0.25, s * 0.25, "S");
      doc.setLineWidth(0.5);
      doc.line(cx - s * 0.2, cy + s * 0.6, cx + s * 0.2, cy + s * 0.6);
      doc.setLineWidth(0.35);
      break;
    }
    case "mail": {
      doc.roundedRect(cx - s * 1.1, cy - s * 0.7, s * 2.2, s * 1.4, s * 0.1, s * 0.1, "S");
      doc.line(cx - s * 1.1, cy - s * 0.7, cx, cy + s * 0.1);
      doc.line(cx, cy + s * 0.1, cx + s * 1.1, cy - s * 0.7);
      break;
    }
    case "pin": {
      // Solid teardrop
      doc.setFillColor(...NAVY);
      doc.circle(cx, cy - s * 0.25, s * 0.65, "F");
      doc.triangle(cx - s * 0.5, cy + s * 0.05, cx + s * 0.5, cy + s * 0.05, cx, cy + s * 0.95, "F");
      doc.setFillColor(...WHITE);
      doc.circle(cx, cy - s * 0.25, s * 0.25, "F");
      break;
    }
    case "calendar": {
      doc.rect(cx - s * 1.1, cy - s * 0.85, s * 2.2, s * 1.7, "S");
      doc.setFillColor(...ORANGE);
      doc.rect(cx - s * 1.1, cy - s * 0.85, s * 2.2, s * 0.45, "F");
      // Top hooks
      doc.setFillColor(...WHITE);
      doc.line(cx - s * 0.55, cy - s * 1.2, cx - s * 0.55, cy - s * 0.55);
      doc.line(cx + s * 0.55, cy - s * 1.2, cx + s * 0.55, cy - s * 0.55);
      doc.setLineWidth(0.5);
      doc.setDrawColor(...NAVY);
      doc.line(cx - s * 0.55, cy - s * 1.2, cx - s * 0.55, cy - s * 0.55);
      doc.line(cx + s * 0.55, cy - s * 1.2, cx + s * 0.55, cy - s * 0.55);
      doc.setLineWidth(0.35);
      break;
    }
    case "person": {
      doc.circle(cx, cy - s * 0.35, s * 0.45, "S");
      // Shoulders curve
      doc.lines([[s * 0.4, -s * 0.5], [-s * 1.6, 0], [s * 0.4, s * 0.5]], cx + s * 0.8, cy + s * 0.85, [1, 1], "S");
      break;
    }
    case "idcard": {
      doc.roundedRect(cx - s * 1.1, cy - s * 0.85, s * 2.2, s * 1.7, s * 0.2, s * 0.2, "S");
      doc.circle(cx - s * 0.45, cy - s * 0.2, s * 0.3, "S");
      doc.line(cx + s * 0.05, cy - s * 0.4, cx + s * 0.85, cy - s * 0.4);
      doc.line(cx + s * 0.05, cy - s * 0.05, cx + s * 0.85, cy - s * 0.05);
      doc.line(cx - s * 0.6, cy + s * 0.4, cx + s * 0.6, cy + s * 0.4);
      break;
    }
    case "briefcase": {
      doc.roundedRect(cx - s * 1.1, cy - s * 0.45, s * 2.2, s * 1.25, s * 0.15, s * 0.15, "S");
      // Handle
      doc.line(cx - s * 0.45, cy - s * 0.45, cx - s * 0.45, cy - s * 0.85);
      doc.line(cx - s * 0.45, cy - s * 0.85, cx + s * 0.45, cy - s * 0.85);
      doc.line(cx + s * 0.45, cy - s * 0.85, cx + s * 0.45, cy - s * 0.45);
      // Front line
      doc.line(cx - s * 1.1, cy + s * 0.1, cx + s * 1.1, cy + s * 0.1);
      break;
    }
    case "orgchart": {
      // Top node
      doc.circle(cx, cy - s * 0.7, s * 0.3, "S");
      // Two children
      doc.circle(cx - s * 0.7, cy + s * 0.55, s * 0.3, "S");
      doc.circle(cx + s * 0.7, cy + s * 0.55, s * 0.3, "S");
      // Lines
      doc.line(cx, cy - s * 0.4, cx, cy + s * 0.05);
      doc.line(cx - s * 0.7, cy + s * 0.05, cx + s * 0.7, cy + s * 0.05);
      doc.line(cx - s * 0.7, cy + s * 0.05, cx - s * 0.7, cy + s * 0.25);
      doc.line(cx + s * 0.7, cy + s * 0.05, cx + s * 0.7, cy + s * 0.25);
      break;
    }
    case "bank": {
      // Roof triangle
      doc.triangle(cx - s * 1.2, cy - s * 0.25, cx + s * 1.2, cy - s * 0.25, cx, cy - s, "S");
      // Base
      doc.line(cx - s * 1.1, cy + s * 0.85, cx + s * 1.1, cy + s * 0.85);
      // Columns (4)
      [-0.75, -0.25, 0.25, 0.75].forEach(o => {
        doc.line(cx + o * s, cy + s * 0.7, cx + o * s, cy - s * 0.05);
      });
      break;
    }
    case "wallet": {
      doc.roundedRect(cx - s * 1.1, cy - s * 0.65, s * 2.2, s * 1.3, s * 0.2, s * 0.2, "S");
      // Card slot dot
      doc.setFillColor(...NAVY);
      doc.circle(cx + s * 0.65, cy, s * 0.22, "F");
      break;
    }
    case "people": {
      // Two heads
      doc.circle(cx - s * 0.5, cy - s * 0.35, s * 0.32, "S");
      doc.circle(cx + s * 0.5, cy - s * 0.35, s * 0.32, "S");
      // Shoulders
      doc.lines([[s * 0.3, -s * 0.4], [-s * 1.6, 0], [s * 0.3, s * 0.4]], cx + s * 0.8, cy + s * 0.6, [1, 1], "S");
      break;
    }
    case "rupee": {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text("Rs", cx, cy + s * 0.6, { align: "center" });
      doc.setFont("helvetica", "normal");
      break;
    }
  }
}

async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
