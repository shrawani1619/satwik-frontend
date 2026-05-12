import jsPDF from 'jspdf';
import { initializeRobotoFontSync } from './robotoFont.js';

// A4 portrait (210 x 297 mm) — compact single-page tax invoice
const MARGIN = 10;
const LINE_HEIGHT = 4.1;
const HEADER_ROW_HEIGHT = 7;
/** Centered logo max size (mm); aspect ratio preserved via getImageProperties */
const LOGO_MAX_W_MM = 44;
const LOGO_MAX_H_MM = 22;
const TABLE_HEADER_BG = [232, 236, 246];
const BORDER_COLOR = [190, 195, 210];
const DARK_GRAY = [33, 33, 33];
const LIGHT_GRAY = [120, 120, 120];
const BRAND_NAVY = [21, 40, 74];
const BRAND_GOLD = [158, 124, 38];

const HSN_COMMISSION = '996211';

/** Format amount in Indian currency: ₹ 10,00,000.00 */
const formatINR = (amount) => {
  const str = Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '₹ ' + str;
};

const formatINRPlain = (amount) => {
  return Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Display value; show '-' instead of 'N/A' */
const na = (v) => (v == null || v === '' || String(v).trim().toUpperCase() === 'N/A' ? '-' : String(v));

const BELOW_TWENTY = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsWords(n) {
  if (n < 20) return BELOW_TWENTY[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return TENS[t] + (u ? ' ' + BELOW_TWENTY[u] : '');
}

function convertHundredsWords(n) {
  if (n < 100) return twoDigitsWords(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return BELOW_TWENTY[h] + ' Hundred' + (rest ? ' ' + twoDigitsWords(rest) : '');
}

/** Indian numbering: Rupees and paise in words (invoice footer). */
function amountToIndianWords(amount) {
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs + 1e-6);
  const paise = Math.round((abs - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  let n = rupees;
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore) parts.push(convertHundredsWords(crore) + ' Crore');
  if (lakh) parts.push(convertHundredsWords(lakh) + ' Lakh');
  if (thousand) parts.push(convertHundredsWords(thousand) + ' Thousand');
  if (hundred) parts.push(convertHundredsWords(hundred));

  let words = parts.join(' ').trim() + ' Rupees';
  if (paise > 0) words += ' and ' + twoDigitsWords(paise) + ' Paise';
  words += ' Only';
  return words;
}

/** Best-effort state name from address string (e.g. “… Maharashtra 411030”). */
function extractStateHint(text) {
  if (!text || typeof text !== 'string') return '';
  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry',
  ];
  const t = text.replace(/\s+/g, ' ');
  for (const s of states) {
    if (t.includes(s)) return s;
  }
  return '';
}

/**
 * Generate PDF invoice from invoice data
 * @param {Object} invoiceData - Invoice data with populated fields
 * @param {Object} companySettings - Company settings data (optional: companyLogo base64 for top-left logo)
 * @param {string} robotoFontBase64 - Optional base64 encoded Roboto font
 * @returns {jsPDF} PDF document
 */
export const generateInvoicePDF = (invoiceData, companySettings = {}, robotoFontBase64 = null) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (robotoFontBase64) {
    initializeRobotoFontSync(doc, robotoFontBase64);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * MARGIN;
  let yPosition = MARGIN;

  const fontFamily = doc.getFontList().Roboto ? 'Roboto' : 'helvetica';

  const addText = (text, x, y, options = {}) => {
    const { fontSize = 10, fontStyle = 'normal', color = DARK_GRAY, align = 'left' } = options;
    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, fontStyle);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(text), x, y, { align });
  };

  const addLine = (x1, y1, x2, y2, color = BORDER_COLOR) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.line(x1, y1, x2, y2);
  };

  const ensureSpace = (mm) => {
    if (yPosition + mm > pageHeight - MARGIN) {
      doc.addPage();
      yPosition = MARGIN;
    }
  };

  const lead = invoiceData.lead || {};
  const creator = lead.createdByResolved || lead.createdBy;
  let receiver = null;
  if (creator && typeof creator === 'object') {
    if (creator.role === 'franchise' && invoiceData.franchise && typeof invoiceData.franchise === 'object') {
      receiver = invoiceData.franchise;
    } else {
      receiver = creator;
    }
  } else if (invoiceData.invoiceType === 'franchise') {
    receiver = invoiceData.franchise;
  } else if (invoiceData.invoiceType === 'sub_agent') {
    receiver = invoiceData.subAgent || invoiceData.agent;
  } else {
    receiver = invoiceData.agent;
  }

  const receiverName = receiver?.name || 'N/A';
  let receiverAddress = 'N/A';
  if (receiver?.address) {
    const addr = receiver.address;
    receiverAddress = `${addr.street || ''}${addr.street && addr.city ? ', ' : ''}${addr.city || ''}${(addr.street || addr.city) && addr.state ? ', ' : ''}${addr.state || ''}${addr.pincode ? ' - ' + addr.pincode : ''}`.replace(/^,\s*|,\s*$/g, '').trim();
    if (!receiverAddress || receiverAddress === '-') receiverAddress = receiver.city || 'N/A';
  } else if (receiver?.city) {
    receiverAddress = receiver.city;
  }
  const receiverGST = receiver?.kyc?.gst || 'N/A';
  const receiverMobile = receiver?.mobile || 'N/A';
  const receiverEmail = receiver?.email || 'N/A';
  const receiverState =
    receiver?.address?.state ||
    extractStateHint(receiverAddress) ||
    '';

  const companyName = companySettings.companyName || 'Satwik Network';
  const companyAddress =
    companySettings.address ||
    'F-3, 3rd Floor, Gangadhar Chambers Co Op Society, Opposite Prabhat Press, Narayan Peth, Pune, Maharashtra 411030';
  const companyGST = companySettings.gstNo || '27AABCY2731J28';
  const companyMobile = companySettings.mobile || '9130011700';
  const companyEmail = companySettings.email || companySettings.contactEmail || 'N/A';
  const companyLogo = companySettings.companyLogo || companySettings.logoBase64 || null;
  const companyState = extractStateHint(companyAddress.replace(/\n/g, ' '));
  const receiverStateResolved = receiverState || extractStateHint(String(receiverAddress || '').replace(/\n/g, ' '));

  // Header block should show invoice receiver (user) details per business request.
  const headerPartyName = receiverName && receiverName !== 'N/A' ? receiverName : companyName;
  const headerPartyAddress = receiverAddress && receiverAddress !== 'N/A' ? receiverAddress : companyAddress;
  const headerPartyMobile = receiverMobile && receiverMobile !== 'N/A' ? receiverMobile : companyMobile;
  const headerPartyGST = receiverGST && receiverGST !== 'N/A' ? receiverGST : companyGST;
  const headerPartyState = receiverStateResolved || companyState || '';

  const bankDetails = receiver?.bankDetails || {};
  const cpCode = bankDetails.cpCode || 'N/A';
  const bankName = bankDetails.bankName || 'N/A';
  const accountNumber = bankDetails.accountNumber || 'N/A';
  const ifsc = bankDetails.ifsc || 'N/A';
  const branch = bankDetails.branch || 'N/A';

  const compBank = companySettings.bankDetails || {};
  const compBankName = compBank.bankName || 'STATE BANK OF INDIA';
  const compAccountNo = compBank.accountNumber || '-';
  const compIfsc = compBank.ifsc || '-';
  const compBranch = compBank.branch || '-';

  const totalGstRatePct = 18;
  const cgstRate = companySettings.taxConfig?.cgstRate ?? 9;
  const sgstRate = companySettings.taxConfig?.sgstRate ?? 9;
  const tdsRate = invoiceData.tdsPercentage ?? companySettings.taxConfig?.defaultTdsRate ?? 2;

  const leadName = lead.customerName || lead.leadId || 'N/A';
  const product = lead.loanType ? lead.loanType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'N/A';
  const amountDisbursed = lead.disbursedAmount || lead.loanAmount || 0;

  let payoutRate = 0;
  if (invoiceData.invoiceType === 'sub_agent') {
    payoutRate = lead.subAgentCommissionPercentage || invoiceData.subAgentCommissionPercentage || 0;
  } else if (invoiceData.invoiceType === 'agent') {
    const agentTotalPercentage =
      lead.agentCommissionPercentage || invoiceData.agentCommissionPercentage || receiver?.commissionPercentage || 0;
    const subAgentPercentage = lead.subAgentCommissionPercentage || 0;
    payoutRate = agentTotalPercentage - subAgentPercentage;
  } else {
    payoutRate = lead.commissionPercentage || invoiceData.commissionPercentage || receiver?.commissionPercentage || 0;
  }

  let commission = invoiceData.commissionAmount || 0;
  if (commission === 0 && amountDisbursed > 0 && payoutRate > 0) {
    commission = (amountDisbursed * payoutRate) / 100;
  }
  if (payoutRate === 0 && commission > 0 && amountDisbursed > 0) {
    payoutRate = (commission / amountDisbursed) * 100;
  }

  let gstAmount = invoiceData.gstAmount ?? 0;
  if (gstAmount === 0 && commission > 0) {
    gstAmount = (commission * totalGstRatePct) / 100;
  }

  let tdsAmount = invoiceData.tdsAmount ?? 0;
  if (tdsAmount === 0 && commission > 0) {
    tdsAmount = (commission * tdsRate) / 100;
  }

  const taxable = Math.max(0, commission);
  const cgstAmt = taxable > 0 && gstAmount > 0 ? (taxable * cgstRate) / 100 : 0;
  const sgstAmt = taxable > 0 && gstAmount > 0 ? (taxable * sgstRate) / 100 : 0;
  const lineAmount = taxable + gstAmount;
  const subTotalBeforeTds = lineAmount;
  const grossValue = commission + gstAmount - tdsAmount;
  const roundOff = Math.round(grossValue) - grossValue;
  const totalRounded = grossValue + roundOff;

  const invoiceNumber = invoiceData.invoiceNumber || 'N/A';
  const invoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const placeOfSupply = receiverState || companyState || '-';

  const itemDescription = `Commission for ${leadName}, ${product}`;

  doc.setCharSpace(0);

  const dataUrlImageFormat = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return 'PNG';
    if (dataUrl.includes('image/png')) return 'PNG';
    if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
    if (dataUrl.includes('image/webp')) return 'WEBP';
    return 'PNG';
  };

  // ---------- Header: centered brand logo + title (matches Satwik invoice style) ----------
  let belowHeaderY = MARGIN;
  if (companyLogo) {
    try {
      const fmt = dataUrlImageFormat(companyLogo);
      let w = LOGO_MAX_W_MM;
      let h = LOGO_MAX_H_MM * 0.55;
      try {
        const props = doc.getImageProperties(companyLogo);
        const ratio = props.height / props.width;
        w = LOGO_MAX_W_MM;
        h = w * ratio;
        if (h > LOGO_MAX_H_MM) {
          h = LOGO_MAX_H_MM;
          w = h / ratio;
        }
      } catch {
        /* fixed box if metadata missing */
      }
      const x = (pageWidth - w) / 2;
      doc.addImage(companyLogo, fmt, x, MARGIN, w, h);
      belowHeaderY = MARGIN + h + 2;
    } catch {
      /* ignore bad image */
    }
  }

  addText('Tax Invoice', pageWidth / 2, belowHeaderY + 4, {
    fontSize: 13,
    fontStyle: 'bold',
    color: BRAND_NAVY,
    align: 'center',
  });
  doc.setDrawColor(BRAND_GOLD[0], BRAND_GOLD[1], BRAND_GOLD[2]);
  doc.setLineWidth(0.35);
  doc.line(pageWidth * 0.34, belowHeaderY + 6.2, pageWidth * 0.66, belowHeaderY + 6.2);
  doc.setLineWidth(0.2);
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  yPosition = belowHeaderY + 9;

  // ---------- Header party block (receiver/user) — compact ----------
  addText(headerPartyName, MARGIN, yPosition, { fontSize: 10, fontStyle: 'bold', color: BRAND_NAVY });
  yPosition += LINE_HEIGHT + 0.3;
  const compAddrOneLine = String(headerPartyAddress || '-').replace(/\s*\n\s*/g, ' ').trim();
  const compAddrLines = doc.splitTextToSize(compAddrOneLine, contentWidth).slice(0, 2);
  compAddrLines.forEach((line) => {
    addText(line, MARGIN, yPosition, { fontSize: 7.5 });
    yPosition += LINE_HEIGHT - 0.2;
  });
  const phoneGst = `Phone: ${headerPartyMobile}    GSTIN: ${headerPartyGST}${headerPartyState ? `    State: ${headerPartyState}` : ''}`;
  doc.splitTextToSize(phoneGst, contentWidth).forEach((line) => {
    addText(line, MARGIN, yPosition, { fontSize: 7.5 });
    yPosition += LINE_HEIGHT - 0.2;
  });
  yPosition += 2;
  addLine(MARGIN, yPosition, pageWidth - MARGIN, yPosition, LIGHT_GRAY);
  yPosition += 4;

  // ---------- Bill To | Invoice Details ----------
  const splitX = MARGIN + contentWidth * 0.5;
  const boxTop = yPosition;
  const leftW = splitX - MARGIN - 4;
  const rightW = pageWidth - MARGIN - splitX - 4;
  const innerPad = 2;
  let leftY = yPosition + innerPad + 2;
  let rightY = yPosition + innerPad + 2;

  addText('Bill To', MARGIN + innerPad, leftY, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY });
  leftY += LINE_HEIGHT;
  const recvNameLines = doc.splitTextToSize(companyName, leftW - 2);
  recvNameLines.forEach((line) => {
    addText(line, MARGIN + innerPad, leftY, { fontSize: 8, fontStyle: 'bold' });
    leftY += LINE_HEIGHT;
  });
  const billAddrLines = doc.splitTextToSize(companyAddress !== 'N/A' ? companyAddress : '-', leftW - 2).slice(0, 3);
  billAddrLines.forEach((line) => {
    addText(line, MARGIN + innerPad, leftY, { fontSize: 7 });
    leftY += LINE_HEIGHT - 0.2;
  });
  addText(`GSTIN: ${na(companyGST)}`, MARGIN + innerPad, leftY, { fontSize: 7 });
  leftY += LINE_HEIGHT;
  if (companyState) {
    addText(`State: ${companyState}`, MARGIN + innerPad, leftY, { fontSize: 7 });
    leftY += LINE_HEIGHT;
  }
  const mobileLine = `Mobile: ${companyMobile}`;
  doc.splitTextToSize(mobileLine, leftW - 2).forEach((line) => {
    addText(line, MARGIN + innerPad, leftY, { fontSize: 7 });
    leftY += LINE_HEIGHT - 0.2;
  });
  const emailLine = `Email: ${companyEmail}`;
  doc.splitTextToSize(emailLine, leftW - 2).forEach((line) => {
    addText(line, MARGIN + innerPad, leftY, { fontSize: 7 });
    leftY += LINE_HEIGHT - 0.2;
  });

  addText('Invoice Details', splitX + innerPad, rightY, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY });
  rightY += LINE_HEIGHT;
  doc.splitTextToSize(`No: ${invoiceNumber}`, rightW - 2).forEach((line) => {
    addText(line, splitX + innerPad, rightY, { fontSize: 7 });
    rightY += LINE_HEIGHT - 0.2;
  });
  doc.splitTextToSize(`Date: ${invoiceDate}`, rightW - 2).forEach((line) => {
    addText(line, splitX + innerPad, rightY, { fontSize: 7 });
    rightY += LINE_HEIGHT - 0.2;
  });
  doc.splitTextToSize(`Place Of Supply: ${placeOfSupply}`, rightW - 2).forEach((line) => {
    addText(line, splitX + innerPad, rightY, { fontSize: 7 });
    rightY += LINE_HEIGHT - 0.2;
  });

  const boxH = Math.max(leftY, rightY) - boxTop + innerPad + 1.5;
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.rect(MARGIN, boxTop, splitX - MARGIN - 1, boxH);
  doc.rect(splitX - 1, boxTop, pageWidth - MARGIN - splitX + 1, boxH);
  yPosition = boxTop + boxH + 4;

  // ---------- Line items table ----------
  const tableLeft = MARGIN;
  const tableRight = pageWidth - MARGIN;
  const tableW = tableRight - tableLeft;
  const col = {
    sr: { x: tableLeft, w: 7 },
    item: { x: tableLeft + 7, w: 56 },
    hsn: { x: tableLeft + 63, w: 16 },
    qty: { x: tableLeft + 79, w: 9 },
    price: { x: tableLeft + 88, w: 24 },
    gst: { x: tableLeft + 112, w: 22 },
    amt: { x: tableLeft + 134, w: tableRight - (tableLeft + 134) },
  };

  /** Table header: light blue-grey band, bold Times, Price/GST/Amount centered (reference layout). */
  const drawTableHeader = (y) => {
    doc.setFillColor(TABLE_HEADER_BG[0], TABLE_HEADER_BG[1], TABLE_HEADER_BG[2]);
    doc.rect(tableLeft, y, tableW, HEADER_ROW_HEIGHT, 'F');
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.rect(tableLeft, y, tableW, HEADER_ROW_HEIGHT);
    const seps = [col.item.x, col.hsn.x, col.qty.x, col.price.x, col.gst.x, col.amt.x];
    seps.forEach((sx) => doc.line(sx, y, sx, y + HEADER_ROW_HEIGHT));
    const hdrY = y + 5.2;
    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(BRAND_NAVY[0], BRAND_NAVY[1], BRAND_NAVY[2]);
    doc.text('#', col.sr.x + col.sr.w / 2, hdrY, { align: 'center' });
    doc.text('Item', col.item.x + 1, hdrY, { align: 'left' });
    doc.text('HSN', col.hsn.x + col.hsn.w / 2, hdrY, { align: 'center' });
    doc.text('Qty', col.qty.x + col.qty.w / 2, hdrY, { align: 'center' });
    doc.text('Price', col.price.x + col.price.w / 2, hdrY, { align: 'center' });
    doc.text('GST', col.gst.x + col.gst.w / 2, hdrY, { align: 'center' });
    doc.text('Amount', col.amt.x + col.amt.w / 2, hdrY, { align: 'center' });
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DARK_GRAY[0], DARK_GRAY[1], DARK_GRAY[2]);
  };

  drawTableHeader(yPosition);
  yPosition += HEADER_ROW_HEIGHT;

  const itemLineGap = 3.6;
  const itemLines = doc.splitTextToSize(itemDescription, col.item.w - 4);
  const bodyRowH = Math.max(8, 4.2 + itemLines.length * itemLineGap);
  doc.rect(tableLeft, yPosition, tableW, bodyRowH);
  [col.item.x, col.hsn.x, col.qty.x, col.price.x, col.gst.x, col.amt.x].forEach((sx) =>
    doc.line(sx, yPosition, sx, yPosition + bodyRowH)
  );

  const itemStartY = yPosition + 4.2;
  itemLines.forEach((line, i) => {
    addText(line, col.item.x + 2, itemStartY + i * itemLineGap, { fontSize: 7.5 });
  });
  // Keep amounts top-aligned with first description line so wrapped item text never hits figures
  const tyNum = itemStartY;
  addText('1', col.sr.x + 1.5, tyNum, { fontSize: 8 });
  addText(HSN_COMMISSION, col.hsn.x + 0.5, tyNum, { fontSize: 7.5 });
  addText('1', col.qty.x + 2, tyNum, { fontSize: 8 });
  addText(formatINRPlain(taxable), col.price.x + col.price.w - 1.5, tyNum, { fontSize: 7.5, align: 'right' });
  addText(formatINRPlain(gstAmount), col.gst.x + col.gst.w - 1.5, tyNum, { fontSize: 7.5, align: 'right' });
  addText(formatINRPlain(lineAmount), col.amt.x + col.amt.w - 1.5, tyNum, { fontSize: 7.5, align: 'right' });
  yPosition += bodyRowH;

  // Total row (GST + Amount columns)
  const totalRowH = 7;
  doc.setFillColor(250, 250, 250);
  doc.rect(tableLeft, yPosition, tableW, totalRowH, 'F');
  doc.rect(tableLeft, yPosition, tableW, totalRowH);
  [col.item.x, col.hsn.x, col.qty.x, col.price.x, col.gst.x, col.amt.x].forEach((sx) =>
    doc.line(sx, yPosition, sx, yPosition + totalRowH)
  );
  addText('Total', col.price.x + 2, yPosition + 5, { fontSize: 8, fontStyle: 'bold' });
  addText(formatINRPlain(gstAmount), col.gst.x + col.gst.w - 2, yPosition + 5, { fontSize: 8, fontStyle: 'bold', align: 'right' });
  addText(formatINRPlain(lineAmount), col.amt.x + col.amt.w - 2, yPosition + 5, { fontSize: 8, fontStyle: 'bold', align: 'right' });
  yPosition += totalRowH + 3;

  // ---------- Tax summary ----------
  ensureSpace(32);
  addText('Tax Summary', MARGIN, yPosition, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY });
  yPosition += 3.5;
  const tsTop = yPosition;
  const tsH = 13.5;
  const tsW = tableW;
  const tsFixed = 26 + 34 + 16 + 28 + 16 + 28;
  const tsSeg = [26, 34, 16, 28, 16, 28, Math.max(22, tsW - tsFixed)];
  let tsX = tableLeft;
  const tsCell = tsSeg.map((w) => {
    const c = { x: tsX, w };
    tsX += w;
    return c;
  });
  doc.setFillColor(TABLE_HEADER_BG[0], TABLE_HEADER_BG[1], TABLE_HEADER_BG[2]);
  const tsHdrBand = 5.5;
  doc.rect(tableLeft, tsTop, tsW, tsHdrBand, 'F');
  doc.rect(tableLeft, tsTop, tsW, tsH);
  tsCell.slice(1).forEach((c) => doc.line(c.x, tsTop, c.x, tsTop + tsH));
  doc.line(tableLeft, tsTop + tsHdrBand, tableRight, tsTop + tsHdrBand);

  const tsHdrY = tsTop + 3.9;
  const tsLabels = ['HSN/SAC', 'Taxable', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'Total Tax'];
  tsLabels.forEach((lbl, i) => {
    const c = tsCell[i];
    const ax = i === 0 ? c.x + 0.8 : c.x + c.w - 0.8;
    addText(lbl, ax, tsHdrY, { fontSize: 6, fontStyle: 'bold', align: i === 0 ? 'left' : 'right' });
  });

  const tsRowY = tsTop + tsHdrBand + 4.2;
  addText(HSN_COMMISSION, tsCell[0].x + 0.8, tsRowY, { fontSize: 6.5 });
  addText(formatINRPlain(taxable), tsCell[1].x + tsCell[1].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  addText(String(cgstRate), tsCell[2].x + tsCell[2].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  addText(formatINRPlain(cgstAmt), tsCell[3].x + tsCell[3].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  addText(String(sgstRate), tsCell[4].x + tsCell[4].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  addText(formatINRPlain(sgstAmt), tsCell[5].x + tsCell[5].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  addText(formatINRPlain(gstAmount), tsCell[6].x + tsCell[6].w - 0.8, tsRowY, { fontSize: 6.5, align: 'right' });
  yPosition = tsTop + tsH + 4;

  // ---------- Totals (right; wrap long lines so they do not spill off page) ----------
  const totW = 78;
  const totX = tableRight - totW;
  const addTotLine = (label, fontSize = 9, bold = false) => {
    const lines = doc.splitTextToSize(label, totW - 1);
    lines.forEach((line) => {
      addText(line, totX + totW, yPosition, { fontSize, fontStyle: bold ? 'bold' : 'normal', align: 'right' });
      yPosition += LINE_HEIGHT;
    });
  };
  addTotLine(`Sub Total: ${formatINRPlain(subTotalBeforeTds)}`);
  if (tdsAmount > 0) {
    addTotLine(`Less: TDS @ ${tdsRate}%: ${formatINRPlain(tdsAmount)}`);
  }
  addTotLine(`Round Off: ${formatINRPlain(roundOff)}`);
  addTotLine(`Total: ${formatINRPlain(totalRounded)}`, 10, true);
  yPosition += 4;

  ensureSpace(22);
  const words = amountToIndianWords(totalRounded);
  const wordLines = doc.splitTextToSize(`Invoice Amount in Words: ${words}`, contentWidth).slice(0, 4);
  wordLines.forEach((line) => {
    addText(line, MARGIN, yPosition, { fontSize: 7, fontStyle: 'italic' });
    yPosition += LINE_HEIGHT + 0.15;
  });
  yPosition += 1;
  addText(`Received: ${formatINRPlain(0)}`, MARGIN, yPosition, { fontSize: 7 });
  addText(`Balance: ${formatINRPlain(totalRounded)}`, pageWidth - MARGIN, yPosition, { fontSize: 7, align: 'right' });
  yPosition += LINE_HEIGHT + 2;

  ensureSpace(28);
  addText('Terms & Conditions', MARGIN, yPosition, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY });
  yPosition += LINE_HEIGHT - 0.2;
  const terms = (
    invoiceData.notes ||
    invoiceData.remarks ||
    'Payment as per agreed commission schedule. Subject to Pune jurisdiction.'
  ).trim();
  const termLines = doc.splitTextToSize(terms, contentWidth);
  termLines.slice(0, 2).forEach((line) => {
    addText(line, MARGIN, yPosition, { fontSize: 6.8 });
    yPosition += LINE_HEIGHT - 0.3;
  });
  yPosition += 2;

  addText('Bank Details', MARGIN, yPosition, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY });
  yPosition += LINE_HEIGHT - 0.2;
  const bankLine1 = `Bank: ${compBankName}    A/c: ${compAccountNo}    IFSC: ${compIfsc}`;
  doc.splitTextToSize(bankLine1, contentWidth).forEach((line) => {
    addText(line, MARGIN, yPosition, { fontSize: 7 });
    yPosition += LINE_HEIGHT - 0.2;
  });
  addText(`Branch: ${compBranch}`, MARGIN, yPosition, { fontSize: 7 });
  yPosition += 4;

  if (na(cpCode) !== '-' || na(bankName) !== '-') {
    ensureSpace(16);
    addText('Partner settlement (payee bank)', MARGIN, yPosition, { fontSize: 7, fontStyle: 'bold' });
    yPosition += LINE_HEIGHT;
    const partnerLine = `Partner Code: ${na(cpCode)}  |  ${na(bankName)}  |  A/c: ${na(accountNumber)}  |  IFSC: ${na(ifsc)}`;
    doc.splitTextToSize(partnerLine, contentWidth).forEach((line) => {
      addText(line, MARGIN, yPosition, { fontSize: 7 });
      yPosition += LINE_HEIGHT - 0.2;
    });
    yPosition += 4;
  }

  ensureSpace(14);
  addLine(MARGIN, yPosition, tableRight, yPosition, BORDER_COLOR);
  yPosition += 5;
  addText('Authorized Signatory', tableRight, yPosition, { fontSize: 8, fontStyle: 'bold', color: BRAND_NAVY, align: 'right' });
  yPosition += LINE_HEIGHT - 0.2;
  addText(companyName, tableRight, yPosition, { fontSize: 7.5, align: 'right' });

  return doc;
};

/**
 * Load logo from Public folder as PNG data URL for use in PDF.
 * Tries /logo.webp and /logo.png. Converts WebP to PNG for jsPDF compatibility.
 */
export async function loadLogoFromPublic() {
  const paths = [
    '/satwik-network-logo.png',
    '/satwik-brand-logo.png',
    '/logo.png',
    '/logo.webp',
  ];
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      if (blob.type === 'image/webp') {
        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = dataUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      }
      return dataUrl;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Download invoice as PDF
 * @param {Object} invoiceData - Invoice data with populated fields
 * @param {Object} companySettings - Company settings data
 * @param {String} filename - Optional filename
 */
export const downloadInvoicePDF = (invoiceData, companySettings = {}, filename = null, robotoFontBase64 = null) => {
  const doc = generateInvoicePDF(invoiceData, companySettings, robotoFontBase64);
  const invoiceNumber = invoiceData.invoiceNumber || 'INV';
  const date = new Date().toISOString().split('T')[0];
  const pdfFilename = filename || `Invoice_${invoiceNumber}_${date}.pdf`;
  doc.save(pdfFilename);
};
