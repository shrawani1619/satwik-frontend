import {
  LEAD_MIN_TENURE_MONTHS,
  LEAD_MAX_TENURE_MONTHS,
  parseTenureMonths,
} from './loanTenure'

export const LEAD_MIN_AGE = 21
export const LEAD_MAX_AGE = 75

export function parseMoney(v) {
  if (v === undefined || v === null || v === '') return NaN
  return Number(String(v).replace(/,/g, '').trim())
}

export function pickLeadField(lead, field, altKeys = []) {
  if (!lead) return ''
  if (lead[field] != null && lead[field] !== '') return lead[field]
  const fv = lead.formValues
  if (fv && fv[field] != null && fv[field] !== '') return fv[field]
  for (const k of altKeys) {
    if (fv && fv[k] != null && fv[k] !== '') return fv[k]
  }
  return ''
}

export function computeNetMonthlyIncome(formLike) {
  const gross = parseMoney(formLike.grossIncome)
  const deduction = parseMoney(formLike.deduction)
  if (Number.isFinite(gross) && gross > 0 && Number.isFinite(deduction) && deduction >= 0) {
    return gross - deduction
  }
  const salary = parseMoney(formLike.salary)
  if (Number.isFinite(salary) && salary > 0 && Number.isFinite(deduction) && deduction >= 0) {
    return salary - deduction
  }
  return parseMoney(formLike.monthlyIncome)
}

export function getEffectiveInterestRate(formLike) {
  const rate = parseMoney(formLike.rateOfInterest)
  if (Number.isFinite(rate) && rate > 0) return rate
  return null
}

/**
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function validateLeadIncomeFields(formLike) {
  const errors = {}

  const age = parseInt(String(formLike.applicantAge ?? '').trim(), 10)
  if (!Number.isFinite(age)) {
    errors.applicantAge = 'Applicant age is required'
  } else if (age < LEAD_MIN_AGE || age > LEAD_MAX_AGE) {
    errors.applicantAge = `Age must be between ${LEAD_MIN_AGE} and ${LEAD_MAX_AGE}`
  }

  const numericRequired = [
    { key: 'foir', label: 'FOIR', min: 1, max: 100 },
    { key: 'grossIncome', label: 'Gross income', min: 1 },
    { key: 'salary', label: 'Salary', min: 1 },
    { key: 'deduction', label: 'Deduction', min: 0 },
    { key: 'currentEmi', label: 'Current EMI', min: 0 },
    { key: 'rateOfInterest', label: 'Rate of interest', min: 0.1, max: 50 },
    {
      key: 'tenureMonths',
      label: 'Tenure (months)',
      min: LEAD_MIN_TENURE_MONTHS,
      max: LEAD_MAX_TENURE_MONTHS,
      integer: true,
    },
  ]

  for (const { key, label, min, max, integer = false } of numericRequired) {
    const raw = formLike[key]
    if (raw === '' || raw === undefined || raw === null) {
      errors[key] = `${label} is required`
      continue
    }
    const n = integer ? parseTenureMonths(raw) : parseMoney(raw)
    if (!Number.isFinite(n)) {
      errors[key] = `Enter a valid ${label.toLowerCase()}`
      continue
    }
    if (min != null && n < min) {
      errors[key] = `${label} must be at least ${min}`
    }
    if (max != null && n > max) {
      errors[key] = `${label} must be at most ${max}`
    }
  }

  const gross = parseMoney(formLike.grossIncome)
  const deduction = parseMoney(formLike.deduction)
  if (Number.isFinite(gross) && Number.isFinite(deduction) && deduction > gross) {
    errors.deduction = 'Deduction cannot exceed gross income'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

export function serializeLeadIncomeFields(formData) {
  const net = computeNetMonthlyIncome(formData)
  return {
    foir: parseMoney(formData.foir),
    grossIncome: parseMoney(formData.grossIncome),
    salary: parseMoney(formData.salary),
    deduction: parseMoney(formData.deduction),
    currentEmi: parseMoney(formData.currentEmi),
    rateOfInterest: parseMoney(formData.rateOfInterest),
    monthlyIncome: Number.isFinite(net) && net > 0 ? net : undefined,
    applicantAge: parseInt(String(formData.applicantAge).trim(), 10),
    tenureMonths: parseTenureMonths(formData.tenureMonths),
  }
}
