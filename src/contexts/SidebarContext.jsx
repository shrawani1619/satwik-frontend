import { createContext, useContext } from 'react'

export const SIDEBAR_WIDTH_EXPANDED = 256
export const SIDEBAR_WIDTH_COLLAPSED = 80

export const SidebarContext = createContext({
  minimized: false,
  isMobile: false,
  widthPx: 0,
})

export function useSidebar() {
  return useContext(SidebarContext)
}
