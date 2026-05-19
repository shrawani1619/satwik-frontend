import { parseMoney, getEffectiveInterestRate } from './leadIncomeFields'
import { parseTenureMonths } from './loanTenure'

/** Max age at loan maturity (home-loan style eligibility). */
export const MAX_AGE_AT_LOAN_END = 70

/** Max tenure months for eligibility (30 years). */
export const MAX_TENURE_MONTHS_ELIGIBILITY = 360

/**
 * EMI = P × R × (1+R)^N / [(1+R)^N − 1], R = monthly rate.
 */
export function calculateEmi(loanAmount, annualRate, months) {
  const p = Number(loanAmount) || 0
  const n = Number(months) || 0
  const r = (Number(annualRate) || 0) / 12 / 100

  if (!p || !n) return 0
  if (!r) return p / n

  const pow = (1 + r) ** n
  return (p * r * pow) / (pow - 1)
}

/** Inverse EMI formula — max principal for a given EMI capacity. */
export function maxPrincipalFromEmi(emi, annualRate, months) {
  const e = Number(emi) || 0
  const n = Number(months) || 0
  const r = (Number(annualRate) || 0) / 12 / 100
  if (!e || !n) return 0
  if (!r) return e * n
  const pow = (1 + r) ** n
  return (e * (pow - 1)) / (r * pow)
}

export function computeMaxTenureByAge(applicantAge, coApplicantAge = 0) {
  const ageForTenure = Math.max(Number(applicantAge) || 0, Number(coApplicantAge) || 0)
  if (!ageForTenure) return MAX_TENURE_MONTHS_ELIGIBILITY
  const maxTenureByAge = Math.max(0, (MAX_AGE_AT_LOAN_END - ageForTenure) * 12)
  return Math.min(MAX_TENURE_MONTHS_ELIGIBILITY, maxTenureByAge)
}

function num(v) {
  const n = parseMoney(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Map lead form fields to eligibility calculator input.
 */
export function mapFormToEligibilityData(formLike = {}, foirDefaultPct = 50) {
  const foirRaw = num(formLike.foir)
  const gross =
    num(formLike.grossIncome) > 0 ? num(formLike.grossIncome) : num(formLike.salary)

  return {
    applicantGross: gross,
    coApplicantGross: num(formLike.coApplicantGross),
    salaryDeduction: num(formLike.deduction),
    currentEmi: num(formLike.currentEmi),
    foir: foirRaw > 0 ? foirRaw : foirDefaultPct,
    loanAmount: num(formLike.loanAmount),
    roi: getEffectiveInterestRate(formLike) || 0,
    tenure: parseTenureMonths(formLike.tenureMonths),
    applicantAge: parseInt(String(formLike.applicantAge ?? '').trim(), 10) || 0,
    coApplicantAge: parseInt(String(formLike.coApplicantAge ?? '').trim(), 10) || 0,
  }
}

/** Current EMI + salary deductions (monthly obligations counted against FOIR). */
export function computeTotalCurrentEmi(currentEmi, salaryDeduction) {
  const emi = Number(currentEmi) || 0
  const deduction = Number(salaryDeduction) || 0
  return emi + deduction
}

/**
 * FOIR on gross salary.
 * Eligible EMI = max FOIR EMI − (current loan EMI + salary deductions).
 */
export function calculateEligibility(data) {
  const applicantGross = Number(data.applicantGross) || 0
  const coApplicantGross = Number(data.coApplicantGross) || 0
  const salaryDeduction = Number(data.salaryDeduction) || 0
  const currentEmi = Number(data.currentEmi) || 0
  const foir = Number(data.foir) || 0
  const loanAmount = Number(data.loanAmount) || 0
  const roi = Number(data.roi) || 0
  const requestedTenure = Number(data.tenure) || 0

  const applicantAge = Number(data.applicantAge) || 0
  const coApplicantAge = Number(data.coApplicantAge) || 0

  const maxAllowedTenure = computeMaxTenureByAge(applicantAge, coApplicantAge)
  const finalTenure =
    requestedTenure > 0
      ? Math.min(requestedTenure, maxAllowedTenure)
      : maxAllowedTenure

  const totalGrossSalary = applicantGross + coApplicantGross
  const foirAmount = totalGrossSalary * (foir / 100)
  const totalCurrentEmi = computeTotalCurrentEmi(currentEmi, salaryDeduction)

  const eligibleEmiPerMonth = Math.max(0, foirAmount - totalCurrentEmi)

  const loanEmiPerMonth =
    loanAmount > 0 && finalTenure > 0 && roi > 0
      ? calculateEmi(loanAmount, roi, finalTenure)
      : 0

  const emiGap = eligibleEmiPerMonth - loanEmiPerMonth
  const totalEmiWithNewLoan = totalCurrentEmi + loanEmiPerMonth
  const actualFoirPct =
    totalGrossSalary > 0 ? (totalEmiWithNewLoan / totalGrossSalary) * 100 : 0

  const maxLoanFromEligibleEmi =
    eligibleEmiPerMonth > 0 && roi > 0 && finalTenure > 0
      ? Math.round(maxPrincipalFromEmi(eligibleEmiPerMonth, roi, finalTenure) / 1000) * 1000
      : 0

  const ready =
    totalGrossSalary > 0 &&
    foir > 0 &&
    requestedTenure > 0 &&
    roi > 0 &&
    loanAmount > 0 &&
    applicantAge > 0

  return {
    ready,
    totalGrossSalary,
    applicantGross,
    coApplicantGross,
    foir,
    foirAmount,
    salaryDeduction,
    currentEmi,
    totalCurrentEmi,
    eligibleEmiPerMonth,
    loanEmiPerMonth,
    emiGap,
    maxAllowedTenure,
    requestedTenure,
    finalTenure,
    maxTenureByAge: maxAllowedTenure,
    applicantAge,
    coApplicantAge,
    ageForTenure: Math.max(applicantAge, coApplicantAge),
    maxLoanFromEligibleEmi,
    actualFoirPct,
    isEligible: emiGap >= 0,
    foirCheckPassed: totalEmiWithNewLoan <= foirAmount + 0.01,
    currentEmiWithinFoir: totalCurrentEmi <= foirAmount,
  }
}

export function calculateEligibilityFromForm(formLike, foirDefaultPct = 50) {
  return calculateEligibility(mapFormToEligibilityData(formLike, foirDefaultPct))
}
