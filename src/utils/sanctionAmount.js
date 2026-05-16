import { formatIndianRupee } from './formatUtils';

/**
 * Resolve loan amount from a lead record (applied / requested amount).
 * @param {object} lead
 * @returns {number|null}
 */
export function getLeadLoanAmount(lead) {
  const raw = lead?.loanAmount ?? lead?.amount ?? lead?.formValues?.loanAmount ?? lead?.formValues?.amount;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {number} sanctionAmount
 * @param {number|null} loanAmount
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateSanctionAmount(sanctionAmount, loanAmount) {
  if (!Number.isFinite(sanctionAmount) || sanctionAmount <= 0) {
    return { valid: false, message: 'Enter a valid sanction amount' };
  }
  if (loanAmount != null && sanctionAmount > loanAmount) {
    return {
      valid: false,
      message: `Sanction amount cannot be greater than loan amount (${formatIndianRupee(loanAmount)})`,
    };
  }
  return { valid: true };
}
