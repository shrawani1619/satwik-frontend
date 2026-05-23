/** Tentative charges — MOD 0.3% of loan amount + fixed fees (see sanction letter processing fee). */
export const PROCESSING_FEE_MOD_RATE_PERCENT = 0.3
export const PROCESSING_FEE_FIXED_NOI = 15000
export const PROCESSING_FEE_FIXED_LEGAL_TECHNICAL = 4130
export const PROCESSING_FEE_FIXED_STAMP_PAPER = 6320
export const PROCESSING_FEE_FIXED_ADVOCATE = 2000

export const PROCESSING_FEE_FIXED_TOTAL =
  PROCESSING_FEE_FIXED_NOI +
  PROCESSING_FEE_FIXED_LEGAL_TECHNICAL +
  PROCESSING_FEE_FIXED_STAMP_PAPER +
  PROCESSING_FEE_FIXED_ADVOCATE

function parsePrincipal(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * MOD (0.3% × loan amount) + NOI + Legal & Technical + Stamp paper + Advocate.
 * @param {number|string} loanAmount
 * @returns {number|null} Total processing fee (rounded to nearest rupee)
 */
export function computeProcessingFeeFromLoanAmount(loanAmount) {
  const principal = parsePrincipal(loanAmount)
  if (principal == null) return null
  const mod = (principal * PROCESSING_FEE_MOD_RATE_PERCENT) / 100
  const total = mod + PROCESSING_FEE_FIXED_TOTAL
  return Math.round(total)
}

export function computeProcessingFeeBreakdown(loanAmount) {
  const principal = parsePrincipal(loanAmount)
  if (principal == null) return null
  const mod = Math.round((principal * PROCESSING_FEE_MOD_RATE_PERCENT) / 100)
  return {
    loanAmount: principal,
    mod,
    noi: PROCESSING_FEE_FIXED_NOI,
    legalTechnical: PROCESSING_FEE_FIXED_LEGAL_TECHNICAL,
    stampPaper: PROCESSING_FEE_FIXED_STAMP_PAPER,
    advocate: PROCESSING_FEE_FIXED_ADVOCATE,
    total: mod + PROCESSING_FEE_FIXED_TOTAL,
  }
}
