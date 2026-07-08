import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import FileUpload from './components/FileUpload'
import ClaimResults from './components/ClaimResults'
import type { ParsedClaimData } from './types'

function App() {
  const [claimData, setClaimData] = useState<ParsedClaimData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            RACLAIM
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

export default App
