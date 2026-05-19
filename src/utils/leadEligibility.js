import {
  LEAD_MIN_AGE,
  LEAD_MAX_AGE,
  computeNetMonthlyIncome,
  getEffectiveInterestRate,
  parseMoney,
} from './leadIncomeFields'
import { getLeadTenureMonths, LEAD_MIN_TENURE_MONTHS, LEAD_MAX_TENURE_MONTHS, parseTenureMonths } from './loanTenure'
import { appendLeadEligibilityTracking } from './leadEligibilityTracking'

/** Assumed rate for rough EMI when rate not entered (eligibility hint only). */
export const ELIGIBILITY_ASSUMED_RATE_PCT = 10.5

/** Typical minimum CIBIL for preliminary check */
export const ELIGIBILITY_MIN_CIBIL = 650

/** Default max share of income toward EMI when FOIR field empty */
export const ELIGIBILITY_MAX_EMI_INCOME_RATIO = 0.5

export { LEAD_MIN_AGE, LEAD_MAX_AGE }

export { getLeadTenureMonths, LEAD_MIN_TENURE_MONTHS, LEAD_MAX_TENURE_MONTHS } from './loanTenure'

function parseNum(v) {
  return parseMoney(v)
}

export function estimateEmi(principal, annualRatePct, tenureMonths) {
  const P = parseNum(principal)
  const n = Number(tenureMonths)
  const rPer = annualRatePct / 12 / 100
  if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(n) || n <= 0) return null
  if (rPer <= 0) return P / n
  const x = (1 + rPer) ** n
  return (P * rPer * x) / (x - 1)
}

/** Max principal for given EMI, rate, tenure (inverse of estimateEmi). */
export function maxPrincipalFromEmi(emi, annualRatePct, tenureMonths) {
  const E = parseNum(emi)
  const n = Number(tenureMonths)
  const rPer = annualRatePct / 12 / 100
  if (!Number.isFinite(E) || E <= 0 || !Number.isFinite(n) || n <= 0) return null
  if (rPer <= 0) return E * n
  const x = (1 + rPer) ** n
  return (E * (x - 1)) / (rPer * x)
}

function cibilEligibilityFactor(cibil) {
  if (!Number.isFinite(cibil)) return { mult: 1, label: null }
  if (cibil >= 750) return { mult: 1, label: null }
  if (cibil >= 700) return { mult: 0.95, label: 'CIBIL 700–749: ~95% of income-based max applied' }
  if (cibil >= ELIGIBILITY_MIN_CIBIL)
    return { mult: 0.85, label: `CIBIL ${ELIGIBILITY_MIN_CIBIL}–699: ~85% of income-based max applied` }
  return {
    mult: 0.7,
    label: `CIBIL below ${ELIGIBILITY_MIN_CIBIL}: indicative max reduced (~70%); bank may decline`,
  }
}

function getFoirLimitPct(formLike) {
  const foir = parseNum(formLike.foir)
  if (Number.isFinite(foir) && foir > 0) return foir
  return ELIGIBILITY_MAX_EMI_INCOME_RATIO * 100
}

/**
 * @returns {number|null} raw max loan before rounding
 */
export function computeMaxEligibleLoanFromIncome(formLike) {
  const income = computeNetMonthlyIncome(formLike)
  if (!Number.isFinite(income) || income <= 0) return null

  const tenure = getLeadTenureMonths(formLike)

  const foirPct = getFoirLimitPct(formLike)
  const maxTotalEmi = income * (foirPct / 100)
  const currentEmi = parseNum(formLike.currentEmi)
  const availableEmi =
    Number.isFinite(currentEmi) && currentEmi >= 0 ? maxTotalEmi - currentEmi : maxTotalEmi
  if (!Number.isFinite(availableEmi) || availableEmi <= 0) return null

  const rate = getEffectiveInterestRate(formLike) ?? ELIGIBILITY_ASSUMED_RATE_PCT
  let raw = maxPrincipalFromEmi(availableEmi, rate, tenure)
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null

  const cibilStr = formLike.cibil != null && formLike.cibil !== '' ? String(formLike.cibil).trim() : ''
  const cibil = cibilStr !== '' ? parseInt(cibilStr, 10) : NaN
  const { mult } = cibilEligibilityFactor(cibil)
  raw *= mult

  return Math.round(raw / 1000) * 1000
}

