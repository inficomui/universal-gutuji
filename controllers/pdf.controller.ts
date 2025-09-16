import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { PlanRequest } from "../models/PlanRequest.ts";
import { Plan } from "../models/Plan.ts";
import { User } from "../models/User.ts";

// ---- utils (pure TS/JS, no extra libs) ----
const INR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(typeof n === "string" ? Number(n) : n);

const dttmIN = (d?: Date | null) =>
  d ? `${d.toLocaleDateString("en-IN")} ${d.toLocaleTimeString("en-IN")}` : "—";

const dtIN = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-IN") : "—";

const truncate = (text: string, max = 80) =>
  (text || "").length > max ? text.slice(0, max - 1) + "…" : (text || "—");

// Draw a section title bar
function sectionTitle(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  doc.save();
  doc.roundedRect(x, y, width, 24, 6).fill("#EEF5FF");
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(11)
     .text(text.toUpperCase(), x + 10, y + 6);
  doc.restore();
  return y + 24 + 8; // next y
}

// Draw a key–value table
function kvTable(
  doc: PDFKit.PDFDocument,
  x: number,
  startY: number,
  width: number,
  rows: Array<[string, string]>,
  labelWidth = 110,
  lineHeight = 16
) {
  const valueWidth = width - labelWidth - 16; // padding
  let y = startY;

  rows.forEach(([k, v], i) => {
    if (i % 2 === 0) {
      doc.save();
      doc.rect(x, y - 2, width, lineHeight + 6).fill("#FBFDFF");
      doc.restore();
    }
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10)
       .text(k, x + 8, y, { width: labelWidth });
    doc.fillColor("#0B1220").font("Helvetica").fontSize(10)
       .text(v ?? "—", x + 8 + labelWidth, y, { width: valueWidth });
    y += lineHeight + 6;
  });

  // border
  doc.save();
  doc.lineWidth(0.8).strokeColor("#E5EAF3")
     .roundedRect(x, startY - 6, width, y - startY + 10, 6)
     .stroke();
  doc.restore();

  return y + 8;
}

// Horizontal divider
function divider(doc: PDFKit.PDFDocument, x: number, y: number, width: number) {
  doc.save();
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(1).strokeColor("#E5EAF3").stroke();
  doc.restore();
  return y + 10;
}

// Badge (for status)
function badge(doc: PDFKit.PDFDocument, text: string, x: number, y: number) {
  const fill = text === "approved" ? "#16A34A"
             : text === "rejected" ? "#DC2626"
             : text === "pending"  ? "#2563EB"
             : "#6B7280";
             doc.font("Helvetica-Bold").fontSize(9);
             const w = doc.widthOfString(text.toUpperCase()) + 12;
             
  doc.save();
  doc.roundedRect(x, y, w, 16, 8).fill(fill);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9)
     .text(text.toUpperCase(), x + 6, y + 4);
  doc.restore();
  return y + 20;
}

