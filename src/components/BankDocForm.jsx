import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { LOAN_TYPE_OPTIONS } from '../utils/loanTenure'

const BankDocForm = ({ bankDoc, banks = [], onSave, onClose, saving = false }) => {
  const [formData, setFormData] = useState({
    bankName: '',
    loanType: '',
    checklistItems: [''],
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (bankDoc) {
      const items = Array.isArray(bankDoc.checklistItems) && bankDoc.checklistItems.length > 0
        ? [...bankDoc.checklistItems]
        : ['']
      setFormData({
        bankName: bankDoc.bankName || '',
        loanType: bankDoc.loanType || '',
        checklistItems: items,
      })
    } else {
      setFormData({
        bankName: '',
        loanType: '',
        checklistItems: [''],
      })
    }
    setErrors({})
  }, [bankDoc])

  const validate = () => {
    const newErrors = {}
    if (!formData.bankName?.trim()) {
      newErrors.bankName = 'Please select a bank'
    }
    const items = (formData.checklistItems || []).map((i) => String(i || '').trim()).filter(Boolean)
    if (items.length === 0) {
      newErrors.checklistItems = 'Add at least one checklist item'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const checklistItems = formData.checklistItems
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    onSave({
      bankName: formData.bankName.trim(),
      loanType: formData.loanType || '',
      checklistItems,
    })
  }

  const handleChecklistChange = (index, value) => {
    setFormData((prev) => {
      const items = [...(prev.checklistItems || [])]
      items[index] = value
      return { ...prev, checklistItems: items }
    })
    if (errors.checklistItems) {
      setErrors((prev) => ({ ...prev, checklistItems: '' }))
    }
  }

  const addChecklistItem = () => {
    setFormData((prev) => ({
      ...prev,
      checklistItems: [...(prev.checklistItems || []), ''],
    }))
  }

  const removeChecklistItem = (index) => {
    setFormData((prev) => {
      const items = [...(prev.checklistItems || [])]
      if (items.length <= 1) return { ...prev, checklistItems: [''] }
      items.splice(index, 1)
      return { ...prev, checklistItems: items }
    })
  }

  const activeBanks = banks.filter((b) => b.status !== 'inactive')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Bank <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.bankName}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, bankName: e.target.value }))
                if (errors.bankName) setErrors((prev) => ({ ...prev, bankName: '' }))
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                errors.bankName ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select bank</option>
              {activeBanks.map((bank) => {
                const id = bank._id || bank.id
                return (
                  <option key={id} value={bank.name}>
                    {bank.name}
                  </option>
                )
              })}
            </select>
            {errors.bankName && <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
            <select
              value={formData.loanType}
              onChange={(e) => setFormData((prev) => ({ ...prev, loanType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All loan types (optional)</option>
              {LOAN_TYPE_OPTIONS.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to use this checklist for all loan types of the selected bank.
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Checklist Section <span className="text-red-500">*</span></h3>
          <button
            type="button"
            onClick={addChecklistItem}
            className="flex items-center gap-1 text-sm font-medium text-primary-900 hover:text-primary-800"
          >
            <Plus className="w-4 h-4" />
            Add Checklist Item
          </button>
        </div>

        <div className="space-y-2">
          {(formData.checklistItems || []).map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-sm text-gray-500 pt-2.5 w-6 flex-shrink-0">{index + 1}.</span>
              <input
                type="text"
                value={item}
                onChange={(e) => handleChecklistChange(index, e.target.value)}
                placeholder="e.g. PAN Card"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                type="button"
                onClick={() => removeChecklistItem(index)}
                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {errors.checklistItems && (
          <p className="mt-1 text-sm text-red-600">{errors.checklistItems}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : bankDoc ? 'Save' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default BankDocForm
