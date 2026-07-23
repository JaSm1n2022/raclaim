import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Loader2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseRemittanceWorkbook, generateRemittancePDF, generateCommissionPDF } from '../lib/remittancePdf'

export default function BillerInvoice() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'detailed' | 'commission'>('detailed')
  const [period, setPeriod] = useState('')
  const [preparedFor, setPreparedFor] = useState('Jasmin Angela Velasco')
  const [payer, setPayer] = useState('Best Choice Health Partners')

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
      toast.error('Please enter the service period')
      return
    }

    if (!preparedFor.trim()) {
      toast.error('Please enter who this is prepared for')
      return
    }

    setIsProcessing(true)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const batches = parseRemittanceWorkbook(arrayBuffer)

      if (batches.length === 0) {
        toast.error('No remittance data found in the Excel file')
        setIsProcessing(false)
        return
      }

      let doc
      let fileName

      if (invoiceType === 'detailed') {
        // Generate detailed invoice
        doc = generateRemittancePDF(batches, {
          period: period.trim(),
          preparedFor: preparedFor.trim(),
          payer: payer.trim() || 'Nevada Medicaid',
        })
        fileName = 'Remittance_Detail_Invoice.pdf'
      } else {
        // Generate commission invoice
        // Create invoice number from today's date: JAV-YYYY-MMDD
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        const invoiceNo = `JAV-${year}-${month}${day}`

        // Format invoice date as MM/DD/YYYY
        const invoiceDate = `${month}/${day}/${year}`

        doc = generateCommissionPDF(batches, {
          period: period.trim(),
          preparedFor: preparedFor.trim(),
          payer: payer.trim() || 'Nevada Medicaid',
          invoiceDate,
          invoiceNo,
          commissionRate: 0.05, // 5% default
        })
        fileName = 'Commission_Invoice.pdf'
      }

      doc.save(fileName)
      toast.success('PDF invoice generated successfully!')
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
                  : 'Drag & drop your Remittance Excel here'}
              </p>
              <p className="text-sm text-gray-500">
                or click to browse files (.xlsx, .xls)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Invoice Type Selection */}
      {selectedFile && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Type</h3>

          <div className="space-y-3">
            <label className="flex items-start cursor-pointer group">
              <input
                type="radio"
                name="invoiceType"
                value="detailed"
                checked={invoiceType === 'detailed'}
                onChange={() => setInvoiceType('detailed')}
                className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                  Detailed Invoice
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete line-item breakdown with all claim details, providers, and service information
                </p>
              </div>
            </label>

            <label className="flex items-start cursor-pointer group">
              <input
                type="radio"
                name="invoiceType"
                value="commission"
                checked={invoiceType === 'commission'}
                onChange={() => setInvoiceType('commission')}
                className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                  Commission Invoice
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Summary invoice with commission calculation and EFT payment overview
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      {selectedFile && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
                Service Period <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g., May 25 – June 19, 2026"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="preparedFor" className="block text-sm font-medium text-gray-700 mb-1">
                Prepared For <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="preparedFor"
                value={preparedFor}
                onChange={(e) => setPreparedFor(e.target.value)}
                placeholder="e.g., Jasmin Angela Velasco"
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
                placeholder="e.g., Best Choice Health Partners"
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
              setInvoiceType('detailed')
              setPeriod('')
              setPreparedFor('Jasmin Angela Velasco')
              setPayer('Best Choice Health Partners')
            }}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            disabled={isProcessing}
          >
            Clear
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isProcessing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Invoice PDF
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Expected Excel Format</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• One sheet per EFT batch/remittance</li>
          <li>• Metadata block with: BILLED ON, Remittance Date, Remittance EFT Number, Remittance EFT Date, NET EARNINGS</li>
          <li>• DETAILS table with columns: Billed On, Payer, Provider Rendering, Client Name, DOS, Code, Unit, Billed Amount, Paid Amount, Claim Status, Comments</li>
        </ul>
      </div>
    </div>
  )
}
