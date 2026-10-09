import { useState, useEffect } from 'react'
import { Settings, Code, Users, Plus, Upload, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

type TabType = 'service-codes' | 'patients'

interface ServiceCode {
  id: string
  code: string
  description: string
  unit: number
  ratePerMin: number
  totalRate: number
  provider: string
}

interface Patient {
  id: number
  patientCd: string
  fn: string
  ln: string
  name: string
  created_at: string
  companyId: string
}

function generatePatientCode(fn: string, ln: string): string {
  let code = ''
  const trimmedLn = ln.trim()
  const trimmedFn = fn.trim()

  if (!trimmedFn || !trimmedLn) return ''

  if (trimmedLn.length < 5) {
    code += trimmedLn.toUpperCase()
  } else {
    code += trimmedLn.substring(0, trimmedLn.length - 2)
  }

  if (trimmedFn.length < 3) {
    code += `-${trimmedFn}`
  } else {
    code += `-${trimmedFn.substring(0, trimmedFn.length - 2)}`
  }

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`
  code += `.${stamp}`

  return code.toUpperCase()
}

export function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('service-codes')
  const [serviceCodes] = useState<ServiceCode[]>([])

  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoadingPatients, setIsLoadingPatients] = useState(false)

  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null)
  const [formFn, setFormFn] = useState('')
  const [formLn, setFormLn] = useState('')
  const [formPatientCd, setFormPatientCd] = useState('')
  const [isSavingPatient, setIsSavingPatient] = useState(false)

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingPatients, setIsUploadingPatients] = useState(false)

  const [deletingPatientId, setDeletingPatientId] = useState<number | null>(null)

  const handleAddServiceCode = () => {
    console.log('Add service code')
  }

  const fetchPatients = async () => {
    if (!user?.companyId) return

    setIsLoadingPatients(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('companyId', user.companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[fetchPatients] Error:', error)
        toast.error('Failed to load patients')
        return
      }

      setPatients(data || [])
    } catch (error: any) {
      console.error('[fetchPatients] Error:', error)
      toast.error('Failed to load patients')
    } finally {
      setIsLoadingPatients(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'patients' && user?.companyId) {
      fetchPatients()
    }
  }, [activeTab, user?.companyId])

  const openCreatePatientForm = () => {
    setFormMode('create')
    setEditingPatientId(null)
    setFormFn('')
    setFormLn('')
    setFormPatientCd('')
    setIsFormModalOpen(true)
  }

  const openEditPatientForm = (patient: Patient) => {
    setFormMode('edit')
    setEditingPatientId(patient.id)
    setFormFn(patient.fn || '')
    setFormLn(patient.ln || '')
    setFormPatientCd(patient.patientCd || '')
    setIsFormModalOpen(true)
  }

  const closePatientForm = () => {
    setIsFormModalOpen(false)
    setEditingPatientId(null)
  }

  useEffect(() => {
    if (formMode === 'create' && formFn && formLn) {
      setFormPatientCd(generatePatientCode(formFn, formLn))
    }
  }, [formFn, formLn, formMode])

  const handleSavePatient = async () => {
    if (!user?.companyId) {
      toast.error('Company ID not found')
      return
    }
    if (!formFn.trim() || !formLn.trim()) {
      toast.error('First and last name are required')
      return
    }
    if (!formPatientCd.trim()) {
      toast.error('Patient code is required')
      return
    }

    setIsSavingPatient(true)
    try {
      const payload = {
        fn: formFn.trim(),
        ln: formLn.trim(),
        name: `${formFn.trim()} ${formLn.trim()}`,
        patientCd: formPatientCd.trim().toUpperCase(),
        companyId: user.companyId,
      }

      if (formMode === 'create') {
        const { error } = await supabase.from('patients').insert(payload)
        if (error) throw error
        toast.success('Patient created successfully')
      } else if (editingPatientId) {
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', editingPatientId)
        if (error) throw error
        toast.success('Patient updated successfully')
      }

      closePatientForm()
      fetchPatients()
    } catch (error: any) {
      console.error('[handleSavePatient] Error:', error)
      toast.error(error.message || 'Failed to save patient')
    } finally {
      setIsSavingPatient(false)
    }
  }

  const handleDeletePatient = async (patient: Patient) => {
    if (!confirm(`Delete patient "${patient.name}"? This cannot be undone.`)) {
      return
    }

    setDeletingPatientId(patient.id)
    try {
      const { error } = await supabase.from('patients').delete().eq('id', patient.id)
      if (error) throw error
      toast.success('Patient deleted')
      setPatients((prev) => prev.filter((p) => p.id !== patient.id))
    } catch (error: any) {
      console.error('[handleDeletePatient] Error:', error)
      toast.error(error.message || 'Failed to delete patient')
    } finally {
      setDeletingPatientId(null)
    }
  }

  const handleUploadPatients = () => {
    setSelectedFile(null)
    setIsUploadModalOpen(true)
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
      toast.error('Company ID not found')
      return
    }

    setIsUploadingPatients(true)
    try {
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        toast.error('No data found in Excel file')
        setIsUploadingPatients(false)
        return
      }

      const existingNames = new Set(
        patients.map((p) => p.name?.trim().toLowerCase()).filter(Boolean)
      )

      const rowsToInsert: Array<{ fn: string; ln: string; name: string; patientCd: string; companyId: string }> = []
      let skipped = 0

      jsonData.forEach((row) => {
        const fn = String(row['FIRST NAME'] ?? row['First Name'] ?? row['FN'] ?? row['fn'] ?? '').trim()
        const ln = String(row['LAST NAME'] ?? row['Last Name'] ?? row['LN'] ?? row['ln'] ?? '').trim()

        if (!fn || !ln) {
          skipped++
          return
        }

        const name = `${fn} ${ln}`
        if (existingNames.has(name.trim().toLowerCase())) {
          skipped++
          return
        }

        rowsToInsert.push({
          fn,
          ln,
          name,
          patientCd: generatePatientCode(fn, ln),
          companyId: user.companyId!,
        })
        existingNames.add(name.trim().toLowerCase())
      })

      if (rowsToInsert.length === 0) {
        toast.error('No new valid patients found in file')
        setIsUploadingPatients(false)
        return
      }

      const { data: inserted, error } = await supabase.from('patients').insert(rowsToInsert).select()
      if (error) throw error

      toast.success(
        `Imported ${inserted?.length || rowsToInsert.length} patient(s)${skipped > 0 ? `, skipped ${skipped}` : ''}`
      )

      setIsUploadModalOpen(false)
      setSelectedFile(null)
      fetchPatients()
    } catch (error: any) {
      console.error('[handleUploadSubmit] Error:', error)
      toast.error(error.message || 'Failed to upload patients')
    } finally {
      setIsUploadingPatients(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Configure service codes and patient records</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('service-codes')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'service-codes'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Code className="w-4 h-4" />
              Service Codes
            </button>
            <button
              onClick={() => setActiveTab('patients')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'patients'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Patients
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'service-codes' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Service Code Management</h2>
                  <p className="text-sm text-gray-600">
                    Manage billing service codes and rates
                  </p>
                </div>
                <button
                  onClick={handleAddServiceCode}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Service Code
                </button>
              </div>

              {/* Service Codes Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rate/Min</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Total Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Provider</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {serviceCodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <Code className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No service codes found</p>
                          <p className="text-gray-400 text-sm mt-1">Add service codes to get started</p>
                        </td>
                      </tr>
                    ) : (
                      serviceCodes.map((code) => (
                        <tr key={code.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{code.code}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{code.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{code.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${code.ratePerMin.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">${code.totalRate.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{code.provider}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Edit
                              </button>
                              <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Patient Management</h2>
                  <p className="text-sm text-gray-600">
                    Manage patient master list and identifiers
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUploadPatients}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Excel
                  </button>
                  <button
                    onClick={openCreatePatientForm}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Patient
                  </button>
                </div>
              </div>

              {/* Patients Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Patient Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoadingPatients ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center">
                          <Loader2 className="w-6 h-6 text-purple-600 mx-auto mb-2 animate-spin" />
                          <p className="text-gray-500 text-sm">Loading patients...</p>
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No patients found</p>
                          <p className="text-gray-400 text-sm mt-1">Add or upload patients to get started</p>
                        </td>
                      </tr>
                    ) : (
                      patients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.patientCd}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{patient.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(patient.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditPatientForm(patient)}
                                title="Edit patient"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePatient(patient)}
                                disabled={deletingPatientId === patient.id}
                                title="Delete patient"
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {deletingPatientId === patient.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Patient Code Format:</h4>
                <p className="text-sm text-blue-700">
                  LASTNAME-FIRSTNAME.YYYYMMDDHHMM (e.g., SMITH-JO.202601151430)
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Patient codes are auto-generated based on name and timestamp. You can customize them during entry.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Patient Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {formMode === 'create' ? 'Add Patient' : 'Edit Patient'}
              </h2>
              <button onClick={closePatientForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
                <input
                  type="text"
                  value={formLn}
                  onChange={(e) => setFormLn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Last Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                <input
                  type="text"
                  value={formFn}
                  onChange={(e) => setFormFn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Code*</label>
                <input
                  type="text"
                  value={formPatientCd}
                  onChange={(e) => setFormPatientCd(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="Auto-generated from name"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-suggested; you may customize before saving.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closePatientForm}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePatient}
                disabled={isSavingPatient || !formFn.trim() || !formLn.trim() || !formPatientCd.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingPatient ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Upload Patients</h2>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false)
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">Selected: {selectedFile.name}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                File must include columns "First Name" and "Last Name" (or "FN"/"LN").
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false)
                  setSelectedFile(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploadingPatients}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUploadingPatients ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
