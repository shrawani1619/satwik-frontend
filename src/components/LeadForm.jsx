import { useState, useEffect } from 'react'
import { toast } from '../services/toastService'
import api from '../services/api'
import { authService } from '../services/auth.service'
import LeadEligibilityCounter from './LeadEligibilityCounter'
import {
  LEAD_MIN_AGE,
  LEAD_MAX_AGE,
  pickLeadField,
  validateLeadIncomeFields,
  serializeLeadIncomeFields,
} from '../utils/leadIncomeFields'
import {
  getBankTenureMonths,
  LEAD_MIN_TENURE_MONTHS,
  LEAD_MAX_TENURE_MONTHS,
} from '../utils/loanTenure'
import {
  buildLeadEligibilityValidationErrors,
  validationErrorsToFieldMap,
} from '../utils/leadEligibilityTracking'
import { computeLeadEligibilitySnapshot } from '../utils/leadEligibility'

const LeadForm = ({ onClose, onSave, lead }) => {
  const currentUser = authService.getUser()
  const userRole = currentUser?.role || 'super_admin'
  const currentUserId = currentUser?._id || ''

  const isEdit = !!lead

  const [formData, setFormData] = useState({
    // Basic Information
    applicantMobile: '',
    applicantEmail: '',
    customerName: '',
    pan: '',
    aadhar: '',
    email: '',
    mobile: '',
    
    // Loan Details
    loanType: '',
    loanAmount: '',
    bank: '',
    branch: '',
    projectName: '',

    applicantAge: '',
    cibil: '',
    foir: '',
    grossIncome: '',
    salary: '',
    deduction: '',
    currentEmi: '',
    rateOfInterest: '',
    tenureMonths: '',
    
    // SM/BM & ASM (matches backend lead.controller / lead.model)
    smBmName: '',
    smBmEmail: '',
    smBmMobile: '',
    asmName: '',
    asmEmail: '',
    asmMobile: '',
    
    // Assignment
    agent: currentUserId,
    subAgent: '',
    leadType: 'new_lead',
    status: 'logged',
    
    // Additional Fields
    advancePayment: false,
    disbursedAmount: '',
    advancePaymentDetails: '',
    remarks: '',
  })

  const [agents, setAgents] = useState([])
  const [banks, setBanks] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchBanks()
        if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'accounts_manager') {
          await fetchFranchises()
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setFetchError('Failed to load form data. Please refresh the page.')
      }
    }
    
    fetchData()
  }, [])

  useEffect(() => {
    if (!formData.bank || !formData.loanType) return
    if (String(formData.tenureMonths ?? '').trim() !== '') return
    const suggested = getBankTenureMonths(banks, formData.bank, formData.loanType)
    if (suggested) {
      setFormData((prev) => ({ ...prev, tenureMonths: String(suggested) }))
    }
  }, [formData.bank, formData.loanType, banks])

  useEffect(() => {
    if (!isEdit || !lead) return

    const bankValue = typeof lead.bank === 'object' && lead.bank
      ? (lead.bank._id || lead.bank.id || '')
      : (lead.bank || '')

    const agentValue = typeof lead.agent === 'object' && lead.agent
      ? (lead.agent._id || lead.agent.id || '')
      : (lead.agent || currentUserId)

    setFormData((prev) => ({
      ...prev,
      // Basic
      customerName: lead.customerName || '',
      applicantEmail: lead.applicantEmail || lead.email || '',
      applicantMobile: lead.applicantMobile || lead.mobile || lead.phone || '',
      pan: lead.pan || '',
      aadhar: lead.aadhar || lead.aadhaar || '',

      // Loan
      loanType: lead.loanType || '',
      loanAmount: lead.loanAmount ?? lead.amount ?? '',
      branch: lead.branch || '',
      projectName:
        lead.projectName ||
        lead.formValues?.projectName ||
        lead.formValues?.project_name ||
        '',

      applicantAge: String(pickLeadField(lead, 'applicantAge', ['age', 'applicant_age']) || ''),
      cibil: String(pickLeadField(lead, 'cibil') || ''),
      foir: String(pickLeadField(lead, 'foir', ['foi', 'foir_percent']) || ''),
      grossIncome: String(pickLeadField(lead, 'grossIncome', ['gross_income']) || ''),
      salary: String(pickLeadField(lead, 'salary') || ''),
      deduction: String(pickLeadField(lead, 'deduction') || ''),
      currentEmi: String(pickLeadField(lead, 'currentEmi', ['current_emi']) || ''),
      rateOfInterest: String(
        pickLeadField(lead, 'rateOfInterest', ['rate_of_interest', 'interest_rate']) || ''
      ),
      tenureMonths: String(
        pickLeadField(lead, 'tenureMonths', ['tenure', 'loanTenure', 'tenure_in_months']) || ''
      ),

      // Bank/assignment
      bank: bankValue,
      agent: agentValue,

      // Additional
      advancePayment: !!lead.advancePayment,
      disbursedAmount:
        lead.disbursedAmount != null && lead.disbursedAmount !== ''
          ? String(lead.disbursedAmount)
          : '',
      advancePaymentDetails: lead.advancePaymentDetails || '',
      remarks: lead.remarks || lead.remark || '',

      // SM/BM (denormalized fields + populated contact)
      smBmName:
        (typeof lead.smBm === 'object' && lead.smBm?.name) || lead.smBmName || '',
      smBmEmail: lead.smBmEmail || (typeof lead.smBm === 'object' && lead.smBm?.email) || '',
      smBmMobile: lead.smBmMobile || (typeof lead.smBm === 'object' && lead.smBm?.mobile) || '',

      // ASM
      asmName: lead.asmName || '',
      asmEmail: lead.asmEmail || '',
      asmMobile: lead.asmMobile || '',

      // Keep these values consistent in case the backend requires them
      leadType: lead.leadType || prev.leadType,
      status: lead.status || prev.status,
    }))
  }, [isEdit, lead, currentUserId])

  const fetchBanks = async () => {
    try {
      const response = await api.banks.getAll({ status: 'active' })
      setBanks(response.data || response || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      // Don't fail the entire form if banks can't be loaded
      setBanks([])
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll({ status: 'active' })
      setFranchises(response.data || response || [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      // Don't fail the entire form if franchises can't be loaded
      setFranchises([])
    }
  }

  const validateMobile = (mobile) => {
    if (!mobile) return 'Mobile number is required'
    if (!/^[0-9]{10}$/.test(mobile)) return 'Please enter a valid 10-digit mobile number'
    return ''
  }

  const validateEmail = (email) => {
    if (!email) return ''
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    return ''
  }

  const validatePAN = (pan) => {
    if (!pan) return ''
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    if (!panRegex.test(pan)) return 'Please enter a valid PAN (e.g., ABCDE1234F)'
    return ''
  }

  const validateAadhaar = (aadhar) => {
    if (!aadhar) return ''
    if (!/^[0-9]{12}$/.test(aadhar)) return 'Please enter a valid 12-digit Aadhaar number'
    return ''
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let newValue = value
    
    // Auto-format fields
    if (name === 'pan') {
      newValue = value.toUpperCase()
    }
    
    if (name === 'aadhar') {
      // Only allow digits
      newValue = value.replace(/[^0-9]/g, '')
    }
    
    if (name === 'applicantMobile' || name === 'smBmMobile' || name === 'asmMobile') {
      // Only allow digits
      newValue = value.replace(/[^0-9]/g, '')
    }

    if (name === 'cibil' || name === 'applicantAge' || name === 'tenureMonths') {
      newValue = value.replace(/[^0-9]/g, '')
    }

    const moneyFields = [
      'grossIncome',
      'salary',
      'deduction',
      'currentEmi',
      'foir',
      'rateOfInterest',
    ]
    if (moneyFields.includes(name)) {
      newValue = value.replace(/[^0-9.]/g, '')
      const parts = newValue.split('.')
      if (parts.length > 2) {
        newValue = `${parts[0]}.${parts.slice(1).join('')}`
      }
    }

    if (name === 'disbursedAmount') {
      newValue = value.replace(/[^0-9.]/g, '')
      const parts = newValue.split('.')
      if (parts.length > 2) {
        newValue = `${parts[0]}.${parts.slice(1).join('')}`
      }
    }

    if (name === 'bank' || name === 'loanType') {
      setFormData((prev) => ({
        ...prev,
        [name]: newValue,
        tenureMonths: '',
      }))
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: '' }))
      }
      return
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    let errorMessage = ''
    
    // Validate on blur
    switch(name) {
      case 'applicantMobile':
        errorMessage = validateMobile(value)
        break
      case 'applicantEmail':
        errorMessage = validateEmail(value)
        break
      case 'pan':
        errorMessage = validatePAN(value)
        break
      case 'aadhar':
        errorMessage = validateAadhaar(value)
        break
      case 'smBmEmail':
      case 'asmEmail':
        errorMessage = validateEmail(value)
        break
      case 'smBmMobile':
      case 'asmMobile':
        if (value && !/^[0-9]{10}$/.test(value)) {
          errorMessage = 'Please enter a valid 10-digit mobile number'
        }
        break
      default:
        break
    }
    
    if (errorMessage) {
      setErrors(prev => ({ ...prev, [name]: errorMessage }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const eligibilityValidationErrors = buildLeadEligibilityValidationErrors(formData)
      if (eligibilityValidationErrors.length > 0) {
        setErrors((prev) => ({ ...prev, ...validationErrorsToFieldMap(eligibilityValidationErrors) }))
        toast.error(eligibilityValidationErrors[0].message)
        setLoading(false)
        return
      }

      const snapshot = computeLeadEligibilitySnapshot(formData)
      if (!snapshot.requiredPassed) {
        const firstFailed = (snapshot.checklist ?? []).find((item) => item.required && !item.status)
        toast.error(firstFailed?.label ? `${firstFailed.label} not satisfied` : 'Complete required eligibility checks')
        setLoading(false)
        return
      }

      const incomeValidation = validateLeadIncomeFields(formData)
      if (!incomeValidation.ok) {
        setErrors(incomeValidation.errors)
        const firstMsg = Object.values(incomeValidation.errors)[0]
        toast.error(firstMsg || 'Please complete all required income fields')
        setLoading(false)
        return
      }
      setErrors({})

      // Prepare data for submission
      const submitData = {
        ...formData,
        loanAmount: formData.loanAmount ? parseFloat(formData.loanAmount) : undefined,
        cibil: formData.cibil ? parseInt(formData.cibil, 10) : undefined,
        ...serializeLeadIncomeFields(formData),
      }

      // Remove empty fields
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '' || submitData[key] === null || submitData[key] === undefined) {
          delete submitData[key]
        }
      })

      if (submitData.advancePayment === false) {
        submitData.advancePaymentDetails = null
        if (!isEdit) {
          submitData.disbursedAmount = 0
        } else {
          delete submitData.disbursedAmount
        }
      } else if (submitData.advancePayment === true) {
        const raw = String(formData.disbursedAmount ?? '').replace(/,/g, '')
        const d = parseFloat(raw)
        submitData.disbursedAmount = !isNaN(d) && d >= 0 ? d : 0
      }

      console.log('Submitting lead data:', submitData)
      const leadId = lead?._id || lead?.id

      if (isEdit && !leadId) {
        throw new Error('Lead ID is missing')
      }

      const response = isEdit
        ? await api.leads.update(leadId, submitData)
        : await api.leads.create(submitData)
      if (!response) {
        throw new Error('No response received from server')
      }

      if (isEdit) {
        console.log('Lead updated successfully:', response)
        toast.success('Lead updated successfully!')
      } else {
        console.log('Lead created successfully:', response)
        toast.success('Lead created successfully!')
      }

      if (onSave) onSave(response.data)
      onClose()
    } catch (error) {
      console.error(isEdit ? 'Error updating lead:' : 'Error creating lead:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save lead'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const loanTypes = [
    { value: 'personal_loan', label: 'Personal Loan' },
    { value: 'home_loan', label: 'Home Loan' },
    { value: 'business_loan', label: 'Business Loan' },
    { value: 'loan_against_property', label: 'Loan Against Property' },
    { value: 'education_loan', label: 'Education Loan' },
    { value: 'car_loan', label: 'Car Loan' },
  ]

  const residentialStatuses = [
    { value: 'owned', label: 'Owned' },
    { value: 'rented', label: 'Rented' },
    { value: 'family_owned', label: 'Family Owned' },
    { value: 'company_provided', label: 'Company Provided' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {fetchError}
        </div>
      )}

      {/* Bank Selection - Always visible */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Bank Selection</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Bank <span className="text-red-500">*</span>
            </label>
            <select
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Select Bank</option>
              {banks.map(bank => (
                <option key={bank._id} value={bank._id}>{bank.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Other fields - Only shown after bank is selected */}
      {formData.bank && (
        <>
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project name
                </label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Green Valley Residency"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="applicantEmail"
                  value={formData.applicantEmail}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.applicantEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="example@email.com"
                />
                {errors.applicantEmail && (
                  <p className="mt-1 text-xs text-red-600">{errors.applicantEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="applicantMobile"
                  value={formData.applicantMobile}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.applicantMobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="9876543210"
                  pattern="[0-9]{10}"
                  title="Please enter a valid 10 digit mobile number (e.g., 9876543210)"
                  maxLength={10}
                  required
                />
                {errors.applicantMobile && (
                  <p className="mt-1 text-xs text-red-600">{errors.applicantMobile}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicant age <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="applicantAge"
                  value={formData.applicantAge}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.applicantAge ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={`${LEAD_MIN_AGE}–${LEAD_MAX_AGE}`}
                  maxLength={2}
                  required
                />
                {errors.applicantAge && (
                  <p className="mt-1 text-xs text-red-600">{errors.applicantAge}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  name="pan"
                  value={formData.pan}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase ${
                    errors.pan ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="ABCDE1234F"
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                  maxLength={10}
                  title="Please enter a valid PAN (e.g., ABCDE1234F)"
                />
                {errors.pan && (
                  <p className="mt-1 text-xs text-red-600">{errors.pan}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  name="aadhar"
                  value={formData.aadhar}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.aadhar ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="XXXX-XXXX-XXXX"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  title="Please enter a valid 12 digit Aadhaar number"
                />
                {errors.aadhar && (
                  <p className="mt-1 text-xs text-red-600">{errors.aadhar}</p>
                )}
              </div>
            </div>
          </div>

          {/* Loan Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Loan Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="loanType"
                  value={formData.loanType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">-- select --</option>
                  {loanTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="loanAmount"
                  value={formData.loanAmount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenure (months) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="tenureMonths"
                  value={formData.tenureMonths}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.tenureMonths ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={`${LEAD_MIN_TENURE_MONTHS}–${LEAD_MAX_TENURE_MONTHS}`}
                  maxLength={3}
                  required
                />
                <p className="mt-0.5 text-xs text-gray-500">
                  Prefilled from bank defaults when available
                </p>
                {errors.tenureMonths && (
                  <p className="mt-1 text-xs text-red-600">{errors.tenureMonths}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter branch"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CIBIL / credit score</label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="cibil"
                  value={formData.cibil}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 750"
                  maxLength={3}
                />
                <p className="mt-0.5 text-xs text-gray-500">Optional — adds eligibility check (≥ 650)</p>
              </div>

            </div>
          </div>

          {/* Income & FOIR */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Income & FOIR</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FOIR (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="foir"
                  value={formData.foir}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.foir ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g. 50"
                  required
                />
                {errors.foir && <p className="mt-1 text-xs text-red-600">{errors.foir}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gross income (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="grossIncome"
                  value={formData.grossIncome}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.grossIncome ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Monthly gross"
                  required
                />
                {errors.grossIncome && (
                  <p className="mt-1 text-xs text-red-600">{errors.grossIncome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salary (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.salary ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Monthly salary"
                  required
                />
                {errors.salary && <p className="mt-1 text-xs text-red-600">{errors.salary}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deduction (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="deduction"
                  value={formData.deduction}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.deduction ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Total monthly deductions"
                  required
                />
                {errors.deduction && (
                  <p className="mt-1 text-xs text-red-600">{errors.deduction}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current EMI (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="currentEmi"
                  value={formData.currentEmi}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.currentEmi ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0 if none"
                  required
                />
                {errors.currentEmi && (
                  <p className="mt-1 text-xs text-red-600">{errors.currentEmi}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate of interest (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="rateOfInterest"
                  value={formData.rateOfInterest}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.rateOfInterest ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g. 10.5"
                  required
                />
                {errors.rateOfInterest && (
                  <p className="mt-1 text-xs text-red-600">{errors.rateOfInterest}</p>
                )}
              </div>
            </div>

            <LeadEligibilityCounter formData={formData} />
          </div>

          {/* SM / BM & ASM (bank coordination) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">SM / BM details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="smBmName"
                  value={formData.smBmName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="SM/BM name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="smBmEmail"
                  value={formData.smBmEmail}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.smBmEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="sm.bm@bank.com"
                />
                {errors.smBmEmail && (
                  <p className="mt-1 text-xs text-red-600">{errors.smBmEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                <input
                  type="tel"
                  name="smBmMobile"
                  value={formData.smBmMobile}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.smBmMobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {errors.smBmMobile && (
                  <p className="mt-1 text-xs text-red-600">{errors.smBmMobile}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">ASM details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="asmName"
                  value={formData.asmName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="ASM name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="asmEmail"
                  value={formData.asmEmail}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.asmEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="asm@bank.com"
                />
                {errors.asmEmail && (
                  <p className="mt-1 text-xs text-red-600">{errors.asmEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                <input
                  type="tel"
                  name="asmMobile"
                  value={formData.asmMobile}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.asmMobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {errors.asmMobile && (
                  <p className="mt-1 text-xs text-red-600">{errors.asmMobile}</p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Advance Payment
                </label>
                <select
                  name="advancePayment"
                  value={formData.advancePayment.toString()}
                  onChange={(e) => {
                    const yes = e.target.value === 'true'
                    setFormData((prev) => ({
                      ...prev,
                      advancePayment: yes,
                      ...(!yes
                        ? { advancePaymentDetails: '', disbursedAmount: '' }
                        : {}),
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div className={formData.advancePayment ? '' : 'opacity-60'}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disbursed amount (₹) {formData.advancePayment && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="disbursedAmount"
                  value={formData.disbursedAmount}
                  onChange={handleChange}
                  disabled={!formData.advancePayment}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remark
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter remarks"
              />
            </div>
          </div>
        </>
      )}

      {/* Form Actions - Always visible */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? isEdit
              ? 'Saving...'
              : 'Creating...'
            : isEdit
              ? 'Update Lead'
              : 'Create Lead'}
        </button>
      </div>
    </form>
  )
}

export default LeadForm
