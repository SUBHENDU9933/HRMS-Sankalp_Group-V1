/** Branded payslip PDF using jsPDF + company_settings. */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS } from "./utils-app";

/**
 * @param {object} p   - payroll row
 * @param {object} emp - employee row
 * @param {object} co  - company_settings row (optional)
 */
export async function generatePayslipPdf(p, emp, co = null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // ---- Branded header band -------------------------------------------------
  doc.setFillColor(77, 163, 255);
  doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(255, 169, 77);
  doc.rect(0, 22, W, 2, "F");

  // Logo (best-effort)
  if (co?.logo_url) {
    try {
      const dataUrl = await urlToDataUrl(co.logo_url);
      const ext = (dataUrl.match(/^data:image\/(\w+)/) || [])[1] || "png";
      doc.addImage(dataUrl, ext.toUpperCase() === "JPG" ? "JPEG" : ext.toUpperCase(), 10, 4, 14, 14, undefined, "FAST");
    } catch { /* skip */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(co?.name || "Sankalp Interior Solution", co?.logo_url ? 28 : 14, 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (co?.tagline) doc.text(co.tagline, co?.logo_url ? 28 : 14, 16);

  // contact (right side)
  doc.setFontSize(8);
  const right = [];
  if (co?.phone)   right.push(`☎ ${co.phone}`);
  if (co?.email)   right.push(`✉ ${co.email}`);
  if (co?.website) right.push(co.website);
  let ry = 8;
  right.forEach(line => { doc.text(line, W - 14, ry, { align: "right" }); ry += 4; });

  // ---- Title ---------------------------------------------------------------
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Payslip — ${MONTHS[p.month]} ${p.year}`, 14, 34);

  // Office address line
  if (co?.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(co.address, 14, 39, { maxWidth: W - 28 });
  }

  // ---- Employee block ------------------------------------------------------
  autoTable(doc, {
    startY: co?.address ? 44 : 40,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2 },
    theme: "grid",
    body: [
      ["Employee Name", emp?.name || "—", "Employee Code", emp?.employee_code || "—"],
      ["Designation", emp?.designation || "—", "Department", emp?.department || "—"],
      ["Email", emp?.email || "—", "Phone", emp?.phone || "—"],
      ["Bank A/C", emp?.bank_account || "—", "IFSC", emp?.bank_ifsc || "—"],
    ],
    columnStyles: {
      0: { fillColor: [241, 245, 249], fontStyle: "bold", cellWidth: 32 },
      2: { fillColor: [241, 245, 249], fontStyle: "bold", cellWidth: 32 },
    },
  });

  const y1 = doc.lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: y1, margin: { left: 14, right: 14 },
    head: [["Attendance summary", ""]],
    body: [
      ["Present Days", String(p.present_days ?? 0)],
      ["Half Days",    String(p.half_days ?? 0)],
      ["Absent Days",  String(p.absent_days ?? 0)],
    ],
    theme: "grid",
    headStyles: { fillColor: [77, 163, 255], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 1: { halign: "right" } },
  });

  const y2 = doc.lastAutoTable.finalY + 6;
  const fmt = (n) => Number(n || 0).toFixed(2);
  autoTable(doc, {
    startY: y2, margin: { left: 14, right: 14 },
    head: [["Salary breakdown", "Amount (INR)"]],
    body: [
      ["Base Salary", fmt(p.base_salary)],
      ["Incentive",   fmt(p.incentive)],
      ["Bonus",       fmt(p.bonus)],
      ["Overtime",    fmt(p.overtime)],
      ["Deductions",  `-${fmt(p.deductions)}`],
      [
        { content: "Net Payable", styles: { fontStyle: "bold", fillColor: [255, 244, 230] } },
        { content: fmt(p.net_salary), styles: { fontStyle: "bold", fillColor: [255, 244, 230], halign: "right", textColor: [217, 119, 6] } },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [255, 169, 77], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 2.4 },
    columnStyles: { 1: { halign: "right" } },
  });

  const y3 = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleString()}. Computer-generated payslip — no signature required.`, 14, y3);
  if (co?.address) doc.text(co.address, W - 14, y3, { align: "right", maxWidth: 90 });

  const safeName = (emp?.name || "employee").replace(/\s+/g, "_");
  doc.save(`payslip_${safeName}_${MONTHS[p.month]}_${p.year}.pdf`);
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
