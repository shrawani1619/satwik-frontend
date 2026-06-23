import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  FileText,
  FileCheck,
  Building2,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import StatCard from '../components/StatCard'
import api from '../services/api'
import { authService } from '../services/auth.service'
import AccountantOverview from './AccountantOverview'
import { formatInCrores } from '../utils/formatUtils'

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalFranchises: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    totalLoanAmount: 0,
  })
  const [relatedLists, setRelatedLists] = useState({
    recentLeads: [],
    recentFranchises: [],
    recentInvoices: [],
  })
  const [loanDistribution, setLoanDistribution] = useState([])
  const [leadConversionFunnel, setLeadConversionFunnel] = useState([])
  const [selectedLoanSegmentIndex, setSelectedLoanSegmentIndex] = useState(null)
  const [funnelFilter, setFunnelFilter] = useState('monthly') // 'weekly', 'monthly', 'yearly'

  const [loading, setLoading] = useState(true)

  const userRole = authService.getUser()?.role || 'super_admin'

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        funnelPeriod: funnelFilter, // Add funnel filter parameter
      }

      let dashboardData
      try {
        switch (userRole) {
          case 'franchise':
            dashboardData = await api.dashboard.getFranchiseOwnerDashboard(params)
            break
          case 'accounts_manager':
            dashboardData = await api.dashboard.getAccountsDashboard(params)
            break
          case 'regional_manager':
          case 'super_admin':
          default:
            dashboardData = await api.dashboard.getAdminDashboard(params)
            break
        }
      } catch (roleError) {
        if (userRole === 'accounts_manager' || userRole === 'franchise') {
          throw roleError
        }
        console.warn('Role-specific dashboard failed, trying admin:', roleError)
        dashboardData = await api.dashboard.getAdminDashboard(params)
      }

      // Handle different response formats
      const data = dashboardData.data || dashboardData || {}

      console.log('🔍 DEBUG: Dashboard data received:', data)

      setStats({
        totalLeads: data.totalLeads || data.leads?.total || 0,
        totalFranchises: data.totalFranchises || 0,
        totalInvoices: data.totalInvoices || data.invoices?.total || 0,
        totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
        totalLoanAmount: data.totalLoanAmount || 0,
      })

      console.log('🔍 DEBUG: Dashboard stats set:', {
        totalLeads: data.totalLeads || data.leads?.total || 0,
        totalInvoices: data.totalInvoices || data.invoices?.total || 0,
        totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
      })

      // Set related lists (for admin, regional manager, and franchise owner dashboards)
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'franchise') {
        setRelatedLists({
          recentLeads: Array.isArray(data.recentLeads) ? data.recentLeads : [],
          recentFranchises: Array.isArray(data.recentFranchises) ? data.recentFranchises : [],
          recentInvoices: Array.isArray(data.recentInvoices) ? data.recentInvoices : [],
        })
      }
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'franchise') {
        setLoanDistribution(Array.isArray(data.loanDistribution) ? data.loanDistribution : [])
        setLeadConversionFunnel(Array.isArray(data.leadConversionFunnel) ? data.leadConversionFunnel : [])
        setSelectedLoanSegmentIndex(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to empty stats on error - app will still render
      setStats({
        totalLeads: 0,
        totalFranchises: 0,
        totalInvoices: 0,
        totalRevenue: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [userRole, funnelFilter])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const { totalLeads, totalFranchises, totalRevenue, totalLoanAmount } = stats
  const isAccountant = userRole === 'accounts_manager'
  const isRegionalManager = userRole === 'regional_manager'

  // For admin / regional / franchise dashboards: aggregate total loan amount by type
  const totalLoanAmountForChart = Array.isArray(loanDistribution)
    ? loanDistribution.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
    : 0

  // Render Accountant-specific dashboard
  if (isAccountant) {
    return <AccountantOverview />
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Home</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Analytics</span>
      </div>

      <>
          {/* Summary Cards - Admin / Regional / Franchise */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
              isRegionalManager ? 'lg:grid-cols-2' : 'lg:grid-cols-4'
            }`}
          >
            <StatCard
              title="Total Leads"
              value={totalLeads}
              icon={Users}
              color="blue"
            />
            {!isRegionalManager && (
              <StatCard
                title="Active Franchises"
                value={totalFranchises}
                icon={Building2}
                color="teal"
              />
            )}
            <StatCard
              title="Total Amount"
              value={formatInCrores(totalLoanAmount || 0)}
              icon={IndianRupeeIcon}
              color="orange"
            />
            {!isRegionalManager && (
              <StatCard
                title="Total Revenue"
                value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
                icon={IndianRupeeIcon}
                color="purple"
              />
            )}
          </div>

          {/* Loan Distribution & Lead Conversion Funnel - Admin, Regional Manager & Franchise Owner */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'regional_manager' || authService.getUser()?.role === 'franchise') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Loan Distribution</h2>
                {loanDistribution.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-44 h-44 relative flex-shrink-0 [&_svg]:outline-none [&_*]:outline-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart style={{ outline: 'none' }}>
                          <Pie
                            data={loanDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={1}
                            stroke="none"
                            activeShape={(props) => <Sector {...props} stroke="none" />}
                            onClick={(_, index) => setSelectedLoanSegmentIndex(index)}
                            style={{ cursor: 'pointer', outline: 'none' }}
                          >
                            {loanDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold text-gray-700 text-center px-2">
                          {formatInCrores(totalLoanAmountForChart || totalLoanAmount || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <ul className="space-y-2">
                        {loanDistribution.map((item, idx) => (
                          <li
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedLoanSegmentIndex(idx)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelectedLoanSegmentIndex(idx)}
                            className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 ${selectedLoanSegmentIndex === idx ? 'bg-gray-100' : ''}`}
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-700 truncate">
                              {item.name} ({item.count || 0})
                            </span>
                            <span className="font-medium text-gray-900 ml-auto">
                              {formatInCrores(item.totalAmount || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No loan distribution data</p>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Lead Conversion Funnel</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFunnelFilter('weekly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'weekly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('monthly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'monthly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('yearly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'yearly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
                {leadConversionFunnel.length > 0 ? (
                  <div className="space-y-2 max-w-md">
                    {leadConversionFunnel.map((stage) => {
                      const maxVal = Math.max(...leadConversionFunnel.map((s) => s.value || 0), 1)
                      const widthPct = maxVal > 0 ? Math.max(((stage.value || 0) / maxVal) * 100, 18) : 18
                      return (
                        <div key={stage.stage} className="flex items-center gap-3">
                          <div
                            className="h-11 rounded flex items-center px-3 transition-all min-w-[120px]"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: stage.fill,
                            }}
                          >
                            <span className="text-white font-medium text-sm truncate">{stage.stage}</span>
                          </div>
                          <span className="text-gray-700 font-semibold tabular-nums text-right flex-shrink-0 min-w-[80px]">
                            {formatInCrores(stage.value || 0)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No funnel data</p>
                )}
              </div>
            </div>
          )}
        </>
    </div>
  )
}

export default Dashboard
