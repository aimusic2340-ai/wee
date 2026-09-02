export const ALL_ORDER_STATUSES = [
  "pending",
  "accepted",
  "ready_for_pickup",
  "driver_assigned",
  "rejected",
  "completed",
  "delivered",
  "picked_up",
  "at_store",
] as const

export type OrderStatus = (typeof ALL_ORDER_STATUSES)[number]

export const COMPLETED_ORDER_STATUSES: readonly OrderStatus[] = [
  "driver_assigned",
  "at_store",
  "picked_up",
  "delivered",
  "completed",
  "ready_for_pickup",
]

export const REVENUE_ORDER_STATUSES: readonly OrderStatus[] = [
  "accepted",
  ...COMPLETED_ORDER_STATUSES,
]

export function isOrderCompleted(status: string): boolean {
  return COMPLETED_ORDER_STATUSES.includes(status as OrderStatus)
}

export function isRevenueOrder(status: string): boolean {
  return REVENUE_ORDER_STATUSES.includes(status as OrderStatus)
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

export function isWithinPastDays(date: Date, days: number): boolean {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days)
  return date >= start && !isToday(date)
}
