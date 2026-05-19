import {
  LEAD_MIN_AGE,
  LEAD_MAX_AGE,
  computeNetMonthlyIncome,
  getEffectiveInterestRate,
  parseMoney,
} from './leadIncomeFields'
import { getLeadTenureMonths, LEAD_MIN_TENURE_MONTHS, LEAD_MAX_TENURE_MONTHS, parseTenureMonths } from './loanTenure'
import { appendLeadEligibilityTracking } from './leadEligibilityTracking'
import {
  calculateEligibilityFromForm,
  calculateEmi,
  computeMaxTenureByAge,
  MAX_AGE_AT_LOAN_END,
  MAX_TENURE_MONTHS_ELIGIBILITY,
} from './loanEligibilityCalculations'

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
  if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(n) || n <= 0) return null
  const emi = calculateEmi(P, annualRatePct, n)
  return emi > 0 ? emi : null
}

export { calculateEmi, calculateEligibilityFromForm, computeMaxTenureByAge, MAX_AGE_AT_LOAN_END, MAX_TENURE_MONTHS_ELIGIBILITY }

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
  const calc = calculateEligibilityFromForm(formLike, getFoirLimitPct(formLike))
  if (!calc.totalGrossSalary || calc.eligibleEmiPerMonth <= 0) return null

  let raw = calc.maxLoanFromEligibleEmi
  if (!raw || !Number.isFinite(raw) || raw <= 0) return null

  const cibilStr = formLike.cibil != null && formLike.cibil !== '' ? String(formLike.cibil).trim() : ''
  const cibil = cibilStr !== '' ? parseInt(cibilStr, 10) : NaN
  const { mult } = cibilEligibilityFactor(cibil)
  raw = Math.round((raw * mult) / 1000) * 1000

  return raw > 0 ? raw : null
}

