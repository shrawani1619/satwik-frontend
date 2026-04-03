import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, X, Image as ImageIcon } from 'lucide-react'
import api from '../services/api'
import Modal from './Modal'
import StatusBadge from './StatusBadge'

const NotificationDropdown = ({ isOpen, onClose, unreadCount, setUnreadCount }) => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBanner, setSelectedBanner] = useState(null)
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const [notifRes, countRes] = await Promise.all([
        api.notifications?.getAll?.() || { data: [] },
        api.notifications?.getUnreadCount?.().catch(() => ({ data: { count: 0 } })),
      ])
      const data = notifRes.data || notifRes || []
      setNotifications(Array.isArray(data) ? data : [])
      const count = countRes?.data?.count ?? data.filter(n => !(n.isRead ?? n.read)).length
      if (setUnreadCount) setUnreadCount(count)
    } catch (error) {
      setNotifications([])
      if (setUnreadCount) setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId, bannerId) => {
    try {
      if (api.notifications?.markAsRead) {
        await api.notifications.markAsRead(notificationId)
      }
      setNotifications(prev =>
        prev.map(n =>
          (n._id === notificationId || n.id === notificationId)
            ? { ...n, isRead: true, read: true }
            : n
        )
      )
      if (setUnreadCount) setUnreadCount((prev) => Math.max(0, prev - 1))
      if (bannerId) {
        // Fetch banner details and show modal
        try {
          const bannerResponse = await api.banners.getById(bannerId)
          const banner = bannerResponse.data || bannerResponse
          setSelectedBanner(banner)
          setIsBannerModalOpen(true)
          onClose?.()
        } catch (error) {
          console.error('Error fetching banner:', error)
        }
      }
    } catch (err) {
      setNotifications(prev =>
        prev.map(n =>
          (n._id === notificationId || n.id === notificationId)
            ? { ...n, isRead: true, read: true }
            : n
        )
      )
      if (setUnreadCount) setUnreadCount((prev) => Math.max(0, prev - 1))
      if (bannerId) {
        // Fetch banner details and show modal
        try {
          const bannerResponse = await api.banners.getById(bannerId)
          const banner = bannerResponse.data || bannerResponse
          setSelectedBanner(banner)
          setIsBannerModalOpen(true)
          onClose?.()
        } catch (error) {
          console.error('Error fetching banner:', error)
        }
      }
    }
  }

  const markAllAsRead = async () => {
    try {
      if (api.notifications?.markAllAsRead) await api.notifications.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })))
      if (setUnreadCount) setUnreadCount(0)
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })))
      if (setUnreadCount) setUnreadCount(0)
    }
  }

  const deleteNotification = async (e, notificationId) => {
    e?.stopPropagation?.()
    const notification = notifications.find(n => n._id === notificationId || n.id === notificationId)
    const wasUnread = notification && !(notification.isRead ?? notification.read)
    try {
      if (api.notifications?.delete) await api.notifications.delete(notificationId)
    } catch {}
    setNotifications(prev => prev.filter(n => n._id !== notificationId && n.id !== notificationId))
    if (wasUnread && setUnreadCount) setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Check if click is not on the notification bell button
        const bellButton = event.target.closest('button[title="Notifications"]')
        if (!bellButton) {
          onClose?.()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when dropdown is open on mobile
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className="md:hidden fixed inset-0 bg-black/20 z-[115]"
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="fixed md:absolute right-2 md:right-0 top-16 md:top-full md:mt-2 w-[calc(100vw-1rem)] md:w-96 max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 z-[120] max-h-[calc(100vh-5rem)] md:max-h-96 overflow-hidden flex flex-col"
      >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-primary-900 text-white text-xs font-medium rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-primary-900 hover:text-primary-800 font-medium transition-colors px-2 py-1 rounded hover:bg-primary-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-900 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const isUnread = !(notification.isRead ?? notification.read)
              const bannerId = notification.relatedBannerId?._id || notification.relatedBannerId
              const isBannerNotification = notification.type === 'banner_created' || !!bannerId
              return (
                <div
                  key={notification._id || notification.id}
                  className={`p-3 sm:p-4 hover:bg-gray-50 transition-colors ${
                    isUnread ? 'bg-blue-50/50 border-l-2 border-l-primary-900' : ''
                  } ${bannerId ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (bannerId) {
                      markAsRead(notification._id || notification.id, null, bannerId)
                    } else {
                      markAsRead(notification._id || notification.id)
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notification.title || notification.message || 'Notification'}
                      </p>
                      {notification.message && notification.title && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{notification.message}</p>
                      )}
                      {notification.createdAt && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          {new Date(notification.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      )}
                      {isBannerNotification && (
                        <p className="text-xs text-primary-900 mt-2 font-medium flex items-center gap-1">
                          Click to view banner details
                          <span>→</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-1 flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification._id || notification.id)
                          }}
                          className="p-1.5 hover:bg-primary-100 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-primary-900" />
                        </button>
                      )}
                      <button
                        onClick={(e) => deleteNotification(e, notification._id || notification.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4 text-gray-600 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 text-center bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-primary-900 hover:text-primary-800 font-medium hover:bg-primary-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      )}
      </div>

      {/* Banner Details Modal */}
      <Modal
        isOpen={isBannerModalOpen}
        onClose={() => {
          setIsBannerModalOpen(false)
          setSelectedBanner(null)
        }}
        title="Banner Details"
        size="md"
      >
        {selectedBanner && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Banner Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedBanner.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedBanner.status} />
                </div>
              </div>
            </div>

            {selectedBanner.attachment && (
              <div>
                <label className="text-sm font-medium text-gray-500">Banner Image</label>
                <div className="mt-2">
                  <img
                    src={selectedBanner.attachment}
                    alt={selectedBanner.name}
                    className="w-full max-w-md rounded-lg border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-full max-w-md h-64 bg-gray-200 rounded-lg border border-gray-200 hidden items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

export default NotificationDropdown

