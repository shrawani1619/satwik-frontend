import { useState, useCallback } from 'react'
import { toast } from '../services/toastService'
import {
  computeLeadEligibilitySnapshot,
  ELIGIBILITY_ASSUMED_RATE_PCT,
  formatEligibleRupee,
  formatEligibilityPreviewForCopy,
  MAX_AGE_AT_LOAN_END,
  MAX_TENURE_MONTHS_ELIGIBILITY,
} from '../utils/leadEligibility'

function StepBadge({ passed }) {
  if (passed === true) {
    return (
      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
        Pass
      </span>
    )
  }
  if (passed === false) {
    return (
      <span className="text-[10px] font-bold uppercase text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
        Over limit
      </span>
    )
  }
  return null
}

function CalculationBreakdown({ breakdown }) {
  if (!breakdown) return null

  if (!breakdown.ready) {
    const missing = breakdown.missing ?? []
    if (missing.length === 0) return null
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50/80 p-3 select-text">
        <p className="text-xs text-gray-600">
          Complete to see calculation:{' '}
          <span className="font-medium text-gray-800">{missing.join(', ')}</span>
        </p>
      </div>
    )
  }

  const calc = breakdown.calc

  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 space-y-3 select-text">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
        Home loan eligibility calculation
      </p>
      <p className="text-[11px] text-gray-600 leading-relaxed">
        FOIR is calculated on <strong>gross salary</strong>. Eligible capacity is reduced by{' '}
        <strong>current loan EMI + salary deductions</strong>.
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-b border-gray-100 pb-2">
        <span className="text-gray-500">Total gross / mo</span>
        <span className="font-semibold text-right">{formatEligibleRupee(calc.totalGrossSalary)}</span>
        <span className="text-gray-500">FOIR limit</span>
        <span className="font-semibold text-right">{calc.foir}%</span>
        <span className="text-gray-500">Max EMI at FOIR</span>
        <span className="font-semibold text-right">{formatEligibleRupee(calc.foirAmount)}</span>
        <span className="text-gray-500">Current loan EMI</span>
        <span className="font-semibold text-right">{formatEligibleRupee(calc.currentEmi)}</span>
        <span className="text-gray-500">Salary deduction</span>
        <span className="font-semibold text-right">{formatEligibleRupee(calc.salaryDeduction)}</span>
        <span className="text-gray-500">Total current EMI</span>
        <span className="font-semibold text-right">{formatEligibleRupee(calc.totalCurrentEmi)}</span>
        <span className="text-gray-500">Eligible EMI</span>
        <span className="font-semibold text-right text-primary-800">
          {formatEligibleRupee(calc.eligibleEmiPerMonth)}
        </span>
      </div>

      <ol className="space-y-2.5">
        {breakdown.steps.map((step, index) => (
          <li
            key={step.id}
            className={`rounded-md border px-3 py-2 text-xs ${
              step.passed === false
                ? 'border-red-200 bg-red-50'
                : step.passed === true
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-gray-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-900">
                {index + 1}. {step.title}
              </span>
              <StepBadge passed={step.passed} />
            </div>
            <p className="mt-1 text-[11px] text-gray-500 font-mono">{step.formula}</p>
            <p className="text-gray-700">= {step.calculation}</p>
            <p className="font-semibold text-primary-900 mt-0.5">→ {step.result}</p>
          </li>
        ))}
      </ol>

      <div
        className={`rounded-md px-3 py-2 text-xs font-semibold ${
          calc.isEligible ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
        }`}
      >
        {calc.isEligible ? 'PASS' : 'FAIL'} — New loan EMI{' '}
        {calc.isEligible ? 'fits within' : 'exceeds'} eligible EMI capacity (gap{' '}
        {formatEligibleRupee(calc.emiGap)}).
      </div>

      <p className="text-[11px] text-gray-500">
        Tenure capped at {MAX_TENURE_MONTHS_ELIGIBILITY} months or until age {MAX_AGE_AT_LOAN_END}{' '}
        (used {calc.finalTenure} mo).
      </p>
    </div>
  )
}

/**
 * Live eligibility counter while filling the lead form (indicative only).
 */
export default function LeadEligibilityCounter({ formData }) {
  const snapshot = computeLeadEligibilitySnapshot(formData)
  const checklist = snapshot.checklist ?? []
  const validationErrors = snapshot.validationErrors ?? []
  const eligibilityPercent = snapshot.eligibilityPercent ?? 0
  const requiredPassed = snapshot.requiredPassed ?? false
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = formatEligibilityPreviewForCopy(snapshot)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied', 'Eligibility preview copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
        toast.success('Copied', 'Eligibility preview copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      } catch {
        toast.error('Copy failed', 'Select the preview text and copy manually (Ctrl+C)')
      }
    }
  }, [snapshot])

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-primary-50/40 p-4 space-y-3 select-text">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-gray-900">Eligibility preview</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
            title="Copy full eligibility summary"
          >
            {copied ? (
              <>
                <span aria-hidden>✓</span> Copied
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              requiredPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {eligibilityPercent}% · {requiredPassed ? 'Required met' : 'Incomplete'}
          </span>
        </div>
      </div>

      <CalculationBreakdown breakdown={snapshot.calculationBreakdown} />

      <div className="rounded-md border border-primary-200 bg-white/80 p-3 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">
          Max eligible loan (approx.)
        </p>
        {snapshot.amountInsight.maxEligible != null ? (
          <>
            <p className="text-2xl font-extrabold text-primary-950 tracking-tight">
              {snapshot.amountInsight.maxEligibleDisplay}
            </p>
            <p className="text-xs font-medium text-gray-800">{snapshot.amountInsight.headline}</p>
            <p className="text-xs text-gray-600 leading-relaxed">{snapshot.amountInsight.subline}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900">{snapshot.amountInsight.headline}</p>
            <p className="text-xs text-gray-600 leading-relaxed">{snapshot.amountInsight.subline}</p>
          </>
        )}
        {snapshot.amountInsight.cibilNote ? (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
            {snapshot.amountInsight.cibilNote}
          </p>
        ) : null}
        <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100 mt-2">
          FOIR on gross salary · {ELIGIBILITY_ASSUMED_RATE_PCT}% used only if rate missing ·{' '}
          {snapshot.amountInsight.tenureUsed}-month tenure (age-capped).
        </p>
      </div>

      <p className="text-xs text-gray-600">Final sanction depends on lender policy and documents.</p>

      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            eligibilityPercent >= 100
              ? 'bg-emerald-500'
              : eligibilityPercent >= 60
                ? 'bg-primary-600'
                : 'bg-amber-500'
          }`}
          style={{ width: `${eligibilityPercent}%` }}
        />
      </div>

      {validationErrors.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-red-800">Validation</p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {validationErrors.map((err) => (
              <li key={`${err.field}-${err.message}`}>{err.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="space-y-1.5 text-xs">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                item.status ? 'bg-emerald-500 text-white' : 'bg-red-100 text-red-700'
              }`}
            >
              {item.status ? '✓' : '✕'}
            </span>
            <span className={item.status ? 'text-gray-800' : 'text-gray-700'}>
              {item.label}
              {item.required ? <span className="text-red-600"> *</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 select-none">
          Detailed checks ({snapshot.passed}/{snapshot.total})
        </summary>
        <ul className="mt-2 space-y-1 pl-1 select-text">
          {(snapshot.checks ?? []).map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <span className={c.ok ? 'text-emerald-600' : 'text-red-600'}>{c.ok ? '✓' : '✕'}</span>
              <span>
                {c.label}
                {c.detail ? <span className="block text-gray-500">{c.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
