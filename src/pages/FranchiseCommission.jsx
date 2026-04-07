import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Building2, Percent } from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { authService } from '../services/auth.service'

const FranchiseCommission = () => {
  const [limits, setLimits] = useState([])
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedLimit, setSelectedLimit] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, limit: null })
  const [formData, setFormData] = useState({
    bankId: '',
    limitType: 'percentage',
    maxCommissionValue: '',
  })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const userRole = authService.getUser()?.role
  const canAccess =
    userRole === 'super_admin' || userRole === 'accounts_manager' || userRole === 'regional_manager'
  const canCreateLimit = userRole === 'super_admin' || userRole === 'accounts_manager'
  const canEditLimit =
    userRole === 'super_admin' || userRole === 'accounts_manager' || userRole === 'regional_manager'
  const canDeleteLimit = userRole === 'super_admin' || userRole === 'accounts_manager'

  useEffect(() => {
    if (!canAccess) {
      toast.error('Access Denied', 'Only administrators, accounts managers, and regional managers can access this page')
    }
  }, [canAccess])

  useEffect(() => {
    if (canAccess) {
      fetchLimits()
      fetchBanks()
    }
  }, [canAccess])

  const fetchLimits = async () => {
    try {
      setLoading(true)
      const response = await api.franchiseCommissionLimits.getAll()
      const limitsData = response.data || response || []
      setLimits(Array.isArray(limitsData) ? limitsData : [])
    } catch (error) {
      console.error('Error fetching franchise commission limits:', error)
      setLimits([])
      toast.error('Error', 'Failed to fetch franchise commission limits')
    } finally {
      setLoading(false)
    }
  }

  const fetchBanks = async () => {
    try {
      const response = await api.banks.getAll()
      const banksData = response.data || response || []
      setBanks(Array.isArray(banksData) ? banksData : [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      setBanks([])
    }
  }

  const handleCreate = () => {
    setSelectedLimit(null)
    setFormData({
      bankId: '',
      limitType: 'percentage',
      maxCommissionValue: '',
    })
    setErrors({})
    setIsCreateModalOpen(true)
  }

  const handleEdit = (limit) => {
    setSelectedLimit(limit)
    setFormData({
      bankId: limit.bank?._id || limit.bank?.id || limit.bank || '',
      limitType: 'percentage', // Always set to percentage
      maxCommissionValue: limit.maxCommissionValue || '',
    })
    setErrors({})
    setIsEditModalOpen(true)
  }

  const handleDelete = (limit) => {
    setConfirmDelete({ isOpen: true, limit })
  }

  const handleDeleteConfirm = async () => {
    const limit = confirmDelete.limit
    const limitId = limit.id || limit._id
    if (!limitId) {
      toast.error('Error', 'Limit ID is missing')
      return
    }

    try {
      await api.franchiseCommissionLimits.delete(limitId)
      await fetchLimits()
      toast.success('Success', 'Franchise commission limit deleted successfully')
      setConfirmDelete({ isOpen: false, limit: null })
    } catch (error) {
      console.error('Error deleting limit:', error)
      toast.error('Error', error.message || 'Failed to delete franchise commission limit')
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.bankId) {
      newErrors.bankId = 'Bank is required'
    }
    if (formData.maxCommissionValue === '' || formData.maxCommissionValue === null || formData.maxCommissionValue === undefined) {
      newErrors.maxCommissionValue = 'Max commission value is required'
    } else {
      const value = parseFloat(formData.maxCommissionValue)
      if (isNaN(value) || value < 0) {
        newErrors.maxCommissionValue = 'Max commission value must be a positive number'
      }
      if (value > 100) {
        newErrors.maxCommissionValue = 'Percentage cannot exceed 100'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        bankId: formData.bankId,
        limitType: 'percentage', // Always set to percentage
        maxCommissionValue: parseFloat(formData.maxCommissionValue),
      }

      if (selectedLimit) {
        const limitId = selectedLimit.id || selectedLimit._id
        await api.franchiseCommissionLimits.update(limitId, payload)
        toast.success('Success', 'Franchise commission limit updated successfully')
        setIsEditModalOpen(false)
      } else {
        await api.franchiseCommissionLimits.create(payload)
        toast.success('Success', 'Franchise commission limit created successfully')
        setIsCreateModalOpen(false)
      }

      setFormData({
        bankId: '',
        limitType: 'percentage',
        maxCommissionValue: '',
      })
      setSelectedLimit(null)
      await fetchLimits()
    } catch (error) {
      console.error('Error saving limit:', error)
      toast.error('Error', error.message || 'Failed to save franchise commission limit')
    } finally {
      setIsSaving(false)
    }
  }

  // Filter limits
  const filteredLimits = useMemo(() => {
    if (!limits || limits.length === 0) return []

    return limits.filter((limit) => {
      if (!limit) return false
      const searchLower = searchTerm.toLowerCase()
      const bankName = limit.bank?.name || ''
      return bankName.toLowerCase().includes(searchLower)
    })
  }, [limits, searchTerm])

  // Get bank name helper
  const getBankName = (bank) => {
    if (!bank) return 'N/A'
    if (typeof bank === 'string') {
      const foundBank = banks.find(b => (b._id || b.id) === bank)
      return foundBank?.name || 'N/A'
    }
    return bank.name || 'N/A'
  }

  if (!canAccess) {
    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">
            Access Denied. Only administrators, accounts managers, and regional managers can access this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Commission Limits</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage maximum commission limits for franchises by bank.</p>
        </div>
        {canCreateLimit && (
          <button
            onClick={handleCreate}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Set Commission Limit</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by bank name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Limit Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Maximum Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                {(canEditLimit || canDeleteLimit) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={canEditLimit || canDeleteLimit ? 5 : 4}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredLimits.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEditLimit || canDeleteLimit ? 5 : 4}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {canCreateLimit
                      ? 'No commission limits found. Click "Set Commission Limit" to create one.'
                      : 'No commission limits found.'}
                  </td>
                </tr>
              ) : (
                filteredLimits.map((limit, index) => {
                  const limitId = limit.id || limit._id
                  return (
                    <tr key={limitId || `limit-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getBankName(limit.bank)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Percent className="w-3 h-3" />
                          Percentage
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {parseFloat(limit.maxCommissionValue).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {limit.createdBy?.name || limit.createdBy?.email || 'N/A'}
                        </div>
                        {limit.createdBy?.email && limit.createdBy?.name && (
                          <div className="text-xs text-gray-500">
                            {limit.createdBy.email}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {limit.createdAt ? new Date(limit.createdAt).toLocaleDateString() : ''}
                        </div>
                      </td>
                      {(canEditLimit || canDeleteLimit) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {canEditLimit && (
                              <button
                                onClick={() => handleEdit(limit)}
                                className="text-gray-600 hover:text-gray-900 p-1"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteLimit && (
                              <button
                                onClick={() => handleDelete(limit)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        ) : filteredLimits.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No commission limits found.</p>
            {canCreateLimit && (
              <p className="text-xs text-gray-400 mt-1">Click &quot;Set Commission Limit&quot; to create one.</p>
            )}
          </div>
        ) : (
          filteredLimits.map((limit, index) => {
            const limitId = limit.id || limit._id
            return (
              <div
                key={limitId || `limit-${index}`}
                className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {getBankName(limit.bank)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Percent className="w-3 h-3" />
                        Percentage
                      </span>
                    </div>
                  </div>
                  {(canEditLimit || canDeleteLimit) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canEditLimit && (
                        <button
                          onClick={() => handleEdit(limit)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteLimit && (
                        <button
                          onClick={() => handleDelete(limit)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Maximum Commission</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {parseFloat(limit.maxCommissionValue).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-gray-500 font-medium">Created By</span>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-900">
                        {limit.createdBy?.name || limit.createdBy?.email || 'N/A'}
                      </div>
                      {limit.createdBy?.email && limit.createdBy?.name && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {limit.createdBy.email}
                        </div>
                      )}
                      {limit.createdAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(limit.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setIsEditModalOpen(false)
          setSelectedLimit(null)
          setFormData({
            bankId: '',
            limitType: 'percentage',
            maxCommissionValue: '',
          })
          setErrors({})
        }}
        title={selectedLimit ? 'Edit Commission Limit' : 'Set Commission Limit'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank <span className="text-red-500">*</span>
            </label>
            <select
              name="bankId"
              value={formData.bankId}
              onChange={handleInputChange}
              disabled={!!selectedLimit}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.bankId ? 'border-red-500' : 'border-gray-300'
              } ${selectedLimit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select a bank</option>
              {banks.map((bank) => (
                <option key={bank._id || bank.id} value={bank._id || bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
            {errors.bankId && <p className="mt-1 text-sm text-red-600">{errors.bankId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Commission (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="maxCommissionValue"
              value={formData.maxCommissionValue}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.maxCommissionValue ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter percentage (0-100)"
              step="0.01"
              min="0"
              max="100"
            />
            {errors.maxCommissionValue && <p className="mt-1 text-sm text-red-600">{errors.maxCommissionValue}</p>}
            <p className="mt-1 text-xs text-gray-500">Enter a value between 0 and 100</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false)
                setIsEditModalOpen(false)
                setSelectedLimit(null)
                setFormData({
                  bankId: '',
                  limitType: 'percentage',
                  maxCommissionValue: '',
                })
                setErrors({})
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : (selectedLimit ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, limit: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Commission Limit"
        message={`Are you sure you want to delete the commission limit for "${getBankName(confirmDelete.limit?.bank)}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default FranchiseCommission

