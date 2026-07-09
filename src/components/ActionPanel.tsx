import { FileText, Receipt, BarChart3 } from 'lucide-react'

interface ActionPanelProps {
  onSelectPanel: (panel: 'ra-report' | 'biller-invoice' | 'biller-report') => void
}

export default function ActionPanel({ onSelectPanel }: ActionPanelProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to MyBillingRA
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            My personal workspace for managing Remittance Advice reports, tracking payments, and keeping billing records organized in one secure place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* RA Report Panel */}
          <button
            onClick={() => onSelectPanel('ra-report')}
            className="group bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                RA Report
              </h2>
              <p className="text-gray-600">
                Upload and process Remittance Advice claims to generate detailed reports and Excel files
              </p>
            </div>
          </button>

          {/* Biller Invoice Panel */}
          <button
            onClick={() => onSelectPanel('biller-invoice')}
            className="group bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-purple-200 transition-colors">
                <Receipt className="w-10 h-10 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Biller Invoice
              </h2>
              <p className="text-gray-600">
                Generate detailed PDF invoices from remittance Excel workbooks
              </p>
            </div>
          </button>

          {/* Biller Report Panel */}
          <button
            onClick={() => onSelectPanel('biller-report')}
            className="group bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-200 transition-colors">
                <BarChart3 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Biller Report
              </h2>
              <p className="text-gray-600">
                Generate comprehensive billing reports with paid and pending claims from billing Excel workbooks
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
