export const LOAN_TYPE_OPTIONS = [
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'home_loan', label: 'Home Loan' },
  { value: 'business_loan', label: 'Business Loan' },
  { value: 'loan_against_property', label: 'Loan Against Property' },
  { value: 'education_loan', label: 'Education Loan' },
  { value: 'car_loan', label: 'Car Loan' },
]

/** System default tenure when bank admin has not set one */
export const DEFAULT_TENURE_MONTHS_BY_LOAN_TYPE = {
  home_loan: 240,
  personal_loan: 60,
  business_loan: 84,
  loan_against_property: 180,
  education_loan: 120,
  car_loan: 60,
}

export const LEAD_MIN_TENURE_MONTHS = 1
export const LEAD_MAX_TENURE_MONTHS = 480

export function getDefaultTenureForLoanType(loanType) {
  if (!loanType) return null
  return DEFAULT_TENURE_MONTHS_BY_LOAN_TYPE[loanType] ?? 120
}

export function getBankTenureMonths(banks, bankId, loanType) {
  if (!bankId || !loanType || !Array.isArray(banks)) return null
  const bank = banks.find((b) => String(b._id || b.id) === String(bankId))
  const map = bank?.loanTenureMonths
  if (map && map[loanType] != null && map[loanType] !== '') {
    const n = Number(map[loanType])
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return getDefaultTenureForLoanType(loanType)
}

export function parseTenureMonths(v) {
  if (v === undefined || v === null || v === '') return NaN
  return parseInt(String(v).replace(/,/g, '').trim(), 10)
}

/** Resolved tenure for EMI / eligibility (form value → loan-type default). */
export function getLeadTenureMonths(formLike) {
  const fromForm = parseTenureMonths(formLike?.tenureMonths)
  if (Number.isFinite(fromForm) && fromForm >= LEAD_MIN_TENURE_MONTHS) {
    return Math.min(fromForm, LEAD_MAX_TENURE_MONTHS)
  }
  return getDefaultTenureForLoanType(formLike?.loanType) ?? 120
}
