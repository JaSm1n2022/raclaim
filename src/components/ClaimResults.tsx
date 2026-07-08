import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { ParsedClaimData, ClaimItem } from '../types'

interface ClaimResultsProps {
  data: ParsedClaimData
}

export default function ClaimResults({ data }: ClaimResultsProps) {
  const downloadExcel = (sheetData: any[], sheetName: string, filename: string, columns?: string[]) => {
    const wb = XLSX.utils.book_new()

    // Column header display mapping
    const columnHeaderMap: { [key: string]: string } = {
      'sameName': 'Name',
      'samename': 'Name',
      'memberName': 'Member Name',
      'service': 'Proc Cd',
      'modifierCd': 'Modifier',
      'srvcModifierCd': 'Modifier',
      'srvDateFrom': 'From',
      'srvDateTo': 'To',
      'billedAmt': 'Billed Amt',
      'allowedAmt': 'Allowed Amt',
      'deductible': 'Deductible',
      'coinsurance': 'Coinsurance',
      'paidAmt': 'Paid Amt',
      'eobCd': 'EOB Cd',
      'remCd': 'Rem Cd',
      'claimNum': 'Claim Num',
      'icn': 'ICN',
      'dos': 'DOS',
      'procCd': 'Proc Cd',
      'procDesc': 'Proc Desc',
      'from': 'From',
      'to': 'To',
      'billAmount': 'Bill Amount',
      'paidAmount': 'Paid Amount',
      'detail': 'Detail',
      'detailDescription': 'Detail Description',
      'srvcCode': 'Proc Cd',
      'srvcDesc': 'Proc Desc',
      'srvcFrom': 'From',
      'srvcTo': 'To',
      'srvcDetail': 'Detail',
      'srvcBilledAmt': 'Billed Amount',
      'srvcPaidAmt': 'Paid Amount',
      'svDescription': 'Detail Description'
    }

    const getColumnHeader = (key: string) => {
      if (key.toLowerCase() === 'samename') {
        return 'Name'
      }
      return columnHeaderMap[key] || key.replace(/([A-Z])/g, ' $1').trim()
    }

    // If specific columns are provided, filter the data to only include those columns
    let dataToExport = sheetData
    if (columns && columns.length > 0) {
      dataToExport = sheetData.map(row => {
        const filteredRow: any = {}
        columns.forEach(col => {
          if (row[col] !== undefined) {
            // Use the friendly column name as the key
            const headerName = getColumnHeader(col)
            // Handle array values (like svDescription)
            let value = row[col]
            if (Array.isArray(value)) {
              value = value.join(', ')
            }
            filteredRow[headerName] = value
          }
        })
        return filteredRow
      })
    } else {
      // Map all columns to friendly names
      dataToExport = sheetData.map(row => {
        const mappedRow: any = {}
        Object.keys(row).forEach(key => {
          const headerName = getColumnHeader(key)
          // Handle array values (like svDescription)
          let value = row[key]
          if (Array.isArray(value)) {
            value = value.join(', ')
          }
          mappedRow[headerName] = value
        })
        return mappedRow
      })
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
  }

  const downloadAllData = () => {
    const wb = XLSX.utils.book_new()

    // Medicaid Paid
    if (data.medicaid.paid.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(data.medicaid.paid)
      XLSX.utils.book_append_sheet(wb, ws1, 'Medicaid Paid')
    }

    // Medicaid Denied
    if (data.medicaid.denied.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(data.medicaid.denied)
      XLSX.utils.book_append_sheet(wb, ws2, 'Medicaid Denied')
    }

    // Medicare Paid
    if (data.medicare.paid.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(data.medicare.paid)
      XLSX.utils.book_append_sheet(wb, ws3, 'Medicare Paid')
    }

    // Medicare Denied
    if (data.medicare.denied.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(data.medicare.denied)
      XLSX.utils.book_append_sheet(wb, ws4, 'Medicare Denied')
    }

    // Services
    if (data.services.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(data.services)
      XLSX.utils.book_append_sheet(wb, ws5, 'Services')
    }

    // Summary
    const summaryData = [
      { Metric: 'Net Payment', Value: data.netPayment },
      { Metric: 'Denied Amount', Value: data.deniedAmount },
      { Metric: 'Total Payments', Value: data.totalNumber.payments },
      { Metric: 'Total Denied', Value: data.totalNumber.denied },
      { Metric: 'Total Adjustments', Value: data.totalNumber.adjustment },
    ]
    const ws6 = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws6, 'Summary')

    XLSX.writeFile(wb, 'RA_Claim_Complete.xlsx')
  }

  const renderTable = (claims: any[], title: string) => {
    if (claims.length === 0) return null

    // Get column keys and apply custom mappings
    const getColumns = (obj: any) => {
      // Define specific column order for Medicaid Paid Claims
      if (title.includes('Medicaid Paid')) {
        return ['samename', 'srvcCode', 'srvcModifierCd', 'srvcDesc', 'srvcFrom', 'srvcTo', 'srvcBilledAmt', 'srvcPaidAmt', 'srvcDetail', 'svDescription']
      }

      // For Adjustment Summary, filter out memberName and name
      if (title.includes('Adjustment Summary')) {
        const keys = Object.keys(obj)
        return keys.filter(key => key !== 'memberName' && key !== 'name')
      }

      // For all other tables, return all keys
      return Object.keys(obj)
    }

    const columns = getColumns(claims[0])

    // Column header display mapping
    const columnHeaderMap: { [key: string]: string } = {
      'sameName': 'Name',
      'samename': 'Name',
      'memberName': 'Member Name',
      'service': 'Proc Cd',
      'modifierCd': 'Modifier',
      'srvcModifierCd': 'Modifier',
      'srvDateFrom': 'From',
      'srvDateTo': 'To',
      'billedAmt': 'Billed Amt',
      'allowedAmt': 'Allowed Amt',
      'deductible': 'Deductible',
      'coinsurance': 'Coinsurance',
      'paidAmt': 'Paid Amt',
      'eobCd': 'EOB Cd',
      'remCd': 'Rem Cd',
      'claimNum': 'Claim Num',
      'icn': 'ICN',
      'dos': 'DOS',
      'procCd': 'Proc Cd',
      'procDesc': 'Proc Desc',
      'from': 'From',
      'to': 'To',
      'billAmount': 'Bill Amount',
      'paidAmount': 'Paid Amount',
      'detail': 'Detail',
      'detailDescription': 'Detail Description',
      'srvcCode': 'Proc Cd',
      'srvcDesc': 'Proc Desc',
      'srvcFrom': 'From',
      'srvcTo': 'To',
      'srvcDetail': 'Detail',
      'srvcBilledAmt': 'Billed Amount',
      'srvcPaidAmt': 'Paid Amount',
      'svDescription': 'Detail Description'
    }

    const getColumnHeader = (key: string) => {
      // Force sameName to display as Name
      if (key.toLowerCase() === 'samename') {
        return 'Name'
      }
      return columnHeaderMap[key] || key.replace(/([A-Z])/g, ' $1').trim()
    }

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button
            onClick={() => downloadExcel(claims, title, `${title.replace(/\s/g, '_')}.xlsx`, columns)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((key) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {getColumnHeader(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {claims.map((claim, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columns.map((key, vIdx) => {
                    let value = claim[key]
                    // Handle array values (like svDescription)
                    if (Array.isArray(value)) {
                      value = value.join(', ')
                    }
                    return (
                      <td key={vIdx} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {value !== null && value !== undefined ? String(value) : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-12">
      {/* Remittance Information */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-200">
          REMITTANCE INFORMATION
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.remittance.filename && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Filename</p>
              <p className="text-base font-medium text-gray-900">{data.remittance.filename}</p>
            </div>
          )}
          {data.remittance.remittanceDate && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Remittance Date</p>
              <p className="text-base font-medium text-gray-900">{data.remittance.remittanceDate}</p>
            </div>
          )}
          {data.remittance.remittanceEftNumber && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Remittance EFT Number</p>
              <p className="text-base font-medium text-gray-900">{data.remittance.remittanceEftNumber}</p>
            </div>
          )}
          {data.remittance.remittanceEftDate && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Remittance EFT Date</p>
              <p className="text-base font-medium text-gray-900">{data.remittance.remittanceEftDate}</p>
            </div>
          )}
        </div>
      </div>

      {/* Claims Summary Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* MEDICAID Claims Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
            MEDICAID Claims Summary
          </h3>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current N</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">PAID</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicaidSummary?.paid?.count || data.medicaid.paid.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600 font-medium">
                  ${data.medicaidSummary?.paid?.amount || '0.00'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">DENIED</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicaidSummary?.denied?.count || data.medicaid.denied.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                  ${data.medicaidSummary?.denied?.amount || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* MEDICARE CROSSOVER Claims Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
            MEDICARE CROSSOVER Claims Summary
          </h3>
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current N</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">PAID</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicareSummary?.paid?.count || data.medicare.paid.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600 font-medium">
                  ${data.medicareSummary?.paid?.amount || '0.00'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">DENIED</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicareSummary?.denied?.count || data.medicare.denied.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-red-600 font-medium">
                  ${data.medicareSummary?.denied?.amount || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Remittance Advice Summary */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-200">
          PROVIDER REMITTANCE ADVICE SUMMARY
        </h2>

        {/* Claims Data */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">CLAIMS DATA</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">CLAIMS PAID</p>
              <p className="text-sm font-bold text-gray-900">{data.remittance.claimsCurrentNumber || data.totalNumber.payments}</p>
              <p className="text-lg font-bold text-green-600">${data.remittance.claimsCurrentAmount || data.netPayment.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">CLAIM ADJUSTMENTS</p>
              <p className="text-sm font-bold text-gray-900">{data.remittance.claimsAdjustmentsNumber || data.totalNumber.adjustment}</p>
              <p className="text-lg font-bold text-orange-600">${data.remittance.claimAdjustmentsAmount || '0.00'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">TOTAL CLAIMS</p>
              <p className="text-sm font-bold text-gray-900">{data.remittance.totalClaimsPaymentNumber || (data.totalNumber.payments + data.totalNumber.adjustment)}</p>
              <p className="text-lg font-bold text-blue-600">${data.remittance.totalClaimsPaymentAmount || '0.00'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">CLAIMS DENIED</p>
              <p className="text-sm font-bold text-gray-900">{data.remittance.totalClaimsDeniedNumber || data.totalNumber.denied}</p>
              <p className="text-lg font-bold text-red-600">${data.remittance.totalClaimsDeniedAmount || data.deniedAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Earning Data */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">EARNING DATA</h3>
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">PAYMENT CURRENT AMOUNT</span>
                  <span className="text-sm font-bold text-gray-900">${data.remittance.totalClaimsPaymentsAmount || data.netPayment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">CLAIM ADJUSTMENTS</span>
                  <span className="text-sm font-bold text-gray-900">${data.remittance.totalClaimsAdjPaymentsAmount || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">ADJUSTMENTS FROM CURRENT CYCLE</span>
                  <span className="text-sm font-bold text-gray-900">
                    {data.remittance.totalClaimAdjFromCurrentCyclePaymentAmount
                      ? `$${data.remittance.totalClaimAdjFromCurrentCyclePaymentAmount}`
                      : '$0.00'}
                  </span>
                </div>
                {data.remittance.totalClaimAdjFromPreviousCyclePaymentAmount && parseFloat(data.remittance.totalClaimAdjFromPreviousCyclePaymentAmount) !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">OUTSTANDING FROM PREVIOUS CYCLES</span>
                    <span className="text-sm font-bold text-gray-900">${data.remittance.totalClaimAdjFromPreviousCyclePaymentAmount}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center items-end">
                <p className="text-sm text-gray-600 mb-1">NET EARNINGS</p>
                <p className="text-4xl font-bold text-green-600">${data.remittance.netEarningsAmount || '0.00'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={downloadAllData}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download All Data
          </button>
        </div>
      </div>

      {renderTable(data.medicaid.paid, 'Medicaid Paid Claims')}
      {renderTable(data.medicaid.denied, 'Medicaid Denied Claims')}
      {renderTable(data.medicare.paid, 'Medicare Paid Claims')}
      {renderTable(data.medicare.denied, 'Medicare Denied Claims')}
      {data.adjustments && data.adjustments.length > 0 && renderTable(data.adjustments, 'Adjustment Summary')}

      {data.services.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Services Summary</h3>
            <button
              onClick={() => downloadExcel(data.services, 'Services', 'Services_Summary.xlsx')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicaid Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicaid Denied</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicare Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicare Denied</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.services.map((service, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{service.desc}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{service.medicaidPaid}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{service.medicaidDenied}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{service.medicarePaid}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{service.medicareDenied}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