export const downloadPaymentSlip = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { planRequestId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const planRequest = await PlanRequest.findOne({
      where: { id: planRequestId, userId },
      include: [
        { model: Plan, as: "plan" },
        { model: User, as: "user" },
        { model: User, as: "approver" },
      ],
    });

    if (!planRequest) {
      res.status(404).json({
        success: false,
        message: "Plan request not found or you don't have permission to view this request",
      });
      return;
    }

    // ---- Create PDF ----
    const doc = new PDFDocument({ size: "A4", margin: 36 }); // tighter margin for compact single-page
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="plan-request-${planRequest.id}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const margin = 36;
    const contentW = pageW - margin * 2;

    // ---- Header band ----
    doc.save();
    doc.roundedRect(margin, margin, contentW, 70, 10).fill("#1F4E7A");
    doc.fillColor("#FFFFFF");

    doc.font("Helvetica-Bold").fontSize(18).text("UNIVERSAL GURUJI", margin + 16, margin + 12);
    doc.font("Helvetica").fontSize(12).text("Plan Purchase Receipt", margin + 16, margin + 36);
    doc.font("Helvetica").fontSize(10).text(`Request # ${planRequest.id}`, margin + 16, margin + 54);

    // status badge on right
    badge(doc, (planRequest.status || "").toLowerCase(), margin + contentW - 110, margin + 16);

    doc.restore();

    // ---- Meta row (date, payment ref, amount) ----
    let y = margin + 86;
    y = divider(doc, margin, y, contentW);

    const metaCols = [
      ["Request Date", dtIN(planRequest.createdAt)],
      ["Payment Ref", planRequest.paymentReference || "—"],
      ["Amount", INR(planRequest.amount ?? (planRequest as any).plan?.price ?? 0)],
    ];

    const colW = contentW / 3;
    metaCols.forEach(([k, v], i) => {
      const x = margin + i * colW;
      doc.fillColor("#64748B").font("Helvetica-Bold").fontSize(9).text(k.toUpperCase(), x, y);
      doc.fillColor("#0B1220").font("Helvetica").fontSize(11).text(v, x, y + 12, { width: colW - 12 });
    });
    y += 40;

    // ---- Two-column grid ----
    const gutter = 18;
    const colWidth = (contentW - gutter) / 2;
    let leftY = y;
    let rightY = y;

    // Left: Plan Request Details
    leftY = sectionTitle(doc, "Plan Request Details", margin, leftY, colWidth);
    leftY = kvTable(doc, margin, leftY, colWidth, [
      ["Request ID", String(planRequest.id)],
      ["Status", (planRequest.status || "").toUpperCase()],
      ["Payment Method", planRequest.paymentMethod || "—"],
      ["Currency", planRequest.currency || "INR"],
      ["Approved At", dttmIN(planRequest.approvedAt)],
    ]);

    // Left: Customer Information
    leftY = sectionTitle(doc, "Customer Information", margin, leftY, colWidth);
    leftY = kvTable(doc, margin, leftY, colWidth, [
      ["Customer Name", truncate((planRequest as any).user?.name ?? "—", 40)],
      ["Email", truncate((planRequest as any).user?.email ?? "—", 45)],
      ["Username", (planRequest as any).user?.username ?? "—"],
      ["User ID", String((planRequest as any).user?.id ?? "—")],
    ]);

    // Right: Plan Details
    rightY = sectionTitle(doc, "Plan Details", margin + colWidth + gutter, rightY, colWidth);
    const plan = (planRequest as any).plan ?? {};
    const originalPrice = plan.originalPrice ? INR(plan.originalPrice) : "—";
    const price = plan.price ? INR(plan.price) : "—";
    let discount = "—";
    try {
      if (plan.originalPrice && typeof plan.getDiscountPercentage === "function") {
        discount = `${plan.getDiscountPercentage()}%`;
      }
    } catch {}
    rightY = kvTable(doc, margin + colWidth + gutter, rightY, colWidth, [
      ["Plan Name", truncate(plan.name ?? "—", 40)],
      ["Description", truncate(plan.description ?? "—", 80)],
      ["Price", price],
      ["Original Price", originalPrice],
      ["Discount", discount],
      ["BV Value", plan.bvValue != null ? String(plan.bvValue) : "—"],
    ]);

    // Right: Company Information
    rightY = sectionTitle(doc, "Company Information", margin + colWidth + gutter, rightY, colWidth);
    rightY = kvTable(doc, margin + colWidth + gutter, rightY, colWidth, [
      ["Company", "Universal Guruji MLM Platform"],
      ["Email", "support@universalguruji.com"],
      ["Website", "www.universalguruji.com"],
      ["Phone", "+91-XXXXXXXXXX"],
    ]);

    // push below the taller column
    y = Math.max(leftY, rightY) + 6;

    // ---- Status Timeline (compact, one-liners) ----
    y = sectionTitle(doc, "Request Status Timeline", margin, y, contentW);
    const timeline: Array<{ label: string; when: string }> = [];
    timeline.push({ label: "Request Submitted", when: dttmIN(planRequest.createdAt) });
    if (planRequest.approvedAt) timeline.push({ label: "Request Approved", when: dttmIN(planRequest.approvedAt) });
    if (planRequest.status === "rejected") {
      timeline.push({
        label: "Request Rejected",
        when: `${dttmIN(planRequest.updatedAt)} ${planRequest.rejectionReason ? `– ${truncate(planRequest.rejectionReason, 60)}` : ""}`,
      });
    }

    const rowH = 18;
    const bulletX = margin + 10;
    let ty = y + 6;
    timeline.slice(0, 3).forEach((t) => {
      doc.fillColor("#1F2937").font("Helvetica-Bold").fontSize(10).text(`• ${t.label}`, bulletX, ty);
      doc.fillColor("#475569").font("Helvetica").fontSize(9).text(t.when, bulletX + 18, ty + 12);
      ty += rowH + 10;
    });
    y = ty + 4;

    // ---- Notes (short, fits page) ----
    y = sectionTitle(doc, "Important Notes", margin, y, contentW);
    doc.fillColor("#111827").font("Helvetica").fontSize(9);
    const notes = [
      "This is a computer-generated receipt and does not require a signature.",
      "Please keep this receipt for your records.",
      "Plan benefits activate after request approval.",
    ];
    notes.forEach((n, i) => {
      doc.text(`• ${n}`, margin + 10, y + i * 14, { width: contentW - 20 });
    });

    // ---- Footer line + thank you ----
    y += notes.length * 14 + 14;
    divider(doc, margin, y, contentW);
    y += 8;
    doc.fillColor("#1F4E7A").font("Helvetica-Bold").fontSize(11)
       .text("Thank you for choosing Universal Guruji!", margin, y, { width: contentW, align: "center" });

    // If you later add a QR (using a dataURL), place it in top-right or footer area.

    doc.end();
  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Error generating PDF",
    });
  }
};


