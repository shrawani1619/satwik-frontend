import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Mail, Phone } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import RegionalManagerForm from '../components/RegionalManagerForm'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'

const RegionalManagers = () => {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, user: null })

  const fetchManagers = async () => {
    try {
      setLoading(true)
      const response = await api.users.getAll({ role: 'regional_manager', limit: 500 })
      const data = response.data || response || []
      setManagers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching regional managers:', error)
      toast.error('Error', error.message || 'Failed to load regional managers')
      setManagers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchManagers()
  }, [])

  const filtered = useMemo(() => {
    return managers.filter((u) => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        !searchTerm ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobile && String(u.mobile).includes(searchTerm))
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [managers, searchTerm, statusFilter])

  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered
    return [...filtered].sort((a, b) => {
      let av = a[sortConfig.key] ?? ''
      let bv = b[sortConfig.key] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const sortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  const handleSave = async (formData) => {
    try {
      setIsSaving(true)
      if (selected?._id) {
        const { role: _r, ...rest } = formData
        await api.users.update(selected._id, rest)
        toast.success('Success', 'Regional Manager updated')
      } else {
        await api.users.create(formData)
        toast.success('Success', 'Regional Manager created')
      }
      setIsCreateOpen(false)
      setIsEditOpen(false)
      setSelected(null)
      await fetchManagers()
    } catch (error) {
      console.error(error)
      toast.error('Error', error.message || 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.user) return
    try {
      await api.users.delete(confirmDelete.user._id || confirmDelete.user.id)
      toast.success('Success', 'Regional Manager removed')
      setConfirmDelete({ isOpen: false, user: null })
      await fetchManagers()
    } catch (error) {
      toast.error('Error', error.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-primary-900" />
            Regional Managers
          </h1>
          <p className="text-sm text-gray-600 mt-1">Create and manage regional manager accounts</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null)
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Regional Manager
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name, email, or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-500 text-sm">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">No regional managers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" className="flex items-center gap-1 font-semibold text-gray-700" onClick={() => handleSort('name')}>
                      Name {sortIcon('name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">
                    <button type="button" className="flex items-center gap-1 font-semibold text-gray-700" onClick={() => handleSort('email')}>
                      Email {sortIcon('email')}
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden lg:table-cell font-semibold text-gray-700">Mobile</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((u) => (
                  <tr key={u._id || u.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {u.email || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {u.mobile || u.phone || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status || 'active'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(u)
                            setIsEditOpen(true)
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ isOpen: true, user: u })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setSelected(null)
        }}
        title="Add Regional Manager"
        size="md"
      >
        <RegionalManagerForm
          regionalManager={null}
          onSave={handleSave}
          onClose={() => {
            setIsCreateOpen(false)
            setSelected(null)
          }}
          isSaving={isSaving}
        />
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false)
          setSelected(null)
        }}
        title="Edit Regional Manager"
        size="md"
      >
        <RegionalManagerForm
          regionalManager={selected}
          onSave={handleSave}
          onClose={() => {
            setIsEditOpen(false)
            setSelected(null)
          }}
          isSaving={isSaving}
        />
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, user: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Regional Manager"
        message={`Remove "${confirmDelete.user?.name}"? They will no longer be able to sign in.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default RegionalManagers
