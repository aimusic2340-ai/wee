"use client"

import { useMemo } from "react"
import { ChevronLeft, ShoppingBag, CreditCard, Truck, Megaphone } from "lucide-react"
import type { FirestoreOrder } from "@/components/order-popup-panel"

type Type = "new_order" | "payment_captured" | "driver_assigned" | "system_message"
type Latest = FirestoreOrder | null
interface Props {
  latestPending: Latest
  latestPayment: Latest
  latestDriver: Latest
  unreadCategories: Record<"new_order" | "payment_captured" | "driver_assigned", boolean>
  onCategoryViewed: (category: "new_order" | "payment_captured" | "driver_assigned") => void
  onMarkAllRead: () => void
  onNavigate: (page: string) => void
}
const styles = { new_order: [ShoppingBag, "bg-[#22c55e]/15", "text-[#22c55e]"], payment_captured: [CreditCard, "bg-[#1a73e8]/15", "text-[#1a73e8]"], driver_assigned: [Truck, "bg-[#14b8a6]/15", "text-[#14b8a6]"], system_message: [Megaphone, "bg-[#a855f7]/15", "text-[#a855f7]"] } as const

export function NotificationsPage({ latestPending, latestPayment, latestDriver, unreadCategories, onCategoryViewed, onMarkAllRead, onNavigate }: Props) {
  const notifications = useMemo(() => [
    { id: "new_order", type: "new_order" as const, title: "New Order Received!", description: latestPending ? `Order #${latestPending.orderId} for ${latestPending.userName} (Subtotal: ZMW ${latestPending.subtotal.toFixed(2)}) is pending fulfillment.` : "No pending orders at the moment. Tap to view pending orders.", timestamp: latestPending?.createdAt || new Date() },
    { id: "payment_captured", type: "payment_captured" as const, title: "Payment Captured", description: latestPayment ? `Payment for Order #${latestPayment.orderId} (${latestPayment.userName}) of ZMW ${latestPayment.subtotal.toFixed(2)} was processed.` : "Payments will appear here after an order is accepted.", timestamp: latestPayment?.createdAt || new Date() },
    { id: "driver_assigned", type: "driver_assigned" as const, title: "Driver Assigned", description: latestDriver?.driverSnapshot ? `${latestDriver.driverSnapshot.firstName || "Driver"}${latestDriver.driverSnapshot.plateNumber ? ` (${latestDriver.driverSnapshot.plateNumber})` : ""} is delivering for ${latestDriver.userName} at ${latestDriver.destinationAddress}.` : "Driver info will appear here once a driver is assigned", timestamp: latestDriver?.createdAt || new Date() },
    { id: "system_message", type: "system_message" as const, title: "System Message", description: "App Update: Version 3.4.1 is available now. Bug fixes & improvements.", timestamp: new Date(Date.now() - 52 * 60 * 1000) },
  ], [latestPending, latestPayment, latestDriver])
  const since = (d: Date) => { const m = Math.floor((Date.now() - d.getTime()) / 60000); return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} hour${Math.floor(m / 60) === 1 ? "" : "s"} ago` }
  const unread = Object.values(unreadCategories).some(Boolean)
  const tap = (id: string) => { if (id === "new_order") onNavigate("pendingOrders"); else if (id === "driver_assigned") onNavigate("driverAssigned"); else if (id === "payment_captured") onNavigate("payments"); onCategoryViewed(id as "new_order" | "payment_captured" | "driver_assigned") }
  return <div className="flex h-full flex-col bg-background"><header className="shrink-0 border-b border-border bg-card px-4 pb-4 pt-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><button className="text-card-foreground" aria-label="Go back"><ChevronLeft className="size-6" /></button><h1 className="text-2xl font-bold text-card-foreground">Notifications</h1></div>{unread && <button onClick={onMarkAllRead} className="text-sm text-muted-foreground">Mark all as read</button>}</div></header><main className="flex-1 overflow-y-auto px-4 pb-20 scrollbar-hide"><div className="flex flex-col gap-3 pt-2">{notifications.map(n => { const [Icon, bg, color] = styles[n.type]; const isUnread = n.type !== "system_message" && unreadCategories[n.type]; return <button key={n.id} onClick={() => tap(n.id)} className="relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm">{isUnread && <span className="absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#f97316]" />}<div className={`${bg} ml-3 flex size-12 shrink-0 items-center justify-center rounded-xl`}><Icon className={`size-6 ${color}`} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-card-foreground">{n.title}</h2><span className="text-xs text-muted-foreground/70">{since(n.timestamp)}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.description}</p></div></button>})}</div></main></div>
}
