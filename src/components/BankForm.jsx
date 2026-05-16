import { useState, useEffect } from 'react'
import {
  LOAN_TYPE_OPTIONS,
  DEFAULT_TENURE_MONTHS_BY_LOAN_TYPE,
  LEAD_MIN_TENURE_MONTHS,
  LEAD_MAX_TENURE_MONTHS,
} from '../utils/loanTenure'

const BankForm = ({ bank, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    loanTypes: [],
    loanTenureMonths: {},
    type: 'bank',
    status: 'active',
    disbursementThresholdPercentage: 0,
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (bank) {
      setFormData({
        name: bank.name || '',
        loanTypes: bank.loanTypes || [],
        loanTenureMonths: bank.loanTenureMonths || {},
        type: bank.type || 'bank',
        status: bank.status || 'active',
        disbursementThresholdPercentage:
          typeof bank.disbursementThresholdPercentage === 'number'
            ? bank.disbursementThresholdPercentage
            : 0,
      })
    } else {
      setFormData({
        name: '',
        loanTypes: [],
        loanTenureMonths: {},
        type: 'bank',
        status: 'active',
        disbursementThresholdPercentage: 0,
      })
    }
  }, [bank])

  const validate = () => {
    const newErrors = {}
    if (!formData.name || !formData.name.trim()) newErrors.name = 'Bank name is required'
    if (!formData.loanTypes || formData.loanTypes.length === 0) {
      newErrors.loanTypes = 'Please select at least one loan type'
    }
    const threshold = Number(formData.disbursementThresholdPercentage)
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      newErrors.disbursementThresholdPercentage = 'Disbursement Threshold % must be between 0 and 100'
    }
    for (const lt of formData.loanTypes || []) {
      const raw = formData.loanTenureMonths?.[lt]
      const n = raw === '' || raw == null ? NaN : Number(raw)
      if (!Number.isFinite(n) || n < LEAD_MIN_TENURE_MONTHS || n > LEAD_MAX_TENURE_MONTHS) {
        const label = LOAN_TYPE_OPTIONS.find((o) => o.value === lt)?.label || lt
        newErrors.loanTenureMonths = `Enter tenure (${LEAD_MIN_TENURE_MONTHS}–${LEAD_MAX_TENURE_MONTHS} months) for ${label}`
        break
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const tenurePayload = {}
      for (const lt of formData.loanTypes || []) {
        const n = Number(formData.loanTenureMonths?.[lt])
        if (Number.isFinite(n)) tenurePayload[lt] = Math.round(n)
      }
      onSave({ ...formData, loanTenureMonths: tenurePayload })
    }
  }

  const handleLoanTypeToggle = (value) => {
    setFormData((prev) => {
      const current = prev.loanTypes || []
      const adding = !current.includes(value)
      const updated = adding ? [...current, value] : current.filter((t) => t !== value)
      const loanTenureMonths = { ...(prev.loanTenureMonths || {}) }
      if (adding && (loanTenureMonths[value] == null || loanTenureMonths[value] === '')) {
        loanTenureMonths[value] = DEFAULT_TENURE_MONTHS_BY_LOAN_TYPE[value] ?? 120
      }
      if (!adding) delete loanTenureMonths[value]
      return { ...prev, loanTypes: updated, loanTenureMonths }
    })
    if (errors.loanTypes) {
      setErrors((prev) => ({ ...prev, loanTypes: '' }))
    }
  }

  const handleTenureChange = (loanType, value) => {
    setFormData((prev) => ({
      ...prev,
      loanTenureMonths: { ...(prev.loanTenureMonths || {}), [loanType]: value },
    }))
    if (errors.loanTenureMonths) {
      setErrors((prev) => ({ ...prev, loanTenureMonths: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bank Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank / NBFC Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, name: e.target.value }))
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter bank / NBFC name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Loan Types */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Loan Types <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOAN_TYPE_OPTIONS.map((lt) => {
            const checked = formData.loanTypes.includes(lt.value)
            return (
              <label
                key={lt.value}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                  checked
                    ? 'border-primary-600 bg-primary-50 text-primary-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleLoanTypeToggle(lt.value)}
                  className="w-4 h-4 accent-primary-900 flex-shrink-0"
                />
                <span className="text-sm font-medium">{lt.label}</span>
              </label>
            )
          })}
        </div>
        {errors.loanTypes && <p className="mt-1 text-sm text-red-600">{errors.loanTypes}</p>}
      </div>

      {/* Default tenure per loan type (admin) */}
      {formData.loanTypes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default tenure (months) per loan type <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Used when creating leads for this bank (can be changed on the lead).
          </p>
          <div className="space-y-3">
            {formData.loanTypes.map((lt) => {
              const label = LOAN_TYPE_OPTIONS.find((o) => o.value === lt)?.label || lt
              return (
                <div key={lt} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm text-gray-700 sm:w-48 flex-shrink-0">{label}</span>
                  <input
                    type="number"
                    min={LEAD_MIN_TENURE_MONTHS}
                    max={LEAD_MAX_TENURE_MONTHS}
                    value={formData.loanTenureMonths?.[lt] ?? ''}
                    onChange={(e) => handleTenureChange(lt, e.target.value)}
                    className="w-full sm:max-w-[140px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Months"
                  />
                </div>
              )
            })}
          </div>
          {errors.loanTenureMonths && (
            <p className="mt-1 text-sm text-red-600">{errors.loanTenureMonths}</p>
          )}
        </div>
      )}

      {/* Disbursement threshold for invoice eligibility */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Disbursement Threshold % <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={formData.disbursementThresholdPercentage}
          onChange={(e) => {
            setFormData((prev) => ({
              ...prev,
              disbursementThresholdPercentage: e.target.value === '' ? '' : Number(e.target.value),
            }))
            if (errors.disbursementThresholdPercentage) {
              setErrors((prev) => ({ ...prev, disbursementThresholdPercentage: '' }))
            }
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.disbursementThresholdPercentage ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g. 30"
        />
        <p className="mt-1 text-xs text-gray-500">
          Invoice generation is allowed only when disbursed % reaches this threshold.
        </p>
        {errors.disbursementThresholdPercentage && (
          <p className="mt-1 text-sm text-red-600">{errors.disbursementThresholdPercentage}</p>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors"
        >
          {bank ? 'Update Bank' : 'Create Bank'}
        </button>
      </div>
    </form>
  )
}

export default BankForm
