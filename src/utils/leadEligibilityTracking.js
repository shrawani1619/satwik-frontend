import {
  LEAD_MIN_AGE,
  LEAD_MAX_AGE,
  computeNetMonthlyIncome,
  getEffectiveInterestRate,
  parseMoney,
} from './leadIncomeFields'
import { getLeadTenureMonths } from './loanTenure'

const ELIGIBILITY_MIN_CIBIL = 650
const ELIGIBILITY_ASSUMED_RATE_PCT = 10.5
const ELIGIBILITY_MAX_EMI_INCOME_RATIO = 0.5

function estimateEmi(principal, annualRatePct, tenureMonths) {
  const P = parseMoney(principal)
  const n = Number(tenureMonths)
  const rPer = annualRatePct / 12 / 100
  if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(n) || n <= 0) return null
  if (rPer <= 0) return P / n
  const x = (1 + rPer) ** n
  return (P * rPer * x) / (x - 1)
}

function getFoirLimitPct(formLike) {
  const foir = parseMoney(formLike?.foir)
  if (Number.isFinite(foir) && foir > 0) return foir
  return ELIGIBILITY_MAX_EMI_INCOME_RATIO * 100
}

function safeStr(v) {
  if (v === undefined || v === null) return ''
  return String(v)
}

function digitsOnly(v) {
  return safeStr(v).replace(/\D/g, '')
}

function isAdvancePaymentYes(formLike) {
  return formLike?.advancePayment === true || safeStr(formLike?.advancePayment).toLowerCase() === 'true'
}

/**
 * Field validation rules (structured errors).
 * Does not replace income/FOIR calculation validators.
 * @returns {{ field: string, message: string }[]}
 */
export function buildLeadEligibilityValidationErrors(formLike = {}) {
  const errors = []
  const data = formLike ?? {}

  const mobile = digitsOnly(data.applicantMobile)
  if (!mobile) {
    errors.push({ field: 'applicantMobile', message: 'Mobile number is required' })
  } else if (mobile.length !== 10) {
    errors.push({ field: 'applicantMobile', message: 'Mobile number must contain exactly 10 digits' })
  }

  const aadharRaw = safeStr(data.aadhar).trim()
  if (aadharRaw !== '') {
    const aadhar = digitsOnly(aadharRaw)
    if (aadhar.length !== 12) {
      errors.push({ field: 'aadhar', message: 'Aadhaar number must contain exactly 12 digits' })
    }
  }

  const ageStr = safeStr(data.applicantAge).trim()
  const age = ageStr !== '' ? parseInt(ageStr, 10) : NaN
  if (!Number.isFinite(age)) {
    errors.push({ field: 'applicantAge', message: 'Applicant age is required' })
  } else if (age < LEAD_MIN_AGE || age > LEAD_MAX_AGE) {
    errors.push({
      field: 'applicantAge',
      message: `Applicant age must be between ${LEAD_MIN_AGE} and ${LEAD_MAX_AGE}`,
    })
  }

  const loanAmount = parseMoney(data.loanAmount)
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
    errors.push({ field: 'loanAmount', message: 'Loan amount must be greater than 0' })
  }

  const grossIncome = parseMoney(data.grossIncome)
  if (!Number.isFinite(grossIncome) || grossIncome <= 0) {
    errors.push({ field: 'grossIncome', message: 'Gross income must be greater than 0' })
  }

  const tenureMonths = getLeadTenureMonths(data)
  if (!Number.isFinite(tenureMonths) || tenureMonths <= 0) {
    errors.push({ field: 'tenureMonths', message: 'Tenure must be greater than 0 months' })
  }

  const rateRaw = data.rateOfInterest
  if (rateRaw === '' || rateRaw === undefined || rateRaw === null) {
    errors.push({ field: 'rateOfInterest', message: 'Rate of interest is required' })
  } else {
    const rate = parseMoney(rateRaw)
    if (!Number.isFinite(rate) || rate < 0) {
      errors.push({ field: 'rateOfInterest', message: 'Rate of interest must be greater than or equal to 0' })
    }
  }

  if (isAdvancePaymentYes(data)) {
    const disbursed = parseMoney(data.disbursedAmount)
    if (!Number.isFinite(disbursed) || disbursed <= 0) {
      errors.push({
        field: 'disbursedAmount',
        message: 'Disbursed amount is required when advance payment is Yes',
      })
    }
  }

  return errors
}

function findSnapshotCheckOk(snapshotChecks, id) {
  if (!Array.isArray(snapshotChecks)) return false
  const item = snapshotChecks.find((c) => c && c.id === id)
  return Boolean(item?.ok)
}

function isRequiredFieldsCompleted(formLike = {}) {
  const requiredKeys = [
    'bank',
    'loanType',
    'customerName',
    'applicantMobile',
    'applicantAge',
    'loanAmount',
    'grossIncome',
    'foir',
    'salary',
    'deduction',
    'currentEmi',
    'rateOfInterest',
    'tenureMonths',
  ]
  return requiredKeys.every((key) => {
    const v = formLike?.[key]
    if (v === undefined || v === null) return false
    if (typeof v === 'string' && v.trim() === '') return false
    return true
  })
}

function isAgeValid(formLike = {}) {
  const age = parseInt(safeStr(formLike.applicantAge).trim(), 10)
  return Number.isFinite(age) && age >= LEAD_MIN_AGE && age <= LEAD_MAX_AGE
}

