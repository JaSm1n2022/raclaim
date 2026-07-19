import { useState, useEffect } from 'react'
import { Wrench, DollarSign, FileText, AlertCircle, Upload, Download, CheckSquare, Edit2, Trash2 } from 'lucide-react'
import { HamburgerMenu } from '../components/HamburgerMenu'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

type TabType = 'eft-medicaid' | 'missing-logs' | 'office-ally'
type DateRangePreset = 'today' | 'this-week' | 'last-week' | 'this-month' | 'last-30-days' | 'last-90-days' | 'custom'

interface EftRecord {
  id: number
  created_at: string
  client: string
  service_cd: string
  service_desc: string
  service_mod: string | null
  dos: string
  eos: string
  billed_amt: number
  paid_amt: number
  status: string
  provider: string
  eft_number: string
  paid_on: string
  paid_issued: string
  companyId: string
  client_code: string
  comments: string | null
}

interface MissingLogRecord extends EftRecord {
  reason: string
}

export function UtilitiesPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('eft-medicaid')
  const [eftRecords, setEftRecords] = useState<EftRecord[]>([])
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  // Missing Logs state
  const [missingLogs, setMissingLogs] = useState<MissingLogRecord[]>([])
  const [selectedMissingLogs, setSelectedMissingLogs] = useState<Set<number>>(new Set())
  const [loadingMissingLogs, setLoadingMissingLogs] = useState(false)
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month')

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

  // Missing logs date range
  const [missingLogsDateRange, setMissingLogsDateRange] = useState({
    start: firstDayOfMonth.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  })

  const grandTotal = eftRecords
    .filter(record => selectedRecords.size === 0 || selectedRecords.has(record.id))
    .reduce((sum, record) => sum + (record.paid_amt ?? 0), 0)

  // Fetch EFT records from Supabase
  const fetchEftRecords = async () => {
    if (!user?.companyId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('efts')
        .select('*')
        .eq('companyId', user.companyId)
        .gte('paid_on', appliedDateRange.start)
        .lte('paid_on', appliedDateRange.end)
        .order('paid_on', { ascending: false })

      if (error) throw error

      setEftRecords(data || [])
    } catch (error: any) {
      console.error('Error fetching EFT records:', error)
      toast.error('Failed to load EFT records: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'eft-medicaid') {
      fetchEftRecords()
    }
  }, [user?.companyId, appliedDateRange.start, appliedDateRange.end, activeTab])

  const handleApplyDateRange = () => {
    setAppliedDateRange(dateRange)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(new Set(eftRecords.map(r => r.id)))
    } else {
      setSelectedRecords(new Set())
    }
  }

  const handleSelectRecord = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedRecords)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedRecords(newSelected)
  }

  const handleExport = () => {
    const recordsToExport = selectedRecords.size > 0
      ? eftRecords.filter(r => selectedRecords.has(r.id))
      : eftRecords

    if (recordsToExport.length === 0) {
      toast.error('No records to export')
      return
    }

    // Prepare data for Excel
    const excelData = recordsToExport.map(record => ({
      'Paid On': new Date(record.paid_on).toLocaleDateString(),
      'Paid Issued': new Date(record.paid_issued).toLocaleDateString(),
      'EFT Number': record.eft_number,
      'Provider': record.provider,
      'Client': record.client,
      'Client Code': record.client_code,
      'Service Code': record.service_cd,
      'Service Description': record.service_desc,
      'Service Modifier': record.service_mod || '',
      'DOS': new Date(record.dos).toLocaleDateString(),
      'EOS': new Date(record.eos).toLocaleDateString(),
      'Billed Amount': record.billed_amt,
      'Paid Amount': record.paid_amt,
      'Status': record.status,
      'Comments': record.comments || ''
    }))

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'EFT Records')

    // Generate filename with date range
    const filename = `EFT_Records_${appliedDateRange.start}_to_${appliedDateRange.end}.xlsx`

    // Download file
    XLSX.writeFile(wb, filename)

    toast.success(`Exported ${recordsToExport.length} record(s) to Excel`)
  }

  const handleUpload = () => {
    // TODO: Implement file upload
    toast.info('Upload functionality coming soon')
    console.log('Upload EFT data')
  }

  // Calculate date range based on preset
  const getDateRangeFromPreset = (preset: DateRangePreset) => {
    const today = new Date()
    const start = new Date()
    const end = new Date()

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'this-week':
        const dayOfWeek = today.getDay()
        start.setDate(today.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'last-week':
        const lastWeekStart = new Date(today)
        const lastWeekEnd = new Date(today)
        const currentDayOfWeek = today.getDay()
        lastWeekStart.setDate(today.getDate() - currentDayOfWeek - 7)
        lastWeekEnd.setDate(today.getDate() - currentDayOfWeek - 1)
        lastWeekStart.setHours(0, 0, 0, 0)
        lastWeekEnd.setHours(23, 59, 59, 999)
        return {
          start: lastWeekStart.toISOString().split('T')[0],
          end: lastWeekEnd.toISOString().split('T')[0]
        }
      case 'this-month':
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'last-30-days':
        start.setDate(today.getDate() - 30)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'last-90-days':
        start.setDate(today.getDate() - 90)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'custom':
        return missingLogsDateRange
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }

  // Handle preset change
  const handlePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    if (preset !== 'custom') {
      const range = getDateRangeFromPreset(preset)
      setMissingLogsDateRange(range)
    }
  }

  // Generate missing logs report
  const generateMissingLogs = async () => {
    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    setLoadingMissingLogs(true)

    try {
      const dateRange = getDateRangeFromPreset(dateRangePreset)

      // Fetch EFT records
      const { data: eftData, error: eftError } = await supabase
        .from('efts')
        .select('*')
        .eq('companyId', user.companyId)
        .gte('paid_on', dateRange.start)
        .lte('paid_on', dateRange.end)
        .order('paid_on', { ascending: false })

      if (eftError) throw eftError

      // Fetch claims for comparison
      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select('*')
        .eq('companyId', user.companyId)

      if (claimsError) throw claimsError

      // Find EFT records without matching claims
      const missingRecords: MissingLogRecord[] = []

      eftData?.forEach(eft => {
        // Try to find a matching claim
        const matchingClaim = claimsData?.find(claim => {
          // Match criteria: provider, service code, client name (case insensitive), and date of service
          const providerMatch = claim.provider?.toLowerCase() === eft.provider?.toLowerCase()
          const serviceCodeMatch = claim.service_code === eft.service_cd
          const clientMatch = claim.client_name?.toLowerCase().trim() === eft.client?.toLowerCase().trim()

          // Check if DOS matches either dos or date_of_service
          // Helper function to safely convert date to ISO string
          const safeToISODate = (dateValue: any): string | null => {
            if (!dateValue) return null
            try {
              const date = new Date(dateValue)
              if (isNaN(date.getTime())) return null
              return date.toISOString().split('T')[0]
            } catch {
              return null
            }
          }

          const eftDos = safeToISODate(eft.dos)
          const claimDos = safeToISODate(claim.dos_start) || safeToISODate(claim.date_of_service)

          const dosMatch = eftDos && claimDos && claimDos === eftDos

          return providerMatch && serviceCodeMatch && clientMatch && dosMatch
        })

        if (!matchingClaim) {
          missingRecords.push({
            ...eft,
            reason: 'No matching claim found'
          })
        }
      })

      setMissingLogs(missingRecords)
      setSelectedMissingLogs(new Set())

      if (missingRecords.length === 0) {
        toast.success('All EFT records have matching claims!')
      } else {
        toast.warning(`Found ${missingRecords.length} EFT record(s) without matching claims`)
      }
    } catch (error: any) {
      console.error('Error generating missing logs:', error)
      toast.error('Failed to generate missing logs: ' + error.message)
    } finally {
      setLoadingMissingLogs(false)
    }
  }

  // Handle select all for missing logs
  const handleSelectAllMissingLogs = (checked: boolean) => {
    if (checked) {
      setSelectedMissingLogs(new Set(missingLogs.map(r => r.id)))
    } else {
      setSelectedMissingLogs(new Set())
    }
  }

  // Handle select individual missing log
  const handleSelectMissingLog = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedMissingLogs)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedMissingLogs(newSelected)
  }

  // Export missing logs to Excel
  const handleExportMissingLogs = () => {
    const recordsToExport = selectedMissingLogs.size > 0
      ? missingLogs.filter(r => selectedMissingLogs.has(r.id))
      : missingLogs

    if (recordsToExport.length === 0) {
      toast.error('No records to export')
      return
    }

    // Prepare data for Excel
    const excelData = recordsToExport.map(record => ({
      'Paid On': new Date(record.paid_on).toLocaleDateString(),
      'EFT Number': record.eft_number,
      'Provider': record.provider,
      'Client': record.client,
      'Client Code': record.client_code,
      'Service Code': record.service_cd,
      'Service Description': record.service_desc,
      'DOS': new Date(record.dos).toLocaleDateString(),
      'EOS': new Date(record.eos).toLocaleDateString(),
      'Billed Amount': record.billed_amt,
      'Paid Amount': record.paid_amt,
      'Status': record.status,
      'Reason': record.reason
    }))

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Logs')

    const dateRange = getDateRangeFromPreset(dateRangePreset)
    const filename = `EFT_Missing_Logs_${dateRange.start}_to_${dateRange.end}.xlsx`

    // Download file
    XLSX.writeFile(wb, filename)

    toast.success(`Exported ${recordsToExport.length} missing log(s) to Excel`)
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
                  Utilities
                </h1>
                <p className="text-sm text-gray-600 mt-1">EFT management and reporting tools</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

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
              {/* Summary Card */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleUpload}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload EFT Data
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date (Paid On)
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
                      End Date (Paid On)
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
              {selectedRecords.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700">
                      <CheckSquare className="w-5 h-5" />
                      <span className="font-medium">{selectedRecords.size} record(s) selected</span>
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

              {/* EFT Records Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedRecords.size === eftRecords.length && eftRecords.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid On</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">EFT Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Service Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DOS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">EOS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Billed</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <span className="ml-3 text-gray-600">Loading EFT records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : eftRecords.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-12 text-center">
                            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No EFT records found</p>
                            <p className="text-gray-400 text-sm mt-1">Upload EFT data to get started</p>
                          </td>
                        </tr>
                      ) : (
                        eftRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(record.id)}
                                onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
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
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(record.paid_on).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.eft_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.client}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{record.service_cd}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(record.dos).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(record.eos).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">${(record.billed_amt ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-green-600">${(record.paid_amt ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                record.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                record.status === 'DENIED' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {record.status}
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
          )}

          {activeTab === 'missing-logs' && (
            <div>
              {/* Date Range Presets */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date Range</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                  <button
                    onClick={() => handlePresetChange('today')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'today'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handlePresetChange('this-week')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'this-week'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => handlePresetChange('last-week')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'last-week'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Last Week
                  </button>
                  <button
                    onClick={() => handlePresetChange('this-month')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'this-month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => handlePresetChange('last-30-days')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'last-30-days'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => handlePresetChange('last-90-days')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'last-90-days'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Last 90 Days
                  </button>
                  <button
                    onClick={() => handlePresetChange('custom')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      dateRangePreset === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom Date Range Inputs */}
                {dateRangePreset === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={missingLogsDateRange.start}
                        onChange={(e) => setMissingLogsDateRange({ ...missingLogsDateRange, start: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={missingLogsDateRange.end}
                        onChange={(e) => setMissingLogsDateRange({ ...missingLogsDateRange, end: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={generateMissingLogs}
                    disabled={loadingMissingLogs}
                    className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loadingMissingLogs ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Generate Missing Logs Report
                      </>
                    )}
                  </button>
                  <div className="text-sm text-gray-600">
                    Date Range: {getDateRangeFromPreset(dateRangePreset).start} to {getDateRangeFromPreset(dateRangePreset).end}
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  How it works:
                </h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Fetches all EFT transaction records within the selected date range</li>
                  <li>Compares against claim records using provider, date of service, service code, and client name</li>
                  <li>Identifies EFT payments without matching claims</li>
                  <li>Helps ensure data integrity and identify data entry gaps</li>
                </ul>
              </div>

              {/* Results Section */}
              {missingLogs.length > 0 && (
                <>
                  {/* Actions Bar */}
                  {selectedMissingLogs.size > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <CheckSquare className="w-5 h-5" />
                          <span className="font-medium">{selectedMissingLogs.size} record(s) selected</span>
                        </div>
                        <button
                          onClick={handleExportMissingLogs}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Export Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-yellow-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Missing Logs Found</h3>
                          <p className="text-sm text-gray-600">
                            {missingLogs.length} EFT record(s) without matching claims
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleExportMissingLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Export All
                      </button>
                    </div>
                  </div>

                  {/* Missing Logs Table */}
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={selectedMissingLogs.size === missingLogs.length && missingLogs.length > 0}
                                onChange={(e) => handleSelectAllMissingLogs(e.target.checked)}
                                className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid On</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">EFT Number</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Provider</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Client</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Service Code</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">DOS</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {missingLogs.map((record) => (
                            <tr key={record.id} className="hover:bg-yellow-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedMissingLogs.has(record.id)}
                                  onChange={(e) => handleSelectMissingLog(record.id, e.target.checked)}
                                  className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{new Date(record.paid_on).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.eft_number}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.provider}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.client}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{record.service_cd}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{new Date(record.dos).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm font-medium text-green-600">${(record.paid_amt ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                  {record.reason}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* No Results */}
              {!loadingMissingLogs && missingLogs.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Missing Logs</h3>
                  <p className="text-gray-600">
                    Click "Generate Missing Logs Report" to find EFT records without matching claims
                  </p>
                </div>
              )}
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
