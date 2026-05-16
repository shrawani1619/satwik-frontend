import {
  computeLeadEligibilitySnapshot,
  ELIGIBILITY_ASSUMED_RATE_PCT,
  ELIGIBILITY_MAX_EMI_INCOME_RATIO,
} from '../utils/leadEligibility'

/**
 * Live eligibility counter while filling the lead form (indicative only).
 */
export default function LeadEligibilityCounter({ formData }) {
  const snapshot = computeLeadEligibilitySnapshot(formData)
  const checklist = snapshot.checklist ?? []
  const validationErrors = snapshot.validationErrors ?? []
  const eligibilityPercent = snapshot.eligibilityPercent ?? 0
  const requiredPassed = snapshot.requiredPassed ?? false

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-primary-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">Eligibility preview</h4>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            requiredPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {eligibilityPercent}% · {requiredPassed ? 'Required met' : 'Incomplete'}
        </span>
      </div>

      <div className="rounded-md border border-primary-200 bg-white/80 p-3 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">
          Eligible amount (indicative)
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
          Uses {Math.round(ELIGIBILITY_MAX_EMI_INCOME_RATIO * 100)}% FOIR on net income,{' '}
          {ELIGIBILITY_ASSUMED_RATE_PCT}% p.a., {snapshot.amountInsight.tenureUsed}-month tenure. Bank
          decision may differ.
        </p>
      </div>

      <p className="text-xs text-gray-600">
        Final sanction depends on lender policy and documents. Checklist updates as you fill the form.
      </p>

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
              aria-hidden
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
        <summary className="cursor-pointer hover:text-gray-700">
          Detailed checks ({snapshot.passed}/{snapshot.total})
        </summary>
        <ul className="mt-2 space-y-1 pl-1">
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
