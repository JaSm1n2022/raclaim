import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import ActionPanel from './components/ActionPanel'
import FileUpload from './components/FileUpload'
import ClaimResults from './components/ClaimResults'
import BillerInvoice from './components/BillerInvoice'
import BillerReport from './components/BillerReport'
import type { ParsedClaimData } from './types'

function App() {
  const [claimData, setClaimData] = useState<ParsedClaimData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<'ra-report' | 'biller-invoice' | 'biller-report' | null>(null)

  const handleBackToHome = () => {
    setSelectedPanel(null)
    setClaimData(null)
  }

  // Show action panel if no panel is selected
  if (!selectedPanel) {
    return (
      <>
        <Toaster position="top-right" />
        <ActionPanel onSelectPanel={setSelectedPanel} />
      </>
    )
  }

  // Show RA Report interface
  if (selectedPanel === 'ra-report') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <Toaster position="top-right" />

        <div className="max-w-7xl mx-auto">
          <button
            onClick={handleBackToHome}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              RA Report
            </h1>
            <p className="text-lg text-gray-600">
              Upload RA Claim PDF and automatically convert to Excel
            </p>
          </div>

          <FileUpload
            onDataParsed={setClaimData}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />

          {claimData && <ClaimResults data={claimData} />}
        </div>
      </div>
    )
  }

  // Show Biller Invoice interface
  if (selectedPanel === 'biller-invoice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
        <Toaster position="top-right" />

        <div className="max-w-7xl mx-auto">
          <button
            onClick={handleBackToHome}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Biller Invoice
            </h1>
            <p className="text-lg text-gray-600">
              Generate professional PDF invoices from remittance Excel workbooks
            </p>
          </div>

          <BillerInvoice />
        </div>
      </div>
    )
  }

  // Show Biller Report interface
  if (selectedPanel === 'biller-report') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4 sm:px-6 lg:px-8">
        <Toaster position="top-right" />

        <div className="max-w-7xl mx-auto">
          <button
            onClick={handleBackToHome}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Biller Report
            </h1>
            <p className="text-lg text-gray-600">
              Generate comprehensive billing reports with paid and pending claims
            </p>
          </div>

          <BillerReport />
        </div>
      </div>
    )
  }

  return null
}

export default App
