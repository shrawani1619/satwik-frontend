import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileDown,
  Download,
  Loader2,
} from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import Form130Form from '../components/Form130Form'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { authService } from '../services/auth.service'

const Form130 = () => {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, form: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [detailDocuments, setDetailDocuments] = useState([])
  const [loadingDetailDocs, setLoadingDetailDocs] = useState(false)

  const userRole = authService.getUser()?.role
  const isAdminOrAccountant = userRole === 'super_admin' || userRole === 'accounts_manager'

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.form16.getAll()
      const data = response.data || response || []
      setForms(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching Form 130:', error)
      setError(error.message || 'Failed to load Form 130 / TDS records')
      setForms([])
    } finally {
      setLoading(false)
    }
  }

  const totalForms = forms.length

  const filteredForms = useMemo(() => {
    if (!forms || forms.length === 0) return []

    return forms.filter((form) => {
      if (!form) return false
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (form.fileName && form.fileName.toLowerCase().includes(searchLower)) ||
        (form.attachmentName && form.attachmentName.toLowerCase().includes(searchLower)) ||
        (form.formType && form.formType.toLowerCase().includes(searchLower))
      return matchesSearch
    })
  }, [forms, searchTerm])

  const sortedForms = useMemo(() => {
    if (!sortConfig.key) return filteredForms

    return [...filteredForms].sort((a, b) => {
      if (!a || !b) return 0
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredForms, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleCreate = () => {
    setSelectedForm(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (form) => {
    setSelectedForm(form)
    setIsEditModalOpen(true)
  }

  const handleViewDetails = async (form) => {
    setSelectedForm(form)
    setLoadingDetailDocs(true)
    try {
      const resp = await api.documents.list('form16', form._id || form.id)
      setDetailDocuments(resp?.documents || resp?.data || [])
    } catch (e) {
      console.error('Error fetching Form 130 documents:', e)
      setDetailDocuments([])
    } finally {
      setLoadingDetailDocs(false)
    }
    setIsDetailModalOpen(true)
  }

  const handleDelete = (form) => {
    setConfirmDelete({ isOpen: true, form })
  }

  const handleDeleteConfirm = async () => {
    try {
      const id = confirmDelete.form._id || confirmDelete.form.id
      await api.form16.delete(id)
      await fetchForms()
      toast.success('Success', 'Form 130 / TDS record deleted successfully')
      setConfirmDelete({ isOpen: false, form: null })
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Error', error.message || 'Failed to delete')
    }
  }

  const formatDate = (d) => {
    if (!d) return 'N/A'
    return new Date(d).toLocaleDateString()
  }

  const handleExport = () => {
    const headers = [
      'File Name',
      'Attachment Name',
      'Form Type',
      'User',
      'Status',
      'Created At',
    ]
    const data = sortedForms.map((form) => [
      form.fileName || 'N/A',
      form.attachmentName || 'N/A',
      form.formType || 'N/A',
      form.user?.name || 'N/A',
      form.status || 'active',
      formatDate(form.createdAt),
    ])
    exportToExcel(headers, data, 'Form-130-TDS-Records')
  }

  const hasActiveFilters = searchTerm

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading Form 130 / TDS records...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchForms}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content - Only show when not loading and no error */}
      {!loading && !error && (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Form 130 / TDS</h1>
                  {/* Compact Inline Badge - Mobile Only */}
                  <span className="md:hidden inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {totalForms} records
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage Form 130 and TDS documents</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Export to Excel"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                {isAdminOrAccountant && (
                  <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Create Form 130 / TDS</span>
                    <span className="sm:hidden">Create</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statistics Cards - Desktop Only */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Total Records" value={totalForms} icon={FileText} color="blue" />
          </div>

          {/* Filters - Collapsible Accordion */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden md:relative sticky top-0 z-20 md:z-auto md:shadow-sm">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <span className="hidden sm:inline">Filter options</span>
                <span className="sm:hidden">Filters</span>
                {hasActiveFilters && (
                  <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </span>
              {filtersOpen ? (
                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              )}
            </button>
            {filtersOpen && (
              <div className="border-t border-gray-200 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Attachment name, file name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[                      
                      { key: 'fileName', label: 'File Name' },
                      { key: 'attachmentName', label: 'Attachment Name' },
                      { key: 'formType', label: 'Form Type' },
                      { key: 'user', label: 'User' },
                      { key: 'status', label: 'Status' },
                      { key: 'createdAt', label: 'Created At' },
                      { key: 'actions', label: 'Actions', sortable: false },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          col.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                        }`}
                        onClick={() => col.sortable !== false && handleSort(col.key)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{col.label}</span>
                          {sortConfig.key === col.key && (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sortedForms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No Form 130 / TDS records found</p>
                      </td>
                    </tr>
                  ) : (
                    sortedForms.map((form) => (
                      <tr
                        key={form._id || form.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{form.fileName || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{form.attachmentName || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {form.formType || 'Form 130'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{form.user?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              form.status === 'active'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {form.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(form.createdAt)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetails(form)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdminOrAccountant && (
                              <>
                                <button
                                  onClick={() => handleEdit(form)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(form)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Form 130 / TDS"
        size="lg"
      >
        <Form130Form
          onSave={() => {
            fetchForms()
            setIsCreateModalOpen(false)
          }}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Form 130 / TDS"
        size="lg"
      >
        {selectedForm && (
          <Form130Form
            form16={selectedForm}
            onSave={() => {
              fetchForms()
              setIsEditModalOpen(false)
            }}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Form 130 / TDS Details"
        size="lg"
      >
        {selectedForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">File Name</label>
                <p className="text-base font-semibold text-gray-900">{selectedForm.fileName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Attachment Name</label>
                <p className="text-base font-semibold text-gray-900">{selectedForm.attachmentName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Form Type</label>
                <p className="text-base font-medium text-gray-900">{selectedForm.formType || 'Form 130'}</p>
              </div>
        
              <div>
                <label className="text-sm font-medium text-gray-500">User</label>
                <p className="text-base font-medium text-gray-900">{selectedForm.user?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <p className="text-base font-medium">
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      selectedForm.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {selectedForm.status || 'active'}
                  </span>
                </p>
              </div>
            </div>

            {/* Documents Section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Attached Documents</h4>
              {loadingDetailDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : detailDocuments && detailDocuments.length > 0 ? (
                <div className="space-y-2">
                  {detailDocuments.map((doc) => (
                    <div
                      key={doc._id || doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.documentName || 'Document'}</p>
                          <p className="text-xs text-gray-500">{formatDate(doc.uploadedAt)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => api.documents.open(doc._id || doc.id)}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">No files attached</p>
              )}
            </div>

            {isAdminOrAccountant && (
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedForm)
                  }}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, form: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Form 130 / TDS"
        message="Are you sure you want to delete this Form 130 / TDS record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Form130