export function formatEligibleRupee(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function buildCalculationBreakdown(formLike, calc) {
  const missing = []
  const gross = parseNum(formLike.grossIncome) || parseNum(formLike.salary)
  if (!gross) missing.push('gross income')
  if (!parseNum(formLike.foir)) missing.push('FOIR (%)')
  if (!Number.isFinite(parseNum(formLike.currentEmi))) missing.push('current EMI')
  if (!parseTenureMonths(formLike.tenureMonths)) missing.push('tenure (months)')
  if (!getEffectiveInterestRate(formLike)) missing.push('rate of interest')
  if (!parseNum(formLike.loanAmount)) missing.push('loan amount')
  if (!parseInt(String(formLike.applicantAge ?? '').trim(), 10)) missing.push('applicant age')

  if (missing.length > 0) {
    return { ready: false, missing }
  }

  if (!calc?.totalGrossSalary) {
    return { ready: false, missing: ['gross income'] }
  }

  const steps = [
    {
      id: 'gross',
      title: 'Total gross monthly income',
      formula: 'Applicant gross + Co-applicant gross',
      calculation: `${formatEligibleRupee(calc.applicantGross)} + ${formatEligibleRupee(calc.coApplicantGross)}`,
      result: formatEligibleRupee(calc.totalGrossSalary),
    },
    {
      id: 'foirMax',
      title: 'Max EMI at FOIR limit',
      formula: 'Gross income × FOIR% (on gross, before deductions)',
      calculation: `${formatEligibleRupee(calc.totalGrossSalary)} × ${calc.foir}%`,
      result: formatEligibleRupee(calc.foirAmount),
    },
    {
      id: 'totalCurrent',
      title: 'Total current EMI (incl. salary deduction)',
      formula: 'Current loan EMI + Salary deduction',
      calculation: `${formatEligibleRupee(calc.currentEmi)} + ${formatEligibleRupee(calc.salaryDeduction)}`,
      result: formatEligibleRupee(calc.totalCurrentEmi),
    },
    {
      id: 'eligibleEmi',
      title: 'Eligible EMI (for new loan)',
      formula: 'Max EMI at FOIR − Total current EMI',
      calculation: `${formatEligibleRupee(calc.foirAmount)} − ${formatEligibleRupee(calc.totalCurrentEmi)}`,
      result: formatEligibleRupee(calc.eligibleEmiPerMonth),
    },
    {
      id: 'tenure',
      title: 'Eligible tenure (age cap)',
      formula: `min(${MAX_TENURE_MONTHS_ELIGIBILITY} mo, (${MAX_AGE_AT_LOAN_END} − age) × 12)`,
      calculation: `Requested ${calc.requestedTenure} mo · max allowed ${calc.maxAllowedTenure} mo`,
      result: `${calc.finalTenure} months`,
    },
    {
      id: 'newEmi',
      title: 'New loan EMI',
      formula: 'P × R × (1+R)^N / [(1+R)^N − 1]',
      calculation: `P = ${formatEligibleRupee(parseNum(formLike.loanAmount))}, ${calc.finalTenure} mo @ ${getEffectiveInterestRate(formLike)}%`,
      result: `${formatEligibleRupee(calc.loanEmiPerMonth)}/mo`,
    },
    {
      id: 'foirCheck',
      title: 'FOIR / eligibility check',
      formula: 'Eligible EMI − New loan EMI (≥ 0 to pass)',
      calculation: `${formatEligibleRupee(calc.eligibleEmiPerMonth)} − ${formatEligibleRupee(calc.loanEmiPerMonth)}`,
      result: `${formatEligibleRupee(calc.emiGap)} gap · ${Math.round(calc.actualFoirPct * 10) / 10}% of gross`,
      passed: calc.isEligible,
    },
    {
      id: 'maxLoan',
      title: 'Max eligible loan (approx.)',
      formula: 'Principal from eligible EMI (reducing balance)',
      calculation: `EMI ${formatEligibleRupee(calc.eligibleEmiPerMonth)}/mo · ${calc.finalTenure} mo · ${getEffectiveInterestRate(formLike)}%`,
      result: formatEligibleRupee(calc.maxLoanFromEligibleEmi),
    },
  ]

  return { ready: true, steps, calc }
}

/**
 * Plain-language message when FOIR / EMI limit check fails on submit.
 */
export function formatFoirFailureMessage(formLike = {}) {
  const calc = calculateEligibilityFromForm(formLike, getFoirLimitPct(formLike))

  if (!calc.totalGrossSalary) {
    return 'Please enter gross income to check FOIR (calculated on gross salary).'
  }

  const foirEntered = parseNum(formLike.foir)
  let limitHint = ''
  if (Number.isFinite(foirEntered) && foirEntered > 60) {
    limitHint = ' Use FOIR limit 50% (bank standard), not 90.'
  }

  return (
    `New loan EMI (${formatEligibleRupee(calc.loanEmiPerMonth)}) exceeds eligible EMI ` +
    `(${formatEligibleRupee(calc.eligibleEmiPerMonth)}). ` +
    `Total EMIs are ${Math.round(calc.actualFoirPct * 10) / 10}% of gross ` +
    `(${formatEligibleRupee(calc.totalGrossSalary)}); FOIR limit is ${calc.foir}%. ` +
    `Reduce loan amount or tenure.${limitHint}`
  )
}

/** Console debug for FOIR — open browser DevTools → Console when saving a lead. */
export function logFoirEligibilityDebug(formLike = {}, snapshot = null) {
  const calc = calculateEligibilityFromForm(formLike, getFoirLimitPct(formLike))
  const passed = calc.isEligible

  console.group('[Lead FOIR eligibility]')
  console.log('Inputs:', {
    foirLimitEntered: formLike.foir,
    grossIncome: formLike.grossIncome,
    coApplicantGross: formLike.coApplicantGross,
    deduction: formLike.deduction,
    currentEmi: formLike.currentEmi,
    loanAmount: formLike.loanAmount,
    tenureMonths: formLike.tenureMonths,
    rateOfInterest: formLike.rateOfInterest,
    applicantAge: formLike.applicantAge,
  })
  console.log('Calculated:', {
    totalGrossSalary: Math.round(calc.totalGrossSalary),
    maxEmiAtFoir: Math.round(calc.foirAmount),
    eligibleEmiPerMonth: Math.round(calc.eligibleEmiPerMonth),
    newLoanEmi: Math.round(calc.loanEmiPerMonth),
    emiGap: Math.round(calc.emiGap),
    finalTenureMonths: calc.finalTenure,
    actualFoirPercent: `${Math.round(calc.actualFoirPct * 10) / 10}%`,
    foirLimitPercent: `${calc.foir}%`,
    isEligible: calc.isEligible,
    formula:
      'FOIR on gross; eligible EMI = gross×FOIR% − (current EMI + salary deduction); pass if new EMI ≤ eligible EMI',
  })
  if (snapshot?.checks) {
    console.log(
      'Snapshot foir check:',
      snapshot.checks.find((c) => c.id === 'foirCheck')
    )
  }
  if (!passed) {
    console.warn(
      `[Lead FOIR] FAILED: EMI gap ${Math.round(calc.emiGap)}. ` +
        `Eligible EMI ${Math.round(calc.eligibleEmiPerMonth)}, new loan EMI ${Math.round(calc.loanEmiPerMonth)}.`
    )
  }
  console.groupEnd()

  return { calc, passed }
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

  const foirPct = getFoirLimitPct(formLike)
  const calc = calculateEligibilityFromForm(formLike, foirPct)
  const tenure = calc.finalTenure || getLeadTenureMonths(formLike)
  const rate = getEffectiveInterestRate(formLike) ?? ELIGIBILITY_ASSUMED_RATE_PCT

  if (calc.totalGrossSalary > 0 && Number.isFinite(loanAmt) && loanAmt > 0 && calc.loanEmiPerMonth > 0) {
    const ok = calc.isEligible
    const actualFoirPct = Math.round(calc.actualFoirPct)
    checks.push({
      id: 'foirCheck',
      label: `EMI within FOIR limit (max ${foirPct}% on gross)`,
      ok,
      required: true,
      detail:
        `Gross ${formatEligibleRupee(calc.totalGrossSalary)}/mo · ` +
        `Total current EMI ${formatEligibleRupee(calc.totalCurrentEmi)} · ` +
        `Eligible ${formatEligibleRupee(calc.eligibleEmiPerMonth)} · ` +
        `New loan EMI ${formatEligibleRupee(calc.loanEmiPerMonth)} (${actualFoirPct}% FOIR)`,
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
    tenureUsed: calc.finalTenure || tenure,
  }

  if (!calc.totalGrossSalary) {
    amountInsight.headline = 'Enter gross income to see approximate max loan'
    amountInsight.subline = `FOIR on gross salary · ${foirPct}% · ${rate}% p.a. · ${tenure} mo tenure.`
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

  const calculationBreakdown = buildCalculationBreakdown(formLike, calc)

  const baseSnapshot = {
    checks,
    passed,
    total,
    requiredPassed,
    percent: total ? Math.round((passed / total) * 100) : 0,
    amountInsight,
    calculationBreakdown,
    eligibilityCalc: calc,
  }

  return {
    ...baseSnapshot,
    ...appendLeadEligibilityTracking(formLike, baseSnapshot),
  }
}

/**
 * Plain-text summary of eligibility preview (for clipboard).
 */
export function formatEligibilityPreviewForCopy(snapshot = {}) {
  const lines = []
  const eligibilityPercent = snapshot.eligibilityPercent ?? 0
  const requiredPassed = snapshot.requiredPassed ?? false
  const insight = snapshot.amountInsight ?? {}
  const breakdown = snapshot.calculationBreakdown
  const calc = breakdown?.calc ?? snapshot.eligibilityCalc

  lines.push('ELIGIBILITY PREVIEW')
  lines.push('═'.repeat(40))
  lines.push(`Status: ${eligibilityPercent}% · ${requiredPassed ? 'Required met' : 'Incomplete'}`)
  lines.push('')

  if (breakdown?.ready && calc) {
    lines.push('HOME LOAN ELIGIBILITY CALCULATION')
    lines.push('─'.repeat(40))
    lines.push(`Total gross / month:     ${formatEligibleRupee(calc.totalGrossSalary)}`)
    lines.push(`FOIR limit:              ${calc.foir}%`)
    lines.push(`Max EMI at FOIR:         ${formatEligibleRupee(calc.foirAmount)}`)
    lines.push(`Current loan EMI:        ${formatEligibleRupee(calc.currentEmi)}`)
    lines.push(`Salary deduction:        ${formatEligibleRupee(calc.salaryDeduction)}`)
    lines.push(`Total current EMI:       ${formatEligibleRupee(calc.totalCurrentEmi)}`)
    lines.push(`Eligible EMI:            ${formatEligibleRupee(calc.eligibleEmiPerMonth)}`)
    lines.push(`New loan EMI:            ${formatEligibleRupee(calc.loanEmiPerMonth)}`)
    lines.push(`EMI gap:                 ${formatEligibleRupee(calc.emiGap)}`)
    lines.push(`FOIR (with new loan):    ${Math.round(calc.actualFoirPct * 10) / 10}%`)
    lines.push(`Eligibility:             ${calc.isEligible ? 'PASS' : 'FAIL'}`)
    lines.push(`Tenure used:             ${calc.finalTenure} months`)
    lines.push('')

    if (breakdown.steps?.length) {
      lines.push('STEP-BY-STEP')
      lines.push('─'.repeat(40))
      breakdown.steps.forEach((step, i) => {
        const status =
          step.passed === true ? ' [Pass]' : step.passed === false ? ' [Over limit]' : ''
        lines.push(`${i + 1}. ${step.title}${status}`)
        lines.push(`   Formula: ${step.formula}`)
        lines.push(`   = ${step.calculation}`)
        lines.push(`   → ${step.result}`)
        lines.push('')
      })
    }
  } else if (breakdown?.missing?.length) {
    lines.push('Complete these fields to see calculation:')
    lines.push(breakdown.missing.join(', '))
    lines.push('')
  }

  lines.push('MAX ELIGIBLE LOAN (APPROX.)')
  lines.push('─'.repeat(40))
  if (insight.maxEligibleDisplay) {
    lines.push(`Amount: ${insight.maxEligibleDisplay}`)
    if (insight.headline) lines.push(insight.headline)
    if (insight.subline) lines.push(insight.subline)
    if (insight.requestedDisplay) lines.push(`Requested: ${insight.requestedDisplay}`)
  } else if (insight.headline) {
    lines.push(insight.headline)
    if (insight.subline) lines.push(insight.subline)
  }
  if (insight.cibilNote) lines.push(`Note: ${insight.cibilNote}`)
  lines.push('')

  const checklist = snapshot.checklist ?? []
  if (checklist.length) {
    lines.push('CHECKLIST')
    lines.push('─'.repeat(40))
    checklist.forEach((item) => {
      lines.push(`${item.status ? '✓' : '✕'} ${item.label}${item.required ? ' *' : ''}`)
    })
    lines.push('')
  }

  const checks = snapshot.checks ?? []
  if (checks.length) {
    lines.push(`DETAILED CHECKS (${snapshot.passed}/${snapshot.total})`)
    lines.push('─'.repeat(40))
    checks.forEach((c) => {
      lines.push(`${c.ok ? '✓' : '✕'} ${c.label}`)
      if (c.detail) lines.push(`   ${c.detail}`)
    })
  }

  lines.push('')
  lines.push('Indicative only — final sanction depends on lender policy.')

  return lines.join('\n')
}
