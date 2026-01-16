export interface ValidationIssue {
  messageId: string
}

const MAX_SAFE_AMOUNT = 1_000_000_000 // guardrail for obviously incorrect inputs

/**
 * Attempts to parse a human-entered number (handling commas, spaces, etc.).
 * Returns `null` when the value cannot be safely interpreted as a finite number.
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== "string") {
    return null
  }

  let normalized = value.trim()
  if (!normalized) {
    return null
  }

  normalized = normalized.replace(/\s+/g, "")

  const commaCount = (normalized.match(/,/g) ?? []).length
  const dotCount = (normalized.match(/\./g) ?? []).length

  if (commaCount > 0 && dotCount > 0) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".")
    } else {
      normalized = normalized.replace(/,/g, "")
    }
  } else if (commaCount > 0) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".")
  } else {
    normalized = normalized.replace(/,/g, "")
  }

  normalized = normalized.replace(/[^0-9.-]/g, "")
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateAmountPositive(value: unknown): ValidationIssue | null {
  const parsed = parseNumber(value)
  if (parsed === null) {
    return { messageId: "validation.required" }
  }
  if (parsed <= 0) {
    return { messageId: "validation.amount.nonPositive" }
  }
  if (Math.abs(parsed) > MAX_SAFE_AMOUNT) {
    return { messageId: "validation.amount.tooLarge" }
  }
  return null
}

export function validateAmountNonNegative(value: unknown): ValidationIssue | null {
  const parsed = parseNumber(value)
  if (parsed === null) {
    return { messageId: "validation.required" }
  }
  if (parsed < 0) {
    return { messageId: "validation.amount.nonNegative" }
  }
  if (Math.abs(parsed) > MAX_SAFE_AMOUNT) {
    return { messageId: "validation.amount.tooLarge" }
  }
  return null
}

export function validateInterestRate(value: number): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return { messageId: "validation.required" }
  }
  if (value < 0) {
    return { messageId: "validation.interestRate.negative" }
  }
  if (value > 100) {
    return { messageId: "validation.interestRate.max" }
  }
  return null
}

export function validateRemainingBalance(
  balance: number,
  principal: number
): ValidationIssue | null {
  if (!Number.isFinite(balance)) {
    return { messageId: "validation.required" }
  }
  if (balance < 0) {
    return { messageId: "validation.remainingBalance.negative" }
  }
  if (Number.isFinite(principal) && principal >= 0 && balance > principal) {
    return { messageId: "validation.remainingBalance.exceedsAmount" }
  }
  return null
}

export function validateMonthlyPayment(
  payment: number,
  principal: number
): ValidationIssue | null {
  if (!Number.isFinite(payment)) {
    return { messageId: "validation.required" }
  }
  if (payment < 0) {
    return { messageId: "validation.monthlyPayment.negative" }
  }
  if (Number.isFinite(principal) && principal > 0 && payment > principal) {
    return { messageId: "validation.monthlyPayment.exceedsAmount" }
  }
  return null
}

interface DateValidationOptions {
  allowFuture?: boolean
  maxFutureYears?: number
}

export function validateDateString(
  value: string,
  options: DateValidationOptions = {}
): ValidationIssue | null {
  const { allowFuture = false, maxFutureYears = 5 } = options

  if (!value?.trim()) {
    return { messageId: "validation.required" }
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!isoMatch) {
    return { messageId: "validation.required" }
  }

  const [, yearStr, monthStr, dayStr] = isoMatch
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return { messageId: "validation.required" }
  }

  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const earliest = new Date(2000, 0, 1)

  if (!allowFuture && date > today) {
    return { messageId: "validation.date.future" }
  }

  if (allowFuture) {
    const maxFuture = new Date()
    maxFuture.setFullYear(maxFuture.getFullYear() + maxFutureYears)
    if (date > maxFuture) {
      return { messageId: "validation.date.tooFarFuture" }
    }
  }

  if (date < earliest) {
    return { messageId: "validation.date.tooEarly" }
  }

  return null
}
