import { useState, useEffect } from 'react'
import { FileText, Upload, Plus, Download, CheckSquare, Edit2, Trash2 } from 'lucide-react'
import { HamburgerMenu } from '../components/HamburgerMenu'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

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

export function MedicareClaimsPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaims, setSelectedClaims] = useState<Set<number>>(new Set())
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)

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
        .in('provider', ['Medicare'])
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

  const handleUpload = () => {
    // TODO: Implement file upload
    console.log('Upload claims')
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
                  Medicare Claims
                </h1>
                <p className="text-sm text-gray-600 mt-1">Manage Medicare claim submissions and payments</p>
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
    </div>
  )
}
