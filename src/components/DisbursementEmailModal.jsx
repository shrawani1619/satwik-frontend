import { useState, useEffect } from 'react'
import { X, Mail, Edit, Send, Loader2, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'

const DisbursementEmailModal = ({ isOpen, onClose, leadId }) => {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [emailData, setEmailData] = useState(null)
  const [editedData, setEditedData] = useState(null)
  const [tableFields, setTableFields] = useState([])
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen && leadId) {
      fetchEmailPreview()
    } else {
      // Reset state when modal closes
      setEmailData(null)
      setEditedData(null)
      setTableFields([])
      setIsEditing(false)
      setErrors({})
    }
  }, [isOpen, leadId])

  const fetchEmailPreview = async () => {
    try {
      setLoading(true)
      const response = await api.leads.getDisbursementEmailPreview(leadId)
      if (response.success) {
        setEmailData(response.data)
        setEditedData(response.data)
        // Initialize table fields from structured data
        if (response.data.tableFields) {
          setTableFields(response.data.tableFields)
        } else {
          // Fallback: parse from HTML if tableFields not available
          setTableFields([])
        }
      } else {
        toast.error('Error', response.error || 'Failed to load email preview')
      }
    } catch (error) {
      console.error('Error fetching email preview:', error)
      toast.error('Error', error.message || 'Failed to load email preview')
    } finally {
      setLoading(false)
    }
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = () => {
    const newErrors = {}

    if (!editedData.to || !editedData.to.trim()) {
      newErrors.to = 'TO email is required'
    } else if (!validateEmail(editedData.to)) {
      newErrors.to = 'Invalid email format'
    }

    if (!editedData.subject || !editedData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    }

    // Validate CC emails
    if (editedData.cc && editedData.cc.length > 0) {
      const invalidCC = editedData.cc.filter(cc => !validateEmail(cc.email))
      if (invalidCC.length > 0) {
        newErrors.cc = 'Some CC emails have invalid format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditedData(emailData)
    if (emailData?.tableFields) {
      setTableFields(emailData.tableFields)
    }
    setIsEditing(false)
    setErrors({})
  }

  const handleTableFieldChange = (key, value) => {
    setTableFields(prev => prev.map(field => 
      field.key === key ? { ...field, value } : field
    ))
  }

  const generateTableHTML = (fields) => {
    const rows = fields.map(field => {
      const bgColor = field.highlighted ? 'background-color: #fff9c4;' : ''
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #000; width: 40%;">${field.label}</td>
          <td style="padding: 8px; border: 1px solid #000; width: 60%; ${bgColor}">${field.value || '-'}</td>
        </tr>
      `
    }).join('')

    return `
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 70%; font-family: Arial, sans-serif; border: 2px solid #000;">
        <tr style="background-color: #d32f2f; color: #ffffff;">
          <td style="font-weight: bold; text-align: center; padding: 10px; border: 1px solid #000; width: 40%;">Descriptions</td>
          <td style="font-weight: bold; text-align: center; padding: 10px; border: 1px solid #000; width: 60%;">Status</td>
        </tr>
        ${rows}
      </table>
    `
  }

  const generateEmailBody = (fields) => {
    const tableHTML = generateTableHTML(fields)
    // Extract reporting manager info from table fields or use emailData
    const reportingManagerField = fields.find(f => f.key === 'reportingManager')
    let name = emailData?.lead?.reportingManager || 'Satwik Network'
    let mobile = emailData?.lead?.reportingManagerMobile || ''
    
    // If reporting manager field exists and has value, parse it
    if (reportingManagerField?.value && reportingManagerField.value !== '-') {
      const parts = reportingManagerField.value.trim().split(/\s+/)
      if (parts.length > 0) {
        name = parts[0] || name
        mobile = parts.slice(1).join(' ') || mobile
      }
    }
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <p>Dear Sir/Madam,</p>
          <p>Kindly Provide Disbursement Confirmation in below mentioned format & ( attaché - Sanction Letter/SOA/Appraisal Letter if required)</p>
          ${tableHTML}
          <p style="margin-top: 20px;">Regards,<br>
          ${name}<br>
          ${mobile}<br>
          Satwik Network</p>
        </body>
      </html>
    `
  }

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value,
    }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleCCChange = (index, value) => {
    const newCC = [...editedData.cc]
    newCC[index].email = value
    setEditedData(prev => ({
      ...prev,
      cc: newCC,
    }))
    if (errors.cc) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.cc
        return newErrors
      })
    }
  }

  const handleAddCC = () => {
    setEditedData(prev => ({
      ...prev,
      cc: [...prev.cc, { email: '', role: 'Custom', name: '' }],
    }))
  }

  const handleRemoveCC = (index) => {
    const newCC = editedData.cc.filter((_, i) => i !== index)
    setEditedData(prev => ({
      ...prev,
      cc: newCC,
    }))
  }

  const handleSend = async () => {
    if (!validateForm()) {
      toast.error('Validation Error', 'Please fix the errors before sending')
      return
    }

    try {
      setSending(true)
      
      // Prepare CC array (just emails)
      const ccEmails = editedData.cc
        .map(cc => cc.email)
        .filter(email => email && email.trim())

      // Generate email body from table fields
      const emailBody = generateEmailBody(tableFields)

      const response = await api.leads.sendDisbursementEmail(leadId, {
        to: editedData.to.trim(),
        cc: ccEmails,
        subject: editedData.subject.trim(),
        body: emailBody,
      })

      if (response.success) {
        toast.success('Success', 'Disbursement confirmation email sent successfully')
        onClose()
      } else {
        const errorMsg = response.error || 'Failed to send email'
        const details = response.details ? `\n\nTechnical details: ${response.details}` : ''
        toast.error('Error Sending Email', errorMsg + details)
      }
    } catch (error) {
      console.error('Error sending email:', error)
      // Try to extract error message from response
      let errorMessage = 'Failed to send email'
      if (error.message) {
        errorMessage = error.message
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      toast.error('Error Sending Email', errorMessage)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-20 pb-4 px-4 overflow-y-auto" style={{ zIndex: 10001 }}>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal panel */}
      <div
        className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl w-full max-w-5xl max-h-[calc(100vh-6rem)] flex flex-col mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-900" />
            <h3 className="text-lg font-semibold text-gray-900">Disbursement Confirmation Email</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            disabled={sending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-900" />
              <span className="ml-3 text-gray-600">Loading email preview...</span>
            </div>
          ) : emailData ? (
            <div className="space-y-6">
              {/* Email Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">TO:</label>
                  {isEditing ? (
                    <div>
                      <input
                        type="email"
                        value={editedData.to}
                        onChange={(e) => handleFieldChange('to', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors.to ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.to && <p className="mt-1 text-sm text-red-600">{errors.to}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">{emailData.to}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FROM:</label>
                  <p className="text-sm text-gray-900">{emailData.from}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DATE:</label>
                  <p className="text-sm text-gray-900">{emailData.date}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">CC:</label>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={handleAddCC}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-primary-900 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add CC
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      {editedData.cc.map((cc, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 w-32">{cc.role}:</span>
                          <input
                            type="email"
                            value={cc.email}
                            onChange={(e) => handleCCChange(index, e.target.value)}
                            placeholder="Enter email address"
                            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                              errors.cc ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCC(index)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Remove CC"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {editedData.cc.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No CC recipients. Click "Add CC" to add recipients.</p>
                      )}
                      {errors.cc && <p className="text-sm text-red-600">{errors.cc}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {emailData.cc.length > 0 ? (
                        emailData.cc.map((cc, index) => (
                          <p key={index} className="text-sm text-gray-900">
                            {cc.role}: {cc.email}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No CC recipients</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SUBJECT:</label>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={editedData.subject}
                        onChange={(e) => handleFieldChange('subject', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors.subject ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.subject && <p className="mt-1 text-sm text-red-600">{errors.subject}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">{emailData.subject}</p>
                  )}
                </div>
              </div>

              {/* Disbursement Details Form */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DISBURSEMENT CONFIRMATION DETAILS:</label>
                <div className="border border-gray-300 rounded-lg p-4 bg-white">
                  {tableFields.length > 0 ? (
                    <div className="space-y-4">
                      {tableFields.map((field, index) => (
                        <div key={field.key} className={`grid grid-cols-1 md:grid-cols-3 gap-4 items-center ${field.highlighted ? 'bg-yellow-50 p-3 rounded' : ''}`}>
                          <label className="text-sm font-medium text-gray-700">
                            {field.label}
                            {field.highlighted && <span className="ml-2 text-xs text-gray-500">(Highlighted)</span>}
                          </label>
                          <div className="md:col-span-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={field.value || ''}
                                onChange={(e) => handleTableFieldChange(field.key, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                              />
                            ) : (
                              <p className="text-sm text-gray-900 py-2">{field.value || '-'}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Loading table fields...
                    </div>
                  )}
                </div>
              </div>

              {/* Email Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">EMAIL PREVIEW:</label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  <div
                    dangerouslySetInnerHTML={{ __html: isEditing ? generateEmailBody(tableFields) : emailData.body }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No email data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={sending}
          >
            Cancel
          </button>
          {emailData && !isEditing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              disabled={sending}
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {isEditing && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={sending}
            >
              Cancel Edit
            </button>
          )}
          {emailData && (
            <button
              onClick={handleSend}
              disabled={sending || Object.keys(errors).length > 0}
              className="flex items-center gap-2 px-4 py-2 text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Confirm & Send
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DisbursementEmailModal

