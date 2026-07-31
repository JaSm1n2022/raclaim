import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, Loader2, FileText, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseBillingWorkbook, generateBillingReportPDF, type BillingReport, type ClaimLine } from '../lib/billingReportPdf'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function BillerReport() {
  const { user } = useAuth()
  const [reportMode, setReportMode] = useState<'upload' | 'database'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [period, setPeriod] = useState('')
  const [payer, setPayer] = useState('Best Choice Health Partner')
  const [billerName, setBillerName] = useState('Jasmin Angela Velasco, CPB')
  const [billedOnDate, setBilledOnDate] = useState('')

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
    if (!billedOnDate.trim()) {
      toast.error('Please enter a Billed On date')
      return
    }

    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    setIsProcessing(true)

    try {
      // Query claims table for the given Billed On date
      const { data: claims, error } = await supabase
        .from('claims')
        .select('*')
        .eq('companyId', user.companyId)
        .eq('billed_on', billedOnDate.trim())

      if (error) {
        console.error('Error fetching claims:', error)
        toast.error(`Failed to fetch data: ${error.message}`)
        return
      }

      if (!claims || claims.length === 0) {
        toast.error('No claims found for this Billed On date')
        return
      }

      // Transform database records to ClaimLine format
      const paidClaims: ClaimLine[] = []
      const pendingClaims: ClaimLine[] = []

      claims.forEach((claim: any) => {
        // Format time from dos_start and dos_end
        const timeStr = [claim.dos_start, claim.dos_end]
          .filter(Boolean)
          .join(' - ')

        const paidAmt = claim.paid_amt || 0

        // If paid_amt is not zero, set billed to equal paid_amt
        // Otherwise use the original billed_amt
        const billedAmount = paidAmt !== 0 ? paidAmt : (claim.billed_amt || 0)

        // Separate into paid vs pending based on status
        // Only "paid" (case-insensitive) goes to paid list, everything else goes to Issue/Not Billed
        const statusLower = claim.status ? claim.status.trim().toLowerCase() : ''
        const isPaid = statusLower === 'paid'

        // For pending claims, use comments for status and clear comments to avoid duplication
        // For paid claims use status field and keep comments
        const displayStatus = isPaid ? (claim.status || '') : (claim.comments || claim.status || '')
        const displayComments = isPaid ? (claim.comments || '') : ''

        const claimLine: ClaimLine = {
          provider: claim.employee || '',
          client: (claim.client_name || '').toUpperCase(),
          dos: claim.date_of_service || '',
          time: timeStr,
          code: claim.service_code || '',
          description: claim.service_desc || '',
          unit: claim.unit || 1,
          billed: billedAmount,
          paid: paidAmt,
          status: displayStatus,
          comments: displayComments
        }

        if (isPaid) {
          paidClaims.push(claimLine)
        } else {
          // Pending/null/anything else - set paid amount to null
          claimLine.paid = null
          pendingClaims.push(claimLine)
        }
      })

      // Build BillingReport structure
      const eftNumber = claims[0]?.eft || 'N/A'
      const report: BillingReport = {
        eftNumber: eftNumber,
        remitDate: claims[0]?.paid_on || new Date().toLocaleDateString('en-US'),
        eftDate: claims[0]?.paid_issue || new Date().toLocaleDateString('en-US'),
        netEarnings: paidClaims.reduce((sum, c) => sum + (c.paid || 0), 0),
        paid: paidClaims,
        notBilled: pendingClaims,
        summary: [], // Can be calculated if needed
        summaryTotal: paidClaims.length
      }

      if (report.paid.length === 0 && report.notBilled.length === 0) {
        toast.error('No claim data found')
        return
      }

      const doc = generateBillingReportPDF(report, {
        period: period.trim() || 'N/A',
        payer: payer.trim() || 'Best Choice Health Partner',
        billerName: billerName.trim() || 'Jasmin Angela Velasco, CPB',
      })

      const sanitizedPeriod = period.trim().replace(/\//g, '_') || 'Report'
      const sanitizedDate = billedOnDate.trim().replace(/\//g, '_')
      const fileName = `BILLING_REPORT_${sanitizedPeriod}_${sanitizedDate}.pdf`

      doc.save(fileName)
      toast.success('PDF billing report generated successfully!')
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
              className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 group-hover:text-green-600">
                Upload File
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Generate report by uploading an Excel file with billing data
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
              className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 group-hover:text-green-600">
                By Billed On Date
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Generate report by querying database using Billed On date
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* File Upload Area - Only show when Upload mode */}
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
                    : 'Drag & drop your Billing Excel here'}
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse files (.xlsx, .xls)
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Billed On Date Input - Only show when database mode */}
      {reportMode === 'database' && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Information</h3>

          <div>
            <label htmlFor="billedOnDate" className="block text-sm font-medium text-gray-700 mb-1">
              Billed On Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="billedOnDate"
              value={billedOnDate}
              onChange={(e) => setBilledOnDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will query the database for claims billed on this date
            </p>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      {((reportMode === 'upload' && selectedFile) || reportMode === 'database') && (
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
      {((reportMode === 'upload' && selectedFile) || reportMode === 'database') && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setSelectedFile(null)
              setBilledOnDate('')
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
                {reportMode === 'database' ? (
                  <Database className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                Generate Billing Report PDF
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
            <li>• Single sheet containing stacked sections</li>
            <li>• REMITTANCE INFORMATION section with EFT #, Remittance Date, Remittance EFT Date, NET EARNINGS</li>
            <li>• MEMBER MEDICAID Paid Summary section with paid claims detail table</li>
            <li>• ISSUE/NOT BILLED section with pending claims (no paid amount)</li>
            <li>• SERVICES SUMMARY section with per-code paid counts (Medicare / Medicaid)</li>
          </ul>
        </div>
      ) : (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-green-900 mb-2">Database Report Information</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Report will query the database for claims with the specified Billed On date</li>
            <li>• Paid Claims: Claims with status "Paid" (case-insensitive)</li>
            <li>• Issue/Not Billed - Pending Review: Claims with any other status (Pending, null, etc.)</li>
            <li>• Report format matches the uploaded file version</li>
          </ul>
        </div>
      )}
    </div>
  )
}
