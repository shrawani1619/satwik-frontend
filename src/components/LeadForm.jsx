import { useState, useEffect } from 'react'
import { toast } from '../services/toastService'
import api from '../services/api'
import { authService } from '../services/auth.service'

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
    
    // Bank/Staff Details
    smbName: '',
    smbEmail: '',
    smbMobile: '',
    asmName: '',
    asmEmail: '',
    asmContactNumber: '',
    
    // Assignment
    agent: currentUserId,
    subAgent: '',
    leadType: 'new_lead',
    status: 'logged',
    
    // Additional Fields
    advancePayment: false,
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

      // Bank/assignment
      bank: bankValue,
      agent: agentValue,

      // Additional
      advancePayment: !!lead.advancePayment,
      remarks: lead.remarks || lead.remark || '',

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
    
    if (name === 'applicantMobile') {
      // Only allow digits
      newValue = value.replace(/[^0-9]/g, '')
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
      // Validate required fields
      if (!formData.applicantMobile) {
        toast.error('Applicant mobile is required')
        setLoading(false)
        return
      }

      // Prepare data for submission
      const submitData = {
        ...formData,
        loanAmount: formData.loanAmount ? parseFloat(formData.loanAmount) : undefined,
        cibil: formData.cibil ? parseInt(formData.cibil) : undefined,
      }

      // Remove empty fields
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '' || submitData[key] === null || submitData[key] === undefined) {
          delete submitData[key]
        }
      })

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
    { value: 'gold_loan', label: 'Gold Loan' },
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
                  onChange={(e) => setFormData(prev => ({ ...prev, advancePayment: e.target.value === 'true' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
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
          {loading ? 'Creating...' : 'Create Lead'}
        </button>
      </div>
    </form>
  )
}

export default LeadForm
