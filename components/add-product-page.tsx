"use client"

import { useState, useRef } from "react"
import { ChevronLeft, Camera, Plus, Loader2, X } from "lucide-react"
import { doc, collection, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadProductImage } from "@/lib/cloudinary"
import type { Product } from "@/lib/store-data"

interface AddProductPageProps {
  product?: Product | null
  storeId: string
  storeName: string
  storeAddress: string
  storeCategory?: string
  onBack: () => void
  onSave: (product: Omit<Product, "id"> & { id?: string }) => void
}

const categoryOptions: Record<string, { label: string; foodCategory?: string }[]> = {
  food: [{ label: "Fast Food", foodCategory: "food" }, { label: "Healthy", foodCategory: "food" }, { label: "Snacks", foodCategory: "food" }, { label: "Fresh Produce", foodCategory: "food" }, { label: "Japanese", foodCategory: "food" }, { label: "Desserts", foodCategory: "dessert" }, { label: "Beverages", foodCategory: "drinks" }, { label: "Other", foodCategory: "food" }],
  clothes: ["Men", "Women", "Kids", "Shoes", "Bags & Accessories", "Chitenge & Traditional Wear", "Sportswear", "Underwear & Socks", "Other"].map(label => ({ label })),
  hardware: ["Building Materials", "Roofing", "Plumbing", "Electrical", "Paint & Finishes", "Tools & Equipment", "Doors Windows & Locks", "Nails Screws & Fasteners", "Garden & Outdoor", "Safety Gear", "Other"].map(label => ({ label })),
  market: [{ label: "Vegetables", foodCategory: "vegetables" }, { label: "Fruits", foodCategory: "fruits" }, { label: "Dry Food - beans, groundnuts, kapenta, rice", foodCategory: "dry_food" }, { label: "Utensils", foodCategory: "utensils" }, { label: "Baskets & Buckets", foodCategory: "baskets_buckets" }, { label: "Shoes", foodCategory: "shoes" }, { label: "Garden Items", foodCategory: "garden" }, { label: "Household Items", foodCategory: "household" }, { label: "Other", foodCategory: "other" }],
}

const units = ["item", "bag", "g", "kg", "ml", "L", "pack"]

