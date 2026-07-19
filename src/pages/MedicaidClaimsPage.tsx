import { useState, useEffect } from 'react'
import { FileText, Upload, Plus, Download, CheckSquare, Edit2, Trash2, X, AlertCircle, AlertTriangle } from 'lucide-react'
import { HamburgerMenu } from '../components/HamburgerMenu'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface Claim {
  id: number
  created_at: string
  provider: string
  client_name: string
  client_id: number
  date_of_service: string
  billed_amt: number | null
  paid_amt: number | null
  comments: string | null
  eft: string
  billed_on: string
  paid_on: string
  paid_issued: string
  companyId: string
  unit: number
  client_code: string
  dos_start: string
  dos_end: string
  service_code: string
  service_desc: string
  service_id: number
  status: string
  service_location: string
  primary_dx_cd: string | null
  employee: string
}

interface ParsedRow {
  rowIndex: number
  client_name: string
  date_of_service: string
  dos_start: string
  dos_end: string
  unit: number
  primary_dx_cd: string
  service_code: string
  service_desc: string
  service_location: string
  employee: string
  provider: string
  blockingIssues: string[]
  softWarnings: string[]
  isDuplicate: boolean
}

// Service code mapping
const SERVICE_CODE_MAP: Record<string, string> = {
  'H2014': 'BST (Skills Training and Development)',
  'H2017': 'PSR (Psychosocial Rehabilitation)'
}