// Generate payment slip PDF for all user's plan requests
export const downloadAllPaymentSlips = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
      return;
    }

    // Find all plan requests for the user
    const planRequests = await PlanRequest.findAll({
      where: {
        userId: userId
      },
      include: [
        {
          model: Plan,
          as: 'plan'
        },
        {
          model: User,
          as: 'user'
        },
        {
          model: User,
          as: 'approver'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (planRequests.length === 0) {
      res.status(404).json({
        success: false,
        message: "No plan requests found for this user"
      });
      return;
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="all-plan-requests-${userId}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to add text with styling
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      doc.text(text, x, y, options);
    };

    // Helper function to add line
    const addLine = (x1: number, y1: number, x2: number, y2: number, strokeWidth: number = 1) => {
      doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    };

    // Process each plan request
    planRequests.forEach((planRequest, requestIndex) => {
      // Add new page for each plan request (except first)
      if (requestIndex > 0) {
        doc.addPage();
      }

      // Header Section
      doc.rect(50, 50, 500, 80).fill('#2E86AB');
      doc.fillColor('white');
      addText('UNIVERSAL GURUJI', 60, 70, { fontSize: 24, bold: true });
      addText('Plan Purchase Receipt', 60, 95, { fontSize: 16 });
      addText(`Request #: ${planRequest.id}`, 60, 115, { fontSize: 12 });

      // Reset fill color
      doc.fillColor('black');

      // Plan Request Details Section
      let currentY = 150;
      addText('Plan Request Details:', 60, currentY, { fontSize: 14, bold: true });
      currentY += 25;

      // Plan request details table
      const tableData = [
        ['Request ID:', planRequest.id.toString()],
        ['Request Date:', planRequest.createdAt.toLocaleDateString('en-IN')],
        ['Payment Reference:', planRequest.paymentReference || 'N/A'],
        ['Payment Method:', planRequest.paymentMethod || 'N/A'],
        ['Status:', planRequest.status.toUpperCase()],
        ['Amount:', `₹${planRequest.amount}`],
        ['Currency:', planRequest.currency]
      ];

      tableData.forEach(([label, value], index) => {
        const y = currentY + (index * 20);
        addText(label, 60, y, { fontSize: 10, bold: true });
        addText(value, 200, y, { fontSize: 10 });
      });

      currentY += (tableData.length * 20) + 20;

      // Plan Details Section
      addText('Plan Details:', 60, currentY, { fontSize: 14, bold: true });
      currentY += 25;

      const planTableData = [
        ['Plan Name:', (planRequest as any).plan.name],
        ['Plan Description:', (planRequest as any).plan.description],
        ['Plan Price:', `₹${(planRequest as any).plan.price}`],
        ['Original Price:', (planRequest as any).plan.originalPrice ? `₹${(planRequest as any).plan.originalPrice}` : 'N/A'],
        ['Discount:', (planRequest as any).plan.originalPrice ? `${(planRequest as any).plan.getDiscountPercentage()}%` : 'N/A'],
        ['BV Value:', (planRequest as any).plan.bvValue ? (planRequest as any).plan.bvValue.toString() : 'N/A']
      ];

      planTableData.forEach(([label, value], index) => {
        const y = currentY + (index * 20);
        addText(label, 60, y, { fontSize: 10, bold: true });
        addText(value, 200, y, { fontSize: 10 });
      });

      currentY += (planTableData.length * 20) + 20;

      // User Details Section
      addText('Customer Information:', 60, currentY, { fontSize: 14, bold: true });
      currentY += 25;

      const userTableData = [
        ['Customer Name:', (planRequest as any).user.name],
        ['Email:', (planRequest as any).user.email],
        ['Username:', (planRequest as any).user.username || 'N/A'],
        ['User ID:', (planRequest as any).user.id.toString()]
      ];

      userTableData.forEach(([label, value], index) => {
        const y = currentY + (index * 20);
        addText(label, 60, y, { fontSize: 10, bold: true });
        addText(value, 200, y, { fontSize: 10 });
      });

      currentY += (userTableData.length * 20) + 30;

      // Status Timeline Section
      addText('Request Status Timeline:', 60, currentY, { fontSize: 14, bold: true });
      currentY += 25;

      const statusTimeline = [
        { status: 'Request Submitted', date: planRequest.createdAt, description: 'Plan request submitted by user' },
        { status: 'Request Approved', date: planRequest.approvedAt, description: 'Plan request approved by admin' }
      ].filter(item => item.date);

      // Add rejection info if applicable
      if (planRequest.status === 'rejected' && planRequest.rejectionReason) {
        statusTimeline.push({
          status: 'Request Rejected',
          date: planRequest.updatedAt,
          description: `Rejected: ${planRequest.rejectionReason}`
        });
      }

      statusTimeline.forEach((item, index) => {
        const y = currentY + (index * 25);
        addText(`• ${item.status}`, 60, y, { fontSize: 10, bold: true });
        if (item.date) {
          addText(`Date: ${item.date.toLocaleDateString('en-IN')} ${item.date.toLocaleTimeString('en-IN')}`, 80, y + 12, { fontSize: 9 });
        }
        addText(item.description, 80, y + 24, { fontSize: 8, color: '#666' });
      });

      currentY += (statusTimeline.length * 25) + 30;

      // Footer Section
      addLine(50, currentY, 550, currentY, 2);
      currentY += 20;

      addText('Important Notes:', 60, currentY, { fontSize: 12, bold: true });
      currentY += 20;

      const notes = [
        '• This is a computer-generated receipt and does not require a signature.',
        '• Please keep this receipt for your records.',
        '• For any queries, contact our support team.',
        '• Plan request approval may take 1-2 business days.',
        '• Plan benefits will be activated after request approval.'
      ];

      notes.forEach(note => {
        addText(note, 60, currentY, { fontSize: 9 });
        currentY += 15;
      });

      currentY += 20;
      addText('Thank you for choosing Universal Guruji!', 60, currentY, { fontSize: 12, bold: true, color: '#2E86AB' });
    });

    // Finalize PDF
    doc.end();

  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating PDF"
    });
  }
};
