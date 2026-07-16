import { Download, FileText, Database, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ParsedClaimData } from '../types'
import { generateRAReportPDF } from '../lib/raReportPdf'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

interface ClaimResultsProps {
  data: ParsedClaimData
}

export default function ClaimResults({ data }: ClaimResultsProps) {
  const { user } = useAuth()
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationForm, setMigrationForm] = useState({
    paidOn: '',
    eftNumber: '',
    paidIssued: ''
  })
  const [migrationPreview, setMigrationPreview] = useState<Array<{
    claim: any
    matched: boolean
    patientCode: string | null
    reason?: string
    selected: boolean
  }>>([])
  const [showPreview, setShowPreview] = useState(false)
  // Parse MMDDYY date format to ISO (YYYY-MM-DD)
  const parseDateMMDDYY = (dateStr: string): string | null => {
    if (!dateStr || dateStr.length !== 6) {
      console.warn(`Invalid date format: ${dateStr}`)
      return null
    }

    const mm = dateStr.substring(0, 2)
    const dd = dateStr.substring(2, 4)
    const yy = dateStr.substring(4, 6)
    const yyyy = `20${yy}` // Two-digit year -> 20YY

    const isoDate = `${yyyy}-${mm}-${dd}`

    // Validate the date
    const date = new Date(isoDate)
    if (isNaN(date.getTime())) {
      console.warn(`Malformed date: ${dateStr} -> ${isoDate}`)
      return null
    }

    return isoDate
  }

  // Convert display date (MM/DD/YYYY) to ISO format (YYYY-MM-DD) for date inputs
  const convertToISODate = (dateStr: string): string => {
    if (!dateStr) return ''

    // Try parsing MM/DD/YYYY format
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [month, day, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    // If already in YYYY-MM-DD format, return as-is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr
    }

    return ''
  }

  // Generate migration preview
  const generatePreview = async () => {
    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    setIsMigrating(true)

    try {
      // Fetch all patients for this company to lookup patientCd
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('name, patientCd')
        .eq('companyId', user.companyId)

      if (patientsError) {
        console.error('Error fetching patients:', patientsError)
        toast.error('Failed to fetch patient data')
        setIsMigrating(false)
        return
      }

      // Create a lookup map (lowercase trimmed name -> patientCd)
      const patientLookup = new Map<string, string>()
      patientsData?.forEach(p => {
        if (p.name) {
          patientLookup.set(p.name.toLowerCase().trim(), p.patientCd)
        }
      })

      // Generate preview data
      const preview = data.medicaid.paid.map(claim => {
        // Parse dates
        const dos = claim.srvcFrom ? parseDateMMDDYY(claim.srvcFrom) : null
        const eos = claim.srvcTo ? parseDateMMDDYY(claim.srvcTo) : null

        if (!dos || !eos) {
          return {
            claim,
            matched: false,
            patientCode: null,
            reason: 'Invalid date format',
            selected: false
          }
        }

        // Lookup client_code (patientCd)
        const clientName = claim.samename?.toLowerCase().trim()
        const clientCode = clientName ? patientLookup.get(clientName) : null

        if (!clientCode) {
          return {
            claim,
            matched: false,
            patientCode: null,
            reason: `Patient not found: ${claim.samename}`,
            selected: false
          }
        }

        return {
          claim,
          matched: true,
          patientCode: clientCode,
          reason: undefined,
          selected: true // Auto-select matched records
        }
      })

      setMigrationPreview(preview)
      setShowPreview(true)
    } catch (error: any) {
      console.error('Preview generation error:', error)
      toast.error(`Failed to generate preview: ${error.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  // Migrate selected records to efts table
  const handleMigration = async () => {
    if (!user?.companyId) {
      toast.error('User company ID not found')
      return
    }

    if (!migrationForm.paidOn || !migrationForm.eftNumber || !migrationForm.paidIssued) {
      toast.error('Please fill in all required fields')
      return
    }

    const selectedItems = migrationPreview.filter(item => item.selected && item.matched)

    if (selectedItems.length === 0) {
      toast.error('No records selected for migration')
      return
    }

    setIsMigrating(true)

    try {
      const records = []
      const currentDate = new Date().toISOString()

      for (const item of selectedItems) {
        const claim = item.claim
        const dos = parseDateMMDDYY(claim.srvcFrom)
        const eos = parseDateMMDDYY(claim.srvcTo)

        // Parse amounts
        const billedAmt = parseFloat(String(claim.srvcBilledAmt || 0))
        const paidAmt = parseFloat(String(claim.srvcPaidAmt || 0))

        // Build the record
        const record = {
          client: claim.samename || null,
          service_cd: claim.srvcCode || null,
          service_desc: claim.srvcDesc || null,
          service_mod: claim.srvcModifierCd || null,
          dos: dos,
          eos: eos,
          billed_amt: billedAmt,
          paid_amt: paidAmt,
          status: 'PAID',
          provider: 'Medicaid',
          eft_number: migrationForm.eftNumber,
          paid_on: migrationForm.paidOn,
          paid_issued: migrationForm.paidIssued,
          companyId: user.companyId,
          createdUser: {
            name: user.name || user.email,
            userId: user.id,
            date: currentDate
          },
          updatedUser: {
            name: user.name || user.email,
            userId: user.id,
            date: currentDate
          },
          comments: claim.svDescription ? (Array.isArray(claim.svDescription) ? claim.svDescription.join(', ') : claim.svDescription) : null,
          client_code: item.patientCode
        }

        records.push(record)
      }

      // Bulk insert into efts table
      const { data: insertedData, error: insertError } = await supabase
        .from('efts')
        .insert(records)
        .select()

      if (insertError) {
        console.error('Error inserting records:', insertError)
        toast.error(`Failed to migrate: ${insertError.message}`)
        setIsMigrating(false)
        return
      }

      // Success!
      toast.success(`Successfully migrated ${insertedData?.length || records.length} records`)

      // Close modal and reset form
      setShowMigrationModal(false)
      setShowPreview(false)
      setMigrationPreview([])
      setMigrationForm({ paidOn: '', eftNumber: '', paidIssued: '' })
    } catch (error: any) {
      console.error('Migration error:', error)
      toast.error(`Migration failed: ${error.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

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
      'eobCd': 'Detail EOB',
      'remCd': 'Detail Description',
      'claimNum': 'Claim Num',
      'icn': 'ICN',
      'dos': 'DOS',
      'procCd': 'Proc Cd',
      'procDesc': 'Service Description',
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
      'srvcDetail': 'Detail EOB',
      'srvcBilledAmt': 'Billed Amt',
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

  // NEW: Professional styled PDF report matching Biller Report design
  const generatePDFReport = () => {
    const doc = generateRAReportPDF(data)
    doc.save('RA_Claim_Report.pdf')
  }

  // OLD: Original PDF generation (preserved for reference)
  const generatePDFReportOld = () => {
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
      const deniedCols = ['samename', 'srvcCode', 'srvcModifierCd', 'srvcDesc', 'srvcFrom', 'srvcTo', 'srvcBilledAmt', 'srvcDetail', 'svDescription']
      const deniedHeaders = ['#', 'Name', 'Proc Cd', 'Modifier', 'Service Description', 'From', 'To', 'Billed Amt', 'Detail EOB', 'Detail Description']

      const deniedRows = data.medicaid.denied.map((claim, index) => {
        const rowData = deniedCols.map(col => {
          let value = claim[col]

          // Handle array values (like svDescription)
          if (Array.isArray(value)) {
            value = value.join(', ')
          }

          return value !== null && value !== undefined ? String(value) : '-'
        })
        // Add row number at the beginning
        return [String(index + 1), ...rowData]
      })

      autoTable(doc, {
        startY: yPosition,
        head: [deniedHeaders],
        body: deniedRows,
        theme: 'striped',
        headStyles: { fillColor: [231, 76, 60], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' }
        }
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

    // Save the PDF (old version)
    doc.save('RA_Claim_Report_Old.pdf')
  }

  const renderTable = (claims: any[], title: string) => {
    if (claims.length === 0) return null

    // Get column keys and apply custom mappings
    const getColumns = (obj: any) => {
      // Define specific column order for Medicaid Paid Claims
      if (title.includes('Medicaid Paid')) {
        return ['samename', 'srvcCode', 'srvcModifierCd', 'srvcDesc', 'srvcFrom', 'srvcTo', 'srvcBilledAmt', 'srvcPaidAmt', 'srvcDetail', 'svDescription']
      }

      // Define specific column order for Medicaid Denied Claims
      if (title.includes('Medicaid Denied')) {
        return ['samename', 'srvcCode', 'srvcModifierCd', 'srvcDesc', 'srvcFrom', 'srvcTo', 'srvcBilledAmt', 'srvcDetail', 'svDescription']
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
      'eobCd': 'Detail EOB',
      'remCd': 'Detail Description',
      'claimNum': 'Claim Num',
      'icn': 'ICN',
      'dos': 'DOS',
      'procCd': 'Proc Cd',
      'procDesc': 'Service Description',
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
      'srvcDetail': 'Detail EOB',
      'srvcBilledAmt': 'Billed Amt',
      'srvcPaidAmt': 'Paid Amount',
      'svDescription': 'Detail Description'
    }

    const getColumnHeader = (key: string) => {
      // Force sameName to display as Name
      if (key.toLowerCase() === 'samename') {
        return 'Name'
      }

      // Special handling for Medicaid Denied Claims
      if (title.includes('Medicaid Denied')) {
        if (key === 'srvcDesc') return 'Service Description'
        if (key === 'srvcBilledAmt') return 'Billed Amt'
        if (key === 'srvcDetail') return 'Detail EOB'
      }

      // Special handling for Medicaid Paid Claims
      if (title.includes('Medicaid Paid')) {
        if (key === 'srvcBilledAmt') return 'Billed Amount'
        if (key === 'srvcPaidAmt') return 'Paid Amount'
      }

      return columnHeaderMap[key] || key.replace(/([A-Z])/g, ' $1').trim()
    }

    // Check if this table should have row numbers
    const hasRowNumbers = title.includes('Paid Claims') || title.includes('Medicaid Denied')

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadExcel(claims, title, `${title.replace(/\s/g, '_')}.xlsx`, columns)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {title === 'Medicaid Paid Claims' && (
              <button
                onClick={() => {
                  // Auto-populate form with remittance data, converting dates to ISO format
                  setMigrationForm({
                    paidOn: convertToISODate(data.remittance.remittanceDate || ''),
                    eftNumber: data.remittance.remittanceEftNumber || '',
                    paidIssued: convertToISODate(data.remittance.remittanceEftDate || '')
                  })
                  setShowMigrationModal(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Database className="w-4 h-4" />
                Migration
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {hasRowNumbers && (
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
                  {hasRowNumbers && (
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

      {/* Migration Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Migrate to Database</h3>
              <button
                onClick={() => {
                  setShowMigrationModal(false)
                  setShowPreview(false)
                  setMigrationPreview([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isMigrating}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paid On <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={migrationForm.paidOn}
                    onChange={(e) => setMigrationForm({ ...migrationForm, paidOn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isMigrating || showPreview}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EFT Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={migrationForm.eftNumber}
                    onChange={(e) => setMigrationForm({ ...migrationForm, eftNumber: e.target.value })}
                    placeholder="Enter EFT number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isMigrating || showPreview}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paid Issued <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={migrationForm.paidIssued}
                    onChange={(e) => setMigrationForm({ ...migrationForm, paidIssued: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isMigrating || showPreview}
                  />
                </div>
              </div>
            </div>

            {!showPreview && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-blue-700">
                  Total: {data.medicaid.paid.length} Medicaid paid claims. Click "Generate Preview" to see which records will be migrated.
                </p>
              </div>
            )}

            {showPreview && (
              <div className="mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-semibold text-gray-900">Migration Preview</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 font-medium">
                        Matched: {migrationPreview.filter(p => p.matched).length}
                      </span>
                      <span className="text-red-600 font-medium">
                        Not Matched: {migrationPreview.filter(p => !p.matched).length}
                      </span>
                      <span className="text-blue-600 font-medium">
                        Selected: {migrationPreview.filter(p => p.selected).length}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setMigrationPreview(prev => prev.map(p => ({ ...p, selected: p.matched })))}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Select All Matched
                    </button>
                    <button
                      onClick={() => setMigrationPreview(prev => prev.map(p => ({ ...p, selected: false })))}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Select
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Service
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          From
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          To
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Paid Amt
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Patient Code
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {migrationPreview.map((item, idx) => (
                        <tr key={idx} className={item.matched ? 'bg-green-50' : 'bg-red-50'}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              disabled={!item.matched}
                              onChange={(e) => {
                                const updated = [...migrationPreview]
                                updated[idx].selected = e.target.checked
                                setMigrationPreview(updated)
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {item.matched ? (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                Matched
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {item.claim.samename}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {item.claim.srvcCode}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {item.claim.srvcFrom}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {item.claim.srvcTo}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            ${item.claim.srvcPaidAmt}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {item.patientCode || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-red-600 whitespace-nowrap">
                            {item.reason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMigrationModal(false)
                  setShowPreview(false)
                  setMigrationPreview([])
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isMigrating}
              >
                Cancel
              </button>
              {!showPreview ? (
                <button
                  onClick={generatePreview}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={isMigrating || !migrationForm.paidOn || !migrationForm.eftNumber || !migrationForm.paidIssued}
                >
                  {isMigrating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Preview'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleMigration}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={isMigrating || migrationPreview.filter(p => p.selected).length === 0}
                >
                  {isMigrating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Migrate {migrationPreview.filter(p => p.selected).length} Records
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
