"use client"

import type React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Phone, PhoneBrand } from "@/lib/types"
import { Upload, X } from "lucide-react"

interface AddPhoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhoneAdded: (phone: Phone) => void
}

export function AddPhoneDialog({ open, onOpenChange, onPhoneAdded }: AddPhoneDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    brand: "Samsung" as PhoneBrand,
    model: "",
    storage: "",
    ram: "",
    battery: "",
    sim: "",
    price: "",
    image: "",
    message: "",
    network: "",
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB")
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setImagePreview(base64String)
        setFormData({ ...formData, image: base64String })
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setFormData({ ...formData, image: "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Basic validation
    if (!formData.model || !formData.storage || !formData.price) {
      setError("Model, Storage, and Price are required")
      setIsLoading(false)
      return
    }

    if (formData.brand === "Samsung") {
      if (!formData.ram || !formData.sim || !formData.network) {
        setError("RAM, SIM, and Network are required for Samsung")
        setIsLoading(false)
        return
      }
    }

    if (formData.brand === "iPhone" && !formData.battery) {
      setError("Battery is required for iPhone")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const phoneData = {
        brand: formData.brand,
        model: formData.model,
        storage: formData.storage,
        ram: formData.ram || null,
        battery: formData.brand === "iPhone" ? formData.battery : null,
        network: formData.brand === "Samsung" ? formData.network : null,
        sim: formData.sim || null,
        price: formData.price, // Store as string directly
        image: formData.image || null,
        message: formData.message || null,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }

      console.log("[v0] Phone data to insert:", phoneData)

      const { data, error: insertError } = await supabase
        .from("phones")
        .insert(phoneData)
        .select()

      console.log("[v0] Supabase insert result:", { data, insertError })

      if (insertError) {
        console.error("[v0] Supabase insert error:", insertError)
        setError(insertError.message || JSON.stringify(insertError))
        return
      }

      console.log("[v0] Phone added successfully:", data)
      if (data && data.length > 0) {
        onPhoneAdded(data[0])
      }

      // Reset form
      setFormData({
        brand: "Samsung",
        model: "",
        storage: "",
        ram: "",
        battery: "",
        sim: "",
        price: "",
        image: "",
        message: "",
        network: "",
      })
      setImagePreview(null)
    } catch (err) {
      console.error("[v0] Unexpected error adding phone:", err)
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Phone</DialogTitle>
          <DialogDescription>Enter the details of the new phone to add to inventory</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brand */}
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Select
                value={formData.brand}
                onValueChange={(value) => setFormData({ ...formData, brand: value as PhoneBrand })}
              >
                <SelectTrigger className="border-coral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Samsung">Samsung</SelectItem>
                  <SelectItem value="iPhone">iPhone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Galaxy S24 Ultra"
                required
                className="border-coral-200"
              />
            </div>

            {/* Storage */}
            <div className="space-y-2">
              <Label htmlFor="storage">Storage *</Label>
              <Input
                id="storage"
                value={formData.storage}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                placeholder="e.g., 256GB"
                required
                className="border-coral-200"
              />
            </div>

            {/* Network (Samsung only) */}
            {formData.brand === "Samsung" && (
              <div className="space-y-2">
                <Label htmlFor="network">Network *</Label>
                <Select
                  value={formData.network}
                  onValueChange={(value) => setFormData({ ...formData, network: value })}
                >
                  <SelectTrigger className="border-coral-200">
                    <SelectValue placeholder="Select Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5G">5G</SelectItem>
                    <SelectItem value="4G">4G</SelectItem>
                    <SelectItem value="3G">3G</SelectItem>
                    <SelectItem value="2G">2G</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* RAM */}
            <div className="space-y-2">
              <Label htmlFor="ram">RAM {formData.brand === "Samsung" ? "*" : "(Optional)"}</Label>
              <Input
                id="ram"
                value={formData.ram}
                onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                placeholder="e.g., 12GB"
                required={formData.brand === "Samsung"}
                className="border-coral-200"
              />
            </div>

            {/* Battery (iPhone only) */}
            {formData.brand === "iPhone" && (
              <div className="space-y-2">
                <Label htmlFor="battery">Battery *</Label>
                <Input
                  id="battery"
                  value={formData.battery}
                  onChange={(e) => setFormData({ ...formData, battery: e.target.value })}
                  placeholder="e.g., 4500mAh"
                  required={formData.brand === "iPhone"}
                  className="border-coral-200"
                />
              </div>
            )}

            {/* SIM */}
            <div className="space-y-2">
              <Label htmlFor="sim">SIM {formData.brand === "Samsung" ? "*" : "(Optional)"}</Label>
              <Input
                id="sim"
                value={formData.sim}
                onChange={(e) => setFormData({ ...formData, sim: e.target.value })}
                placeholder="e.g., Dual SIM"
                required={formData.brand === "Samsung"}
                className="border-coral-200"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Price (ETB) *</Label>
              <Input
                id="price"
                type="text"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g., 20000 or 20000 - 23000"
                required
                className="border-coral-200"
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="image">Phone Image</Label>
              {imagePreview ? (
                <div className="relative border-2 border-coral-200 rounded-lg p-4">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Preview"
                    className="w-full h-48 object-contain rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-coral-200 rounded-lg p-8 text-center hover:border-coral-400 transition-colors">
                  <input type="file" id="image" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <label htmlFor="image" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-12 h-12 text-coral-400" />
                    <span className="text-sm text-muted-foreground">Click to upload phone image</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</span>
                  </label>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="message">Description/Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Brief description or promotional message"
                rows={3}
                className="border-coral-200"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-coral-200">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white"
            >
              {isLoading ? "Adding..." : "Add Phone"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
