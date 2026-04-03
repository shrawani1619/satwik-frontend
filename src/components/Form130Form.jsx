import { useState, useEffect } from 'react'
import { toast } from '../services/toastService'
import api from '../services/api'
import { authService } from '../services/auth.service'

const Form130Form = ({ form16, onSave, onClose }) => {
  const currentUser = authService.getUser()
  const userRole = currentUser?.role || 'super_admin'
  const isAdminOrAccountant = userRole === 'super_admin' || userRole === 'accounts_manager'

  const [formData, setFormData] = useState({
    formType: 'form130',
    attachmentName: '',
    user: '',
    status: 'active',
  })

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [files, setFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})

  useEffect(() => {
    if (isAdminOrAccountant && !form16) {
      fetchUsers()
    }
  }, [isAdminOrAccountant, form16])

  const fetchUsers = async () => {
    try {
      const response = await api.users.getAll({ status: 'active' })
      setUsers(response.data || response || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    const validFiles = []
    const errors = []
    
    selectedFiles.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`Invalid File "${file.name}": Only PDF or image files are allowed`)
      } else if (file.size > maxSize) {
        errors.push(`File Too Large: "${file.name}" must be less than 10MB`)
      } else {
        validFiles.push(file)
      }
    })
    
    if (errors.length > 0) {
      errors.forEach(err => toast.error('Error', err))
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
      // Initialize progress for new files
      const newProgress = {}
      validFiles.forEach(file => {
        newProgress[file.name] = 0
      })
      setUploadProgress(prev => ({ ...prev, ...newProgress }))
    }
  }

  const removeFile = (fileName) => {
    setFiles(prev => prev.filter(file => file.name !== fileName))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileName]
      return newProgress
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setFetchError(null)

    try {
      // Validate required fields
      if (!formData.attachmentName && files.length === 0 && !form16) {
        toast.error('Error', 'Attachment name or file is required')
        setLoading(false)
        return
      }

      if (!form16 && files.length === 0) {
        toast.error('Error', 'At least one file is required')
        setLoading(false)
        return
      }

      // Upload all files and collect their data
      const uploadedDocuments = []
      
      for (const file of files) {
        try {
          const submitData = new FormData()
          submitData.append('formType', 'form130')
          submitData.append('attachmentName', formData.attachmentName || file.name)
          submitData.append('status', formData.status)
          
          if (formData.user) {
            submitData.append('user', formData.user)
          }
          
          submitData.append('attachment', file)
          
          // Upload document
          const uploadResp = await api.documents.upload(submitData)
          const docData = uploadResp.data || uploadResp
          uploadedDocuments.push(docData)
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 100
          }))
        } catch (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      // If editing an existing form16
      if (form16) {
        const updatePayload = {
          attachmentName: formData.attachmentName || form16.attachmentName,
          status: formData.status,
        }
        if (formData.user) {
          updatePayload.user = formData.user
        }
        
        // If files were uploaded, update with latest file info
        if (uploadedDocuments.length > 0) {
          const lastDoc = uploadedDocuments[uploadedDocuments.length - 1]
          updatePayload.fileName = lastDoc.fileName || files[files.length - 1].name
          updatePayload.fileSize = lastDoc.fileSize || files[files.length - 1].size
          updatePayload.mimeType = lastDoc.mimeType || files[files.length - 1].type
        }
        
        await api.form16.update(form16._id || form16.id, updatePayload)
        toast.success('Success', 'Form 130 / TDS updated successfully')
      } else {
        // Creating new - use the first uploaded document's data
        const firstDoc = uploadedDocuments[0]
        const createPayload = {
          formType: 'form130',
          attachmentName: formData.attachmentName || firstDoc.fileName,
          attachment: firstDoc.url || firstDoc.path,
          status: formData.status,
          fileName: firstDoc.fileName,
          fileSize: firstDoc.fileSize,
          mimeType: firstDoc.mimeType,
        }
        
        if (formData.user) {
          createPayload.user = formData.user
        }
        
        await api.form16.create(createPayload)
        toast.success('Success', 'Form 130 / TDS created successfully')
      }

      if (onSave) {
        onSave()
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving Form 130:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save'
      toast.error('Error', errorMessage)
      setFetchError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {fetchError}
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
        
        <div className="space-y-4">
          {isAdminOrAccountant && !form16 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select User
              </label>
              <select
                name="user"
                value={formData.user}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select User</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachment Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="attachmentName"
              value={formData.attachmentName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter attachment name"
              required
            />
          </div>
        
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload File {!form16 && <span className="text-red-500">*</span>}
          </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors bg-gray-50">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                onChange={handleFileChange}
                multiple
                className="hidden"
                id="file-upload"
                required={!form16}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-primary-600 hover:text-primary-500">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, JPG, PNG, WebP, GIF (Max 10MB)
                </p>
              </label>
            </div>
            
            {/* File List with Progress */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Selected Files ({files.length})</p>
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {file.type.includes('image') ? (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500">IMG</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                            <span className="text-xs text-red-600 font-semibold">PDF</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {uploadProgress[file.name] || 0}% uploaded
                        </p>
                        {uploadProgress[file.name] === 100 && (
                          <p className="text-xs text-green-600 mt-0.5">✓ Ready</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Remove file"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              ✓ Multiple files supported • All formats supported: PDF, JPEG, JPG, PNG, WebP, GIF
            </p>
            {form16 && files.length === 0 && (
              <p className="text-xs text-blue-600 mt-2">
                Leave empty to keep existing files. Upload new files to add them.
              </p>
            )}
        </div>
      </div>

      {/* Form Actions */}
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
          {loading ? 'Saving...' : 'Create Form 130 / TDS'}
        </button>
      </div>
    </form>
  )
}

export default Form130Form
