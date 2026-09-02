"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface OrderItem {
  name: string
  price: number
  quantity?: number
  image?: string
}

export interface FirestoreOrder {
  id: string
  orderId: string
  userName: string
  destinationAddress: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  status: "pending" | "accepted" | "ready_for_pickup" | "rejected" | "completed" | "delivered" | "picked_up" | "at_store"
  storeId: string
  createdAt: Date
  driverStatus?: string
  driverSnapshot?: {
    brand?: string
    carImage?: string
    color?: string
    firstName?: string
    model?: string
    plateNumber?: string
    profilePicture?: string
  }
  driver?: { name?: string; phone?: string; photoURL?: string; vehicle?: string }
}

interface OrderPopupPanelProps {
  order: FirestoreOrder
  onClose: () => void
  onStatusUpdate: (orderId: string, newStatus: string) => void
}

export function OrderPopupPanel({ order, onClose, onStatusUpdate }: OrderPopupPanelProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isMarkingReady, setIsMarkingReady] = useState(false)
  const [localStatus, setLocalStatus] = useState(order.status)
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  
  // Drag state
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  
  const panelRef = useRef<HTMLDivElement>(null)
  const handleAreaRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const lastYRef = useRef(0)
  const velocityRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Panel dimensions
  const PANEL_HEIGHT = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.55, 500) : 400
  const HANDLE_AREA_HEIGHT = 56
  const HIDDEN_POSITION = -(PANEL_HEIGHT - HANDLE_AREA_HEIGHT)

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Sync local status with order status
  useEffect(() => {
    setLocalStatus(order.status)
  }, [order.status])

  // Calculate ETA (minutes since order created)
  const getETA = (createdAt: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - createdAt.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "< 1 min"
    if (diffMins === 1) return "1 min"
    return `${diffMins} mins`
  }

  // Smooth exit animation then close
  const animateExit = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 350)
  }

  // Drag handlers for touch
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    lastYRef.current = e.touches[0].clientY
    lastTimeRef.current = Date.now()
    velocityRef.current = 0
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    
    const currentY = e.touches[0].clientY
    const currentTime = Date.now()
    const timeDiff = currentTime - lastTimeRef.current
    
    if (timeDiff > 0) {
      velocityRef.current = (currentY - lastYRef.current) / timeDiff
    }
    
    lastYRef.current = currentY
    lastTimeRef.current = currentTime
    
    const diff = currentY - startYRef.current
    
    if (isHidden) {
      // Panel is hidden, allow dragging down to show
      const newY = HIDDEN_POSITION + diff
      setDragY(Math.max(HIDDEN_POSITION, Math.min(0, newY)))
    } else {
      // Panel is visible, allow dragging up to hide
      setDragY(Math.max(HIDDEN_POSITION, Math.min(0, diff)))
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    
    const threshold = Math.abs(HIDDEN_POSITION) * 0.4
    const velocityThreshold = 0.5
    
    if (isHidden) {
      // Currently hidden - check if should show
      if (velocityRef.current > velocityThreshold || dragY > HIDDEN_POSITION + threshold) {
        setDragY(0)
        setIsHidden(false)
      } else {
        setDragY(HIDDEN_POSITION)
      }
    } else {
      // Currently visible - check if should hide
      if (velocityRef.current < -velocityThreshold || dragY < -threshold) {
        setDragY(HIDDEN_POSITION)
        setIsHidden(true)
      } else {
        setDragY(0)
      }
    }
  }

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY
    lastYRef.current = e.clientY
    lastTimeRef.current = Date.now()
    velocityRef.current = 0
    setIsDragging(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      const currentY = e.clientY
      const currentTime = Date.now()
      const timeDiff = currentTime - lastTimeRef.current
      
      if (timeDiff > 0) {
        velocityRef.current = (currentY - lastYRef.current) / timeDiff
      }
      
      lastYRef.current = currentY
      lastTimeRef.current = currentTime
      
      const diff = currentY - startYRef.current
      
      if (isHidden) {
        const newY = HIDDEN_POSITION + diff
        setDragY(Math.max(HIDDEN_POSITION, Math.min(0, newY)))
      } else {
        setDragY(Math.max(HIDDEN_POSITION, Math.min(0, diff)))
      }
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      
      const threshold = Math.abs(HIDDEN_POSITION) * 0.4
      const velocityThreshold = 0.5
      
      if (isHidden) {
        if (velocityRef.current > velocityThreshold || dragY > HIDDEN_POSITION + threshold) {
          setDragY(0)
          setIsHidden(false)
        } else {
          setDragY(HIDDEN_POSITION)
        }
      } else {
        if (velocityRef.current < -velocityThreshold || dragY < -threshold) {
          setDragY(HIDDEN_POSITION)
          setIsHidden(true)
        } else {
          setDragY(0)
        }
      }
      
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Accept handler - PRESERVES EXISTING FIRESTORE LOGIC
  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "accepted"
      })
      setLocalStatus("accepted")
      onStatusUpdate(order.id, "accepted")
    } catch (error) {
      console.error("Error accepting order:", error)
    } finally {
      setIsAccepting(false)
    }
  }

  // Reject handler - PRESERVES EXISTING FIRESTORE LOGIC
  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "rejected"
      })
      onStatusUpdate(order.id, "rejected")
      animateExit()
    } catch (error) {
      console.error("Error rejecting order:", error)
    } finally {
      setIsRejecting(false)
    }
  }

  // Ready for pickup handler - PRESERVES EXISTING FIRESTORE LOGIC
  const handleMarkReady = async () => {
    setIsMarkingReady(true)
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "ready_for_pickup"
      })
      onStatusUpdate(order.id, "ready_for_pickup")
      animateExit()
    } catch (error) {
      console.error("Error marking order ready:", error)
    } finally {
      setIsMarkingReady(false)
    }
  }

  // Calculate transform based on state
  const getTransform = () => {
    if (isExiting) {
      return `translateY(-100%)`
    }
    if (!isVisible) {
      return `translateY(-100%)`
    }
    return `translateY(${dragY}px)`
  }

  return (
    <div 
      className="fixed inset-0 z-50"
      style={{ 
        pointerEvents: isHidden ? 'none' : 'auto'
      }}
    >
      {/* Backdrop - only visible when panel is shown */}
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity duration-300"
        style={{ 
          opacity: isHidden ? 0 : 1,
          pointerEvents: isHidden ? 'none' : 'auto'
        }}
      />
      
      {/* Panel - slides from top edge with no gap */}
      <div
        ref={panelRef}
        className="absolute left-0 right-0 top-0 flex flex-col bg-white shadow-2xl"
        style={{
          height: `${PANEL_HEIGHT}px`,
          transform: getTransform(),
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          borderBottomLeftRadius: '24px',
          borderBottomRightRadius: '24px',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3), 0 4px 20px -5px rgba(0, 0, 0, 0.2)',
          pointerEvents: 'auto',
        }}
      >
        {/* Fixed Top Section - Order Number & ETA */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Order #{order.orderId}</h2>
              <p className="text-sm text-gray-500 mt-0.5">New incoming order</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400 uppercase tracking-wide">ETA</span>
              <span className="text-lg font-semibold text-orange-500">{getETA(order.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Middle Section */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Customer Info */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Customer</p>
            <h3 className="text-base font-semibold text-gray-900">{order.userName}</h3>
            <p className="text-sm text-gray-500 mt-1">{order.destinationAddress}</p>
          </div>

          {/* Items List */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Items</p>
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2">
                <span className="text-gray-700 text-sm">
                  {item.name} {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ""}
                </span>
                <span className="text-gray-600 text-sm font-medium">ZMW {item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Pricing Summary */}
          <div className="px-5 py-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400 text-sm">Subtotal</span>
              <span className="text-gray-600 text-sm">ZMW {order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 mt-2 border-t border-gray-100">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-gray-900">ZMW {order.subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Section - Action Buttons */}
        <div className="flex-shrink-0 px-5 py-4 bg-white border-t border-gray-100">
          {localStatus === "pending" && (
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={isAccepting || isRejecting}
                className="flex-1 py-3.5 px-6 rounded-xl border-2 border-red-500 text-red-500 font-semibold text-base transition-all duration-200 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{
                  boxShadow: '0 2px 8px -2px rgba(239, 68, 68, 0.3)'
                }}
              >
                {isRejecting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reject"}
              </button>
              <button
                onClick={handleAccept}
                disabled={isAccepting || isRejecting}
                className="flex-1 py-3.5 px-6 rounded-xl bg-[#22c55e] text-white font-semibold text-base transition-all duration-200 hover:bg-[#16a34a] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{
                  boxShadow: '0 4px 12px -2px rgba(34, 197, 94, 0.4)'
                }}
              >
                {isAccepting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Accept"}
              </button>
            </div>
          )}
          
          {localStatus === "accepted" && (
            <button
              onClick={handleMarkReady}
              disabled={isMarkingReady}
              className="w-full py-3.5 px-6 rounded-xl bg-orange-500 text-white font-semibold text-base transition-all duration-200 hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                boxShadow: '0 4px 12px -2px rgba(249, 115, 22, 0.4)'
              }}
            >
              {isMarkingReady ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                "Ready for pickup"
              )}
            </button>
          )}
        </div>

        {/* Handle Area - Below buttons, for dragging */}
        <div 
          ref={handleAreaRef}
          className="flex-shrink-0 flex flex-col items-center justify-center py-3 cursor-grab active:cursor-grabbing bg-gray-50 select-none"
          style={{ 
            height: `${HANDLE_AREA_HEIGHT}px`,
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            touchAction: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            {isHidden ? "Pull down" : "Slide up to minimize"}
          </span>
        </div>
      </div>
    </div>
  )
}