function isMobileValid(formLike = {}) {
  return /^[0-9]{10}$/.test(digitsOnly(formLike.applicantMobile))
}

function isIncomeValid(formLike = {}) {
  const gross = parseMoney(formLike.grossIncome)
  return Number.isFinite(gross) && gross > 0
}

function isLoanAmountValid(formLike = {}) {
  const loan = parseMoney(formLike.loanAmount)
  return Number.isFinite(loan) && loan > 0
}

/** Uses existing EMI/FOIR helpers — does not change calculation logic. */
function isFoirPassed(formLike = {}) {
  const netIncome = computeNetMonthlyIncome(formLike)
  const loanAmt = parseMoney(formLike.loanAmount)
  if (!Number.isFinite(netIncome) || netIncome <= 0 || !Number.isFinite(loanAmt) || loanAmt <= 0) {
    return false
  }
  const tenure = getLeadTenureMonths(formLike)
  const rate = getEffectiveInterestRate(formLike) ?? 10.5
  const foirPct = getFoirLimitPct(formLike)
  const newEmi = estimateEmi(loanAmt, rate, tenure)
  const currentEmi = parseMoney(formLike.currentEmi)
  const totalEmi =
    newEmi != null && Number.isFinite(currentEmi) ? currentEmi + newEmi : newEmi
  const ratio = totalEmi != null && netIncome > 0 ? totalEmi / netIncome : Infinity
  return Number.isFinite(ratio) && ratio * 100 <= foirPct
}

function isCibilPassed(formLike = {}) {
  const cibilStr = safeStr(formLike.cibil).trim()
  if (cibilStr === '') return true
  const cibil = parseInt(cibilStr, 10)
  return Number.isFinite(cibil) && cibil >= ELIGIBILITY_MIN_CIBIL
}

function isAdvancePaymentValid(formLike = {}) {
  if (!isAdvancePaymentYes(formLike)) return true
  const disbursed = parseMoney(formLike.disbursedAmount)
  return Number.isFinite(disbursed) && disbursed > 0
}

/**
 * Dynamic eligibility checklist.
 * @param {object} formLike
 * @param {object[]} [snapshotChecks] — optional checks from computeLeadEligibilitySnapshot
 * @returns {{ label: string, status: boolean, required: boolean }[]}
 */
export function buildLeadEligibilityChecklist(formLike = {}, snapshotChecks = []) {
  const data = formLike ?? {}
  const foirFromSnapshot = findSnapshotCheckOk(snapshotChecks, 'foirCheck')
  const foirStatus = snapshotChecks.length > 0 ? foirFromSnapshot : isFoirPassed(data)

  const cibilStr = safeStr(data.cibil).trim()
  const cibilFromSnapshot =
    cibilStr !== '' ? findSnapshotCheckOk(snapshotChecks, 'cibil') : isCibilPassed(data)

  return [
    {
      label: 'Required fields completed',
      status: isRequiredFieldsCompleted(data),
      required: true,
    },
    {
      label: 'Age validation',
      status: isAgeValid(data),
      required: true,
    },
    {
      label: 'Mobile validation',
      status: isMobileValid(data),
      required: true,
    },
    {
      label: 'Income validation',
      status: isIncomeValid(data),
      required: true,
    },
    {
      label: 'Loan amount validation',
      status: isLoanAmountValid(data),
      required: true,
    },
    {
      label: 'Bank selected',
      status: Boolean(data.bank),
      required: true,
    },
    {
      label: 'Loan type selected',
      status: Boolean(data.loanType),
      required: true,
    },
    {
      label: 'FOIR passed',
      status: foirStatus,
      required: true,
    },
    {
      label: 'CIBIL passed',
      status: cibilFromSnapshot,
      required: false,
    },
    {
      label: 'Advance payment validation',
      status: isAdvancePaymentValid(data),
      required: false,
    },
  ]
}

export function computeEligibilityPercentFromChecklist(checklist = []) {
  const list = Array.isArray(checklist) ? checklist : []
  if (list.length === 0) return 0
  const passed = list.filter((item) => item?.status === true).length
  return Math.round((passed / list.length) * 100)
}

export function computeRequiredPassedFromChecklist(checklist = []) {
  const list = Array.isArray(checklist) ? checklist : []
  const requiredItems = list.filter((item) => item?.required === true)
  if (requiredItems.length === 0) return false
  return requiredItems.every((item) => item?.status === true)
}

/**
 * Appends tracking fields to an existing eligibility snapshot.
 * Does not modify calculation outputs (amountInsight, checks, passed, total, percent).
 */
export function appendLeadEligibilityTracking(formLike = {}, snapshot = {}) {
  const validationErrors = buildLeadEligibilityValidationErrors(formLike)
  const checklist = buildLeadEligibilityChecklist(formLike, snapshot.checks ?? [])
  const eligibilityPercent = computeEligibilityPercentFromChecklist(checklist)
  const requiredPassed = computeRequiredPassedFromChecklist(checklist)

  return {
    validationErrors,
    checklist,
    eligibilityPercent,
    requiredPassed,
  }
}

/**
 * @returns {Record<string, string>}
 */
export function validationErrorsToFieldMap(validationErrors = []) {
  const map = {}
  for (const err of validationErrors) {
    if (err?.field && err?.message && map[err.field] == null) {
      map[err.field] = err.message
    }
  }
  return map
}
