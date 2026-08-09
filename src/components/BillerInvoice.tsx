import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Loader2, FileText, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseRemittanceWorkbook, generateRemittancePDF, generateCommissionPDF, type RemittanceBatch, type LineItem } from '../lib/remittancePdf'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function BillerInvoice() {
  const { user } = useAuth()
  const [reportMode, setReportMode] = useState<'upload' | 'database'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'detailed' | 'commission'>('detailed')
  const [period, setPeriod] = useState('')
  const [preparedFor, setPreparedFor] = useState('Jasmin Angela Velasco')
  const [payer, setPayer] = useState('Best Choice Health Partners')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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

  const handleGeneratePDFFromDatabase = async () => {
    if (!startDate.trim() || !endDate.trim()) {
      toast.error('Please enter both start and end dates')
      return
    }

    if (!user?.companyId) {
      toast.error('User company ID not found')
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
      // Query claims table for the given billed_on date range
      const { data: claims, error } = await supabase
        .from('claims')
        .select('*')
        .eq('companyId', user.companyId)
        .gte('billed_on', startDate.trim())
        .lte('billed_on', endDate.trim())
        .order('billed_on', { ascending: true })

      if (error) {
        console.error('Error fetching claims:', error)
        toast.error(`Failed to fetch data: ${error.message}`)
        return
      }

      if (!claims || claims.length === 0) {
        toast.error('No claims found for this date range')
        return
      }

      // Group claims by billed_on date to create batches
      const batchMap = new Map<string, any[]>()
      claims.forEach((claim: any) => {
        const billedOn = claim.billed_on || ''
        if (!batchMap.has(billedOn)) {
          batchMap.set(billedOn, [])
        }
        batchMap.get(billedOn)!.push(claim)
      })

      // Helper function to format dates (remove timestamp if present)
      const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return new Date().toLocaleDateString('en-US')

        // If date contains 'T' (ISO format with timestamp), extract just the date part
        if (dateStr.includes('T')) {
          const [datePart] = dateStr.split('T')
          const [year, month, day] = datePart.split('-')
          return `${month}/${day}/${year}`
        }

        return dateStr
      }

      // Transform each group into RemittanceBatch format
      const batches: RemittanceBatch[] = []

      for (const [billedOn, claimsGroup] of batchMap.entries()) {
        const titleCase = (s: string) =>
          s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

        // Filter only paid claims (paid_amt > 0)
        const paidClaims = claimsGroup.filter((claim: any) => {
          const paidAmt = claim.paid_amt || 0
          return paidAmt > 0
        })

        // Transform to LineItem format
        const rows: LineItem[] = paidClaims.map((claim: any) => {
          const timeStr = [claim.dos_start, claim.dos_end]
            .filter(Boolean)
            .join(' - ')

          return {
            provider: claim.employee ? titleCase(claim.employee) : '',
            client: (claim.client_name || '').toUpperCase(),
            dos: claim.date_of_service || '',
            time: timeStr,
            code: claim.service_code || '',
            description: claim.service_desc || '',
            unit: claim.unit || 1,
            billed: claim.billed_amt || 0,
            paid: claim.paid_amt || 0,
            status: claim.status || '',
            comments: claim.comments || ''
          }
        })

        // Skip this batch if no paid claims
        if (rows.length === 0) continue

        // Find first claim with valid EFT number
        const claimWithEft = paidClaims.find(c => c.eft && c.eft.trim() !== '')
        const eftNumber = claimWithEft?.eft || 'N/A'

        // Find first paid claim for dates
        const paidClaim = paidClaims.find(c => c.paid_on && c.paid_issued)

        // Calculate net earnings from paid amounts
        const netEarnings = rows.reduce((sum, r) => sum + (r.paid || 0), 0)

        batches.push({
          eftNumber: eftNumber,
          billedOn: formatDate(billedOn),
          remitDate: formatDate(paidClaim?.paid_on || paidClaims[0]?.paid_on),
          eftDate: formatDate(paidClaim?.paid_issued || paidClaims[0]?.paid_issued),
          netEarnings: netEarnings,
          rows: rows
        })
      }

      if (batches.length === 0) {
        toast.error('No remittance data found')
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
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        const invoiceNo = `JAV-${year}-${month}${day}`
        const invoiceDate = `${month}/${day}/${year}`

        doc = generateCommissionPDF(batches, {
          period: period.trim(),
          preparedFor: preparedFor.trim(),
          payer: payer.trim() || 'Nevada Medicaid',
          invoiceDate,
          invoiceNo,
          commissionRate: 0.05,
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

  const handleGeneratePDF = async () => {
    if (reportMode === 'database') {
      return handleGeneratePDFFromDatabase()
    }

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
      {/* Report Mode Toggle */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Source</h3>

        <div className="space-y-3">
          <label className="flex items-start cursor-pointer group">
            <input
              type="radio"
              name="reportMode"
              value="upload"
              checked={reportMode === 'upload'}
              onChange={() => setReportMode('upload')}
              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                Upload File
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Generate invoice by uploading an Excel file with remittance data
              </p>
            </div>
          </label>

          <label className="flex items-start cursor-pointer group">
            <input
              type="radio"
              name="reportMode"
              value="database"
              checked={reportMode === 'database'}
              onChange={() => setReportMode('database')}
              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                By Date Range
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Generate invoice by querying database using Billed On date range
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Date Range Inputs - Only show when database mode */}
      {reportMode === 'database' && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date (Billed On) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date (Billed On) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Claims will be grouped by Billed On date and generate separate remittances for each date
          </p>
        </div>
      )}

      {/* File Upload Area - Only show when upload mode */}
      {reportMode === 'upload' && (
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
      )}

      {/* Invoice Type Selection */}
      {((reportMode === 'upload' && selectedFile) || reportMode === 'database') && (
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
      {((reportMode === 'upload' && selectedFile) || reportMode === 'database') && (
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
      {((reportMode === 'upload' && selectedFile) || reportMode === 'database') && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setSelectedFile(null)
              setInvoiceType('detailed')
              setPeriod('')
              setPreparedFor('Jasmin Angela Velasco')
              setPayer('Best Choice Health Partners')
              setStartDate('')
              setEndDate('')
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
                {reportMode === 'database' ? (
                  <Database className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                Generate Invoice PDF
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Section */}
      {reportMode === 'upload' ? (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Expected Excel Format</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• One sheet per EFT batch/remittance</li>
            <li>• Metadata block with: BILLED ON, Remittance Date, Remittance EFT Number, Remittance EFT Date, NET EARNINGS</li>
            <li>• DETAILS table with columns: Billed On, Payer, Provider Rendering, Client Name, DOS, Code, Unit, Billed Amount, Paid Amount, Claim Status, Comments</li>
          </ul>
        </div>
      ) : (
        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-purple-900 mb-2">Database Invoice Information</h4>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Invoice will query the database for claims within the specified Billed On date range</li>
            <li>• Claims will be automatically grouped by Billed On date</li>
            <li>• Each unique Billed On date creates a separate remittance batch</li>
            <li>• Both Detailed and Commission invoice types are available</li>
          </ul>
        </div>
      )}
    </div>
  )
}