export function AddProductPage({ product, storeId, storeName, storeAddress, storeCategory = "food", onBack, onSave }: AddProductPageProps) {
  const categories = categoryOptions[storeCategory] || categoryOptions.food
  const savedCategory = product?.category || categories[0].label
  const options = categories.some(option => option.label === savedCategory) ? categories : [...categories, { label: savedCategory, foodCategory: product?.foodCategory }]
  const selectedCategory = options.find(option => option.label === savedCategory)
  const [name, setName] = useState(product?.name || "")
  const [category, setCategory] = useState(savedCategory)
  const [price, setPrice] = useState(product?.price?.toString() || "")
  const initialUnitMatch = product?.unit?.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  const initialUnitType = initialUnitMatch?.[2] || (product?.unit ? product.unit : "item")
  const unitOptions = units.includes(initialUnitType) ? units : [initialUnitType, ...units]
  const [unitAmount, setUnitAmount] = useState(initialUnitMatch?.[1] || "1")
  const [unitType, setUnitType] = useState(initialUnitType)
  const [description, setDescription] = useState(product?.description || "")
  const [available, setAvailable] = useState(product?.available ?? true)
  const existingImages = (product?.images?.length ? product.images : product?.image ? [product.image] : []).filter(Boolean).slice(0, 3)
  const [image, setImage] = useState(existingImages[0] || "")
  const [imageUrls, setImageUrls] = useState<string[]>(existingImages)
  const [stock, setStock] = useState(product?.stock?.toString() || "0")
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null])
  const [activeImageSlot, setActiveImageSlot] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!product

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const preview = event.target?.result as string
      if (storeCategory === "clothes") {
        setImageUrls((current) => { const next = [...current]; next[activeImageSlot] = preview; return next })
        setImageFiles((current) => { const next = [...current]; next[activeImageSlot] = file; return next })
      } else {
        setImage(preview)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const removeImage = (slot: number) => {
    setImageUrls((current) => current.filter((_, index) => index !== slot))
    setImageFiles((current) => current.filter((_, index) => index !== slot))
  }

  const handleSave = async () => {
    if (!name.trim() || !price) return
    if (storeCategory === "clothes" && imageUrls.filter(Boolean).length === 0) {
      setError("Add at least one photo")
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      // Generate product ID using Firestore document reference
      const productId = product?.id || doc(collection(db, "stores", storeId, "products")).id
      
      let savedImageUrls = imageUrls.filter(Boolean)
      if (storeCategory === "clothes") {
        setIsUploading(true)
        try {
          const uploaded = await Promise.all(savedImageUrls.map(async (url, index) => imageFiles[index] ? uploadProductImage(imageFiles[index]!, storeId, productId) : url))
          savedImageUrls = uploaded.filter(Boolean)
        } catch {
          setError("Failed to upload image. Please try again.")
          setIsSaving(false)
          setIsUploading(false)
          return
        }
        setIsUploading(false)
      } else if (imageFiles[0]) {
        setIsUploading(true)
        try { savedImageUrls = [await uploadProductImage(imageFiles[0]!, storeId, productId)] } catch {
          setError("Failed to upload image. Please try again.")
          setIsSaving(false)
          setIsUploading(false)
          return
        }
        setIsUploading(false)
      }
      const imageUrl = storeCategory === "clothes" ? (savedImageUrls[0] || "") : (savedImageUrls[0] || image || "")

      // Prepare product data for Firestore
      const productData = {
        name: name.trim(),
        price: parseFloat(price) || 0,
        imageUrl: imageUrl || "",
        ...(storeCategory === "clothes" ? { imageUrls: savedImageUrls } : {}),
        description: description.trim(),
        category,
        unit: `${unitAmount}${unitType}`,
        stockQuantity: parseInt(stock) || 0,
        availability: available,
        available,
        storeId,
        storeName,
        storeAddress,
        ...(selectedCategory?.foodCategory && (storeCategory === "food" || storeCategory === "market") ? { foodCategory: selectedCategory.foodCategory } : {}),
        ...(isEditing ? {} : { createdAt: serverTimestamp() }),
      }

      // Save to Firestore
      await setDoc(doc(db, "stores", storeId, "products", productId), productData, { merge: true })

      // Call onSave callback with the product data for local state update
      onSave({
        id: productId,
        name: name.trim(),
        category,
        price: parseFloat(price) || 0,
        unit: `${unitAmount}${unitType}`,
        description: description.trim(),
        available,
        image: imageUrl || "",
        stock: parseInt(stock) || 0,
        foodCategory: selectedCategory?.foodCategory,
      })
    } catch (err) {
      console.error("Error saving product:", err)
      setError("Failed to save product. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header */}
      <div className="bg-card px-4 pt-5 pb-4 shrink-0 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-card-foreground transition-colors hover:text-primary"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-card-foreground">
              {isEditing ? "Edit Product" : "Add New Product"}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        <div className="flex flex-col gap-5">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-xl p-3 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {/* Image Upload */}
          {storeCategory === "clothes" ? (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((slot) => (
                <button key={slot} type="button" onClick={() => { setActiveImageSlot(slot); fileInputRef.current?.click() }} disabled={isUploading || isSaving} className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card">
                  {imageUrls[slot] ? <img src={imageUrls[slot]} alt={slot === 0 ? "Main product photo" : `Product photo ${slot + 1}`} className="size-full object-cover" /> : <><Camera className="size-6 text-primary" /><span className="mt-1 px-1 text-center text-[10px] text-muted-foreground">{slot === 0 ? "Main photo (required)" : `Photo ${slot + 1} (optional)`}</span></>}
                  {imageUrls[slot] && <span role="button" tabIndex={0} aria-label={`Remove photo ${slot + 1}`} onClick={(event) => { event.stopPropagation(); removeImage(slot) }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="size-3" /></span>}
                </button>
              ))}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          ) : (
            <div className="flex justify-center">
              <button type="button" onClick={() => { setActiveImageSlot(0); fileInputRef.current?.click() }} disabled={isUploading || isSaving} className="relative flex h-36 w-full max-w-xs flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-card">
                {image ? <img src={image} alt="Product preview" className="size-full rounded-xl object-cover" /> : <><Camera className="size-6 text-primary" /><span className="text-sm text-muted-foreground">Tap to Upload Image</span></>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          )}

          {/* Product Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Product Name
            </label>
            <input
              type="text"
              placeholder="Enter product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              {options.map((cat) => (
                <option key={cat.label} value={cat.label}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price and Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Price (ZMW)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="ZMW 0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Unit
              </label>
              <div className="flex items-center overflow-hidden bg-card border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="1"
                  value={unitAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                    setUnitAmount(value)
                  }}
                  className="min-w-0 flex-1 px-4 py-3 bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
                  aria-label="Unit amount"
                />
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-20 shrink-0 border-l border-border bg-transparent px-2 py-3 text-sm text-card-foreground focus:outline-none cursor-pointer"
                  aria-label="Unit type"
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Stock Quantity
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Description (Optional)
            </label>
            <textarea
              placeholder="Add details about the product..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <div>
              <p className="text-sm font-semibold text-card-foreground">Availability</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {available ? "Product is Available" : "Product is Out of Stock"}
              </p>
            </div>
            <button
              onClick={() => setAvailable(!available)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${
                available ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              role="switch"
              aria-checked={available}
              aria-label="Toggle product availability"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-card transition-transform duration-300 shadow-sm ${
                  available ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!name.trim() || !price || isSaving || isUploading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold transition-all duration-200 active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isSaving || isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isUploading ? "Uploading Image..." : "Saving..."}
              </>
            ) : (
              isEditing ? "Update Product" : "Save Product"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