export function MedicaidClaimsPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaims, setSelectedClaims] = useState<Set<number>>(new Set())
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showBilledOnPrompt, setShowBilledOnPrompt] = useState(false)
  const [uploadBilledOn, setUploadBilledOn] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  // Default date range: start of current month to today
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [dateRange, setDateRange] = useState({
    start: firstDayOfMonth.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  })
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: firstDayOfMonth.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  })

  const grandTotal = claims
    .filter(claim => selectedClaims.size === 0 || selectedClaims.has(claim.id))
    .reduce((sum, claim) => sum + (claim.paid_amt ?? 0), 0)

  // Fetch claims from Supabase
  const fetchClaims = async () => {
    if (!user?.companyId) return

    setLoading(true)
    try {
      // Build query similar to medical-biller-system
      const startDateTime = `${appliedDateRange.start} 00:00`
      const endDateTime = `${appliedDateRange.end} 23:59`

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('companyId', user.companyId)
        .in('provider', ['Medicaid'])
        .gte('billed_on', startDateTime)
        .lt('billed_on', endDateTime)
        .order('billed_on', { ascending: false })

      if (error) throw error

      setClaims(data || [])
    } catch (error: any) {
      console.error('Error fetching claims:', error)
      toast.error('Failed to load claims: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClaims()
  }, [user?.companyId, appliedDateRange.start, appliedDateRange.end])

  const handleApplyDateRange = () => {
    setAppliedDateRange(dateRange)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaims(new Set(claims.map(c => c.id)))
    } else {
      setSelectedClaims(new Set())
    }
  }

  const handleSelectClaim = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedClaims)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedClaims(newSelected)
  }

  const handleExport = () => {
    // TODO: Implement Excel export
    console.log('Exporting claims:', Array.from(selectedClaims))
  }

  // Parse date from MM/DD/YYYY to YYYY-MM-DD
  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null

    try {
      // Handle MM/DD/YYYY format
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0')
        const day = parts[1].padStart(2, '0')
        const year = parts[2]
        return `${year}-${month}-${day}`
      }

      // Already in YYYY-MM-DD format
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr
      }

      return null
    } catch {
      return null
    }
  }

  // Check for duplicates
  const checkForDuplicates = async (rows: ParsedRow[]): Promise<Set<number>> => {
    if (!user?.companyId) return new Set()

    const duplicateIndices = new Set<number>()

    try {
      // Check each row against existing claims
      for (const row of rows) {
        if (!row.client_name || !row.date_of_service || !row.service_code) continue

        const { data, error } = await supabase
          .from('claims')
          .select('id')
          .eq('companyId', user.companyId)
          .eq('client_name', row.client_name)
          .eq('date_of_service', row.date_of_service)
          .eq('service_code', row.service_code)
          .limit(1)

        if (!error && data && data.length > 0) {
          duplicateIndices.add(row.rowIndex)
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error)
    }

    return duplicateIndices
  }

  const handleUpload = () => {
    setShowUploadModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    setIsUploading(true)

    try {
      // Read Excel file
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        toast.error('No data found in Excel file')
        setIsUploading(false)
        return
      }

      // Parse and validate each row
      const parsed: ParsedRow[] = []

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i]
        const blockingIssues: string[] = []
        const softWarnings: string[] = []

        // Extract and validate columns
        const client_name = row['NAME'] || ''
        const dos_raw = row['DOS'] || ''
        const dos_start = row['START'] || ''
        const dos_end = row['END'] || ''
        const duration = parseInt(String(row['DURATION'] || '0'))
        const primary_dx_cd = row['CODE'] || ''
        const service_code = row['SERVICE'] || ''
        const service_location = row['LOCATION'] || ''
        const employee = row['EMPLOYEE'] || ''

        // Blocking validations
        if (!client_name.trim()) {
          blockingIssues.push('Missing NAME')
        }

        const date_of_service = parseDate(dos_raw)
        if (!date_of_service) {
          blockingIssues.push('Invalid or missing DOS')
        }

        if (!service_code.trim()) {
          blockingIssues.push('Missing SERVICE')
        }

        // Soft validations
        const service_desc = SERVICE_CODE_MAP[service_code]
        if (!service_desc) {
          softWarnings.push('Unknown service code')
        }

        // Duration mismatch check for H2014/H2017
        if ((service_code === 'H2014' || service_code === 'H2017') && duration !== 0) {
          softWarnings.push('Duration should be 0 for this service code')
        }

        parsed.push({
          rowIndex: i,
          client_name,
          date_of_service: date_of_service || '',
          dos_start,
          dos_end,
          unit: duration,
          primary_dx_cd,
          service_code,
          service_desc: service_desc || '',
          service_location,
          employee,
          provider: employee, // Provider = Employee per guide
          blockingIssues,
          softWarnings,
          isDuplicate: false
        })
      }

      // Check for duplicates
      const duplicateIndices = await checkForDuplicates(parsed)
      parsed.forEach(row => {
        if (duplicateIndices.has(row.rowIndex)) {
          row.isDuplicate = true
          row.blockingIssues.push('Duplicate record detected')
        }
      })

      setParsedRows(parsed)

      // Auto-select clean rows
      const cleanRows = new Set<number>()
      parsed.forEach(row => {
        if (row.blockingIssues.length === 0) {
          cleanRows.add(row.rowIndex)
        }
      })
      setSelectedRows(cleanRows)

      // Close upload modal and show review modal
      setShowUploadModal(false)
      setShowReviewModal(true)
    } catch (error: any) {
      console.error('Parse error:', error)
      toast.error(`Failed to parse file: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectAllRows = (checked: boolean) => {
    if (checked) {
      const selectableRows = parsedRows
        .filter(row => row.blockingIssues.length === 0)
        .map(row => row.rowIndex)
      setSelectedRows(new Set(selectableRows))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleSelectRow = (rowIndex: number, checked: boolean) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(rowIndex)
    } else {
      newSelected.delete(rowIndex)
    }
    setSelectedRows(newSelected)
  }

  const handleReviewSave = () => {
    if (selectedRows.size === 0) {
      toast.error('Please select at least one row to save')
      return
    }

    // Show billed_on date prompt
    setUploadBilledOn(today.toISOString().split('T')[0])
    setShowBilledOnPrompt(true)
  }

  const handleFinalSave = async () => {
    if (!uploadBilledOn) {
      toast.error('Please select a billed on date')
      return
    }

    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    setIsUploading(true)

    try {
      // Build claims from selected rows
      const claimsToInsert = parsedRows
        .filter(row => selectedRows.has(row.rowIndex))
        .map(row => ({
          provider: row.provider,
          client_name: row.client_name,
          client_id: 0, // Per guide: left null/default since Excel has no client ID
          date_of_service: row.date_of_service,
          dos_start: row.dos_start,
          dos_end: row.dos_end,
          billed_amt: null,
          paid_amt: null,
          comments: null,
          eft: '',
          billed_on: uploadBilledOn,
          paid_on: uploadBilledOn,
          paid_issued: uploadBilledOn,
          companyId: user.companyId,
          unit: row.unit,
          client_code: '', // Per guide: left null/default
          service_code: row.service_code,
          service_desc: row.service_desc,
          service_id: 0,
          status: 'Pending',
          service_location: row.service_location,
          primary_dx_cd: row.primary_dx_cd,
          employee: row.employee
        }))

      // Insert into Supabase
      const { data: insertedData, error: insertError } = await supabase
        .from('claims')
        .insert(claimsToInsert)
        .select()

      if (insertError) {
        console.error('Error inserting claims:', insertError)
        toast.error(`Failed to save claims: ${insertError.message}`)
        setIsUploading(false)
        return
      }

      toast.success(`Successfully saved ${insertedData?.length || claimsToInsert.length} claims`)

      // Close modals and reset
      setShowBilledOnPrompt(false)
      setShowReviewModal(false)
      setSelectedFile(null)
      setUploadBilledOn('')
      setParsedRows([])
      setSelectedRows(new Set())

      // Refresh claims list
      fetchClaims()
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(`Save failed: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddClaim = () => {
    // TODO: Open modal form
    console.log('Add new claim')
  }

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
                  Medicaid Claims
                </h1>
                <p className="text-sm text-gray-600 mt-1">Manage Medicaid claim submissions and payments</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
              <button
                onClick={handleAddClaim}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Claim
              </button>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Paid Amount</span>
                <span className="text-2xl font-bold text-green-600">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Search by client, provider, code..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              &nbsp;
            </label>
            <button
              onClick={handleApplyDateRange}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      {selectedClaims.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
              <CheckSquare className="w-5 h-5" />
              <span className="font-medium">{selectedClaims.size} claim(s) selected</span>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Selected
            </button>
          </div>
        </div>
      )}

      {/* Claims Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedClaims.size === claims.length && claims.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Billed On</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid On</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">EFT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DOS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Billed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading claims...</span>
                    </div>
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No claims found</p>
                    <p className="text-gray-400 text-sm mt-1">Upload or add claims to get started</p>
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedClaims.has(claim.id)}
                        onChange={(e) => handleSelectClaim(claim.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(claim.billed_on).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(claim.paid_on).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{claim.eft}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{claim.provider}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{claim.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(claim.date_of_service).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{claim.service_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{claim.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">${(claim.billed_amt ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">${(claim.paid_amt ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        claim.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        claim.status === 'Denied' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Upload Billing File</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setSelectedFile(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Excel File (.xlsx)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setSelectedFile(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Processing...' : 'Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Claims</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedRows.size} of {parsedRows.filter(r => r.blockingIssues.length === 0).length} rows selected
                </p>
              </div>
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setParsedRows([])
                  setSelectedRows(new Set())
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === parsedRows.filter(r => r.blockingIssues.length === 0).length && parsedRows.filter(r => r.blockingIssues.length === 0).length > 0}
                    onChange={(e) => handleSelectAllRows(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All Clean Rows</span>
                </label>
              </div>

              <div className="space-y-3">
                {parsedRows.map((row) => {
                  const hasBlockingIssues = row.blockingIssues.length > 0
                  const hasSoftWarnings = row.softWarnings.length > 0

                  return (
                    <div
                      key={row.rowIndex}
                      className={`border rounded-lg p-4 ${
                        hasBlockingIssues ? 'border-red-300 bg-red-50' :
                        hasSoftWarnings ? 'border-yellow-300 bg-yellow-50' :
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.rowIndex)}
                          onChange={(e) => handleSelectRow(row.rowIndex, e.target.checked)}
                          disabled={hasBlockingIssues}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        />

                        <div className="flex-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                            <div>
                              <span className="text-xs font-medium text-gray-500">Client</span>
                              <p className="text-sm text-gray-900">{row.client_name || '—'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">DOS</span>
                              <p className="text-sm text-gray-900">{row.date_of_service || '—'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Time</span>
                              <p className="text-sm text-gray-900">{row.dos_start} - {row.dos_end}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Service</span>
                              <p className="text-sm text-gray-900">{row.service_code}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Description</span>
                              <p className="text-sm text-gray-900">{row.service_desc || '—'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Unit</span>
                              <p className="text-sm text-gray-900">{row.unit}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Location</span>
                              <p className="text-sm text-gray-900">{row.service_location || '—'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Employee</span>
                              <p className="text-sm text-gray-900">{row.employee || '—'}</p>
                            </div>
                          </div>

                          {row.primary_dx_cd && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-gray-500">Diagnosis: </span>
                              <span className="text-sm text-gray-900">{row.primary_dx_cd}</span>
                            </div>
                          )}

                          {hasBlockingIssues && (
                            <div className="flex items-center gap-2 text-red-700 mt-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm font-medium">
                                {row.blockingIssues.join(', ')}
                              </span>
                            </div>
                          )}

                          {hasSoftWarnings && (
                            <div className="flex items-center gap-2 text-yellow-700 mt-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm">
                                {row.softWarnings.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    setParsedRows([])
                    setSelectedRows(new Set())
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewSave}
                  disabled={selectedRows.size === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Save Selected ({selectedRows.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billed On Date Prompt */}
      {showBilledOnPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Select Billed On Date</h2>
              <button
                onClick={() => setShowBilledOnPrompt(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Billed On Date
              </label>
              <input
                type="date"
                value={uploadBilledOn}
                onChange={(e) => setUploadBilledOn(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                This date will be applied to all {selectedRows.size} selected claims
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBilledOnPrompt(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalSave}
                disabled={!uploadBilledOn || isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
