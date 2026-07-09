import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Loader2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseBillingWorkbook, generateBillingReportPDF } from '../lib/billingReportPdf'

export default function BillerReport() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [period, setPeriod] = useState('')
  const [payer, setPayer] = useState('Best Choice Health Partner')
  const [billerName, setBillerName] = useState('Jasmin Angela Velasco, CPB')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      if (isExcel) {
        setSelectedFile(file)
        toast.success(`File selected: ${file.name}`)
      } else {
        toast.error('Please upload an Excel file (.xlsx or .xls)')
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  })

  const handleGeneratePDF = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    if (!period.trim()) {
      toast.error('Please enter the billing period')
      return
    }

    setIsProcessing(true)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const report = parseBillingWorkbook(arrayBuffer)

      if (!report.paid.length && !report.notBilled.length) {
        toast.error('No billing data found in the Excel file')
        setIsProcessing(false)
        return
      }

      const doc = generateBillingReportPDF(report, {
        period: period.trim(),
        payer: payer.trim() || 'Best Choice Health Partner',
        billerName: billerName.trim() || 'Jasmin Angela Velasco, CPB',
      })

      // Generate filename: BILLING_REPORT_{period with / replaced by _}
      const sanitizedPeriod = period.trim().replace(/\//g, '_')
      const fileName = `BILLING_REPORT_${sanitizedPeriod}.pdf`

      doc.save(fileName)
      toast.success('PDF billing report generated successfully!')
    } catch (error: any) {
      console.error('PDF generation error:', error)
      toast.error(`Failed to generate PDF: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto mb-8">
      {/* File Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200 ease-in-out mb-6
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center">
          {selectedFile ? (
            <>
              <FileSpreadsheet className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive
                  ? 'Drop the Excel file here'
                  : 'Drag & drop your Billing Excel here'}
              </p>
              <p className="text-sm text-gray-500">
                or click to browse files (.xlsx, .xls)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      {selectedFile && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Details</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
                Billing Period <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g., 06/23/2026 – 06/26/2026"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-1">
                Payer
              </label>
              <input
                type="text"
                id="payer"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                placeholder="e.g., Best Choice Health Partner"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="billerName" className="block text-sm font-medium text-gray-700 mb-1">
                Biller Name
              </label>
              <input
                type="text"
                id="billerName"
                value={billerName}
                onChange={(e) => setBillerName(e.target.value)}
                placeholder="e.g., Jasmin Angela Velasco, CPB"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFile && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setSelectedFile(null)
              setPeriod('')
              setPayer('Best Choice Health Partner')
              setBillerName('Jasmin Angela Velasco, CPB')
            }}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            disabled={isProcessing}
          >
            Clear
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isProcessing}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Billing Report PDF
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Expected Excel Format</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Single sheet containing stacked sections</li>
          <li>• REMITTANCE INFORMATION section with EFT #, Remittance Date, Remittance EFT Date, NET EARNINGS</li>
          <li>• MEMBER MEDICAID Paid Summary section with paid claims detail table</li>
          <li>• ISSUE/NOT BILLED section with pending claims (no paid amount)</li>
          <li>• SERVICES SUMMARY section with per-code paid counts (Medicare / Medicaid)</li>
        </ul>
      </div>
    </div>
  )
}
