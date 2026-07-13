import { useState } from 'react'
import { Settings, Code, Users, Plus, Upload } from 'lucide-react'

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
  id: string
  patientCode: string
  firstName: string
  lastName: string
  name: string
  createdAt: string
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('service-codes')
  const [serviceCodes, setServiceCodes] = useState<ServiceCode[]>([])
  const [patients, setPatients] = useState<Patient[]>([])

  const handleAddServiceCode = () => {
    console.log('Add service code')
  }

  const handleUploadPatients = () => {
    console.log('Upload patients')
  }

  const handleAddPatient = () => {
    console.log('Add patient')
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
                    onClick={handleAddPatient}
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
                    {patients.length === 0 ? (
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
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.patientCode}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{patient.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{patient.createdAt}</td>
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
    </div>
  )
}
