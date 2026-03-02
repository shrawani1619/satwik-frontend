import { useState, useEffect } from 'react'
import { Upload, X, File, Download, Trash2 } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'

// Generate invoice number
const generateInvoiceNumber = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `INV-${year}${month}${day}-${random}`
}

const InvoiceForm = ({ invoice, onSave, onClose, leads = [] }) => {
  const [formData, setFormData] = useState({
    leadId: '',
    commissionAmount: '',
    tdsPercentage: 2,
    status: 'pending',
  })

  const [errors, setErrors] = useState({})
  const [selectedLead, setSelectedLead] = useState(null)
  const [loadingLead, setLoadingLead] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loadingAttachments, setLoadingAttachments] = useState(false)

  // Fetch lead details when editing invoice (lead is already associated)
  useEffect(() => {
    if (invoice && invoice.lead) {
      // If lead is populated, use it directly
      if (typeof invoice.lead === 'object' && (invoice.lead._id || invoice.lead.id || invoice.lead.customerName || invoice.lead.loanAccountNo)) {
        setSelectedLead(invoice.lead)
        setFormData(prev => ({
          ...prev,
          leadId: invoice.lead._id || invoice.lead.id || invoice.lead
        }))
      } else {
        // If lead is just an ID, fetch the lead details
        const fetchLeadDetails = async () => {
          try {
            setLoadingLead(true)
            const leadId = invoice.lead?._id || invoice.lead?.id || invoice.lead || invoice.leadId
            if (leadId) {
              const response = await api.leads.getById(leadId)
              const leadData = response.data || response
              setSelectedLead(leadData)
              setFormData(prev => ({
                ...prev,
                leadId: leadId
              }))
            }
          } catch (error) {
            console.error('Error fetching lead details:', error)
            toast.error('Error', 'Failed to load lead information')
          } finally {
            setLoadingLead(false)
          }
        }
        fetchLeadDetails()
      }
    }
  }, [invoice])

  useEffect(() => {
    if (invoice) {
      const leadId = invoice.leadId || (invoice.lead && (invoice.lead._id || invoice.lead.id)) || invoice.lead || ''
      setFormData({
        leadId,
        commissionAmount: invoice.commissionAmount || '',
        tdsPercentage: invoice.tdsPercentage || 2,
        status: invoice.status || 'pending',
      })
      // Set selected lead if available
      if (invoice.lead) {
        setSelectedLead(invoice.lead)
      }
      // Fetch existing attachments
      fetchAttachments(invoice.id || invoice._id)
    }
  }, [invoice])

  const fetchAttachments = async (invoiceId) => {
    if (!invoiceId) return
    try {
      setLoadingAttachments(true)
      const response = await api.documents.list('invoice', invoiceId)
      const documents = response.data || response || []
      setAttachments(Array.isArray(documents) ? documents : [])
    } catch (error) {
      console.error('Error fetching attachments:', error)
      setAttachments([])
    } finally {
      setLoadingAttachments(false)
    }
  }

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return
    
    const invoiceId = invoice?.id || invoice?._id
    if (!invoiceId) {
      toast.error('Error', 'Please save the invoice first before uploading attachments')
      return
    }

    const filesArray = Array.from(files)
    setUploading(true)

    try {
      const uploadPromises = filesArray.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entityType', 'invoice')
        formData.append('entityId', invoiceId)
        formData.append('documentType', 'attachment')
        formData.append('description', `Invoice attachment: ${file.name}`)

        const response = await api.documents.upload(formData)
        return response.data || response
      })

      const uploadedDocs = await Promise.all(uploadPromises)
      setAttachments(prev => [...prev, ...uploadedDocs])
      toast.success('Success', `Successfully uploaded ${uploadedDocs.length} file(s)`)
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Upload Failed', error.message || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return
    }

    try {
      await api.documents.delete(documentId)
      setAttachments(prev => prev.filter(att => (att.id || att._id) !== documentId))
      toast.success('Success', 'Attachment deleted successfully')
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast.error('Error', error.message || 'Failed to delete attachment')
    }
  }

  // Update selected lead when leadId changes (leads from parent for dropdown sync; when editing, selectedLead is set from invoice)
  const leadsList = Array.isArray(leads) ? leads : []
  useEffect(() => {
    if (formData.leadId && leadsList.length > 0) {
      const lead = leadsList.find(l => (l.id || l._id) === formData.leadId || (l.id || l._id)?.toString() === String(formData.leadId))
      setSelectedLead(lead)
      // Auto-populate commission amount from lead if available
      if (lead && (lead.actualCommission || lead.expectedCommission)) {
        setFormData(prev => ({
          ...prev,
          commissionAmount: lead.actualCommission || lead.expectedCommission || prev.commissionAmount
        }))
      }
    } else {
      setSelectedLead(null)
    }
  }, [formData.leadId, leadsList])

  // Formula: Taxable = commission; GST = 18% of Taxable; TDS = 2% of Taxable; Gross = Taxable + GST - TDS
  const GST_RATE = 18
  const TDS_RATE = 2

  const validate = () => {
    const newErrors = {}
    
    // For editing, lead is already set from invoice
    if (!invoice && !formData.leadId) {
      newErrors.leadId = 'Lead is required'
    }
    
    if (!formData.commissionAmount || formData.commissionAmount <= 0) {
      newErrors.commissionAmount = 'Commission amount must be greater than 0'
    }

    // For editing, use invoice.lead; for creating, use selectedLead
    const leadToValidate = invoice?.lead || selectedLead
    if (!invoice && !leadToValidate) {
      newErrors.leadId = 'Please select a valid lead'
    } else if (leadToValidate && !invoice) {
      // Validate that lead has agent and franchise (only for new invoices)
      const agentId = leadToValidate.agent?._id || leadToValidate.agent?.id || leadToValidate.agent || leadToValidate.agentId
      const franchiseId = leadToValidate.franchise?._id || leadToValidate.franchise?.id || leadToValidate.franchise || leadToValidate.franchiseId
      if (!agentId) {
        newErrors.leadId = 'Selected lead must have a partner assigned'
      }
      if (!franchiseId) {
        newErrors.leadId = 'Selected lead must have a franchise assigned'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) {
      return
    }

    const taxable = parseFloat(formData.commissionAmount) // Commission (Taxable) = as entered / or Loan Amount × Rate%
    const gstAmount = (taxable * GST_RATE) / 100 // GST = 18% of Taxable
    const tdsAmount = (taxable * formData.tdsPercentage) / 100 // TDS = 2% of Taxable (or form %)
    const netPayable = taxable + gstAmount - tdsAmount // Gross = Taxable + GST - TDS

    const commissionAmount = taxable

    // For editing, use invoice data; for creating, use form data
    const leadData = invoice?.lead || selectedLead
    const leadId = invoice?.lead?._id || invoice?.lead?.id || invoice?.lead || formData.leadId
    
    // Extract agent and franchise IDs - handle both populated objects and IDs
    let agentId, franchiseId
    if (invoice) {
      // When editing, get from invoice
      agentId = invoice.agent?._id || invoice.agent?.id || invoice.agent
      franchiseId = invoice.franchise?._id || invoice.franchise?.id || invoice.franchise
    } else {
      // When creating, get from selected lead
      agentId = leadData?.agent?._id || leadData?.agent?.id || leadData?.agent || leadData?.agentId
      franchiseId = leadData?.franchise?._id || leadData?.franchise?.id || leadData?.franchise || leadData?.franchiseId
    }
    
    if (!agentId || !franchiseId) {
      toast.error('Error', 'Invoice must have both partner and franchise assigned')
      return
    }
    
    const invoiceData = {
      invoiceNumber: invoice?.invoiceNumber || generateInvoiceNumber(),
      lead: leadId,
      agent: agentId,
      franchise: franchiseId,
      commissionAmount,
      gstAmount,
      tdsAmount,
      tdsPercentage: formData.tdsPercentage,
      netPayable,
      status: formData.status,
    }
    
    console.log('🔍 DEBUG: Invoice data being sent:', JSON.stringify(invoiceData, null, 2))
    onSave(invoiceData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'commissionAmount' || name === 'tdsPercentage' 
        ? (value === '' ? '' : parseFloat(value) || value)
        : value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Lead Information - Display only, no dropdown */}
      {invoice && (invoice.lead || selectedLead) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead Information
          </label>
          {loadingLead ? (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Loading lead information...</p>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Customer Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(selectedLead || invoice.lead)?.customerName || (selectedLead || invoice.lead)?.loanAccountNo || (selectedLead || invoice.lead)?.leadId || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Loan Account No</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(selectedLead || invoice.lead)?.loanAccountNo || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Loan Type</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(selectedLead || invoice.lead)?.loanType ? (selectedLead || invoice.lead).loanType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                  <p className="text-sm font-medium text-gray-900">
                    ₹{((selectedLead || invoice.lead)?.loanAmount || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Partner</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedLead?.agent?.name || invoice.lead?.agent?.name || invoice.agent?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Franchise</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedLead?.franchise?.name || invoice.lead?.franchise?.name || invoice.franchise?.name || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* For new invoices, show lead selection is not needed as invoices are generated from leads */}
      {!invoice && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Invoices are typically generated from leads. If you need to create an invoice manually, please use the "Generate Invoice from Lead" option.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Commission Amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="commissionAmount"
          value={formData.commissionAmount}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.commissionAmount ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter commission amount"
          min="0"
          step="1000"
        />
        {errors.commissionAmount && <p className="mt-1 text-sm text-red-600">{errors.commissionAmount}</p>}
        {selectedLead && (selectedLead.actualCommission || selectedLead.expectedCommission) && (
          <p className="mt-1 text-xs text-gray-500">
            Suggested: ₹{(selectedLead.actualCommission || selectedLead.expectedCommission).toLocaleString()}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          TDS Percentage (%) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="tdsPercentage"
          value={formData.tdsPercentage}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          min="0"
          max="100"
          step="0.1"
        />
        {formData.commissionAmount && formData.tdsPercentage != null && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-sm space-y-1">
            <p><strong>Taxable (Commission):</strong> ₹{(parseFloat(formData.commissionAmount) || 0).toLocaleString()}</p>
            <p><strong>GST (18%):</strong> ₹{(((parseFloat(formData.commissionAmount) || 0) * GST_RATE / 100).toLocaleString())}</p>
            <p><strong>TDS ({formData.tdsPercentage}%):</strong> ₹{((parseFloat(formData.commissionAmount) || 0) * formData.tdsPercentage / 100).toLocaleString()}</p>
            <p><strong>Gross (Taxable + GST − TDS):</strong> ₹{((parseFloat(formData.commissionAmount) || 0) * (1 + GST_RATE / 100 - formData.tdsPercentage / 100)).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="escalated">Escalated</option>
          <option value="gst_paid">GST Paid</option>
          <option value="paid">Paid</option>
          <option value="regular_paid">Regular Paid</option>
        </select>
      </div>

      {/* Attachments Section - Only show when editing existing invoice */}
      {invoice && (
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
          </label>
          
          {/* File Upload Input */}
          <div className="mb-4">
            <input
              type="file"
              id="invoice-attachments"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
              className="hidden"
            />
            <label
              htmlFor="invoice-attachments"
              className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700">
                {uploading ? 'Uploading...' : 'Upload Attachments (Multiple files allowed)'}
              </span>
            </label>
          </div>

          {/* Existing Attachments List */}
          {loadingAttachments ? (
            <div className="text-sm text-gray-500 py-2">Loading attachments...</div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const attachmentId = attachment.id || attachment._id
                const fileName = attachment.originalFileName || attachment.fileName || 'Unknown'
                const fileUrl = attachment.url || attachment.filePath
                const fileSize = attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(2)} KB` : ''

                return (
                  <div
                    key={attachmentId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <File className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                        {fileSize && (
                          <p className="text-xs text-gray-500">{fileSize}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(attachmentId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-2">No attachments yet</div>
          )}
        </div>
      )}

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
          {invoice ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

export default InvoiceForm
