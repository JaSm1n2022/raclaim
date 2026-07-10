import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { HamburgerMenu } from '../components/HamburgerMenu'
import FileUpload from '../components/FileUpload'
import ClaimResults from '../components/ClaimResults'
import type { ParsedClaimData } from '../types'

export function RAReportPage() {
  const [claimData, setClaimData] = useState<ParsedClaimData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuth()

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
                  RA Report
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Upload RA Claim PDF and automatically convert to Excel
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
