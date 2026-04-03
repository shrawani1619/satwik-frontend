import React, { useState, useEffect, useMemo } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, Calendar, User, Trash2, Edit, Plus, FileText, Building2, Store, RefreshCw, Eye, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { toast } from '../services/toastService'

const History = () => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedRows, setExpandedRows] = useState(new Set())

  useEffect(() => {
    fetchHistory()
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage, actionFilter, entityTypeFilter, startDate, endDate])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: 50,
      }
      
      if (actionFilter !== 'all') {
        params.action = actionFilter
      }
      
      if (entityTypeFilter !== 'all') {
        params.entityType = entityTypeFilter
      }
      
      if (startDate) {
        params.startDate = startDate
      }
      
      if (endDate) {
        params.endDate = endDate
      }

      const response = await api.history.getAll(params)
      const historyData = response.data || []
      setHistory(historyData)
      setTotalPages(response.pagination?.totalPages || 1)
      setTotalItems(response.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching history:', error)
      setHistory([])
      toast.error('Error', 'Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history

    const searchLower = searchTerm.toLowerCase()
    return history.filter((item) => {
      const userName = item.userId?.name || ''
      const userEmail = item.userId?.email || ''
      const entityType = item.entityType || ''
      const action = item.action || ''
      
      return (
        userName.toLowerCase().includes(searchLower) ||
        userEmail.toLowerCase().includes(searchLower) ||
        entityType.toLowerCase().includes(searchLower) ||
        action.toLowerCase().includes(searchLower)
      )
    })
  }, [history, searchTerm])

  const getActionIcon = (action) => {
    switch (action) {
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-500" />
      case 'create':
        return <Plus className="w-4 h-4 text-green-500" />
      case 'update':
        return <Edit className="w-4 h-4 text-blue-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'create':
        return 'bg-green-100 text-green-800'
      case 'update':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case 'Lead':
        return <FileText className="w-4 h-4" />
      case 'Franchise':
        return <Store className="w-4 h-4" />
      case 'User':
        return <User className="w-4 h-4" />
      default:
        return <Building2 className="w-4 h-4" />
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleResetFilters = () => {
    setActionFilter('all')
    setEntityTypeFilter('all')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const uniqueActions = useMemo(() => {
    const actions = new Set()
    history.forEach((item) => {
      if (item.action) actions.add(item.action)
    })
    return Array.from(actions).sort()
  }, [history])

  const uniqueEntityTypes = useMemo(() => {
    const types = new Set()
    history.forEach((item) => {
      if (item.entityType) types.add(item.entityType)
    })
    return Array.from(types).sort()
  }, [history])

  const toggleRowExpansion = (itemId) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const getEntityDisplayName = (entityType, data) => {
    if (!data) return 'N/A'
    
    switch (entityType) {
      case 'Lead':
        return data.customerName || data.applicantName || data.caseNumber || 'Lead'
      case 'Franchise':
        return data.name || 'Franchise'
      case 'User':
        return data.name || data.email || 'User'
      default:
        return data.name || entityType
    }
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return new Date(value).toLocaleString('en-IN')
      }
      if (value.name) return value.name
      if (value.email) return value.email
      return JSON.stringify(value)
    }
    return String(value)
  }

  const renderEntityDetails = (item) => {
    const { action, entityType, previousValues, newValues, changes } = item
    const isExpanded = expandedRows.has(item._id)

    if (!isExpanded) return null

    if (action === 'delete') {
      // Show what was deleted
      const deletedData = previousValues || {}
      const displayName = getEntityDisplayName(entityType, deletedData)
      
      return (
        <tr>
          <td colSpan="6" className="px-6 py-4 bg-red-50">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-900">Deleted: {displayName}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(deletedData)
                  .filter(([key]) => !['_id', '__v', 'password', 'createdAt', 'updatedAt'].includes(key))
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <div key={key} className="bg-white p-2 rounded border border-red-200">
                      <div className="text-xs font-medium text-gray-600 mb-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-gray-900 break-words">
                        {formatValue(value)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </td>
        </tr>
      )
    }

    if (action === 'create') {
      // Show what was created
      const createdData = newValues || {}
      const displayName = getEntityDisplayName(entityType, createdData)
      
      return (
        <tr>
          <td colSpan="6" className="px-6 py-4 bg-green-50">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-900">Created: {displayName}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(createdData)
                  .filter(([key]) => !['_id', '__v', 'password', 'createdAt', 'updatedAt'].includes(key))
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <div key={key} className="bg-white p-2 rounded border border-green-200">
                      <div className="text-xs font-medium text-gray-600 mb-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-gray-900 break-words">
                        {formatValue(value)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </td>
        </tr>
      )
    }

    if (action === 'update') {
      // Show what changed
      const updateChanges = changes || {}
      const hasChanges = Object.keys(updateChanges).length > 0
      
      if (!hasChanges && previousValues && newValues) {
        // If no changes object, compare previous and new values
        const allKeys = new Set([...Object.keys(previousValues), ...Object.keys(newValues)])
        const computedChanges = {}
        allKeys.forEach((key) => {
          if (['_id', '__v', 'password', 'createdAt', 'updatedAt'].includes(key)) return
          const oldVal = previousValues[key]
          const newVal = newValues[key]
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            computedChanges[key] = { from: oldVal, to: newVal }
          }
        })
        
        if (Object.keys(computedChanges).length === 0) {
          return (
            <tr>
              <td colSpan="6" className="px-6 py-4 bg-blue-50 text-center text-gray-500">
                No specific changes recorded
              </td>
            </tr>
          )
        }

        return (
          <tr>
            <td colSpan="6" className="px-6 py-4 bg-blue-50">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Edit className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-blue-900">Changes Made</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(computedChanges).slice(0, 10).map(([key, change]) => (
                    <div key={key} className="bg-white p-3 rounded border border-blue-200">
                      <div className="text-xs font-medium text-gray-600 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 bg-red-50 p-2 rounded">
                          <div className="text-xs text-red-600 font-medium mb-1">Old Value</div>
                          <div className="text-gray-900">{formatValue(change.from)}</div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex-1 bg-green-50 p-2 rounded">
                          <div className="text-xs text-green-600 font-medium mb-1">New Value</div>
                          <div className="text-gray-900">{formatValue(change.to)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </tr>
        )
      }

      if (hasChanges) {
        return (
          <tr>
            <td colSpan="6" className="px-6 py-4 bg-blue-50">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Edit className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-blue-900">Changes Made</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(updateChanges).slice(0, 10).map(([key, change]) => (
                    <div key={key} className="bg-white p-3 rounded border border-blue-200">
                      <div className="text-xs font-medium text-gray-600 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 bg-red-50 p-2 rounded">
                          <div className="text-xs text-red-600 font-medium mb-1">Old Value</div>
                          <div className="text-gray-900">{formatValue(change.from || change.oldValue)}</div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex-1 bg-green-50 p-2 rounded">
                          <div className="text-xs text-green-600 font-medium mb-1">New Value</div>
                          <div className="text-gray-900">{formatValue(change.to || change.newValue)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </tr>
        )
      }
    }

    return null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p className="text-sm text-gray-500 mt-1">View all system activity and changes</p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center justify-between w-full mb-4"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-700">Filters</span>
          </div>
          {filtersOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {filtersOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user, entity, or action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity Type
              </label>
              <select
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {uniqueEntityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-500">Loading history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No history records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistory.map((item) => (
                    <React.Fragment key={item._id || item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.userId?.name || 'Unknown User'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.userId?.email || 'N/A'}
                              </div>
                              {item.userId?.role && (
                                <div className="text-xs text-gray-400">
                                  {item.userId.role}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getActionIcon(item.action)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(item.action)}`}>
                              {item.action || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getEntityIcon(item.entityType)}
                            <div>
                              <div className="text-sm text-gray-900">
                                {item.entityType || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {item.action === 'delete' && item.previousValues
                                  ? getEntityDisplayName(item.entityType, item.previousValues)
                                  : item.action === 'create' && item.newValues
                                  ? getEntityDisplayName(item.entityType, item.newValues)
                                  : item.action === 'update' && item.previousValues
                                  ? getEntityDisplayName(item.entityType, item.previousValues)
                                  : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {item.entityId?.toString().substring(0, 8) || 'N/A'}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleRowExpansion(item._id)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            {expandedRows.has(item._id) ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {renderEntityDetails(item)}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
                <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                  Showing page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span> ({totalItems} total records)
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={currentPage === 1}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={currentPage >= totalPages || history.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white disabled:blur-[0.5px] transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default History

