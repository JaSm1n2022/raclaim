import { Download, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

  const generatePDFReport = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPosition = 40

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('REMITTANCE ADVICE REPORT', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 30

    // Remittance Information Section
    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('REMITTANCE INFORMATION', 40, yPosition)
    yPosition += 20

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    if (data.remittance.filename) {
      doc.text(`Filename: ${data.remittance.filename}`, 40, yPosition)
      yPosition += 15
    }
    if (data.remittance.remittanceDate) {
      doc.text(`Remittance Date: ${data.remittance.remittanceDate}`, 40, yPosition)
      yPosition += 15
    }
    if (data.remittance.remittanceEftNumber) {
      doc.text(`EFT Number: ${data.remittance.remittanceEftNumber}`, 40, yPosition)
      yPosition += 15
    }
    if (data.remittance.remittanceEftDate) {
      doc.text(`EFT Date: ${data.remittance.remittanceEftDate}`, 40, yPosition)
      yPosition += 15
    }
    yPosition += 10

    // Summary Section
    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('PROVIDER REMITTANCE ADVICE SUMMARY', 40, yPosition)
    yPosition += 20

    // Summary Tables - Claims Data
    const totalPaidCount = data.medicaid.paid.length + data.medicare.paid.length
    const summaryClaimsData = [
      ['CLAIMS PAID', totalPaidCount, `$${data.remittance.claimsCurrentAmount || data.netPayment.toFixed(2)}`],
      ['CLAIM ADJUSTMENTS', data.remittance.claimsAdjustmentsNumber || data.totalNumber.adjustment, `$${data.remittance.claimAdjustmentsAmount || '0.00'}`],
      ['CLAIMS DENIED', data.remittance.totalClaimsDeniedNumber || data.totalNumber.denied, `$${data.remittance.totalClaimsDeniedAmount || data.deniedAmount.toFixed(2)}`]
    ]

    autoTable(doc, {
      startY: yPosition,
      head: [['Status', 'Count', 'Amount']],
      body: summaryClaimsData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 8 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' }
      }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 20

    // Medicaid and Medicare Summary Side by Side
    const medicaidSummary = [
      ['PAID', data.medicaid.paid.length, `$${data.medicaidSummary?.paid?.amount || '0.00'}`],
      ['DENIED', data.medicaid.denied.length, `$${data.medicaidSummary?.denied?.amount || '0.00'}`]
    ]

    const medicareSummary = [
      ['PAID', data.medicare.paid.length, `$${data.medicareSummary?.paid?.amount || '0.00'}`],
      ['DENIED', data.medicare.denied.length, `$${data.medicareSummary?.denied?.amount || '0.00'}`]
    ]

    // Medicaid Summary
    autoTable(doc, {
      startY: yPosition,
      head: [['MEDICAID Claims Summary', '', '']],
      body: medicaidSummary,
      theme: 'grid',
      margin: { left: 40, right: pageWidth / 2 + 20 },
      headStyles: { fillColor: [52, 152, 219], fontStyle: 'bold', fontSize: 10, halign: 'center' },
      styles: { fontSize: 9, cellPadding: 6 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' }
      }
    })

    // Medicare Summary
    autoTable(doc, {
      startY: yPosition,
      head: [['MEDICARE Claims Summary', '', '']],
      body: medicareSummary,
      theme: 'grid',
      margin: { left: pageWidth / 2 + 20, right: 40 },
      headStyles: { fillColor: [52, 152, 219], fontStyle: 'bold', fontSize: 10, halign: 'center' },
      styles: { fontSize: 9, cellPadding: 6 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' }
      }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 20

    // Earning Data
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      yPosition = 40
    }

    doc.setFontSize(12)
    doc.setTextColor(41, 128, 185)
    doc.text('EARNING DATA', 40, yPosition)
    yPosition += 15

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text(`Payment Current Amount: $${data.remittance.totalClaimsPaymentsAmount || data.netPayment.toFixed(2)}`, 40, yPosition)
    yPosition += 15
    doc.text(`Claim Adjustments: $${data.remittance.totalClaimsAdjPaymentsAmount || '0.00'}`, 40, yPosition)
    yPosition += 15
    doc.text(`Adjustments from Current Cycle: $${data.remittance.totalClaimAdjFromCurrentCyclePaymentAmount || '0.00'}`, 40, yPosition)
    yPosition += 15

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 139, 34)
    doc.text(`NET EARNINGS: $${data.remittance.netEarningsAmount || '0.00'}`, 40, yPosition)
    yPosition += 30

    // Add new page for detailed claims
    doc.addPage()
    yPosition = 40

    // Medicaid Paid Claims
    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('MEDICAID PAID CLAIMS', 40, yPosition)
    yPosition += 15

    if (data.medicaid.paid.length > 0) {
      const columns = ['samename', 'srvcCode', 'srvcModifierCd', 'srvcFrom', 'srvcTo', 'srvcBilledAmt', 'srvcPaidAmt', 'svDescription']
      const headers = ['#', 'Name', 'Proc Cd', 'Modifier', 'From', 'To', 'Billed Amt', 'Paid Amt', 'Detail Description']
      const rows = data.medicaid.paid.map((claim, index) => {
        const rowData = columns.map(col => {
          let value = claim[col]
          if (value === null || value === undefined) return '-'

          // Handle array values (like svDescription)
          if (Array.isArray(value)) {
            value = value.join(', ')
          }

          const strValue = String(value)

          // Truncate Detail Description to 45 characters
          if (col === 'svDescription' && strValue.length > 45) {
            return strValue.substring(0, 45) + '...'
          }

          return strValue
        })
        // Add row number at the beginning
        return [String(index + 1), ...rowData]
      })

      autoTable(doc, {
        startY: yPosition,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10

      // Calculate and display total for Paid Amt column using all data
      const totalPaidAmt = data.medicaid.paid.reduce((sum, claim) => {
        const paidAmt = parseFloat(claim.srvcPaidAmt) || 0
        return sum + paidAmt
      }, 0)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`Total Paid Amount: $${totalPaidAmt.toFixed(2)}`, pageWidth - 40, yPosition, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      yPosition += 20
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'italic')
      doc.text('No Record', 40, yPosition)
      doc.setFont('helvetica', 'normal')
      yPosition += 30
    }

    // Medicaid Denied Claims
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      yPosition = 40
    }

    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('MEDICAID DENIED CLAIMS', 40, yPosition)
    yPosition += 15

    if (data.medicaid.denied.length > 0) {
      const deniedCols = Object.keys(data.medicaid.denied[0]).slice(0, 8)
      const deniedHeaders = deniedCols.map(col => {
        const headerMap: { [key: string]: string } = {
          'samename': 'Name', 'service': 'Proc Cd', 'modifierCd': 'Modifier',
          'srvDateFrom': 'From', 'srvDateTo': 'To', 'billedAmt': 'Billed Amt',
          'remCd': 'Rem Cd', 'claimNum': 'Claim Num'
        }
        return headerMap[col] || col
      })

      const deniedRows = data.medicaid.denied.map(claim =>
        deniedCols.map(col => {
          const value = claim[col]
          return value !== null && value !== undefined ? String(value) : '-'
        })
      )

      autoTable(doc, {
        startY: yPosition,
        head: [deniedHeaders],
        body: deniedRows,
        theme: 'striped',
        headStyles: { fillColor: [231, 76, 60], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'italic')
      doc.text('No Record', 40, yPosition)
      doc.setFont('helvetica', 'normal')
      yPosition += 30
    }

    // Medicare Paid Claims
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      yPosition = 40
    }

    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('MEDICARE PAID CLAIMS', 40, yPosition)
    yPosition += 15

    if (data.medicare.paid.length > 0) {
      const medicareCols = ['samename', 'icn', 'dos', 'procCd', 'from', 'to', 'billAmount', 'paidAmount', 'detailDescription']
      const medicareHeaders = ['#', 'Name', 'ICN', 'DOS', 'Proc Cd', 'From', 'To', 'Bill Amount', 'Paid Amount', 'Detail Description']

      const medicareRows = data.medicare.paid.map((claim, index) => {
        const rowData = medicareCols.map(col => {
          let value = claim[col]
          if (value === null || value === undefined) return '-'

          // Handle array values
          if (Array.isArray(value)) {
            value = value.join(', ')
          }

          const strValue = String(value)

          // Truncate Detail Description to 45 characters
          if (col === 'detailDescription' && strValue.length > 45) {
            return strValue.substring(0, 45) + '...'
          }

          return strValue
        })
        // Add row number at the beginning
        return [String(index + 1), ...rowData]
      })

      autoTable(doc, {
        startY: yPosition,
        head: [medicareHeaders],
        body: medicareRows,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          7: { halign: 'right' },
          8: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10

      // Calculate and display total for Paid Amount column using all data
      const totalPaidAmount = data.medicare.paid.reduce((sum, claim) => {
        const paidAmt = parseFloat(claim.paidAmount) || 0
        return sum + paidAmt
      }, 0)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`Total Paid Amount: $${totalPaidAmount.toFixed(2)}`, pageWidth - 40, yPosition, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      yPosition += 20
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'italic')
      doc.text('No Record', 40, yPosition)
      doc.setFont('helvetica', 'normal')
      yPosition += 30
    }

    // Medicare Denied Claims
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      yPosition = 40
    }

    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('MEDICARE DENIED CLAIMS', 40, yPosition)
    yPosition += 15

    if (data.medicare.denied.length > 0) {
      const medicareDeniedCols = Object.keys(data.medicare.denied[0]).slice(0, 8)
      const medicareDeniedHeaders = medicareDeniedCols.map(col => {
        const headerMap: { [key: string]: string } = {
          'samename': 'Name', 'icn': 'ICN', 'dos': 'DOS',
          'procCd': 'Proc Cd', 'from': 'From', 'to': 'To',
          'billAmount': 'Bill Amount', 'detail': 'Detail'
        }
        return headerMap[col] || col
      })

      const medicareDeniedRows = data.medicare.denied.map(claim =>
        medicareDeniedCols.map(col => {
          const value = claim[col]
          return value !== null && value !== undefined ? String(value) : '-'
        })
      )

      autoTable(doc, {
        startY: yPosition,
        head: [medicareDeniedHeaders],
        body: medicareDeniedRows,
        theme: 'striped',
        headStyles: { fillColor: [231, 76, 60], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'italic')
      doc.text('No Record', 40, yPosition)
      doc.setFont('helvetica', 'normal')
      yPosition += 30
    }

    // Adjustment Summary
    if (yPosition > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      yPosition = 40
    }

    doc.setFontSize(14)
    doc.setTextColor(41, 128, 185)
    doc.text('ADJUSTMENT SUMMARY', 40, yPosition)
    yPosition += 15

    if (data.adjustments && data.adjustments.length > 0) {
      const adjustmentCols = Object.keys(data.adjustments[0]).filter(key => key !== 'memberName' && key !== 'name')
      const adjustmentHeaders = adjustmentCols.map(col => {
        const headerMap: { [key: string]: string } = {
          'samename': 'Name', 'service': 'Proc Cd', 'modifierCd': 'Modifier',
          'srvDateFrom': 'From', 'srvDateTo': 'To', 'billedAmt': 'Billed Amt',
          'allowedAmt': 'Allowed Amt', 'deductible': 'Deductible',
          'coinsurance': 'Coinsurance', 'paidAmt': 'Paid Amt',
          'eobCd': 'EOB Cd', 'remCd': 'Rem Cd', 'claimNum': 'Claim Num'
        }
        return headerMap[col] || col.replace(/([A-Z])/g, ' $1').trim()
      })

      const adjustmentRows = data.adjustments.map(claim =>
        adjustmentCols.map(col => {
          const value = claim[col]
          return value !== null && value !== undefined ? String(value) : '-'
        })
      )

      autoTable(doc, {
        startY: yPosition,
        head: [adjustmentHeaders],
        body: adjustmentRows,
        theme: 'striped',
        headStyles: { fillColor: [243, 156, 18], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.setFont('helvetica', 'italic')
      doc.text('No Record', 40, yPosition)
      doc.setFont('helvetica', 'normal')
      yPosition += 30
    }

    // Services Summary
    if (data.services.length > 0) {
      doc.addPage()
      yPosition = 40

      doc.setFontSize(14)
      doc.setTextColor(41, 128, 185)
      doc.text('SERVICES SUMMARY', 40, yPosition)
      yPosition += 15

      const servicesRows = data.services.map(service => [
        service.name,
        service.desc,
        String(service.medicaidPaid),
        String(service.medicaidDenied),
        String(service.medicarePaid),
        String(service.medicareDenied),
        String(service.total)
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Service Code', 'Description', 'Med Paid', 'Med Denied', 'Mcare Paid', 'Mcare Denied', 'Total']],
        body: servicesRows,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 },
        columnStyles: {
          6: { fontStyle: 'bold' }
        }
      })
    }

    // Footer on each page
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' }
      )
    }

    // Save the PDF
    doc.save('RA_Claim_Report.pdf')
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

    // Check if this is a paid claims table
    const isPaidTable = title.includes('Paid Claims')

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
                {isPaidTable && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                )}
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
                  {isPaidTable && (
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {idx + 1}
                    </td>
                  )}
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
        {data.remittance.filename && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-1">Filename</p>
            <p className="text-base font-medium text-gray-900">{data.remittance.filename}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Count</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">PAID</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicaid.paid.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600 font-medium">
                  ${data.medicaidSummary?.paid?.amount || '0.00'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">DENIED</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicaid.denied.length}
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
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Count</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Current Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">PAID</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicare.paid.length}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-600 font-medium">
                  ${data.medicareSummary?.paid?.amount || '0.00'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">DENIED</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {data.medicare.denied.length}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">CLAIMS PAID</p>
              <p className="text-sm font-bold text-gray-900">{data.medicaid.paid.length + data.medicare.paid.length}</p>
              <p className="text-lg font-bold text-green-600">${data.remittance.claimsCurrentAmount || data.netPayment.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">CLAIM ADJUSTMENTS</p>
              <p className="text-sm font-bold text-gray-900">{data.remittance.claimsAdjustmentsNumber || data.totalNumber.adjustment}</p>
              <p className="text-lg font-bold text-orange-600">${data.remittance.claimAdjustmentsAmount || '0.00'}</p>
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

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={generatePDFReport}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Print Report
          </button>
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
