import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import api from '../services/api'
import PasswordField from './PasswordField'

const rmIdsFromAccountant = (am) => {
    const raw = am?.assignedRegionalManagers
    if (!Array.isArray(raw) || raw.length === 0) return []
    return raw.map((r) => (typeof r === 'object' && r ? String(r._id || r.id) : String(r))).filter(Boolean)
}

const AccountantManagerForm = ({ accountantManager, onSave, onClose, isSaving = false }) => {
    const isEdit = !!accountantManager
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        password: '',
    })
    const [assignedRegionalManagers, setAssignedRegionalManagers] = useState([])
    const [regionalManagers, setRegionalManagers] = useState([])
    const [rmSelect, setRmSelect] = useState('')
    const [errors, setErrors] = useState({})

    useEffect(() => {
        let cancelled = false

        const fetchAssignableUsers = async () => {
            try {
                const [rmRes, adminRes] = await Promise.all([
                    api.users.getAll({ role: 'regional_manager', limit: 500, status: 'active' }),
                    // Allow selecting Admin (super_admin) from the same dropdown
                    api.users.getAll({ role: 'super_admin', limit: 50, status: 'active' }),
                ])

                const rmData = rmRes.data || rmRes || []
                const adminData = adminRes.data || adminRes || []

                const combined = [
                    ...(Array.isArray(adminData) ? adminData : []),
                    ...(Array.isArray(rmData) ? rmData : []),
                ]

                if (!cancelled) setRegionalManagers(combined)
            } catch (e) {
                if (!cancelled) setRegionalManagers([])
            }
        }

        fetchAssignableUsers()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (accountantManager) {
            setFormData({
                name: accountantManager.name || '',
                email: accountantManager.email || '',
                mobile: accountantManager.mobile || accountantManager.phone || '',
                password: '',
            })
            setAssignedRegionalManagers(rmIdsFromAccountant(accountantManager))
        } else {
            setFormData({
                name: '',
                email: '',
                mobile: '',
                password: '',
            })
            setAssignedRegionalManagers([])
        }
        setRmSelect('')
    }, [accountantManager])

    const rmById = useMemo(() => {
        const map = new Map()
        regionalManagers.forEach((rm) => {
            const id = String(rm._id || rm.id)
            if (id) map.set(id, rm)
        })
        return map
    }, [regionalManagers])

    const availableRegionalManagers = useMemo(() => {
        return [...regionalManagers]
            .filter((rm) => !assignedRegionalManagers.includes(String(rm._id || rm.id)))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    }, [regionalManagers, assignedRegionalManagers])

    const validate = () => {
        const newErrors = {}
        if (!formData.name.trim()) newErrors.name = 'Name is required'
        if (!formData.email.trim()) newErrors.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
        if (!formData.mobile.trim()) newErrors.mobile = 'Mobile is required'
        if (!isEdit && (!formData.password || formData.password.length < 6)) {
            newErrors.password = 'Password must be at least 6 characters'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const addRegionalManagerFromDropdown = () => {
        const sid = String(rmSelect || '').trim()
        if (!sid) return
        setAssignedRegionalManagers((prev) => (prev.includes(sid) ? prev : [...prev, sid]))
        setRmSelect('')
    }

    const removeRegionalManager = (id) => {
        const sid = String(id)
        setAssignedRegionalManagers((prev) => prev.filter((x) => x !== sid))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validate()) {
            const payload = {
                ...formData,
                role: 'accounts_manager',
                assignedRegionalManagers,
            }
            if (isEdit && !payload.password) {
                delete payload.password
            }
            onSave(payload)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Full name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="email@example.com"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span></label>
                    <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="10-digit mobile number"
                    />
                    {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password {!isEdit && <span className="text-red-500">*</span>}
                    </label>
                    <PasswordField
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={isEdit ? "Leave blank to keep current" : "Min 6 characters"}
                        autoComplete={isEdit ? 'current-password' : 'new-password'}
                        error={!!errors.password}
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="rm-assign-select">
                    Assigned user
                </label>
                <p className="text-xs text-gray-500">
                    This accountant will only see leads for users working under the franchises linked to these selected users. Add at least one for access to approved leads.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        id="rm-assign-select"
                        value={rmSelect}
                        onChange={(e) => setRmSelect(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={regionalManagers.length === 0 || availableRegionalManagers.length === 0}
                    >
                        <option value="">
                            {regionalManagers.length === 0
                                ? 'No users available'
                                : availableRegionalManagers.length === 0
                                  ? 'All users are already assigned'
                                  : 'Select user…'}
                        </option>
                        {availableRegionalManagers.map((rm) => {
                            const id = String(rm._id || rm.id)
                            const label = [rm.name || '—', rm.email].filter(Boolean).join(' · ')
                            return (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            )
                        })}
                    </select>
                    <button
                        type="button"
                        onClick={addRegionalManagerFromDropdown}
                        disabled={!rmSelect || isSaving}
                        className="shrink-0 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add
                    </button>
                </div>
                {assignedRegionalManagers.length > 0 ? (
                    <ul className="flex flex-wrap gap-2 pt-1">
                        {assignedRegionalManagers.map((id) => {
                            const rm = rmById.get(id)
                            const title = rm ? [rm.name, rm.email].filter(Boolean).join(' · ') : id
                            return (
                                <li
                                    key={id}
                                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-primary-50 border border-primary-200 text-sm text-primary-900"
                                >
                                    <span className="max-w-[220px] truncate" title={title}>
                                        {rm?.name || rm?.email || 'User'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeRegionalManager(id)}
                                        className="p-0.5 rounded-full hover:bg-primary-100 text-primary-700"
                                        aria-label={`Remove ${rm?.name || 'user'}`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="text-xs text-amber-700 pt-1">
                        No users assigned — this accountant will not see scoped leads until you add at least one.
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : (isEdit ? 'Update Accountant Manager' : 'Create Accountant Manager')}
                </button>
            </div>
        </form>
    )
}

export default AccountantManagerForm
