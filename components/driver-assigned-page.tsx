"use client"

import { ChevronLeft, Truck } from "lucide-react"
import type { FirestoreOrder } from "@/components/order-popup-panel"

function getDriverLabel(order: FirestoreOrder) {
  const status = order.status === "at_store" ? "at_store" : order.driverStatus
  if (status === "at_store") return "Driver has arrived at store"
  if (status === "assigned") return "Driver coming to store"
  if (status === "picked_up") return "Driver on the way to client"
  if (status === "delivered") return "Driver delivered to client"
  if (status === "completed") { const count = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0); return `Driver delivered ${count === 1 ? "item" : "items"} to client` }
  return null
}

function statusClass(order: FirestoreOrder) {
  if (order.status === "completed") return "bg-[#22c55e]/15 text-[#22c55e]"
  if (order.status === "delivered") return "bg-[#1a73e8]/15 text-[#1a73e8]"
  if (order.status === "picked_up") return "bg-[#a855f7]/15 text-[#a855f7]"
  if (order.status === "at_store") return "bg-[#f97316]/15 text-[#f97316]"
  return "bg-[#ef4444]/15 text-[#ef4444]"
}

export function DriverAssignedPage({ orders, onBack }: { orders: FirestoreOrder[]; onBack: () => void }) {
  const assignments = orders.filter(order => order.driverStatus && order.driverSnapshot).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return <div className="flex h-full flex-col bg-background"><header className="shrink-0 border-b border-border bg-card px-4 pb-4 pt-5"><div className="flex items-center gap-3"><button onClick={onBack} aria-label="Go back" className="text-card-foreground"><ChevronLeft className="size-6" /></button><h1 className="text-2xl font-bold text-card-foreground">Driver Assigned</h1></div></header><main className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide"><div className="flex flex-col gap-3">{assignments.length === 0 ? <div className="py-16 text-center text-muted-foreground">No driver assignments recorded yet.</div> : assignments.map(order => { const driver = order.driverSnapshot!; const label = getDriverLabel(order); const vehicle = [driver.color, driver.brand, driver.model].filter(Boolean).join(" ") || "Vehicle details unavailable"; return <article key={order.id} className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">{driver.profilePicture ? <img src={driver.profilePicture} alt={`${driver.firstName || "Driver"} profile`} className="size-full object-cover" /> : <Truck className="text-primary" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-card-foreground">{driver.firstName || "Driver assigned"}</h2><p className="text-sm text-muted-foreground">{vehicle}</p></div>{driver.plateNumber && <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-card-foreground">{driver.plateNumber}</span>}</div>{label && <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order)}`}>{label}</span>}<p className="mt-3 text-xs text-muted-foreground">Order #{order.orderId} · {order.destinationAddress}</p></div></div></article> })}</div></main></div>
}
