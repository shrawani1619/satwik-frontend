import jsPDF from 'jspdf';
import { initializeRobotoFontSync } from './robotoFont.js';

/**
 * Generate PDF invoice from invoice data
 * @param {Object} invoiceData - Invoice data with populated fields
 * @param {Object} companySettings - Company settings data
 * @param {string} robotoFontBase64 - Optional base64 encoded Roboto font
 * @returns {jsPDF} PDF document
 */
export const generateInvoicePDF = (invoiceData, companySettings = {}, robotoFontBase64 = null) => {
  const doc = new jsPDF();
  
  // Try to initialize Roboto font if base64 is provided
  if (robotoFontBase64) {
    initializeRobotoFontSync(doc, robotoFontBase64);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Colors
  const primaryColor = [41, 128, 185]; // Blue
  const darkGray = [51, 51, 51];
  const lightGray = [128, 128, 128];
  // Check if Roboto font is available
  const fontFamily = doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica';

  // Helper function to add text with styling
  const addText = (text, x, y, options = {}) => {
    const {
      fontSize = 10,
      fontStyle = 'normal',
      color = darkGray,
      align = 'left',
    } = options;

    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, fontStyle);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, x, y, { align });
  };

  // Helper function to add line
  const addLine = (x1, y1, x2, y2, color = lightGray) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.line(x1, y1, x2, y2);
  };

  // Determine receiver (Agent, SubAgent, or Franchise)
  let receiver = null;
  if (invoiceData.invoiceType === 'sub_agent') {
    // For SubAgent invoices, the receiver should be the SubAgent
    receiver = invoiceData.subAgent;
    // Fallback to agent only if subAgent is not populated (shouldn't happen, but safety check)
    if (!receiver || (typeof receiver === 'object' && !receiver.name)) {
      console.warn('⚠️ SubAgent invoice but subAgent not populated, falling back to agent');
      receiver = invoiceData.agent;
    }
  } else if (invoiceData.invoiceType === 'agent') {
    receiver = invoiceData.agent;
  } else {
    receiver = invoiceData.franchise;
  }

  // Determine if receiver is a "normal" (non-GST) user
  // For agents/sub-agents we look at agent.agentType
  // For franchises we look at franchise.franchiseType
  let isNormalGSTUser = false;
  if (invoiceData.invoiceType === 'agent' || invoiceData.invoiceType === 'sub_agent') {
    const agent = invoiceData.agent || receiver;
    isNormalGSTUser = agent?.agentType === 'normal';
  } else if (invoiceData.invoiceType === 'franchise') {
    const franchise = invoiceData.franchise || receiver;
    isNormalGSTUser = franchise?.franchiseType === 'normal';
  }
  
  // Debug logging
  console.log('🔍 Invoice PDF - Receiver Details:', {
    invoiceType: invoiceData.invoiceType,
    receiverName: receiver?.name,
    receiverId: receiver?._id || receiver?.id,
    hasSubAgent: !!invoiceData.subAgent,
    subAgentName: invoiceData.subAgent?.name,
    agentName: invoiceData.agent?.name
  });
  
  const receiverName = receiver?.name || 'N/A';
  // Handle address - franchises have address object, users might have city
  let receiverAddress = 'N/A';
  if (receiver?.address) {
    const addr = receiver.address;
    receiverAddress = `${addr.street || ''}${addr.street && addr.city ? ', ' : ''}${addr.city || ''}${(addr.street || addr.city) && addr.state ? ', ' : ''}${addr.state || ''}${addr.pincode ? ' - ' + addr.pincode : ''}`.replace(/^,\s*|,\s*$/g, '').trim();
    if (!receiverAddress || receiverAddress === '-') receiverAddress = receiver.city || 'N/A';
  } else if (receiver?.city) {
    receiverAddress = receiver.city;
  }
  const receiverPAN = receiver?.kyc?.pan || 'N/A';
  const receiverGST = receiver?.kyc?.gst || 'N/A';
  const receiverMobile = receiver?.mobile || 'N/A';
  const receiverEmail = receiver?.email || 'N/A';

  // Company settings (who paid - YKC)
  const companyName = companySettings.companyName || 'YKC FINANCIAL SERVICES';
  const companyAddress = companySettings.address || 'F-3, 3rd Floor, Gangadhar Chambers Co Op Society, Opposite Prabhat Press, Narayan Peth, Pune, Maharashtra 411030';
  const companyGST = companySettings.gstNo || '27AABCY2731J28';
  const companyPAN = companySettings.panNo || 'N/A';
  const companyEmail = companySettings.email || 'N/A';
  const companyMobile = companySettings.mobile || '9130011700';

  // Bank details from receiver
  const bankDetails = receiver?.bankDetails || {};
  const cpCode = bankDetails.cpCode || 'N/A';
  const bankName = bankDetails.bankName || 'N/A';
  const accountNumber = bankDetails.accountNumber || 'N/A';
  const ifsc = bankDetails.ifsc || 'N/A';
  const branch = bankDetails.branch || 'N/A';

  // Tax configuration: GST = 18% of Taxable, TDS = 2% of Taxable, Gross = Taxable + GST - TDS
  const totalGstRatePct = 18; // 18% GST on taxable
  const cgstRate = companySettings.taxConfig?.cgstRate ?? 9;
  const sgstRate = companySettings.taxConfig?.sgstRate ?? 9;
  const tdsRate = invoiceData.tdsPercentage ?? companySettings.taxConfig?.defaultTdsRate ?? 2;

  // Lead information
  const lead = invoiceData.lead || {};
  const leadName = lead.customerName || lead.leadId || 'N/A';
  const bankName_lead = lead.bank?.name || 'N/A';
  const product = lead.loanType ? lead.loanType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
  const amountDisbursed = lead.disbursedAmount || lead.loanAmount || 0;
  
  // Get payout rate - prioritize invoice data, then lead, then receiver
  let payoutRate = 0;
  if (invoiceData.invoiceType === 'sub_agent') {
    // For SubAgent invoices, use the commission rate decided by the agent
    payoutRate = lead.subAgentCommissionPercentage || invoiceData.subAgentCommissionPercentage || 0;
  } else if (invoiceData.invoiceType === 'agent') {
    // For Agent invoices, calculate remaining percentage (total - subAgent's share)
    const agentTotalPercentage = lead.agentCommissionPercentage || invoiceData.agentCommissionPercentage || receiver?.commissionPercentage || 0;
    const subAgentPercentage = lead.subAgentCommissionPercentage || 0;
    payoutRate = agentTotalPercentage - subAgentPercentage; // Agent's remaining commission
  } else {
    payoutRate = lead.commissionPercentage || invoiceData.commissionPercentage || receiver?.commissionPercentage || 0;
  }

  // Use commission amount from invoice if available, otherwise calculate
  let commission = invoiceData.commissionAmount || 0;
  
  // If commission is 0 but we have amount and rate, calculate it
  if (commission === 0 && amountDisbursed > 0 && payoutRate > 0) {
    commission = (amountDisbursed * payoutRate) / 100;
  }
  
  // If we have commission but no rate, calculate rate backwards
  if (payoutRate === 0 && commission > 0 && amountDisbursed > 0) {
    payoutRate = (commission / amountDisbursed) * 100;
  }
  
  // GST = 18% of Taxable (commission)
  let gstAmount = invoiceData.gstAmount ?? 0;
  if (gstAmount === 0 && commission > 0) {
    gstAmount = (commission * totalGstRatePct) / 100;
  }

  // TDS = 2% of Taxable (or invoice tdsPercentage)
  let tdsAmount = invoiceData.tdsAmount ?? 0;
  if (tdsAmount === 0 && commission > 0) {
    tdsAmount = (commission * tdsRate) / 100;
  }

  // Gross = Taxable + GST - TDS (always compute for correct PDF display)
  const grossValue = commission + gstAmount - tdsAmount;

  // Header Section
  addText('TAX INVOICE', pageWidth / 2, yPosition, {
    fontSize: 20,
    fontStyle: 'bold',
    color: primaryColor,
    align: 'center',
  });

  yPosition += 10;

  // Invoice Number and Date (Right aligned)
  const invoiceNumber = invoiceData.invoiceNumber || 'N/A';
  const invoiceDate = invoiceData.invoiceDate
    ? new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  addText(`Invoice No.: ${invoiceNumber}`, pageWidth - 20, yPosition, {
    fontSize: 10,
    align: 'right',
  });
  yPosition += 5;
  addText(`Date: ${invoiceDate}`, pageWidth - 20, yPosition, {
    fontSize: 10,
    align: 'right',
  });

  yPosition += 15;

  // RECEIVER DETAILS (Partner/Sub Partner/Franchise - Who Receives Payment) - Top Section
  addText('Receiver Details:', 20, yPosition, { fontSize: 12, fontStyle: 'bold' });
  yPosition += 7;
  addText(receiverName, 20, yPosition, { fontSize: 12, fontStyle: 'bold' });
  yPosition += 6;
  
  // Show address or N/A if not available
  if (receiverAddress && receiverAddress !== 'N/A') {
    const receiverAddressLines = doc.splitTextToSize(receiverAddress, pageWidth - 40);
    receiverAddressLines.forEach((line) => {
      addText(line, 20, yPosition, { fontSize: 9 });
      yPosition += 5;
    });
  } else {
    addText('N/A', 20, yPosition, { fontSize: 9 });
    yPosition += 5;
  }

  yPosition += 3;
  addText(`Mobile No.: ${receiverMobile}`, 20, yPosition, { fontSize: 9 });
  yPosition += 5;
  addText(`Email ID: ${receiverEmail}`, 20, yPosition, { fontSize: 9 });

  yPosition += 10;
  // Divider Line
  addLine(20, yPosition, pageWidth - 20, yPosition);

  yPosition += 10;

  // PARTY DETAILS (YKC - Who Paid Payment)
  addText('Party Details:', 20, yPosition, { fontSize: 12, fontStyle: 'bold' });
  yPosition += 7;
  addText(companyName, 20, yPosition, { fontSize: 12, fontStyle: 'bold' });
  yPosition += 6;
  
  const companyAddressLines = doc.splitTextToSize(companyAddress, pageWidth - 40);
  companyAddressLines.forEach((line) => {
    addText(line, 20, yPosition, { fontSize: 9 });
    yPosition += 5;
  });

  yPosition += 3;
  addText(`GST No.: ${companyGST}`, 20, yPosition, { fontSize: 9 });
  yPosition += 5;
  addText(`Mobile No.: ${companyMobile}`, 20, yPosition, { fontSize: 9 });

  yPosition += 15;

  // Invoice Items Table Header
  addLine(20, yPosition - 5, pageWidth - 20, yPosition - 5);
  
  // Table column positions (better spacing to prevent overflow)
  // Page width is typically 210mm, leaving margins, we have ~170mm usable width
  const col = {
    sr: 20,
    customer: 28,
    bank: 55,
    product: 70,
  
    amountRight: 115,
    rateRight: 130,
    taxableRight: 150,
    // GST column will only be used for GST-registered users
    gstRight: 165,
    tdsRight: 180,
    grossRight: pageWidth - 15,
  };

  // If the receiver is a "normal" user, we hide the GST column visually
  // and shift the remaining numeric columns slightly for better spacing.
  if (isNormalGSTUser) {
    // Re-use the previous GST column position for TDS and keep Gross at the end
    col.tdsRight = col.gstRight;
    col.grossRight = pageWidth - 15;
  }

  // Table headers with proper spacing (shorter headers to fit)
  addText('Sr', col.sr, yPosition, { fontSize: 8, fontStyle: 'bold' });
  addText('Customer', col.customer, yPosition, { fontSize: 8, fontStyle: 'bold' });
  addText('Bank', col.bank, yPosition, { fontSize: 8, fontStyle: 'bold' });
  addText('Product', col.product, yPosition, { fontSize: 8, fontStyle: 'bold' });
  addText('Amount', col.amountRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right' });
  addText('Rate%', col.rateRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right'});
  addText('Taxable', col.taxableRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right' });
  // Only show GST column in header for GST-registered users
  if (!isNormalGSTUser) {
    addText('GST', col.gstRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right' });
  }
  addText('TDS', col.tdsRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right'});
  addText('Gross', col.grossRight, yPosition, { fontSize: 8, fontStyle: 'bold' , align: 'right'});

  yPosition += 8;
  addLine(20, yPosition - 5, pageWidth - 20, yPosition - 5);

  // Invoice Item Row with proper column alignment
  addText('1', col.sr, yPosition, { fontSize: 8 });
  
  // Customer Name (truncate if too long)
  const customerNameText = doc.splitTextToSize(leadName, 25);
  addText(customerNameText[0] || leadName.substring(0, 12),   col.customer, yPosition, { fontSize: 8});
  
  addText(bankName_lead.substring(0, 8), col.bank, yPosition, { fontSize: 8 });
  addText(product.substring(0, 10), col.product, yPosition, { fontSize: 8 });
  
  // Amount - right aligned (clean string, no backticks)
  const amountFormatted = amountDisbursed.toLocaleString('en-IN');
  const amountText = '₹' + amountFormatted;
  doc.setCharSpace(0);
  addText(amountText, col.amountRight , yPosition, { fontSize: 8, align: 'right' });
  
  // Rate - right aligned (clean string formatting)
  const rateFormatted = Math.abs(payoutRate).toFixed(2);
  const rateText = rateFormatted + '%';
  addText(rateText, col.rateRight, yPosition, { fontSize: 8, align: 'right' });
  
  // Taxable Amount - right aligned (clean formatting)
  const taxableValue = Math.max(0, commission);
  const taxableFormatted = taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const taxableText = '₹' + taxableFormatted;
  addText(taxableText, col.taxableRight , yPosition, { fontSize: 8, align: 'right' });
  
  // GST - right aligned (clean formatting) - only if not a "normal" user
  if (!isNormalGSTUser) {
    const gstValue = Math.max(0, gstAmount);
    const gstFormatted = gstValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const gstText = '₹' + gstFormatted;
    addText(gstText, col.gstRight, yPosition, { fontSize: 8, align: 'right' });
  }
  
  // TDS - right aligned (clean formatting)
  const tdsValue = Math.max(0, tdsAmount);
  const tdsFormatted = tdsValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tdsText = '₹' + tdsFormatted;
  addText(tdsText, col.tdsRight , yPosition, { fontSize: 8, align: 'right' });
  
  // Gross Value - right aligned (clean formatting)
  const grossFormatted = grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const grossText = '₹' + grossFormatted;
  addText(grossText, col.grossRight , yPosition, { fontSize: 8, align: 'right' });

  yPosition += 10;
  addLine(20, yPosition - 5, pageWidth - 20, yPosition - 5);

  // CP Code & Bank Details Section
  yPosition += 10;
  addText('CP Code & Bank Details:', 20, yPosition, {
    fontSize: 11,
    fontStyle: 'bold',
  });
  yPosition += 7;
  if (cpCode !== 'N/A') {
    addText(`CP Code: ${cpCode}`, 20, yPosition, { fontSize: 9 });
    yPosition += 5;
  }
  addText(`Bank Name: ${bankName}`, 20, yPosition, { fontSize: 9 });
  yPosition += 5;
  addText(`Account No.: ${accountNumber}`, 20, yPosition, { fontSize: 9 });
  yPosition += 5;
  addText(`IFSC Code: ${ifsc}`, 20, yPosition, { fontSize: 9 });
  yPosition += 5;
  addText(`Branch: ${branch}`, 20, yPosition, { fontSize: 9 });

  // Additional Information
  if (invoiceData.notes || invoiceData.remarks) {
    yPosition += 10;
    addText('Notes:', 20, yPosition, { fontSize: 10, fontStyle: 'bold' });
    yPosition += 6;
    const notes = invoiceData.notes || invoiceData.remarks || '';
    const notesLines = doc.splitTextToSize(notes, pageWidth - 40);
    notesLines.forEach((line) => {
      addText(line, 20, yPosition, { fontSize: 9 });
      yPosition += 5;
    });
  }

  // Signature Section
  yPosition = pageHeight - 40;
  addLine(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;
  addText('Authorised Signatory', pageWidth - 20, yPosition, {
    fontSize: 10,
    fontStyle: 'bold',
    align: 'right',
  });
  yPosition += 6;
  addText(receiverName, pageWidth - 20, yPosition, {
    fontSize: 9,
    align: 'right',
  });

  return doc;
};

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
