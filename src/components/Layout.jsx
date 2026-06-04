import { useState, useEffect, useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import {
  SidebarContext,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from '../contexts/SidebarContext'

const STORAGE_KEY = 'sidebarMinimized'

const Layout = () => {
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sidebarMinimized ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarMinimized])

  const sidebarWidthPx = useMemo(() => {
    if (isMobile) return 0
    return sidebarMinimized ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
  }, [isMobile, sidebarMinimized])

  useEffect(() => {
    const w = isMobile ? '0px' : `${sidebarWidthPx}px`
    document.documentElement.style.setProperty('--sidebar-width', w)
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width')
    }
  }, [sidebarWidthPx, isMobile])

  const sidebarContextValue = useMemo(
    () => ({
      minimized: sidebarMinimized && !isMobile,
      isMobile,
      widthPx: sidebarWidthPx,
    }),
    [sidebarMinimized, isMobile, sidebarWidthPx]
  )

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar
          minimized={sidebarMinimized}
          onMinimizeChange={setSidebarMinimized}
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[80] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        <div
          className="flex flex-1 flex-col min-w-0 overflow-hidden transition-[margin] duration-300 ease-in-out"
          style={{ marginLeft: isMobile ? 0 : sidebarWidthPx }}
        >
          <Header onMenuClick={() => setSidebarOpen(true)} isMobile={isMobile} />
          <main className="relative z-10 flex-1 w-full overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-5">
            <div className="mx-auto h-full w-full max-w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

export default Layout
