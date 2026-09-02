"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ALL_ORDER_STATUSES, isOrderCompleted, isRevenueOrder, isToday, isWithinPastDays } from "@/lib/order-status"
import type { FirestoreOrder } from "@/components/order-popup-panel"

interface UseRealtimeOrdersReturn {
  pendingOrders: FirestoreOrder[]
  acceptedOrders: FirestoreOrder[]
  completedOrders: FirestoreOrder[]
  allOrders: FirestoreOrder[]
  todayOrders: FirestoreOrder[]
  pastOrders: FirestoreOrder[]
  weeklyRevenueOrders: FirestoreOrder[]
  isLoading: boolean
  error: string | null
  pendingOrderForPopup: FirestoreOrder | null
  dismissPopup: () => void
  handleStatusUpdate: (orderId: string, newStatus: string) => void
}

export function useRealtimeOrders(storeId: string | null): UseRealtimeOrdersReturn {
  const [pendingOrders, setPendingOrders] = useState<FirestoreOrder[]>([])
  const [acceptedOrders, setAcceptedOrders] = useState<FirestoreOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<FirestoreOrder[]>([])
  const [allOrders, setAllOrders] = useState<FirestoreOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingOrderForPopup, setPendingOrderForPopup] = useState<FirestoreOrder | null>(null)
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set())
  const previousOrdersRef = useRef<Map<string, FirestoreOrder>>(new Map())
  const initializedRef = useRef(false)

  const playSound = useCallback((path: string) => {
    if (typeof window === "undefined") return
    const audio = new Audio(path)
    void audio.play().catch(() => {})
  }, [])

  const convertTimestamp = (timestamp: unknown): Date => {
    if (timestamp instanceof Timestamp) return timestamp.toDate()
    if (timestamp instanceof Date) return timestamp
    return new Date()
  }

  const getTodayOrders = useCallback((orders: FirestoreOrder[]) => orders.filter(order => isToday(order.createdAt)), [])
  const getPastOrders = useCallback((orders: FirestoreOrder[]) => orders.filter(order => isOrderCompleted(order.status) && isWithinPastDays(order.createdAt, 90)), [])

  const dismissPopup = useCallback(() => {
    if (pendingOrderForPopup) setDismissedOrderIds(prev => new Set([...prev, pendingOrderForPopup.id]))
    setPendingOrderForPopup(null)
  }, [pendingOrderForPopup])

  const handleStatusUpdate = useCallback((orderId: string, newStatus: string) => {
    if (newStatus === "accepted") {
      const order = pendingOrders.find(o => o.id === orderId)
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      if (order) { const updated = { ...order, status: "accepted" as const }; setAcceptedOrders(prev => [...prev, updated]); setPendingOrderForPopup(updated) }
      setDismissedOrderIds(prev => new Set([...prev, orderId]))
    } else if (newStatus === "rejected" || newStatus === "ready_for_pickup") {
      setPendingOrders(prev => prev.filter(o => o.id !== orderId)); setAcceptedOrders(prev => prev.filter(o => o.id !== orderId)); setDismissedOrderIds(prev => new Set([...prev, orderId])); setPendingOrderForPopup(null)
    }
  }, [pendingOrders])

  useEffect(() => {
    if (!storeId) { setIsLoading(false); return }
    setIsLoading(true); setError(null)
    const ordersQuery = query(collection(db, "orders"), where("storeId", "==", storeId), where("status", "in", [...ALL_ORDER_STATUSES]), orderBy("createdAt", "desc"))
    return onSnapshot(ordersQuery, snapshot => {
      const orders = snapshot.docs.map(docSnap => { const data = docSnap.data(); return { id: docSnap.id, orderId: data.orderId || docSnap.id.slice(-5).toUpperCase(), userName: data.userName || "Customer", destinationAddress: data.destinationAddress || "", items: data.items || [], subtotal: data.subtotal || 0, deliveryFee: data.deliveryFee || 0, total: data.total || 0, status: data.status, storeId: data.storeId, createdAt: convertTimestamp(data.createdAt), driverStatus: data.driverStatus, driverSnapshot: data.driverSnapshot, driver: data.driver } as FirestoreOrder })
      const previous = previousOrdersRef.current
      if (initializedRef.current) {
        if (orders.some(order => order.status === "pending" && !previous.has(order.id))) playSound("/sounds/order.mp3")
        if (orders.some(order => order.driverStatus === "at_store" && previous.get(order.id)?.driverStatus !== "at_store")) playSound("/sounds/driver.mp3")
      }
      previousOrdersRef.current = new Map(orders.map(order => [order.id, order]))
      initializedRef.current = true
      setPendingOrders(orders.filter(o => o.status === "pending")); setAcceptedOrders(orders.filter(o => o.status === "accepted")); setCompletedOrders(orders.filter(o => isOrderCompleted(o.status))); setAllOrders(orders); setIsLoading(false)
    }, err => { console.error("Error listening to orders:", err); setError(err.message); setIsLoading(false) })
  }, [storeId, playSound])

  useEffect(() => { const next = pendingOrders.find(o => !dismissedOrderIds.has(o.id)); if (next && !pendingOrderForPopup) setPendingOrderForPopup(next) }, [pendingOrders, dismissedOrderIds, pendingOrderForPopup])

  const todayOrders = getTodayOrders(allOrders)
  const pastOrders = getPastOrders(allOrders)
  const weeklyRevenueOrders = allOrders.filter(o => { const date = new Date(o.createdAt); const week = new Date(); week.setDate(week.getDate() - 7); return date >= week && isRevenueOrder(o.status) })
  return { pendingOrders, acceptedOrders, completedOrders, allOrders, todayOrders, pastOrders, weeklyRevenueOrders, isLoading, error, pendingOrderForPopup, dismissPopup, handleStatusUpdate }
}
