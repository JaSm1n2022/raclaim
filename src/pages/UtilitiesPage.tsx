import { useState } from 'react'
import { Wrench, DollarSign, FileText, AlertCircle } from 'lucide-react'
import { HamburgerMenu } from '../components/HamburgerMenu'

type TabType = 'eft-medicaid' | 'missing-logs' | 'office-ally'

export function UtilitiesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('eft-medicaid')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
                  Utilities
                </h1>
                <p className="text-sm text-gray-600 mt-1">EFT management and reporting tools</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('eft-medicaid')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'eft-medicaid'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              EFT Medicaid
            </button>
            <button
              onClick={() => setActiveTab('missing-logs')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'missing-logs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              EFT Missing Logs
            </button>
            <button
              onClick={() => setActiveTab('office-ally')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'office-ally'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Office Ally Report
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'eft-medicaid' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">EFT Medicaid Transactions</h2>
                <p className="text-sm text-gray-600">
                  Manage Electronic Funds Transfer records for Medicaid payments
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <DollarSign className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">EFT Management</h3>
                <p className="text-gray-600 mb-4">
                  View and manage EFT transaction records, upload payment data, and reconcile claims
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Upload EFT Data
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    View Records
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'missing-logs' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">EFT Missing Logs Report</h2>
                <p className="text-sm text-gray-600">
                  Identify EFT transactions that don't have corresponding claim records
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Find Missing Logs</h3>
                <p className="text-gray-600 mb-4">
                  Compare EFT payments against claim records to find unmatched transactions
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                    Generate Report
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Export Results
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Fetches all EFT transaction records</li>
                  <li>Compares against claim records using provider, date of service, service code, and client name</li>
                  <li>Identifies EFT payments without matching claims</li>
                  <li>Helps ensure data integrity and identify data entry gaps</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'office-ally' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Office Ally Report</h2>
                <p className="text-sm text-gray-600">
                  Process and export Office Ally payment reports
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <FileText className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Office Ally Processing</h3>
                <p className="text-gray-600 mb-4">
                  Upload Office Ally reports and export formatted data for analysis
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Upload Report
                  </button>
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Export to Excel
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Report Fields:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
                  <div>• Check No</div>
                  <div>• Patient ID</div>
                  <div>• Full Name</div>
                  <div>• Account</div>
                  <div>• Service Date</div>
                  <div>• CPT Code</div>
                  <div>• Service Charge</div>
                  <div>• Service Payment</div>
                  <div>• Total Adjustment</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
