/** Client-side payslip PDF using jsPDF. Branded Sankalp blue/orange. */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS } from "./utils-app";

export function generatePayslipPdf(p, emp) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(77, 163, 255);
  doc.rect(0, 0, W, 14, "F");
  doc.setFillColor(255, 169, 77);
  doc.rect(0, 14, W, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Sankalp Interior Solution", 14, 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sankalp Group & Business Solution", W - 14, 9, { align: "right" });

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Payslip — ${MONTHS[p.month]} ${p.year}`, 14, 26);

  // Employee block
  autoTable(doc, {
    startY: 32,
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
  // Attendance
  autoTable(doc, {
    startY: y1,
    margin: { left: 14, right: 14 },
    head: [["Attendance Summary", ""]],
    body: [
      ["Present Days", String(p.present_days ?? 0)],
      ["Half Days", String(p.half_days ?? 0)],
      ["Absent Days", String(p.absent_days ?? 0)],
    ],
    theme: "grid",
    headStyles: { fillColor: [77, 163, 255], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 1: { halign: "right" } },
  });

  const y2 = doc.lastAutoTable.finalY + 6;
  const fmt = (n) => Number(n || 0).toFixed(2);
  autoTable(doc, {
    startY: y2,
    margin: { left: 14, right: 14 },
    head: [["Salary Breakdown", "Amount (INR)"]],
    body: [
      ["Base Salary", fmt(p.base_salary)],
      ["Incentive", fmt(p.incentive)],
      ["Bonus", fmt(p.bonus)],
      ["Overtime", fmt(p.overtime)],
      ["Deductions", `-${fmt(p.deductions)}`],
      [{ content: "Net Payable", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
       { content: fmt(p.net_salary), styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } }],
    ],
    theme: "grid",
    headStyles: { fillColor: [255, 169, 77], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 2.4 },
    columnStyles: { 1: { halign: "right" } },
  });

  const y3 = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleString()}. Computer-generated payslip.`, 14, y3);

  const name = (emp?.name || "employee").replace(/\s+/g, "_");
  doc.save(`payslip_${name}_${MONTHS[p.month]}_${p.year}.pdf`);
}
