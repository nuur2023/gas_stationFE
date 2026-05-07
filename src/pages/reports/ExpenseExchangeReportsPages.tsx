import { CashOutDailyReportPage } from './CashOutDailyReportPage'

export function ExpenseReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="Expense"
      title="Expense report"
      tableTitle="Expenses"
    />
  )
}

export function ExchangeReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="Exchange"
      title="Exchange report"
      tableTitle="Exchange"
    />
  )
}

export function CashOrUsdTakenReportPage() {
  return (
    <CashOutDailyReportPage
      expenseType="cashOrUsdTaken"
      title="Cash or USD Taken report"
      tableTitle="Cash or USD Taken"
    />
  )
}
