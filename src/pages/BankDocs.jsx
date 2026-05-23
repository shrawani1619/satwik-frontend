import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import BankDocForm from '../components/BankDocForm'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { authService } from '../services/auth.service'
import { LOAN_TYPE_OPTIONS } from '../utils/loanTenure'

const formatLoanTypeLabel = (value) => {
  if (!value) return 'All loan types'
  const opt = LOAN_TYPE_OPTIONS.find((o) => o.value === value)
  return opt?.label || value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const BankDocs = () => {
  const userRole = authService.getUser()?.role || ''
  const canManage = userRole === 'super_admin'

  const [bankDocs, setBankDocs] = useState([])
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, doc: null })
  const [sortConfig, setSortConfig] = useState({ key: 'bankName', direction: 'asc' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [docsRes, banksRes] = await Promise.all([
        api.bankDocs.getAll(),
        api.banks.getAll(),
      ])
      const docsData = docsRes.data || docsRes || []
      const banksData = banksRes.data || banksRes || []
      setBankDocs(Array.isArray(docsData) ? docsData : [])
      setBanks(Array.isArray(banksData) ? banksData : [])
    } catch (error) {
      console.error('Error fetching bank docs:', error)
      toast.error('Error', error.message || 'Failed to load bank document configurations')
      setBankDocs([])
    } finally {
      setLoading(false)
    }
  }

  const filteredDocs = useMemo(() => {
    if (!bankDocs.length) return []
    const searchLower = searchTerm.toLowerCase()
    return bankDocs.filter((doc) => {
      if (!doc) return false
      const bankMatch = (doc.bankName || '').toLowerCase().includes(searchLower)
      const loanMatch = formatLoanTypeLabel(doc.loanType).toLowerCase().includes(searchLower)
      const itemMatch = (doc.checklistItems || []).some((item) =>
        String(item).toLowerCase().includes(searchLower)
      )
      return bankMatch || loanMatch || itemMatch
    })
  }, [bankDocs, searchTerm])

  const sortedDocs = useMemo(() => {
    if (!sortConfig.key) return filteredDocs
    return [...filteredDocs].sort((a, b) => {
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]
      if (sortConfig.key === 'checklistCount') {
        aValue = (a.checklistItems || []).length
        bValue = (b.checklistItems || []).length
      }
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = String(bValue).toLowerCase()
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredDocs, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  const handleAdd = () => {
    setSelectedDoc(null)
    setIsFormModalOpen(true)
  }

  const handleEdit = (doc) => {
    setSelectedDoc(doc)
    setIsFormModalOpen(true)
  }

  const handleView = (doc) => {
    setSelectedDoc(doc)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      setSaving(true)
      if (selectedDoc) {
        const docId = selectedDoc.id || selectedDoc._id
        if (!docId) {
          toast.error('Error', 'Configuration ID is missing')
          return
        }
        await api.bankDocs.update(docId, formData)
        toast.success('Success', 'Bank document checklist updated successfully')
      } else {
        await api.bankDocs.create(formData)
        toast.success('Success', 'Bank document checklist created successfully')
      }
      await fetchData()
      setIsFormModalOpen(false)
      setSelectedDoc(null)
    } catch (error) {
      console.error('Error saving bank doc:', error)
      toast.error('Error', error.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (doc) => {
    setConfirmDelete({ isOpen: true, doc })
  }

  const handleDeleteConfirm = async () => {
    const doc = confirmDelete.doc
    const docId = doc?.id || doc?._id
    if (!docId) {
      toast.error('Error', 'Configuration ID is missing')
      return
    }
    try {
      await api.bankDocs.delete(docId)
      await fetchData()
      toast.success('Success', `Checklist for "${doc.bankName}" deleted successfully`)
      setConfirmDelete({ isOpen: false, doc: null })
    } catch (error) {
      console.error('Error deleting bank doc:', error)
      toast.error('Error', error.message || 'Failed to delete configuration')
    }
  }

  const hasActiveFilters = searchTerm !== ''

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Docs</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage bank-wise document checklists for inquiry reminders
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Doc</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Search
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </span>
          {filtersOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bank, loan type, or document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('bankName')}
                >
                  <div className="flex items-center gap-2">
                    Bank
                    {getSortIcon('bankName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('loanType')}
                >
                  <div className="flex items-center gap-2">
                    Loan Type
                    {getSortIcon('loanType')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('checklistCount')}
                >
                  <div className="flex items-center gap-2">
                    Items
                    {getSortIcon('checklistCount')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    No bank document configurations found
                  </td>
                </tr>
              ) : (
                sortedDocs.map((doc) => {
                  const docId = doc.id || doc._id
                  const itemCount = (doc.checklistItems || []).length
                  return (
                    <tr key={docId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{doc.bankName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-800 rounded-full border border-primary-200">
                          {formatLoanTypeLabel(doc.loanType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {itemCount} document{itemCount !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.updatedAt
                          ? new Date(doc.updatedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(doc)}
                            className="text-primary-900 hover:text-primary-800 p-1"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(doc)}
                                className="text-gray-600 hover:text-gray-900 p-1"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(doc)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedDocs.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedDocs.length}</span> configuration
              {sortedDocs.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => {
          if (!saving) {
            setIsFormModalOpen(false)
            setSelectedDoc(null)
          }
        }}
        title={selectedDoc ? 'Edit Bank Document Checklist' : 'Add Bank Document Checklist'}
        size="lg"
      >
        <BankDocForm
          bankDoc={selectedDoc}
          banks={banks}
          onSave={handleSave}
          onClose={() => {
            if (!saving) {
              setIsFormModalOpen(false)
              setSelectedDoc(null)
            }
          }}
          saving={saving}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedDoc(null)
        }}
        title="Bank Document Checklist"
        size="md"
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Bank</label>
                <p className="mt-1 text-sm text-gray-900">{selectedDoc.bankName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Type</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatLoanTypeLabel(selectedDoc.loanType)}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Checklist Items</label>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                {(selectedDoc.checklistItems || []).map((item, index) => (
                  <li key={index} className="text-sm text-gray-900">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
            {canManage && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedDoc)
                  }}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit Checklist
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, doc: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Bank Document Checklist"
        message={`Are you sure you want to delete the checklist for "${confirmDelete.doc?.bankName || 'this bank'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default BankDocs
