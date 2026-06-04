import { LOAN_TYPE_OPTIONS } from '../utils/loanTenure'

export function formatLoanTypeLabel(value) {
  if (!value) return ''
  const opt = LOAN_TYPE_OPTIONS.find((o) => o.value === value)
  return opt?.label || String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Compact loan-type chips for tables and detail views.
 * @param {string[]} loanTypes
 * @param {number} maxVisible - In tables, show at most this many chips; rest as "+N more".
 * @param {'sm'|'md'} size
 */
export default function LoanTypeBadges({ loanTypes = [], maxVisible = 3, size = 'sm', emptyLabel = 'N/A' }) {
  const types = Array.isArray(loanTypes) ? loanTypes.filter(Boolean) : []
  if (types.length === 0) {
    return <span className="text-sm text-gray-400">{emptyLabel}</span>
  }

  const showAll = maxVisible == null || maxVisible < 0 || types.length <= maxVisible
  const visible = showAll ? types : types.slice(0, maxVisible)
  const hidden = showAll ? [] : types.slice(maxVisible)
  const hiddenCount = hidden.length

  const chipClass =
    size === 'md'
      ? 'px-2.5 py-1 text-sm'
      : 'px-2 py-0.5 text-xs'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((lt) => (
        <span
          key={lt}
          title={formatLoanTypeLabel(lt)}
          className={`inline-flex shrink-0 whitespace-nowrap font-medium rounded-full border border-primary-200 bg-primary-50 text-primary-800 ${chipClass}`}
        >
          {formatLoanTypeLabel(lt)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          title={hidden.map(formatLoanTypeLabel).join(' · ')}
          className={`inline-flex shrink-0 cursor-default whitespace-nowrap font-medium rounded-full border border-gray-200 bg-gray-100 text-gray-700 ${chipClass}`}
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  )
}
