// Shared formatting + validation helpers for key KYC/bank fields.

export const normalizeDigits = (value) => String(value ?? '').replace(/\D/g, '');

export const formatMobileInput = (value) => {
  const digits = normalizeDigits(value);
  // Hard cap at 10 digits so user cannot type beyond mobile length.
  return digits.slice(0, 10);
};

export const isValidMobileInput = (value) => {
  const digits = formatMobileInput(value);
  return /^[6-9]\d{9}$/.test(digits);
};

export const formatPanInput = (value) =>
  String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10);

export const isValidPanInput = (value) => {
  const pan = formatPanInput(value);
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
};

export const formatAccountNumberInput = (value) => normalizeDigits(value).slice(0, 18);

export const isValidAccountNumberInput = (value) => {
  const acc = formatAccountNumberInput(value);
  // Typical Indian bank account numbers are 9-18 digits.
  return acc.length >= 9 && acc.length <= 18;
};

export const formatAadhaarInput = (value) => normalizeDigits(value).slice(0, 12);

export const isValidAadhaarInput = (value) => {
  const aadhaar = formatAadhaarInput(value);
  return /^\d{12}$/.test(aadhaar);
};

// Indian IFSC: 11 chars => 4 letters, 0, 6 letters/digits
export const formatIFSCInput = (value) =>
  String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 11);

export const isValidIFSCInput = (value) => {
  const ifsc = formatIFSCInput(value);
  if (!ifsc) return false;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
};

// Indian GSTIN: 15 chars (state(2) + PAN(10) + entity(1) + Z(1) + checksum(1))
export const formatGstInput = (value) =>
  String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 15);

export const isValidGstInput = (value) => {
  const gst = formatGstInput(value);
  if (!gst) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst);
};

