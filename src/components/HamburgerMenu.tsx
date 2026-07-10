import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Menu,
  X,
  Home,
  User,
  LogOut,
  FileText,
  Receipt,
  BarChart3
} from 'lucide-react'

export function HamburgerMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigate = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    setMenuOpen(false)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setMenuOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img
                src="/images/mybillingra.png"
                alt="MyBillingRA Logo"
                className="h-16 w-auto"
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* User Info */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {user?.name || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation Section */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                Navigation
              </h3>
              <nav className="space-y-1">
                <button
                  onClick={() => handleNavigate('/dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive('/dashboard')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="font-medium">Home</span>
                </button>
                <button
                  onClick={() => handleNavigate('/profile')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive('/profile')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Profile</span>
                </button>
              </nav>
            </div>

            {/* Language Section */}
            <div className="p-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                Language
              </h3>
              <div className="space-y-1">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  <span className="font-medium">English</span>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 cursor-not-allowed"
                >
                  <span className="font-medium">Español (Coming Soon)</span>
                </button>
              </div>
            </div>

            {/* Quick Actions Section */}
            <div className="p-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                Quick Actions
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => handleNavigate('/ra-report')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive('/ra-report')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">RA Report</span>
                </button>
                <button
                  onClick={() => handleNavigate('/biller-invoice')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive('/biller-invoice')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Receipt className="w-5 h-5" />
                  <span className="font-medium">Biller Invoice</span>
                </button>
                <button
                  onClick={() => handleNavigate('/biller-report')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive('/biller-report')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span className="font-medium">Biller Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
