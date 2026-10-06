"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ALL_ORDER_STATUSES, isOrderCompleted, isRevenueOrder, isToday, isWithinPastDays } from "@/lib/order-status"
import type { FirestoreOrder } from "@/components/order-popup-panel"

interface UseRealtimeOrdersReturn {
  pendingOrders: FirestoreOrder[]
  acceptedOrders: FirestoreOrder[]
  completedOrders: FirestoreOrder[]
  allOrders: FirestoreOrder[]
  activeOrders: FirestoreOrder[]
  todayOrders: FirestoreOrder[]
  pastOrders: FirestoreOrder[]
  weeklyRevenueOrders: FirestoreOrder[]
  isLoading: boolean
  error: string | null
  handleStatusUpdate: (orderId: string, newStatus: string) => void
}

export function useRealtimeOrders(storeId: string | null): UseRealtimeOrdersReturn {
  const [orders, setOrders] = useState<FirestoreOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const previousOrdersRef = useRef<Map<string, FirestoreOrder>>(new Map())
  const initializedRef = useRef(false)
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null)

  const playSound = useCallback((path: string) => {
    if (typeof window === "undefined") return
    const audio = new Audio(path)
    void audio.play().catch(() => {})
  }, [])

  const convertTimestamp = (timestamp: unknown): Date => {
    if (timestamp instanceof Timestamp) return timestamp.toDate()
    if (timestamp instanceof Date) return timestamp
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp && typeof timestamp.toDate === "function") return timestamp.toDate()
    return new Date()
  }

  useEffect(() => {
    if (!storeId) {
      setOrders([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    initializedRef.current = false
    previousOrdersRef.current = new Map()
    const ordersQuery = query(collection(db, "orders"), where("storeId", "==", storeId), where("status", "in", [...ALL_ORDER_STATUSES]), orderBy("createdAt", "desc"))
    return onSnapshot(ordersQuery, snapshot => {
      const nextOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return { id: docSnap.id, orderId: data.orderId || docSnap.id.slice(-5).toUpperCase(), userName: data.userName || "Customer", destinationAddress: data.destinationAddress || "", items: data.items || [], subtotal: data.subtotal || 0, deliveryFee: data.deliveryFee || 0, total: data.total || 0, status: data.status, storeId: data.storeId, createdAt: convertTimestamp(data.createdAt), driverStatus: data.driverStatus, driverSnapshot: data.driverSnapshot, driver: data.driver } as FirestoreOrder
      })
      const previous = previousOrdersRef.current
      if (initializedRef.current) {
        if (nextOrders.some(order => order.status === "pending" && !previous.has(order.id))) playSound("/sounds/order.mp3")
        if (nextOrders.some(order => order.driverStatus === "at_store" && previous.get(order.id)?.driverStatus !== "at_store")) playSound("/sounds/driver.mp3")
      }
      previousOrdersRef.current = new Map(nextOrders.map(order => [order.id, order]))
      initializedRef.current = true
      setOrders(nextOrders)
      setIsLoading(false)
    }, err => {
      console.error("Error listening to orders:", err)
      setError(err.message)
      setIsLoading(false)
    })
  }, [storeId, playSound])

  const handleStatusUpdate = useCallback((orderId: string, newStatus: string) => {
    setOrders(current => current.map(order => order.id === orderId ? { ...order, status: newStatus as FirestoreOrder["status"] } : order))
  }, [])

  const pendingOrders = useMemo(() => orders.filter(order => order.status === "pending").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), [orders])
  const acceptedOrders = useMemo(() => orders.filter(order => order.status === "accepted").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), [orders])
  const activeOrders = useMemo(() => [...pendingOrders, ...acceptedOrders], [pendingOrders, acceptedOrders])
  const completedOrders = useMemo(() => orders.filter(order => isOrderCompleted(order.status)), [orders])
  const todayOrders = useMemo(() => orders.filter(order => isToday(order.createdAt)), [orders])
  const pastOrders = useMemo(() => orders.filter(order => isOrderCompleted(order.status) && isWithinPastDays(order.createdAt, 90)), [orders])
  const weeklyRevenueOrders = useMemo(() => orders.filter(order => { const week = new Date(); week.setDate(week.getDate() - 7); return order.createdAt >= week && isRevenueOrder(order.status) }), [orders])

  useEffect(() => {
    if (pendingOrders.length === 0) {
      pendingAudioRef.current?.pause()
      pendingAudioRef.current = null
      return
    }
    if (!pendingAudioRef.current) {
      const audio = new Audio("/sounds/order.mp3")
      audio.loop = true
      pendingAudioRef.current = audio
      void audio.play().catch(() => {})
    }
  }, [pendingOrders.length])

  useEffect(() => () => pendingAudioRef.current?.pause(), [])

  return { pendingOrders, acceptedOrders, completedOrders, allOrders: orders, activeOrders, todayOrders, pastOrders, weeklyRevenueOrders, isLoading, error, handleStatusUpdate }
}
