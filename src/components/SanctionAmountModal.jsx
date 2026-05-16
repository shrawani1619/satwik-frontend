import Modal from './Modal'
import { getLeadLoanAmount, validateSanctionAmount } from '../utils/sanctionAmount'
import { formatIndianRupee } from '../utils/formatUtils'

/**
 * Popup when lead status changes to "Sanction and branch appointment are fixed".
 * Collects sanction amount and optional invoice number.
 */
export default function SanctionAmountModal({
  isOpen,
  onClose,
  lead,
  sanctionAmount,
  onSanctionAmountChange,
  invoiceNumber,
  onInvoiceNumberChange,
  onSubmit,
  isSubmitting = false,
}) {
  const customerName = lead?.customerName || 'selected lead'
  const loanAmount = getLeadLoanAmount(lead)
  const parsedSanction = Number(String(sanctionAmount ?? '').replace(/,/g, '').trim())
  const validation =
    sanctionAmount !== '' && sanctionAmount != null
      ? validateSanctionAmount(parsedSanction, loanAmount)
      : { valid: true }
  const hasAmount = String(sanctionAmount ?? '').trim() !== ''
  const showError = hasAmount && !validation.valid
  const canSubmit = hasAmount && validation.valid

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sanction details"
      size="sm"
      closeOnOverlay={!isSubmitting}
    >
      <div className="space-y-4 p-1">
        <p className="text-sm text-gray-600">
          Enter the sanctioned amount for{' '}
          <span className="font-semibold text-gray-900">{customerName}</span>.
          An invoice will be generated based on this amount.
        </p>

        {loanAmount != null && (
          <p className="text-xs text-gray-500">
            Loan amount (max sanction): {formatIndianRupee(loanAmount)}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sanction amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max={loanAmount ?? undefined}
            step="any"
            value={sanctionAmount}
            onChange={(e) => onSanctionAmountChange(e.target.value)}
            placeholder="Enter sanctioned amount"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              showError ? 'border-red-400' : 'border-gray-300'
            }`}
            autoFocus
            disabled={isSubmitting}
          />
          {showError && (
            <p className="mt-1 text-xs text-red-600">{validation.message}</p>
          )}
        </div>

        {/* <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice number (optional)</label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            placeholder="Auto-generated if left blank"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isSubmitting}
          />
        </div> */}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-3 py-2 text-sm rounded bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-60"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? 'Saving…' : 'Save & generate invoice'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
