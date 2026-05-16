import { CashOutDailyReportPage } from './CashOutDailyReportPage'

export function ExpenseReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="Expense"
      title="Expense report"
      tableTitle="Expenses"
      pdfReportTitle="EXPENSE REPORT"
    />
  )
}

export function ExchangeReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="Exchange"
      title="Exchange report"
      tableTitle="Exchange"
      pdfReportTitle="EXCHANGE REPORT"
    />
  )
}

export function CashOrUsdTakenReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="cashOrUsdTaken"
      title="Cash or USD Taken report"
      tableTitle="Cash or USD Taken"
      pdfReportTitle="CASH OR USD TAKEN REPORT"
      operationOfficeOnly
    />
  )
}
