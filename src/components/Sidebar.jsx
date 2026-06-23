import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '/logo.webp'
import { authService } from '../services/auth.service'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Store,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  MapPin,
  History,
  Image,
  Receipt,
  Percent,
  Wallet,
  X,
  FileCheck,
} from 'lucide-react'
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from '../contexts/SidebarContext'

const Sidebar = ({
  minimized = false,
  onMinimizeChange,
  isMobile = false,
  isOpen = false,
  onClose,
}) => {
  const currentUser = authService.getUser()
  const userRole = currentUser?.role || 'super_admin'

  const isCollapsed = minimized && !isMobile
  const isExpanded = !isCollapsed || isMobile

  useEffect(() => {
    if (isMobile && onMinimizeChange) {
      onMinimizeChange(false)
    }
  }, [isMobile, onMinimizeChange])

  const handleToggle = () => {
    if (isMobile) {
      onClose?.()
      return
    }
    onMinimizeChange?.(!minimized)
  }

  const handleLinkClick = () => {
    if (isMobile) {
      onClose?.()
    }
  }

  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['super_admin', 'regional_manager', 'franchise', 'accounts_manager'] },
    { icon: MapPin, label: 'Regional Manager', path: '/regional-managers', roles: ['super_admin'] },
    { icon: Store, label: 'Franchises', path: '/franchises', roles: ['super_admin'] },
    { icon: Users, label: 'Leads', path: '/leads', roles: ['super_admin', 'regional_manager', 'franchise', 'accounts_manager'] },
    { icon: Building2, label: 'Banks', path: '/banks', roles: ['super_admin', 'regional_manager'] },
    { icon: FileCheck, label: 'Bank Docs', path: '/bank-docs', roles: ['super_admin', 'regional_manager'] },
    { icon: UserCheck, label: 'Accountant Managers', path: '/accountant-managers', roles: ['super_admin'] },
    { icon: FileText, label: 'Invoices', path: '/invoices', roles: ['super_admin', 'regional_manager', 'franchise', 'accounts_manager'] },
    { icon: Wallet, label: 'Payouts', path: '/payouts', roles: ['super_admin', 'accounts_manager'] },
    { icon: Image, label: 'Banners', path: '/banners', roles: ['super_admin', 'regional_manager', 'franchise', 'accounts_manager'] },
    { icon: Receipt, label: 'Form 130 / TDS', path: '/form16', roles: ['super_admin', 'accounts_manager', 'franchise', 'regional_manager'] },
    { icon: History, label: 'History', path: '/history', roles: ['super_admin', 'accounts_manager'] },
    { icon: Percent, label: 'Commission', path: '/franchise-commission', roles: ['super_admin', 'accounts_manager', 'regional_manager'] },
  ]

  const menuItems = allMenuItems.filter((item) => item.roles.includes(userRole))

  const bottomMenuItems = [
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help Center', path: '/help' },
  ]

  const navLinkClass = (isActive) =>
    `flex items-center rounded-lg transition-colors ${
      isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
    } ${
      isActive
        ? 'bg-primary-50 text-primary-900 font-medium ring-1 ring-primary-100'
        : 'text-gray-700 hover:bg-gray-50'
    }`

  const sidebarWidth = isMobile ? SIDEBAR_WIDTH_EXPANDED : isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <aside
      className={`sidebar-transition fixed left-0 top-0 z-[90] flex h-screen flex-col border-r border-gray-200 bg-white shadow-sm ${
        isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
      }`}
      style={{ width: sidebarWidth }}
      aria-label="Main navigation"
    >
      {/* Brand + toggle */}
      <div
        className={`flex h-16 flex-shrink-0 items-center border-b border-gray-200 ${
          isCollapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3'
        }`}
      >
        {isExpanded ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <img
                src={logo}
                alt="Satwik Network"
                className="h-10 w-auto flex-shrink-0 object-contain"
              />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-gray-900">Satwik Network</div>
                <div className="truncate text-xs text-gray-500">CRM Dashboard</div>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center">
              {isMobile ? (
                <button
                  type="button"
                  onClick={handleToggle}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggle}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            className="group flex flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-gray-50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <img
              src={logo}
              alt="Satwik Network"
              className="h-9 w-9 object-contain"
            />
            <ChevronRight className="h-4 w-4 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {isExpanded && (
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Navigation
            </h3>
          )}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) => navLinkClass(isActive)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="truncate text-sm">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="mt-2 flex-shrink-0 border-t border-gray-200 pt-3">
          {isExpanded && (
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Support
            </h3>
          )}
          <nav className="space-y-1">
            {bottomMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) => navLinkClass(isActive)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="truncate text-sm">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>

          {isCollapsed && (
            <button
              type="button"
              onClick={handleToggle}
              className="mt-2 flex w-full items-center justify-center rounded-lg py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
