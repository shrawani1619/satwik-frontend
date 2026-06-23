import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Copy, Settings2, History, X, Receipt, FileDown, CheckCircle, FileText, Paperclip, ExternalLink, Loader2 } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import DisbursementEmailModal from '../components/DisbursementEmailModal'
import LeadForm from '../components/LeadForm'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'
import { canExportLeads } from '../utils/roleUtils'
import AccountantLeads from './AccountantLeads'
import { formatInCrores, formatIndianRupee } from '../utils/formatUtils'
import { downloadSanctionLetterForLead, handleSanctionLetterDownloadClick } from '../utils/sanctionLetterPdf'
import SanctionAmountModal from '../components/SanctionAmountModal'
import { getLeadLoanAmount, validateSanctionAmount } from '../utils/sanctionAmount'

const SANCTION_STATUS = 'sanctioned_branch_appointment_fixed'

/** Row status dropdown — Logged always listed. */
const LEAD_STATUS_CHANGE_OPTIONS = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'logged', label: 'Logged' },
  { value: 'legal_valuation_property_done', label: 'Legal Valuation / Property Done' },
  { value: 'sanctioned_branch_appointment_fixed', label: 'Sanction and branch appointment are fixed' },
  { value: 'partial_disbursed', label: 'Partial Disbursed' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

const DEFAULT_LEAD_COLUMNS = [
  { key: 'customerName', label: 'Customer Name', visible: true, sortable: true },
  { key: 'loanType', label: 'Loan Type', visible: true, sortable: true },
  { key: 'loanAmount', label: 'Loan Amount', visible: true, sortable: true },
  { key: 'disbursedAmount', label: 'Disbursed Amount', visible: true, sortable: true },
  { key: 'remainingAmount', label: 'Remaining', visible: true, sortable: true },
  { key: 'status', label: 'Status', visible: true, sortable: true },
  { key: 'bank', label: 'Bank Name', visible: true, sortable: false },
  { key: 'smBm', label: 'SM/BM', visible: true, sortable: false },
  { key: 'asm', label: 'ASM', visible: true, sortable: false },
  { key: 'branch', label: 'Branch', visible: true, sortable: true },
  { key: 'projectName', label: 'Project Name', visible: true, sortable: true },
  { key: 'disbursementDate', label: 'Disbursement Date', visible: true, sortable: true },
  { key: 'sanctionedDate', label: 'Sanctioned Date', visible: true, sortable: true },
  { key: 'remarks', label: 'Remarks', visible: false, sortable: false },
  { key: 'createdAt', label: 'Date', visible: true, sortable: true },
  { key: 'actions', label: 'Actions', visible: true, sortable: false },
]

function mergeLeadColumnConfig(savedColumns) {
  const merged = [...savedColumns]
  const keys = new Set(merged.map((c) => c.key))
  for (const defCol of DEFAULT_LEAD_COLUMNS) {
    if (keys.has(defCol.key)) continue
    if (defCol.key === 'projectName') {
      const branchIdx = merged.findIndex((c) => c.key === 'branch')
      if (branchIdx >= 0) merged.splice(branchIdx + 1, 0, { ...defCol })
      else {
        const actionsIdx = merged.findIndex((c) => c.key === 'actions')
        if (actionsIdx >= 0) merged.splice(actionsIdx, 0, { ...defCol })
        else merged.push({ ...defCol })
      }
    } else {
      const actionsIdx = merged.findIndex((c) => c.key === 'actions')
      if (actionsIdx >= 0) merged.splice(actionsIdx, 0, { ...defCol })
      else merged.push({ ...defCol })
    }
    keys.add(defCol.key)
  }
  return merged
}

const Leads = () => {
  const userRole = authService.getUser()?.role || 'super_admin'
  const isAccountant = userRole === 'accounts_manager'
  const canViewHistory = ['super_admin', 'franchise'].includes(userRole)
  const canEdit = true
  const canCreate = true
  const canSendDisbursementEmail = true
  const showInvoiceRequestColumn = ['franchise', 'super_admin'].includes(userRole)

  // Render AccountantLeads for accountants
  if (isAccountant) {
    return <AccountantLeads />
  }

  const [leads, setLeads] = useState([])
  const [banks, setBanks] = useState([])
  const [staff, setStaff] = useState([])
  const [bankManagers, setBankManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [dsaCodeFilter, setDsaCodeFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailAttachments, setDetailAttachments] = useState([])
  const [loadingDetailAttachments, setLoadingDetailAttachments] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [leadHistory, setLeadHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryItems, setExpandedHistoryItems] = useState(new Set())
  const [selectedLead, setSelectedLead] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, lead: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [expandedFields, setExpandedFields] = useState({})
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [isDisbursementEmailModalOpen, setIsDisbursementEmailModalOpen] = useState(false)
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null)
  const [editingCommission, setEditingCommission] = useState({ leadId: null, field: null })
  const [commissionEditValues, setCommissionEditValues] = useState({ percentage: '', amount: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInvoiceNumberModalOpen, setIsInvoiceNumberModalOpen] = useState(false)
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('')
  const [invoiceRequestLead, setInvoiceRequestLead] = useState(null)
  const [isInvoiceRequestSubmitting, setIsInvoiceRequestSubmitting] = useState(false)
  const [sanctionPdfLoadingId, setSanctionPdfLoadingId] = useState(null)
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false)
  const [sanctionModalLead, setSanctionModalLead] = useState(null)
  const [sanctionAmountInput, setSanctionAmountInput] = useState('')
  const [sanctionInvoiceNumber, setSanctionInvoiceNumber] = useState('')
  const [isSanctionSubmitting, setIsSanctionSubmitting] = useState(false)

  const updateLeadSanctionPdfMeta = (leadId, pdfMeta) => {
    setLeads((prev) =>
      prev.map((l) => {
        const lid = l?._id || l?.id
        return lid && String(lid) === String(leadId) ? { ...l, sanctionLetterPdf: pdfMeta } : l
      })
    )
    setSelectedLead((prev) => {
      if (!prev) return prev
      const pid = prev._id || prev.id
      return pid && String(pid) === String(leadId) ? { ...prev, sanctionLetterPdf: pdfMeta } : prev
    })
  }


  // Column configuration with all available fields
  const [columnConfig, setColumnConfig] = useState(() => {
    const saved = localStorage.getItem('leadsColumnConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Remove leadType, contact, caseNumber, verificationStatus and sanctionedAmount columns if they exist in saved config
        const filtered = parsed.filter(col => col.key !== 'leadType' && col.key !== 'contact' && col.key !== 'caseNumber' && col.key !== 'verificationStatus' && col.key !== 'sanctionedAmount')
        
        // Remove ALL commission-related columns and partner columns
        const commissionKeys = [
          'commissionPercentage', 'commissionAmount',
          'referralFranchiseCommissionPercentage', 'referralFranchiseCommissionAmount'
        ]
        let updated = filtered.filter(col => !commissionKeys.includes(col.key))

        // Remove Partner / Referral Associated / Associated columns (legacy + current)
        const removeKeys = new Set([
          'partner', 'partnerId', 'partnerName',
          'createdBy', 'createdById', 'createdByName',
          'referral', 'referralAssociated', 'referral_associated',
          'associated', 'associatedId', 'associatedModel', 'franchise', 'franchiseId'
        ])
        updated = updated.filter((col) => {
          const key = String(col?.key || '').trim()
          const label = String(col?.label || '').toLowerCase()
          if (removeKeys.has(key)) return false
          if (label.includes('partner')) return false
          if (label.includes('referral')) return false
          if (label.includes('associated')) return false
          return true
        })
        
        // Update codeUse label to 'DSA Code' if it exists
        updated = updated.map(col => {
          // Normalize legacy 'franchise' column to 'associated'
          if (col.key === 'franchise') {
            return { ...col, key: 'associated', label: 'Associated' }
          }
          // If label mentions Franchise, rename to Associated (but not for commission columns)
          if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise') && !col.key.includes('Commission')) {
            return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
          }
          if (col.key === 'codeUse') {
            return { ...col, label: 'DSA Code' }
          }
          return col
        })
        
        // Remove any duplicate columns based on key (keep first occurrence)
        const seenKeys = new Set()
        const deduplicated = updated.filter(col => {
          if (seenKeys.has(col.key)) {
            return false
          }
          seenKeys.add(col.key)
          return true
        })

        return mergeLeadColumnConfig(deduplicated)
      } catch (e) {
        console.error('Error parsing saved column config:', e)
      }
    }
    return [...DEFAULT_LEAD_COLUMNS]
  })

  useEffect(() => {
    // Filter out leadType, contact, caseNumber, verificationStatus, and Partner/Referral/Associated columns before saving
    const filteredConfig = columnConfig.filter(col => 
      col.key !== 'leadType' && 
      col.key !== 'contact' && 
      col.key !== 'caseNumber' && 
      col.key !== 'verificationStatus' &&
      col.key !== 'associated' &&
      col.key !== 'franchise' &&
      col.key !== 'createdBy' &&
      col.key !== 'createdByName' &&
      !String(col.label || '').toLowerCase().includes('partner') &&
      !String(col.label || '').toLowerCase().includes('referral') &&
      !String(col.label || '').toLowerCase().includes('associated')
    )
    // Normalize any legacy 'franchise' keys and labels, and ensure codeUse label is 'DSA Code'
    const normalized = filteredConfig.map(col => {
      if (col.key === 'franchise') {
        return { ...col, key: 'associated', label: 'Associated' }
      }
      if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise')) {
        return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
      }
      if (col.key === 'codeUse') {
        return { ...col, label: 'DSA Code' }
      }
      return col
    })
    localStorage.setItem('leadsColumnConfig', JSON.stringify(normalized))
  }, [columnConfig])

  useEffect(() => {
    fetchLeads()
    fetchBanks()
    fetchBankManagers()
    fetchStaff()
    fetchFranchises()
  }, [userRole])

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      const isClickInsideOverlay = target.closest('.absolute.z-50') || target.closest('[data-expandable]')
      if (!isClickInsideOverlay) {
        setExpandedFields({})
      }
      const isClickInsideColumnSettings = target.closest('[data-column-settings]')
      if (!isClickInsideColumnSettings && !target.closest('button[data-column-settings-button]')) {
        setShowColumnSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expandedFields, showColumnSettings])

  const parseLeadsResponse = (response) => {
    if (Array.isArray(response)) return response
    if (response?.data && Array.isArray(response.data)) return response.data
    if (response?.data?.data && Array.isArray(response.data.data)) return response.data.data
    if (response?.leads && Array.isArray(response.leads)) return response.leads
    console.warn('Unexpected leads response structure:', response)
    return []
  }

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await api.leads.getAll({ limit: 1000 })
      const leadsData = parseLeadsResponse(response)
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
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

  const fetchStaff = async () => {
    try {
      const response = await api.staff.getAll()
      const staffData = response.data || response || []
      setStaff(Array.isArray(staffData) ? staffData : [])
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
    }
  }

  const fetchBankManagers = async () => {
    try {
      const response = await api.bankManagers.getAll({ limit: 1000 })
      const bmData = response.data || response || []
      setBankManagers(Array.isArray(bmData) ? bmData : [])
    } catch (error) {
      console.error('Error fetching bank managers:', error)
      setBankManagers([])
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll()
      const franchisesData = response.data || response || []
      setFranchises(Array.isArray(franchisesData) ? franchisesData : [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    }
  }

  const filterLeadsByUiState = (list) => {
    if (!list || list.length === 0) return []

    const searchLower = (searchTerm || '').trim().toLowerCase()
    const hasSearch = searchLower.length > 0

    return list.filter((lead) => {
      if (!lead) return false

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      if (!matchesStatus) return false

      if (franchiseFilter) {
        const fid = lead.associated?._id || lead.associated?.id || lead.associated
        if (!fid || (fid !== franchiseFilter && fid.toString() !== franchiseFilter)) return false
      }
      if (bankFilter) {
        const bid = lead.bank?._id || lead.bank?.id || lead.bank
        if (!bid || (bid !== bankFilter && bid.toString() !== bankFilter)) return false
      }
      if (dsaCodeFilter.trim()) {
        const code = (lead.dsaCode ?? lead.codeUse ?? '').toString().toLowerCase()
        if (!code.includes(dsaCodeFilter.trim().toLowerCase())) return false
      }
      if (projectFilter.trim()) {
        const project = (lead.projectName ?? lead.formValues?.projectName ?? lead.formValues?.project_name ?? '')
          .toString()
          .trim()
          .toLowerCase()
        if (project !== projectFilter.trim().toLowerCase()) return false
      }
      if (loanTypeFilter && loanTypeFilter !== 'all') {
        const leadType = (lead.loanType ?? '').toString().replace(/_/g, ' ').toLowerCase()
        if (!leadType.includes(loanTypeFilter.trim().toLowerCase())) return false
      }

      if (dateFromFilter || dateToFilter) {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null
        if (!leadDate) return false

        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter)
          fromDate.setHours(0, 0, 0, 0)
          if (leadDate < fromDate) return false
        }

        if (dateToFilter) {
          const toDate = new Date(dateToFilter)
          toDate.setHours(23, 59, 59, 999)
          if (leadDate > toDate) return false
        }
      }

      if (!hasSearch) return true

      const applicantEmail = lead.applicantEmail || lead.email || ''
      const applicantMobile = (lead.applicantMobile || lead.phone || lead.mobile || '').toString()
      const customerName = lead.customerName || ''
      const caseNumber = lead.caseNumber || ''
      const loanAccountNo = (lead.loanAccountNo || '').toString()
      const projectName = (lead.projectName ?? lead.formValues?.projectName ?? lead.formValues?.project_name ?? '')
        .toString()

      return (
        applicantEmail.toLowerCase().includes(searchLower) ||
        applicantMobile.includes(searchTerm.trim()) ||
        customerName.toLowerCase().includes(searchLower) ||
        caseNumber.toLowerCase().includes(searchLower) ||
        loanAccountNo.toLowerCase().includes(searchLower) ||
        projectName.toLowerCase().includes(searchLower)
      )
    })
  }

  const sortLeadsList = (list) => {
    if (!sortConfig.key) return list

    return [...list].sort((a, b) => {
      if (!a || !b) return 0

      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  // Filter and search leads
  const filteredLeads = useMemo(
    () => filterLeadsByUiState(leads),
    [leads, searchTerm, statusFilter, franchiseFilter, bankFilter, dsaCodeFilter, projectFilter, loanTypeFilter, dateFromFilter, dateToFilter]
  )

  const projectOptions = useMemo(() => {
    const names = new Set()
    leads.forEach((lead) => {
      const p = (lead.projectName ?? lead.formValues?.projectName ?? lead.formValues?.project_name ?? '')
        .toString()
        .trim()
      if (p) names.add(p)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [leads])

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'all' ||
    franchiseFilter !== '' ||
    bankFilter !== '' ||
    dsaCodeFilter.trim() !== '' ||
    projectFilter.trim() !== '' ||
    (loanTypeFilter && loanTypeFilter !== 'all') ||
    dateFromFilter !== '' ||
    dateToFilter !== ''
  
  // Calculate total loan amount from filtered leads
  const totalFilteredLoanAmount = useMemo(() => {
    return filteredLeads.reduce((sum, lead) => {
      const loanAmount = lead.loanAmount || lead.amount || 0
      return sum + (typeof loanAmount === 'number' ? loanAmount : parseFloat(loanAmount) || 0)
    }, 0)
  }, [filteredLeads])

  const clearLeadsFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
    setBankFilter('')
    setDsaCodeFilter('')
    setProjectFilter('')
    setLoanTypeFilter('all')
    setDateFromFilter('')
    setDateToFilter('')
  }

  // Sort leads
  const sortedLeads = useMemo(() => sortLeadsList(filteredLeads), [filteredLeads, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleInvoiceRequest = async (lead, event = null) => {
    if (event) event.stopPropagation()
    setInvoiceRequestLead(lead)
    setInvoiceNumberInput('')
    setIsInvoiceNumberModalOpen(true)
  }

  const submitInvoiceRequest = async () => {
    try {
      const lead = invoiceRequestLead
      const leadId = lead?.id || lead?._id
      if (!leadId) {
        toast.error('Error', 'Lead not found')
        return
      }
      const invoiceNumber = invoiceNumberInput.trim()
      if (!invoiceNumber) {
        toast.error('Error', 'Invoice number is required')
        return
      }

      setIsInvoiceRequestSubmitting(true)
      await api.invoices.generateFromLead(leadId, { invoiceNumber })
      toast.success('Success', 'Invoice requested successfully (pending accountant approval)')
      setIsInvoiceNumberModalOpen(false)
      setInvoiceRequestLead(null)
      setInvoiceNumberInput('')
      await fetchLeads()
    } catch (error) {
      console.error('Error generating invoice:', error)
      toast.error('Error', error?.message || 'Failed to generate invoice')
    } finally {
      setIsInvoiceRequestSubmitting(false)
    }
  }

  const getInvoiceRequestUi = (lead) => {
    const rawStatus = String(
      lead?.invoice?.status ||
      lead?.invoiceStatus ||
      ''
    )
      .trim()
      .toLowerCase()

    const hasInvoiceRequest = Boolean(lead?.invoice || lead?.isInvoiceGenerated || rawStatus)
    const statusEligible =
      lead?.status === 'partial_disbursed' ||
      lead?.status === 'partial disbursed' ||
      lead?.status === 'disbursed' ||
      lead?.status === 'completed'
    const thresholdPct = Number(lead?.bank?.disbursementThresholdPercentage ?? 0)
    const safeThresholdPct = Number.isFinite(thresholdPct) ? Math.min(Math.max(thresholdPct, 0), 100) : 0
    const loanAmount = Number(lead?.loanAmount ?? lead?.amount ?? 0)
    const disbursedAmount = Number(lead?.disbursedAmount ?? 0)
    const disbursedPct = loanAmount > 0 ? (disbursedAmount / loanAmount) * 100 : 0
    const thresholdEligible = disbursedPct >= safeThresholdPct
    const canGenerate = statusEligible && thresholdEligible

    if (!hasInvoiceRequest) {
      const blockedReason = !statusEligible
        ? 'Lead status must be Partial Disbursed, Disbursed, or Completed'
        : `Disbursement ${disbursedPct.toFixed(2)}% / required ${safeThresholdPct.toFixed(2)}%`
      return {
        type: 'action',
        enabled: canGenerate,
        label: canGenerate ? 'Generate Invoice' : 'Not Ready',
        reason: canGenerate ? 'Generate invoice' : blockedReason,
      }
    }

    if (['paid', 'regular_paid', 'gst_paid'].includes(rawStatus)) {
      return { type: 'badge', label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
    }

    if (rawStatus === 'approved') {
      return { type: 'badge', label: 'Approved', className: 'bg-green-50 text-green-700 border border-green-200' }
    }

    if (rawStatus === 'rejected') {
      return { type: 'badge', label: 'Rejected', className: 'bg-red-50 text-red-700 border border-red-200' }
    }

    if (['overdue', 'recovery_pending'].includes(rawStatus)) {
      return { type: 'badge', label: 'Overdue', className: 'bg-red-50 text-red-700 border border-red-200' }
    }

    if (['pending', 'escalated', 'draft', 'payment_pending', 'gst_pending'].includes(rawStatus) || hasInvoiceRequest) {
      return { type: 'badge', label: 'Requested', className: 'bg-purple-50 text-purple-700 border border-purple-200' }
    }

    return { type: 'badge', label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' }
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  const handleCreate = () => {
    setSelectedLead(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (lead) => {
    setSelectedLead(lead)
    setIsEditModalOpen(true)
  }

  const handleView = async (lead) => {
    setSelectedLead(lead)
    setIsDetailModalOpen(true)
    setDetailAttachments([])
    const leadId = lead?.id || lead?._id
    if (leadId) {
      try {
        setLoadingDetailAttachments(true)
        const res = await api.documents.list('lead', leadId)
        const docs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setDetailAttachments(docs.filter(d => d.documentType === 'attachment'))
      } catch (_) {
        setDetailAttachments([])
      } finally {
        setLoadingDetailAttachments(false)
      }
    }
  }

  const handleViewHistory = async (lead) => {
    setSelectedLead(lead)
    setIsHistoryModalOpen(true)
    setHistoryLoading(true)
    setExpandedHistoryItems(new Set())
    try {
      const response = await api.leads.getHistory(lead.id || lead._id)
      const historyData = response.data || response || []
      setLeadHistory(Array.isArray(historyData) ? historyData : [])
    } catch (error) {
      console.error('Error fetching lead history:', error)
      toast.error('Error', 'Failed to load lead history')
      setLeadHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDisbursementEmail = (lead) => {
    setSelectedLeadForEmail(lead)
    setIsDisbursementEmailModalOpen(true)
  }

  const toggleHistoryItem = (index) => {
    setExpandedHistoryItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const isHistoryItemExpanded = (index) => {
    return expandedHistoryItems.has(index)
  }

  const formatFieldName = (field) => {
    const fieldMap = {
      'createdBy': 'Created By',
      'associated': 'Associated',
      'bank': 'Bank',
      'smBm': 'SM/BM',
      'applicantMobile': 'Mobile',
      'applicantEmail': 'Email',
      'loanType': 'Loan Type',
      'loanAmount': 'Loan Amount',
      'disbursedAmount': 'Disbursed Amount',
      'status': 'Status',
      'disbursementDate': 'Disbursement Date',
      'sanctionedDate': 'Sanctioned Date',
      'customerName': 'Customer Name',
      'branch': 'Branch',
      'projectName': 'Project Name',
      'asmName': 'ASM Name',
      'asmEmail': 'ASM Email',
      'asmMobile': 'ASM Mobile',
      'smBmEmail': 'SM/BM Email',
      'smBmMobile': 'SM/BM Mobile',
      'remarks': 'Remarks',
      'commissionPercentage': 'Commission Percentage',
      'commissionBasis': 'Commission Basis',
    }
    return fieldMap[field] || field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  const formatFieldValue = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return new Date(value).toLocaleString()
    }

    // Handle ObjectId references - try to resolve to names
    if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
      if (fieldName === 'bank') {
        const bank = banks.find(b => (b._id || b.id) === value)
        return bank ? bank.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'associated') {
        const franchise = franchises.find(f => (f._id || f.id) === value)
        return franchise ? franchise.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'smBm') {
        const staffMember = staff.find(s => (s._id || s.id) === value)
        return staffMember ? staffMember.name : value.substring(0, 8) + '...'
      }
      return value.substring(0, 8) + '...'
    }

    // Handle object values (shouldn't happen, but just in case)
    if (typeof value === 'object') {
      if (value.name) return value.name
      if (value._id || value.id) {
        if (fieldName === 'bank') {
          const bank = banks.find(b => (b._id || b.id) === (value._id || value.id))
          return bank ? bank.name : 'Unknown'
        }
        if (fieldName === 'smBm') {
          const staffMember = staff.find(s => (s._id || s.id) === (value._id || value.id))
          return staffMember ? staffMember.name : 'Unknown'
        }
        return 'Unknown'
      }
      return '[Object]'
    }

    return String(value)
  }

  const handleSave = async (formData) => {
    // Prevent double submission
    if (isSubmitting) {
      toast.error('Error', 'Please wait, lead creation is already in progress')
      return
    }

    setIsSubmitting(true)
    try {
      const isNewLead = formData.leadType === 'new_lead';

      // Validate required fields (only fields with red asterisk)
      // Bank not required for new_lead type
      if (!isNewLead && !formData.bankId) {
        toast.error('Error', 'Bank is required')
        return
      }
      // If this is the legacy (predefined) payload, require loanType and loanAmount.
      if (!formData.loanType) {
        if (!formData.loanType) {
          toast.error('Error', 'Loan type is required')
          return
        }
        if (!formData.loanAmount || formData.loanAmount <= 0) {
          toast.error('Error', 'Loan amount must be greater than 0')
          return
        }
      }

      // Map form data to backend API format
      const leadData = {
        leadType: formData.leadType || 'bank',
        caseNumber: formData.caseNumber?.trim() || undefined,
        applicantMobile: formData.applicantMobile?.trim() || undefined,
        applicantEmail: formData.applicantEmail?.trim() || undefined,
        loanType: formData.loanType,
        loanAmount: formData.loanAmount ? parseFloat(formData.loanAmount) : undefined,
        status: formData.status || 'inquiry',
        associated: formData.associated || formData.associatedId || formData.franchiseId || undefined,
        associatedModel: formData.associatedModel || (formData.franchiseId ? 'Franchise' : undefined),
        bank: formData.bankId || formData.bank || undefined,
        customerName: formData.customerName?.trim() || undefined,
        sanctionedDate: formData.sanctionedDate || undefined,
        disbursedAmount: formData.disbursedAmount ? parseFloat(formData.disbursedAmount) : undefined,
        disbursementDate: formData.disbursementDate || undefined,
        disbursementType: formData.disbursementType || undefined,
        loanAccountNo: formData.loanAccountNo?.trim() || undefined,
        smBm: formData.smBmId || undefined,
        smBmName: formData.smBmName?.trim() || undefined,
        smBmEmail: formData.smBmEmail?.trim() || undefined,
        smBmMobile: formData.smBmMobile?.trim() || undefined,
        asmName: formData.asmName?.trim() || undefined,
        asmEmail: formData.asmEmail?.trim() || undefined,
        asmMobile: formData.asmMobile?.trim() || undefined,
        dsaCode: formData.dsaCode?.trim() || formData.codeUse?.trim() || undefined,
        branch: formData.branch?.trim() || undefined,
        projectName: formData.projectName?.trim() || undefined,
        remarks: formData.remarks?.trim() || undefined,
      }

      if (selectedLead) {
        // Update existing lead
        const leadId = selectedLead.id || selectedLead._id
        if (!leadId) {
          toast.error('Error', 'Lead ID is missing')
          return
        }
        await api.leads.update(leadId, leadData)

        await fetchLeads()

        await fetchStaff()

        setIsEditModalOpen(false)
        toast.success('Success', 'Lead updated successfully')
      } else {
        // Create new lead
        await api.leads.create(leadData)

        await fetchLeads()

        // Refresh staff list in case a new SM/BM was created
        await fetchStaff()

        setIsCreateModalOpen(false)
        toast.success('Success', 'Lead created successfully')
      }
      setSelectedLead(null)
    } catch (error) {
      console.error('Error saving lead:', error)
      // Only show toast if API error handler hasn't already shown it
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save lead')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeSanctionModal = () => {
    setIsSanctionModalOpen(false)
    setSanctionModalLead(null)
    setSanctionAmountInput('')
    setSanctionInvoiceNumber('')
  }

  const handleStatusSelectChange = (lead, newStatus) => {
    const leadId = lead?.id || lead?._id
    const prevStatus = lead?.status || 'inquiry'
    if (newStatus === prevStatus) {
      console.warn('[Leads] Status unchanged — no API call', { leadId, status: prevStatus })
      toast.info('No change', 'Lead is already in this status.')
      return
    }
    if (
      newStatus === SANCTION_STATUS &&
      prevStatus !== SANCTION_STATUS
    ) {
      setSanctionModalLead(lead)
      const defaultAmt = lead.sanctionedAmount ?? lead.loanAmount ?? lead.amount ?? ''
      setSanctionAmountInput(defaultAmt !== '' && defaultAmt != null ? String(defaultAmt) : '')
      setSanctionInvoiceNumber('')
      setIsSanctionModalOpen(true)
      return
    }
    handleStatusUpdate(leadId, newStatus, prevStatus)
  }

  const submitSanctionStatus = async () => {
    const lead = sanctionModalLead
    const leadId = lead?.id || lead?._id
    const amount = Number(String(sanctionAmountInput).replace(/,/g, '').trim())
    if (!leadId) {
      toast.error('Error', 'Lead ID is missing')
      return
    }
    const loanAmount = getLeadLoanAmount(lead)
    const check = validateSanctionAmount(amount, loanAmount)
    if (!check.valid) {
      toast.error('Error', check.message)
      return
    }

    setIsSanctionSubmitting(true)
    try {
      const payload = {
        status: SANCTION_STATUS,
        sanctionedAmount: amount,
        generateInvoice: true,
      }
      const invNo = sanctionInvoiceNumber.trim()
      if (invNo) payload.invoiceNumber = invNo

      const res = await api.leads.updateStatus(leadId, payload)
      if (res?.whatsapp) {
        console.error('[WhatsApp] status update response', res.whatsapp)
      }
      await fetchLeads()
      closeSanctionModal()
      if (res?.invoiceError) {
        toast.error('Partial success', res.invoiceError)
      } else {
        toast.success('Success', res?.message || 'Status updated and invoice generated')
      }
    } catch (error) {
      console.error('Error updating sanction status:', error)
      toast.error('Error', error.message || 'Failed to update status')
    } finally {
      setIsSanctionSubmitting(false)
    }
  }

  const handleStatusUpdate = async (leadId, newStatus, previousStatus) => {
    if (!leadId) {
      console.error('Lead ID is missing')
      toast.error('Error', 'Lead ID is missing')
      return
    }
    if (previousStatus && newStatus === previousStatus) {
      console.warn('[Leads] Status unchanged — no API call', { leadId, status: newStatus })
      toast.info('No change', 'Lead is already in this status.')
      return
    }
    try {
      console.error('[Leads] PUT status', { leadId, from: previousStatus, to: newStatus })
      const res = await api.leads.updateStatus(leadId, newStatus)
      if (res?.whatsapp) {
        console.error('[WhatsApp] status update response', res.whatsapp)
      }
      await fetchLeads()
      toast.success('Success', 'Lead status updated successfully')
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Error', error.message || 'Failed to update lead status')
    }
  }

  const handleDeleteClick = (lead) => {
    setConfirmDelete({ isOpen: true, lead })
  }

  const handleDeleteConfirm = async () => {
    const lead = confirmDelete.lead
    const leadId = lead.id || lead._id
    if (!leadId) {
      toast.error('Error', 'Lead ID is missing')
      return
    }

    try {
      await api.leads.delete(leadId)
      await fetchLeads()
      toast.success('Success', `Lead "${lead.caseNumber || 'this lead'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, lead: null })
    } catch (error) {
      console.error('Error deleting lead:', error)
      toast.error('Error', error.message || 'Failed to delete lead')
    }
  }

  const handleCommissionEdit = (lead, field) => {
    const leadId = lead.id || lead._id
    const currentPercentage = lead.commissionPercentage || 0
    const currentAmount = lead.commissionAmount || 0
    
    setEditingCommission({ leadId, field })
    setCommissionEditValues({ 
      percentage: typeof currentPercentage === 'number' ? currentPercentage.toString() : (currentPercentage || '0'), 
      amount: typeof currentAmount === 'number' ? currentAmount.toString() : (currentAmount || '0')
    })
  }

  const handleCommissionSave = async (lead) => {
    const leadId = lead.id || lead._id
    if (!leadId) {
      toast.error('Error', 'Lead ID is missing')
      return
    }

    try {
      const updateData = {}
      if (commissionEditValues.percentage) {
        updateData.commissionPercentage = parseFloat(commissionEditValues.percentage)
      }
      if (commissionEditValues.amount) {
        updateData.commissionAmount = parseFloat(commissionEditValues.amount)
      }

      await api.leads.update(leadId, updateData)
      await fetchLeads()
      toast.success('Success', 'Commission updated successfully')
      setEditingCommission({ leadId: null, field: null })
      setCommissionEditValues({ percentage: '', amount: '' })
    } catch (error) {
      console.error('Error updating commission:', error)
      toast.error('Error', error.message || 'Failed to update commission')
    }
  }

  const handleCommissionCancel = () => {
    setEditingCommission({ leadId: null, field: null })
    setCommissionEditValues({ percentage: '', amount: '' })
  }

  const getCreatedByName = (lead) => {
    if (!lead) return 'N/A'
    const creator = lead.createdByResolved || lead.createdBy
    if (typeof creator === 'object' && creator?.name) return creator.name
    return lead.createdByName || 'N/A'
  }

  const getBankName = (bankId) => {
    if (!bankId) return 'N/A'
    const bank = banks.find((b) => b.id === bankId || b._id === bankId)
    return bank ? (bank.name || 'N/A') : 'N/A'
  }

  const getFranchiseName = (franchiseIdOrObject) => {
    if (!franchiseIdOrObject) return 'N/A'

    if (typeof franchiseIdOrObject === 'object' && franchiseIdOrObject.name) {
      return franchiseIdOrObject.name
    }

    if (typeof franchiseIdOrObject === 'object') {
      const id = franchiseIdOrObject._id || franchiseIdOrObject.id
      if (id) {
        const franchise = franchises.find((f) => f.id === id || f._id === id)
        return franchise ? (franchise.name || 'N/A') : 'N/A'
      }
    }

    const franchise = franchises.find((f) => f.id === franchiseIdOrObject || f._id === franchiseIdOrObject)
    return franchise ? (franchise.name || 'N/A') : 'N/A'
  }

  const getAssociatedName = (lead) => {
    if (!lead) return 'N/A'
    if (lead.associated && typeof lead.associated === 'object' && lead.associated.name) {
      return lead.associated.name
    }

    return lead.associated?.name || getFranchiseName(lead.associated || lead.franchiseId || lead.franchise) || 'N/A'
  }

  const getStaffName = (staffIdOrObject) => {
    if (!staffIdOrObject) return 'N/A'

    if (typeof staffIdOrObject === 'object' && staffIdOrObject.name) {
      return staffIdOrObject.name
    }

    if (typeof staffIdOrObject === 'object') {
      const id = staffIdOrObject._id || staffIdOrObject.id
      if (id) {
        const staffMember = staff.find((s) => s.id === id || s._id === id)
        if (staffMember) return staffMember.name || 'N/A'
        const bm = bankManagers.find((b) => b.id === id || b._id === id)
        if (bm) return bm.name || 'N/A'
        return 'N/A'
      }
    }

    const staffMember = staff.find((s) => s.id === staffIdOrObject || s._id === staffIdOrObject)
    if (staffMember) return staffMember.name || 'N/A'
    const bm = bankManagers.find((b) => b.id === staffIdOrObject || b._id === staffIdOrObject)
    if (bm) return bm.name || 'N/A'
    return 'N/A'
  }

  const getBankDisplayNameForExport = (lead) => {
    if (lead.bankName) return lead.bankName
    if (lead.bank && typeof lead.bank === 'object' && lead.bank.name) return lead.bank.name
    const bankId = typeof lead.bank === 'string' ? lead.bank : (lead.bank?._id || lead.bank?.id)
    if (bankId) {
      const found = banks.find((b) => String(b.id || b._id) === String(bankId))
      if (found?.name) return found.name
    }
    return getBankName(lead.bankId || lead.bank) || 'N/A'
  }

  const getSmBmDisplayForExport = (lead) => {
    if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) return lead.smBm.name
    const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
    return getStaffName(smBmId)
  }

  const getLeadExportScalar = (lead, colKey) => {
    switch (colKey) {
      case 'caseNumber':
        return lead.caseNumber || 'N/A'
      case 'customerName':
        return lead.customerName || 'N/A'
      case 'loanType':
        return lead.loanType?.replace(/_/g, ' ') || 'N/A'
      case 'loanAmount': {
        const la = lead.loanAmount || lead.amount
        return la != null && la !== '' ? formatIndianRupee(la) : ''
      }
      case 'disbursedAmount':
        return lead.disbursedAmount != null && lead.disbursedAmount !== ''
          ? formatIndianRupee(lead.disbursedAmount)
          : ''
      case 'remainingAmount': {
        const la = lead.loanAmount || lead.amount || 0
        const d = lead.disbursedAmount || 0
        return formatIndianRupee(Math.max(0, la - d))
      }
      case 'status':
        return lead.status || 'N/A'
      case 'associated':
        return getAssociatedName(lead)
      case 'franchise':
        return getFranchiseName(lead.franchise || lead.franchiseId || lead.associated)
      case 'bank':
        return getBankDisplayNameForExport(lead)
      case 'smBm':
        return getSmBmDisplayForExport(lead)
      case 'asm':
        return lead.asmName || 'N/A'
      case 'branch':
        return lead.branch || 'N/A'
      case 'projectName':
        return (
          lead.projectName ||
          lead.formValues?.projectName ||
          lead.formValues?.project_name ||
          'N/A'
        )
      case 'loanAccountNo':
        return lead.loanAccountNo || 'N/A'
      case 'disbursementDate':
        return lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A'
      case 'sanctionedDate':
        return lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A'
      case 'codeUse':
      case 'dsaCode':
        return lead.dsaCode || lead.codeUse || 'N/A'
      case 'remarks':
        return lead.remarks || 'N/A'
      case 'createdAt':
        return lead.createdAt
          ? new Date(lead.createdAt).toLocaleDateString()
          : lead.created_at
            ? new Date(lead.created_at).toLocaleDateString()
            : 'N/A'
      case 'createdBy':
      case 'createdById':
      case 'createdByName':
        return getCreatedByName(lead)
      default: {
        const v = lead[colKey]
        if (v == null) return ''
        if (typeof v === 'object') {
          if (v.name != null) return String(v.name)
          return ''
        }
        return String(v)
      }
    }
  }

  const toggleExpand = (leadId, field) => {
    const key = `${leadId}-${field}`
    setExpandedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isExpanded = (leadId, field) => {
    const key = `${leadId}-${field}`
    return expandedFields[key] || false
  }

  const copyToClipboard = async (text, label) => {
    if (!text || text === 'N/A') return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied', `${label} copied to clipboard`)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Error', 'Failed to copy to clipboard')
    }
  }

  const moveColumn = (index, direction) => {
    const newConfig = [...columnConfig]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newConfig.length) return
    const [removed] = newConfig.splice(index, 1)
    newConfig.splice(newIndex, 0, removed)
    setColumnConfig(newConfig)
  }

  const toggleColumnVisibility = (key) => {
    // Prevent hiding the Actions column — required for the Download sanction-letter button.
    if (String(key || '').toLowerCase() === 'actions') return
    setColumnConfig(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ))
  }

  const visibleColumns = columnConfig.filter(col => {
    // Always keep the Actions column visible so Download PDF remains accessible.
    if (String(col?.key || '') === 'actions') return true
    if (!col.visible) return false

    const key = (col.key || '').toString().toLowerCase()
    const label = (col.label || '').toString().toLowerCase()

    if (userRole === 'franchise' && (key === 'associated' || key === 'franchise' || label.includes('associated') || label.includes('franchise'))) {
      return false
    }

    return true
  })

  const buildLeadExcelRows = (leadList, columns) => {
    const cols = (columns || []).filter((c) => c.key !== 'actions')
    return leadList.map((lead) => {
      const row = {}
      for (const col of cols) {
        row[col.label] = getLeadExportScalar(lead, col.key)
      }
      return row
    })
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'logged', label: 'Logged' },
    { value: 'inquiry', label: 'Inquiry' },
    { value: 'legal_valuation_property_done', label: 'Legal Valuation / Property Done' },
    { value: 'sanctioned_branch_appointment_fixed', label: 'Sanction and branch appointment are fixed' },
    { value: 'partial_disbursed', label: 'Partial Disbursed' },
    { value: 'disbursed', label: 'Disbursed' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden min-h-0 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 flex-shrink-0 gap-3 md:gap-0">
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Manage and track all loan leads</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-2">
          {canExportLeads() && (
            <button
              type="button"
              onClick={() => {
                const cols = visibleColumns.filter((c) => c.key !== 'actions')
                if (!cols.length) {
                  toast.error('Export', 'Enable at least one data column to export')
                  return
                }
                const rows = buildLeadExcelRows(sortedLeads, cols)
                if (!rows.length) {
                  toast.error('Export', 'No leads to export')
                  return
                }
                exportToExcel(rows, `leads_export_${Date.now()}`, 'Leads')
                toast.success('Export', `Exported ${rows.length} leads to Excel`)
              }}
              disabled={loading}
              title={loading ? 'Loading leads...' : 'Export currently filtered data to Excel'}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export to Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
          )}
          <div className="relative">
            <button
              data-column-settings-button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Settings2 className="w-4 h-4" />
              <span>Columns</span>
            </button>
            {showColumnSettings && (
              <div data-column-settings className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 min-w-[350px] max-h-[600px] overflow-y-auto">
                <div className="mb-3 font-semibold text-gray-900">Column Settings</div>
                <div className="text-xs text-gray-500 mb-3">Use arrows to reorder, checkbox to toggle visibility</div>
                <div className="space-y-1 mb-4">
                  {columnConfig
                    .filter(col => {
                      if (userRole === 'franchise') {
                        const k = (col.key || '').toString().toLowerCase()
                        const lbl = (col.label || '').toString().toLowerCase()
                        if (k === 'associated' || k === 'franchise' || lbl.includes('associated') || lbl.includes('franchise')) {
                          return false
                        }
                      }
                      return true
                    })
                    .map((col, index) => (
                      <div key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveColumn(index, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveColumn(index, 'down')}
                            disabled={index === columnConfig.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumnVisibility(col.key)}
                          className="w-4 h-4 text-primary-900 rounded"
                        />
                        <span className="flex-1 text-sm text-gray-700">{col.label}</span>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
          {canCreate && (
            <button
              onClick={handleCreate}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span>Create Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick search + project filter (always visible) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 mb-3 md:mb-4 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name, email, phone, project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Project name</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All projects</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3 md:mb-6 flex-shrink-0">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900 text-sm md:text-base">
            <Filter className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-gray-500" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, email, phone, project..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzY2NjY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_12px_center] bg-no-repeat"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                <select
                  value={franchiseFilter}
                  onChange={(e) => setFranchiseFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Associated</option>
                  {franchises.map((f) => (
                    <option key={f._id || f.id} value={f._id || f.id}>{f.name || 'Unnamed'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <select
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All banks</option>
                  {banks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>{b.name || 'Unnamed'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DSA Code</label>
                <input
                  type="text"
                  placeholder="Filter by DSA code..."
                  value={dsaCodeFilter}
                  onChange={(e) => setDsaCodeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">All projects</option>
                  {projectOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                <select
                  value={loanTypeFilter}
                  onChange={(e) => setLoanTypeFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="personal">Personal</option>
                  <option value="home">Home</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  min={dateFromFilter || undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {hasActiveFilters && (
                <>
                  <button type="button" onClick={clearLeadsFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                    Clear all filters
                  </button>
                  <span className="text-sm text-gray-500">Showing {filteredLeads.length} of {leads.length} leads</span>
                </>
              )}
              {!hasActiveFilters && (
                <span className="text-sm text-gray-500">Total {leads.length} leads</span>
              )}
              {totalFilteredLoanAmount > 0 && (
                <span className="text-sm font-semibold text-gray-700">
                  • Total Loan Amount: {formatInCrores(totalFilteredLoanAmount)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:flex flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${col.key === 'actions' ? 'text-right' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className={`flex items-center gap-2 ${col.key === 'actions' ? 'justify-end' : ''}`}>
                      {col.label}
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                {showInvoiceRequestColumn && (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap w-44">
                    Invoice Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length + (showInvoiceRequestColumn ? 1 : 0)} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedLeads.length === 0 ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length + (showInvoiceRequestColumn ? 1 : 0)} className="px-6 py-8 text-center text-gray-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => {
                  const renderCell = (col) => {
                    switch (col.key) {
                      case 'caseNumber':
                        return <div className="text-sm font-medium text-gray-900">{lead.caseNumber || 'N/A'}</div>
                      case 'customerName':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'customer')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.customerName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'customer') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'customer') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.customerName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.customerName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.applicantEmail || lead.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantEmail || lead.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.applicantMobile || lead.phone || lead.mobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantMobile || lead.phone || lead.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'loanType':
                        return <div className="text-sm text-gray-900">{lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</div>
                      case 'loanAmount':
                        return <div className="text-sm font-medium text-gray-900">{formatIndianRupee(lead.loanAmount || lead.amount || 0)}</div>
                      // 'sanctionedAmount' column removed
                      case 'disbursedAmount':
                        return <div className="text-sm font-medium text-gray-900">{formatIndianRupee(lead.disbursedAmount || 0)}</div>
                      case 'remainingAmount':
                        const loanAmount = lead.loanAmount || lead.amount || 0;
                        const disbursed = lead.disbursedAmount || 0;
                        const remaining = Math.max(0, loanAmount - disbursed);
                        return <div className="text-sm font-medium text-gray-900">{formatIndianRupee(remaining)}</div>
                      case 'status':
                        return <StatusBadge status={lead.status || 'inquiry'} />
                      case 'associated': {
                        const associatedName = getAssociatedName(lead)
                        const associatedObj = lead.associated
                        const associatedEmail = associatedObj?.email || 'N/A'
                        const associatedMobile = associatedObj?.mobile || 'N/A'
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'associated')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {associatedName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'associated') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'associated') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{associatedName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedName !== 'N/A' ? associatedName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{associatedEmail}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedEmail !== 'N/A' ? associatedEmail : '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{associatedMobile}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(associatedMobile !== 'N/A' ? associatedMobile : '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'bank': {
                        const bankName = (() => {
                          // 1. Denormalized bankName stored directly on lead (most reliable)
                          if (lead.bankName) return lead.bankName;
                          // 2. Populated bank object from backend
                          if (lead.bank && typeof lead.bank === 'object' && lead.bank.name) {
                            return lead.bank.name;
                          }
                          // 3. Look up in local banks array by ID
                          const bankId = typeof lead.bank === 'string' ? lead.bank : (lead.bank?._id || lead.bank?.id);
                          if (bankId) {
                            const found = banks.find(b => String(b.id || b._id) === String(bankId));
                            if (found?.name) return found.name;
                          }
                          return 'N/A';
                        })()
                        
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'bank')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {bankName}
                              </span>
                              {isExpanded(lead.id || lead._id, 'bank') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'bank') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{bankName}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(bankName !== 'N/A' ? bankName : '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.contactEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.contactMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'smBm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'smbm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {(() => {
                                  if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                    return lead.smBm.name
                                  }
                                  const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                  return getStaffName(smBmId)
                                })()}
                              </span>
                              {isExpanded(lead.id || lead._id, 'smbm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'smbm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">
                                        {(() => {
                                          if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                            return lead.smBm.name
                                          }
                                          const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                          return getStaffName(smBmId)
                                        })()}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const name = (() => {
                                            if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                              return lead.smBm.name
                                            }
                                            const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                            return getStaffName(smBmId)
                                          })()
                                          copyToClipboard(name, 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.smBmEmail || (lead.smBm?.email) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmEmail || lead.smBm?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.smBmMobile || (lead.smBm?.mobile) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmMobile || lead.smBm?.mobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'asm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'asm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.asmName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'asm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'asm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'branch':
                        return <div className="text-sm text-gray-900">{lead.branch || 'N/A'}</div>
                      case 'projectName': {
                        const pn =
                          lead.projectName ||
                          lead.formValues?.projectName ||
                          lead.formValues?.project_name ||
                          'N/A'
                        return (
                          <div className="text-sm text-gray-900 max-w-[140px] truncate" title={pn}>
                            {pn}
                          </div>
                        )
                      }
                      case 'loanAccountNo':
                        return <div className="text-sm text-gray-900">{lead.loanAccountNo || 'N/A'}</div>
                      case 'disbursementDate':
                        return <div className="text-sm text-gray-900">{lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A'}</div>
                      case 'sanctionedDate':
                        return <div className="text-sm text-gray-900">{lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A'}</div>
                      case 'codeUse':
                      case 'dsaCode':
                        return <div className="text-sm text-gray-900">{lead.dsaCode || lead.codeUse || 'N/A'}</div>
                      case 'remarks':
                        return <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.remarks || 'N/A'}>{lead.remarks || 'N/A'}</div>
                      case 'createdAt':
                        return <div className="text-sm text-gray-900">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</div>
                      case 'actions':
                        return (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSanctionLetterDownloadClick(
                                  lead,
                                  sanctionPdfLoadingId,
                                  setSanctionPdfLoadingId,
                                  updateLeadSanctionPdfMeta
                                )
                              }}
                              disabled={sanctionPdfLoadingId === String(lead._id || lead.id)}
                              className="text-emerald-700 hover:text-emerald-900 p-1 disabled:opacity-50"
                              title="Download sanction letter PDF"
                            >
                              {sanctionPdfLoadingId === String(lead._id || lead.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileDown className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleView(lead)}
                              className="text-primary-900 hover:text-primary-800 p-1"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canViewHistory && (
                              <button
                                onClick={() => handleViewHistory(lead)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="View History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            )}
                            {(canSendDisbursementEmail && (lead.status === 'disbursed' || lead.status === 'partial_disbursed')) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDisbursementEmail(lead)
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Disbursement Confirmation"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(lead)}
                                  className="text-gray-600 hover:text-gray-900 p-1"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(lead)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <select
                                  value={lead.status || 'inquiry'}
                                  onChange={(e) => {
                                    const next = e.target.value
                                    handleStatusSelectChange(lead, next)
                                    if (
                                      next === SANCTION_STATUS &&
                                      (lead.status || 'inquiry') !== SANCTION_STATUS
                                    ) {
                                      e.target.value = lead.status || 'inquiry'
                                    }
                                  }}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {LEAD_STATUS_CHANGE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        )
                      default:
                        return <div className="text-sm text-gray-900">N/A</div>
                    }
                  }

                  return (
                    <tr key={lead.id || lead._id} className="hover:bg-gray-50 border-b border-gray-200">
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-6 py-4 whitespace-nowrap ${col.key === 'actions' ? 'text-right' : ''}`}
                        >
                          {renderCell(col)}
                        </td>
                      ))}
                      {showInvoiceRequestColumn && (
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <div className="flex items-center justify-center min-h-[40px]">
                            {(() => {
                              const invoiceUi = getInvoiceRequestUi(lead)
                              if (invoiceUi.type === 'action') {
                                return (
                                  <button
                                    onClick={(e) => invoiceUi.enabled && handleInvoiceRequest(lead, e)}
                                    disabled={!invoiceUi.enabled}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                      invoiceUi.enabled
                                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                    }`}
                                    title={invoiceUi.reason || 'Generate invoice'}
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span className="whitespace-nowrap">{invoiceUi.label}</span>
                                  </button>
                                )
                              }

                              return (
                                <span
                                  className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${invoiceUi.className}`}
                                >
                                  {invoiceUi.label}
                                </span>
                              )
                            })()}
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
        {sortedLeads.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedLeads.length}</span> of{' '}
              <span className="font-medium">{sortedLeads.length}</span> leads
            </p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 mb-4">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No leads found</p>
          </div>
        ) : (
          sortedLeads.map((lead) => {
            const getFieldValue = (col) => {
              switch (col.key) {
                case 'customerName':
                  return lead.customerName || 'N/A'
                case 'loanType':
                  return lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'
                case 'loanAmount':
                  return formatIndianRupee(lead.loanAmount || lead.amount || 0)
                case 'disbursedAmount':
                  return formatIndianRupee(lead.disbursedAmount || 0)
                case 'status':
                  return lead.status || 'inquiry'
                case 'bank':
                  return lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A'
                case 'loanAccountNo':
                  return lead.loanAccountNo || 'N/A'
                case 'projectName':
                  return (
                    lead.projectName ||
                    lead.formValues?.projectName ||
                    lead.formValues?.project_name ||
                    'N/A'
                  )
                case 'branch':
                  return lead.branch || 'N/A'
                default:
                  return 'N/A'
              }
            }

            const primaryColumns = visibleColumns.filter(col => 
              ['customerName', 'loanType', 'loanAmount', 'status'].includes(col.key)
            )
            const secondaryColumns = visibleColumns.filter(col => 
              !['customerName', 'loanType', 'loanAmount', 'status', 'actions'].includes(col.key) && col.visible
            ).slice(0, 4) // Limit to 4 secondary fields for mobile

            return (
              <div
                key={lead.id || lead._id}
                onClick={() => {
                  setSelectedLead(lead)
                  setIsDetailModalOpen(true)
                }}
                className="bg-white rounded-lg border border-gray-200 p-4 min-h-[48px] active:bg-gray-50 transition-colors"
              >
                {/* Primary Info */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {lead.customerName || 'N/A'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge status={lead.status || 'inquiry'} />
                    </div>
                  </div>
                </div>

                {/* Secondary Info */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {secondaryColumns.map((col) => {
                    const value = getFieldValue(col)
                    if (value === 'N/A' || !value) return null
                    return (
                      <div key={col.key} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">{col.label}:</span>
                        <span className="text-xs font-semibold text-gray-900 text-right flex-1 ml-2">
                          {col.key === 'loanAmount' || col.key === 'disbursedAmount' ? value : String(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                {visibleColumns.some(col => col.key === 'actions') && (
                  <div className="pt-3 border-t border-gray-100 mt-3 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSanctionLetterDownloadClick(
                          lead,
                          sanctionPdfLoadingId,
                          setSanctionPdfLoadingId,
                          updateLeadSanctionPdfMeta
                        )
                      }}
                      disabled={sanctionPdfLoadingId === String(lead._id || lead.id)}
                      className="text-emerald-700 hover:text-emerald-900 p-2 disabled:opacity-50"
                      title="Download sanction letter PDF"
                    >
                      {sanctionPdfLoadingId === String(lead._id || lead.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                            setIsEditModalOpen(true)
                          }}
                          className="text-gray-600 hover:text-gray-900 p-2"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {(() => {
                          if (!['franchise', 'super_admin'].includes(userRole)) return null
                          const invoiceUi = getInvoiceRequestUi(lead)
                          if (invoiceUi.type !== 'action' || !invoiceUi.enabled) return null
                          return (
                            <button
                              onClick={(e) => handleInvoiceRequest(lead, e)}
                              className="text-purple-700 hover:text-purple-900 p-2"
                              title={invoiceUi.reason || 'Generate invoice'}
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(lead)
                          }}
                          className="text-red-600 hover:text-red-900 p-2"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                            setIsDetailModalOpen(true)
                          }}
                          className="text-primary-600 hover:text-primary-900 p-2"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <SanctionAmountModal
        isOpen={isSanctionModalOpen}
        onClose={closeSanctionModal}
        lead={sanctionModalLead}
        sanctionAmount={sanctionAmountInput}
        onSanctionAmountChange={setSanctionAmountInput}
        invoiceNumber={sanctionInvoiceNumber}
        onInvoiceNumberChange={setSanctionInvoiceNumber}
        onSubmit={submitSanctionStatus}
        isSubmitting={isSanctionSubmitting}
      />

      <Modal
        isOpen={isInvoiceNumberModalOpen}
        onClose={() => {
          setIsInvoiceNumberModalOpen(false)
          setInvoiceRequestLead(null)
          setInvoiceNumberInput('')
        }}
        title="Generate Invoice"
        size="sm"
        closeOnOverlay={false}
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-gray-600">
            Enter invoice number for <span className="font-semibold text-gray-900">{invoiceRequestLead?.customerName || 'selected lead'}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoiceNumberInput}
              onChange={(e) => setInvoiceNumberInput(e.target.value)}
              placeholder="Enter invoice number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsInvoiceNumberModalOpen(false)
                setInvoiceRequestLead(null)
                setInvoiceNumberInput('')
              }}
              className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
              disabled={isInvoiceRequestSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitInvoiceRequest}
              className="px-3 py-2 text-sm rounded bg-primary-900 text-white hover:bg-primary-800"
              disabled={isInvoiceRequestSubmitting}
            >
              {isInvoiceRequestSubmitting ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setIsSubmitting(false); }}
        title="Create New Lead"
        size="lg"
      >
        <LeadForm
          onClose={() => { setIsCreateModalOpen(false); fetchLeads(); }}
          onSave={(newLead) => {
            setLeads([newLead, ...leads])
          }}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedLead(null)
          setIsSubmitting(false)
        }}
        title="Edit Lead"
      >
        <LeadForm
          lead={selectedLead}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedLead(null)
            setIsSubmitting(false)
            fetchLeads()
          }}
          onSave={(updatedLead) => {
            setLeads((prev) => {
              const uid = updatedLead?._id || updatedLead?.id
              return prev.map((l) => {
                const lid = l?._id || l?.id
                return uid && lid && String(lid) === String(uid) ? updatedLead : l
              })
            })
          }}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLead(null)
        }}
        title="Lead Details"
        size="md"
      >
        {selectedLead && (
          <div className="space-y-5">
            {/* Customer Details */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Customer Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.customerName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Co-applicant Name</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.coApplicantName || selectedLead.formValues?.coApplicantName || selectedLead.formValues?.co_applicant_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantEmail || selectedLead.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Mobile</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantMobile || selectedLead.phone || selectedLead.mobile || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Loan Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Loan Type</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.loanType || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Loan Amount</label>
                  <p className="mt-1 text-sm text-gray-900">{formatIndianRupee(selectedLead.loanAmount || selectedLead.amount || 0)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Project name</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.projectName ||
                      selectedLead.formValues?.projectName ||
                      selectedLead.formValues?.project_name ||
                      'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <StatusBadge status={selectedLead.status || 'inquiry'} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Disbursement Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.disbursementDate ? new Date(selectedLead.disbursementDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Bank</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.bank?.name || getBankName(selectedLead.bankId || selectedLead.bank) || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Branch</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.branch || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">SM/BM Name</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {(() => {
                      if (selectedLead.smBm && typeof selectedLead.smBm === 'object' && selectedLead.smBm.name) {
                        return selectedLead.smBm.name
                      }
                      const smBmId = selectedLead.smBmId || (selectedLead.smBm && (selectedLead.smBm._id || selectedLead.smBm.id)) || selectedLead.smBm
                      return getStaffName(smBmId)
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">SM/BM Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmEmail || selectedLead.smBm?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">SM/BM Mobile</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmMobile || selectedLead.smBm?.mobile || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Other Details */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Other Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created By</label>
                  <p className="mt-1 text-sm text-gray-900">{getCreatedByName(selectedLead)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Associated</label>
                  <p className="mt-1 text-sm text-gray-900">{getAssociatedName(selectedLead)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ASM Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.asmName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ASM Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.asmEmail || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ASM Mobile</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.asmMobile || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">DSA Code</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLead.dsaCode || selectedLead.codeUse || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Loan sanction letter (Puppeteer PDF) */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  Loan sanction letter
                </span>
                {selectedLead?.sanctionLetterPdf?.generatedAt && (
                  <span className="text-xs text-gray-500">
                    Generated {new Date(selectedLead.sanctionLetterPdf.generatedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!sanctionPdfLoadingId}
                  onClick={async () => {
                    const id = selectedLead._id || selectedLead.id
                    if (!id) return
                    setSanctionPdfLoadingId(String(id))
                    try {
                      const res = await api.leads.generateSanctionLetterPdf(id)
                      const pdfMeta = res?.data?.sanctionLetterPdf
                      updateLeadSanctionPdfMeta(String(id), pdfMeta)
                      toast.success('PDF ready', 'Sanction letter generated successfully.')
                    } catch (e) {
                      if (!e._toastShown) toast.error('Error', e.message || 'Could not generate PDF')
                    } finally {
                      setSanctionPdfLoadingId(null)
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary-900 text-white text-sm font-medium rounded-lg hover:bg-primary-800 disabled:opacity-50"
                >
                  {sanctionPdfLoadingId === String(selectedLead._id || selectedLead.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Generate PDF
                </button>
                <button
                  type="button"
                  disabled={!!sanctionPdfLoadingId}
                  onClick={() =>
                    handleSanctionLetterDownloadClick(
                      selectedLead,
                      sanctionPdfLoadingId,
                      setSanctionPdfLoadingId,
                      updateLeadSanctionPdfMeta
                    )
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Attachments
                  {detailAttachments.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {detailAttachments.length}
                    </span>
                  )}
                </span>
              </div>
              {loadingDetailAttachments ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  Loading attachments…
                </div>
              ) : detailAttachments.length > 0 ? (
                <div className="space-y-2">
                  {detailAttachments.map((att) => {
                    const name = att.fileName || att.originalFileName || att.name || 'Attachment'
                    const ext = name.split('.').pop()?.toLowerCase() || ''
                    const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext)
                    const isPdf = ext === 'pdf'
                    const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : null
                    return (
                      <div
                        key={att.id || att._id}
                        className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                          isImage ? 'bg-green-500' : isPdf ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {isPdf ? 'PDF' : ext.toUpperCase().slice(0,3) || '📎'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {sizeKB && <p className="text-xs text-gray-500">{sizeKB} KB</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => api.documents.open(att.id || att._id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-1">No attachments for this lead</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 flex gap-2">
              {canViewHistory && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleViewHistory(selectedLead)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <History className="w-4 h-4" />
                  View History
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedLead)
                  }}
                  className="flex-1 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit Lead
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, lead: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Lead"
        message={`Are you sure you want to delete lead "${confirmDelete.lead?.caseNumber || 'this lead'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Disbursement Email Modal */}
      <DisbursementEmailModal
        isOpen={isDisbursementEmailModalOpen}
        onClose={() => {
          setIsDisbursementEmailModalOpen(false)
          setSelectedLeadForEmail(null)
        }}
        leadId={selectedLeadForEmail?.id || selectedLeadForEmail?._id}
      />

      {/* History Sidebar */}
      {isHistoryModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-50 z-[10000]"
            onClick={() => {
              setIsHistoryModalOpen(false)
              setSelectedLead(null)
              setLeadHistory([])
              setExpandedHistoryItems(new Set())
            }}
          ></div>

          {/* Sidebar */}
          <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-[450px] bg-white shadow-2xl z-[10001] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                History - {selectedLead?.caseNumber || 'Lead'}
              </h3>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false)
                  setSelectedLead(null)
                  setLeadHistory([])
                  setExpandedHistoryItems(new Set())
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {historyLoading ? (
                <div className="py-8 text-center text-gray-500">Loading history...</div>
              ) : leadHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No history available for this lead.</div>
              ) : (
                <div className="space-y-2">
                  {leadHistory.map((historyItem, index) => {
                    const isExpanded = isHistoryItemExpanded(index)
                    const changeCount = historyItem.changes?.length || 0

                    return (
                      <div
                        key={historyItem._id || historyItem.id || index}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                      >
                        {/* Collapsed Header - Always Visible */}
                        <div
                          className="p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleHistoryItem(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-900 capitalize">
                                  {historyItem.action?.replace(/_/g, ' ')}
                                </span>
                                {changeCount > 0 && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                    {changeCount} {changeCount === 1 ? 'change' : 'changes'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {historyItem.changedBy && (
                                  <span>
                                    by <span className="font-medium">{historyItem.changedBy.name || historyItem.changedBy.email || 'Unknown'}</span>
                                  </span>
                                )}
                                <span className="text-gray-400">
                                  {historyItem.createdAt
                                    ? new Date(historyItem.createdAt).toLocaleString()
                                    : historyItem.created_at
                                      ? new Date(historyItem.created_at).toLocaleString()
                                      : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'transform rotate-180' : ''
                                }`}
                            />
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-2 pb-2 border-t border-gray-100">
                            {historyItem.changes && historyItem.changes.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {historyItem.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="bg-gray-50 rounded p-2 border border-gray-100">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">
                                      {formatFieldName(change.field)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-red-600 line-through flex-1 truncate">
                                        {formatFieldValue(change.oldValue, change.field)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600 font-semibold flex-1 truncate">
                                        {formatFieldValue(change.newValue, change.field)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic text-center py-2">
                                {historyItem.action === 'created' ? 'Lead was created' : 'No field changes recorded'}
                              </div>
                            )}

                            {historyItem.remarks && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                                  <span className="font-semibold text-gray-700">Remarks: </span>
                                  {historyItem.remarks}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Leads