export function formatEligibleRupee(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/**
 * Plain-language message when FOIR / EMI limit check fails on submit.
 */
export function formatFoirFailureMessage(formLike = {}) {
  const netIncome = computeNetMonthlyIncome(formLike)
  const foirLimit = getFoirLimitPct(formLike)
  const loanAmt = parseNum(formLike.loanAmount)
  const tenure = getLeadTenureMonths(formLike)
  const rate = getEffectiveInterestRate(formLike) ?? ELIGIBILITY_ASSUMED_RATE_PCT
  const newEmi = estimateEmi(loanAmt, rate, tenure) ?? 0
  const currentEmi = parseNum(formLike.currentEmi) || 0
  const totalEmi = newEmi + currentEmi

  if (!Number.isFinite(netIncome) || netIncome <= 0) {
    return 'Please enter gross income and deductions to check FOIR.'
  }

  const actualPct = Math.round((totalEmi / netIncome) * 100)
  const foirEntered = parseNum(formLike.foir)
  const maxAllowedEmi = netIncome * (foirLimit / 100)
  let limitHint = ''
  if (Number.isFinite(foirEntered) && foirEntered > 60) {
    limitHint = ' Use FOIR limit 50% (bank standard), not 90.'
  } else if (Number.isFinite(foirEntered) && foirEntered < 40) {
    limitHint =
      ` You entered ${foirEntered}% — that makes the rule stricter. Use 50% (bank limit). Max EMI at ${foirEntered}% would be only ${formatEligibleRupee(maxAllowedEmi)}/mo.`
  }

  return (
    `Total monthly EMIs (${formatEligibleRupee(totalEmi)}) are ${actualPct}% of net income ` +
    `(${formatEligibleRupee(netIncome)}). Your FOIR limit is ${foirLimit}% ` +
    `(max EMI ${formatEligibleRupee(maxAllowedEmi)}/mo). Reduce loan amount or current EMI.${limitHint}`
  )
}

/** Console debug for FOIR — open browser DevTools → Console when saving a lead. */
export function logFoirEligibilityDebug(formLike = {}, snapshot = null) {
  const netIncome = computeNetMonthlyIncome(formLike)
  const foirLimit = getFoirLimitPct(formLike)
  const loanAmt = parseNum(formLike.loanAmount)
  const tenure = getLeadTenureMonths(formLike)
  const rate = getEffectiveInterestRate(formLike) ?? ELIGIBILITY_ASSUMED_RATE_PCT
  const newEmi = estimateEmi(loanAmt, rate, tenure) ?? 0
  const currentEmi = parseNum(formLike.currentEmi) || 0
  const totalEmi = newEmi + currentEmi
  const actualPct = netIncome > 0 ? (totalEmi / netIncome) * 100 : NaN
  const maxAllowedEmi = netIncome > 0 ? netIncome * (foirLimit / 100) : 0
  const passed = Number.isFinite(actualPct) && actualPct <= foirLimit

  console.group('[Lead FOIR eligibility]')
  console.log('Inputs:', {
    foirLimitEntered: formLike.foir,
    grossIncome: formLike.grossIncome,
    salary: formLike.salary,
    deduction: formLike.deduction,
    currentEmi: formLike.currentEmi,
    loanAmount: formLike.loanAmount,
    tenureMonths: formLike.tenureMonths,
    rateOfInterest: formLike.rateOfInterest,
  })
  console.log('Calculated:', {
    netMonthlyIncome: Math.round(netIncome),
    estimatedNewLoanEmi: Math.round(newEmi),
    totalMonthlyEmi: Math.round(totalEmi),
    actualFoirPercent: `${Math.round(actualPct * 10) / 10}%`,
    foirLimitPercent: `${foirLimit}%`,
    maxEmiAllowedAtThisLimit: Math.round(maxAllowedEmi),
    foirCheckPassed: passed,
    formula: '(current EMI + new loan EMI) ÷ net income × 100 ≤ FOIR limit %',
  })
  if (snapshot?.checks) {
    console.log(
      'Snapshot foir check:',
      snapshot.checks.find((c) => c.id === 'foirCheck')
    )
  }
  if (!passed) {
    console.warn(
      `[Lead FOIR] FAILED: ${Math.round(actualPct)}% > ${foirLimit}% limit. ` +
        `Need total EMI ≤ ${Math.round(maxAllowedEmi)} but have ${Math.round(totalEmi)}.`
    )
  }
  console.groupEnd()

  return { netIncome, foirLimit, totalEmi, actualPct, maxAllowedEmi, passed }
}

/** User-friendly toast when eligibility checklist blocks submit. */
export function formatEligibilitySubmitError(formLike = {}, snapshot = {}) {
  const checklist = snapshot.checklist ?? []
  const failed = checklist.find((item) => item.required && !item.status)
  if (!failed) {
    return 'Please complete all required eligibility checks.'
  }

  if (failed.label === 'FOIR passed' || failed.label === 'EMI within FOIR limit') {
    return formatFoirFailureMessage(formLike)
  }

  const messages = {
    'Required fields completed': 'Please fill all required fields before saving.',
    'Age validation': 'Applicant age must be between 21 and 75 years.',
    'Mobile validation': 'Enter a valid 10-digit mobile number.',
    'Income validation': 'Gross income must be greater than zero.',
    'Loan amount validation': 'Loan amount must be greater than zero.',
    'Bank selected': 'Please select a bank.',
    'Loan type selected': 'Please select a loan type.',
    'Advance payment validation':
      'Enter disbursed amount when advance payment is Yes.',
  }

  return messages[failed.label] || `Please fix: ${failed.label}.`
}

/**
 * Live eligibility snapshot for lead create/edit form.
 */
export function computeLeadEligibilitySnapshot(formLike) {
  const checks = []

  checks.push({
    id: 'bank',
    label: 'Bank selected',
    ok: Boolean(formLike.bank),
    required: true,
  })

  checks.push({
    id: 'loanType',
    label: 'Loan type selected',
    ok: Boolean(formLike.loanType),
    required: true,
  })

  const loanAmt = parseNum(formLike.loanAmount)
  checks.push({
    id: 'loanAmount',
    label: 'Loan amount entered',
    ok: Number.isFinite(loanAmt) && loanAmt > 0,
    required: true,
  })

  const name = String(formLike.customerName || '').trim()
  checks.push({
    id: 'customerName',
    label: 'Customer name',
    ok: name.length > 0,
    required: true,
  })

  const mobile = String(formLike.applicantMobile || '').replace(/\D/g, '')
  checks.push({
    id: 'mobile',
    label: 'Valid 10-digit mobile',
    ok: /^[0-9]{10}$/.test(mobile),
    required: true,
  })

  const ageStr =
    formLike.applicantAge != null && formLike.applicantAge !== '' ? String(formLike.applicantAge).trim() : ''
  const age = ageStr !== '' ? parseInt(ageStr, 10) : NaN
  checks.push({
    id: 'age',
    label: `Age ${LEAD_MIN_AGE}–${LEAD_MAX_AGE}`,
    ok: Number.isFinite(age) && age >= LEAD_MIN_AGE && age <= LEAD_MAX_AGE,
    required: true,
  })

  const requiredIncomeFields = [
    { key: 'foir', label: 'FOIR (%)' },
    { key: 'grossIncome', label: 'Gross income' },
    { key: 'salary', label: 'Salary' },
    { key: 'deduction', label: 'Deduction' },
    { key: 'currentEmi', label: 'Current EMI' },
    { key: 'rateOfInterest', label: 'Rate of interest' },
    { key: 'tenureMonths', label: 'Tenure (months)' },
  ]
  for (const { key, label } of requiredIncomeFields) {
    const n = key === 'tenureMonths' ? parseTenureMonths(formLike[key]) : parseNum(formLike[key])
    const ok =
      key === 'tenureMonths'
        ? Number.isFinite(n) && n >= LEAD_MIN_TENURE_MONTHS && n <= LEAD_MAX_TENURE_MONTHS
        : Number.isFinite(n) && n >= 0 && (key !== 'foir' || n > 0)
    checks.push({
      id: key,
      label: `${label} entered`,
      ok,
      required: true,
    })
  }

  const cibilStr = formLike.cibil != null && formLike.cibil !== '' ? String(formLike.cibil).trim() : ''
  if (cibilStr !== '') {
    const cibil = parseInt(cibilStr, 10)
    const ok = Number.isFinite(cibil) && cibil >= ELIGIBILITY_MIN_CIBIL
    checks.push({
      id: 'cibil',
      label: `CIBIL / score ≥ ${ELIGIBILITY_MIN_CIBIL}`,
      ok,
      required: false,
    })
  }

  const netIncome = computeNetMonthlyIncome(formLike)
  const foirPct = getFoirLimitPct(formLike)
  const tenure = getLeadTenureMonths(formLike)
  const rate = getEffectiveInterestRate(formLike) ?? ELIGIBILITY_ASSUMED_RATE_PCT

  if (Number.isFinite(netIncome) && netIncome > 0 && Number.isFinite(loanAmt) && loanAmt > 0) {
    const newEmi = estimateEmi(loanAmt, rate, tenure)
    const currentEmi = parseNum(formLike.currentEmi)
    const totalEmi =
      newEmi != null && Number.isFinite(currentEmi) ? currentEmi + newEmi : newEmi
    const ratio = totalEmi != null && netIncome > 0 ? totalEmi / netIncome : Infinity
    const ok = Number.isFinite(ratio) && ratio * 100 <= foirPct
    const actualFoirPct =
      totalEmi != null && netIncome > 0 ? Math.round((totalEmi / netIncome) * 100) : null
    checks.push({
      id: 'foirCheck',
      label: `EMI within FOIR limit (max ${foirPct}%)`,
      ok,
      required: true,
      detail:
        actualFoirPct != null
          ? `Net income ${formatEligibleRupee(netIncome)}/mo · EMIs ${formatEligibleRupee(totalEmi)}/mo (${actualFoirPct}% of income)`
          : undefined,
    })
  }

  const passed = checks.filter((c) => c.ok).length
  const total = checks.length
  const requiredChecks = checks.filter((c) => c.required)
  const requiredPassed = requiredChecks.length > 0 && requiredChecks.every((c) => c.ok)

  const maxEligible = computeMaxEligibleLoanFromIncome(formLike)

  const cibilAdjLabel =
    cibilStr !== '' ? cibilEligibilityFactor(parseInt(cibilStr, 10)).label : null

  let amountInsight = {
    maxEligible: maxEligible,
    maxEligibleDisplay: maxEligible != null ? formatEligibleRupee(maxEligible) : null,
    requested: Number.isFinite(loanAmt) && loanAmt > 0 ? loanAmt : null,
    requestedDisplay:
      Number.isFinite(loanAmt) && loanAmt > 0 ? formatEligibleRupee(loanAmt) : null,
    withinMax: null,
    gap: null,
    gapDisplay: null,
    headline: null,
    subline: null,
    cibilNote: cibilAdjLabel,
    tenureUsed: tenure,
  }

  if (!Number.isFinite(netIncome) || netIncome <= 0) {
    amountInsight.headline = 'Enter gross income and deduction to see approximate max loan'
    amountInsight.subline = `Uses FOIR ${foirPct}%, ${rate}% p.a., ${tenure} month tenure.`
  } else if (maxEligible == null) {
    amountInsight.headline = 'Could not estimate loan from income'
    amountInsight.subline = 'Check FOIR limit and current EMI leave room for a new loan.'
  } else {
    amountInsight.headline = 'Approx. max loan (income-based)'
    if (amountInsight.requested != null) {
      amountInsight.withinMax = amountInsight.requested <= maxEligible
      amountInsight.gap = amountInsight.requested - maxEligible
      if (amountInsight.withinMax) {
        amountInsight.subline = `Requested ${amountInsight.requestedDisplay} fits within this indicative limit.`
      } else {
        amountInsight.gapDisplay = formatEligibleRupee(Math.abs(amountInsight.gap))
        amountInsight.subline = `Requested ${amountInsight.requestedDisplay} is about ${amountInsight.gapDisplay} above this indicative limit.`
      }
    } else {
      amountInsight.subline = `Enter loan amount above to compare with ${amountInsight.maxEligibleDisplay}.`
    }
  }

  const baseSnapshot = {
    checks,
    passed,
    total,
    requiredPassed,
    percent: total ? Math.round((passed / total) * 100) : 0,
    amountInsight,
  }

  return {
    ...baseSnapshot,
    ...appendLeadEligibilityTracking(formLike, baseSnapshot),
  }
}
