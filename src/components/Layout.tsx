import { ReactNode, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, LogOut, User, FileText, Receipt, BarChart3, X } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menuItems = [
    { path: '/dashboard', icon: FileText, label: 'RA Report' },
    { path: '/biller-invoice', icon: Receipt, label: 'Biller Invoice' },
    { path: '/biller-report', icon: BarChart3, label: 'Biller Report' },
  ]

  const isActive = (path: string) => location.pathname === path

  const handleNavigate = (path: string) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <img
            src="/images/mybillingra.png"
            alt="MyBillingRA Logo"
            className="h-8 w-auto"
          />
          <div className="w-10" />
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-end mb-3">
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <img
                      src="/images/mybillingra.png"
                      alt="MyBillingRA Logo"
                      className="h-20 w-auto mb-2"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    <p className="text-sm text-gray-600 font-bold">Billing Portal</p>
                  </div>
                </div>

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

                <nav className="flex-1 p-4 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.path)
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                          active
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    )
                  })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200 flex flex-col items-center">
            <img
              src="/images/mybillingra.png"
              alt="MyBillingRA Logo"
              className="h-20 w-auto mb-2"
              style={{ mixBlendMode: 'multiply' }}
            />
            <p className="text-sm text-gray-600 font-bold">Billing Portal</p>
          </div>

          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {user?.name || user?.email?.split('@')[0]}
                </p>
                <p className="text-sm text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        {children}
      </main>
    </div>
  )
}
