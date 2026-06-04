import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useSidebar } from '../contexts/SidebarContext'

const Modal = ({ isOpen, onClose, title, children, size = 'md', closeOnOverlay = true }) => {
  const { isMobile, widthPx } = useSidebar()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
  }

  const sidebarLeft = !isMobile && widthPx > 0 ? widthPx : 0

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[10000] flex items-start justify-center overflow-y-auto px-2 pb-4 pt-12 sm:px-4 sm:pt-20"
      style={{ left: sidebarLeft }}
    >
      <div
        className="fixed top-0 right-0 bottom-0 bg-gray-500/75 transition-opacity"
        style={{ left: sidebarLeft }}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden
      />

      <div
        className={`relative mt-2 flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl sm:mt-4 sm:max-h-[calc(100vh-6rem)] ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <h3 id="modal-title" className="pr-2 text-base font-semibold text-gray-900 sm:text-lg">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
