import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDecimal } from './formatNumber'

export type CashSalesPdfFuelScope = 'all' | 'petrol' | 'diesel'
export type CashSalesPdfPeriod = 'daily' | 'weekly' | 'monthly'

export type CashSalesReportRowPdf = {
  periodLabel: string
  name: 'Petrol' | 'Diesel'
  sspFuelPrice: number
  usdFuelPrice: number
  sspLiters: number
  usdLiters: number
  sspAmount: number
  usdAmount: number
  rateLabel: string
  sspToUsd: number
  finalUsd: number
}

export type CashSalesGrandPdf = {
  sspLiters: number
  usdLiters: number
  sspAmount: number
  usdAmount: number
  sspToUsd: number
  finalUsd: number
}

export function openCashSalesReportPdf(opts: {
  reportTitle: string
  businessName: string
  stationName?: string
  period: CashSalesPdfPeriod
  fuelScope: CashSalesPdfFuelScope
  from: string
  to: string
  rows: CashSalesReportRowPdf[]
}) {
  const {
    reportTitle,
    businessName,
    stationName,
    period,
    fuelScope,
    from,
    to,
    rows,
  } = opts

  const orientation = 'portrait'
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 48
  const headerH = 150
  let y = headerH + 54

  const now = new Date()
  const today = now.toLocaleDateString('en-CA')

  doc.setFillColor(21, 128, 122)
  doc.rect(0, 0, pageW, headerH, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text((businessName || 'Gas Station').toUpperCase(), pageW / 2, 52, { align: 'center' })

  doc.setFontSize(14)
  doc.text(reportTitle.toUpperCase(), pageW / 2, 80, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  const periodLabel =
    period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'
  doc.text(periodLabel, pageW / 2, 106, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`${from} ! ${to}`, pageW / 2, 130, { align: 'center' })

  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  // doc.text('Station Name', margin, y - 16)
  // doc.text('current date', pageW - margin, y - 16, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text(stationName?.trim() || 'All stations', margin, y)
  doc.text(today, pageW - margin, y, { align: 'right' })
  y += 14

  const fmtUsd = (n: number) => `$${formatDecimal(n)}`
  const showRow = (r: CashSalesReportRowPdf) =>
    fuelScope === 'all' || (fuelScope === 'petrol' ? r.name === 'Petrol' : r.name === 'Diesel')

  const filtered = rows.filter(showRow)
  const rateLabels = Array.from(new Set(filtered.map((r) => (r.rateLabel || '').trim()).values())).filter(
    (x) => x.length > 0 && x !== '—',
  )
  const summaryRateLabel =
    rateLabels.length === 0 ? '—' : rateLabels.length === 1 ? rateLabels[0] : 'Mixed rates'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.text(`Rate: ${summaryRateLabel}`, margin, y - 30)

  const subtotal = filtered.reduce(
    (acc, r) => {
      acc.sspLiters += r.sspLiters
      acc.usdLiters += r.usdLiters
      acc.sspAmount += r.sspAmount
      acc.usdAmount += r.usdAmount
      acc.sspToUsd += r.sspToUsd
      acc.finalUsd += r.finalUsd
      return acc
    },
    { sspLiters: 0, usdLiters: 0, sspAmount: 0, usdAmount: 0, sspToUsd: 0, finalUsd: 0 },
  )

  const body: (string | number)[][] = filtered.map((r) => [
    r.name,
    formatDecimal(r.sspFuelPrice),
    formatDecimal(r.usdFuelPrice),
    formatDecimal(r.sspLiters),
    formatDecimal(r.usdLiters),
    formatDecimal(r.sspAmount),
    fmtUsd(r.usdAmount),
    fmtUsd(r.sspToUsd),
    fmtUsd(r.finalUsd),
  ])

  const head = [['Name', 'SSP Price', 'USD Price', 'SSP L', 'USD L', 'Total SSP', 'Total USD', 'SspToUsd', 'Final USD']]
  const foot: (string | number)[][] = [[
    'Subtotal',
    '',
    '',
    formatDecimal(subtotal.sspLiters),
    formatDecimal(subtotal.usdLiters),
    formatDecimal(subtotal.sspAmount),
    fmtUsd(subtotal.usdAmount),
    fmtUsd(subtotal.sspToUsd),
    fmtUsd(subtotal.finalUsd),
  ]]

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    styles: { fontSize: 10, cellPadding: 5, textColor: [31, 41, 55] },
    headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55], fontStyle: 'bold' },
    footStyles: {
      fillColor: [21, 128, 122],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 60 },
    didDrawPage: (data) => {
      const pW = doc.internal.pageSize.getWidth()
      const pH = doc.internal.pageSize.getHeight()
      const lineY = pH - 34
      doc.setDrawColor(21, 128, 122)
      doc.setLineWidth(1)
      doc.line(margin, lineY, pW - margin, lineY)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('Powered by abaalsoftware', margin, lineY + 15)
      doc.text(`Page | ${data.pageNumber}`, pW - margin, lineY + 15, { align: 'right' })
    },
  })

  const pdfBlobUrl = doc.output('bloburl')
  window.open(pdfBlobUrl, '_blank', 'noopener,noreferrer')
}
