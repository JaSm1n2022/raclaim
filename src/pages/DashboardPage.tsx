import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { HamburgerMenu } from '../components/HamburgerMenu'
import { FileText, Receipt, BarChart3 } from 'lucide-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const quickActions = [
    {
      title: 'RA Report',
      description: 'Upload RA Claim PDF and automatically convert to Excel',
      icon: FileText,
      href: '/ra-report',
      color: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
      gradient: 'from-blue-50 to-indigo-100'
    },
    {
      title: 'Biller Invoice',
      description: 'Generate professional PDF invoices from remittance Excel workbooks',
      icon: Receipt,
      href: '/biller-invoice',
      color: 'bg-purple-50 text-purple-600',
      iconBg: 'bg-purple-100',
      gradient: 'from-purple-50 to-pink-100'
    },
    {
      title: 'Biller Report',
      description: 'Generate comprehensive billing reports with paid and pending claims',
      icon: BarChart3,
      href: '/biller-report',
      color: 'bg-green-50 text-green-600',
      iconBg: 'bg-green-100',
      gradient: 'from-green-50 to-emerald-100'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <HamburgerMenu />
            <div className="flex flex-col items-center flex-1">
              <img
                src="/images/mybillingra.png"
                alt="MyBillingRA Logo"
                className="h-32 w-auto mb-2"
                style={{ mixBlendMode: 'multiply' }}
              />
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {user?.name || user?.email?.split('@')[0]}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to MyBillingRA
          </h2>
          <p className="text-gray-600">
            Select a tool below to get started with your billing tasks
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <button
              key={action.title}
              onClick={() => navigate(action.href)}
              className={`bg-gradient-to-br ${action.gradient} rounded-xl shadow-lg p-8 border border-gray-200 hover:shadow-xl transition-all transform hover:-translate-y-1 text-left group`}
            >
              <div className={`${action.iconBg} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <action.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{action.title}</h3>
              <p className="text-gray-600 leading-relaxed">{action.description}</p>
              <div className="mt-6 flex items-center text-blue-600 font-semibold">
                <span>Get Started</span>
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-8 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">About MyBillingRA</h3>
          <div className="grid md:grid-cols-3 gap-6 text-gray-600">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">RA Report</h4>
              <p className="text-sm">
                Quickly convert your Remittance Advice (RA) claim PDFs into organized Excel spreadsheets for easier analysis and record-keeping.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Biller Invoice</h4>
              <p className="text-sm">
                Create professional, branded PDF invoices from your Excel remittance data with just a few clicks.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Biller Report</h4>
              <p className="text-sm">
                Generate comprehensive billing reports that track both paid and pending claims for complete financial oversight.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
