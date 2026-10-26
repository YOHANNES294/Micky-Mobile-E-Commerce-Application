"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Phone, PhoneBrand } from "@/lib/types"
import { Upload, X } from "lucide-react"

interface EditPhoneDialogProps {
  phone: Phone
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhoneUpdated: (phone: Phone) => void
}

export function EditPhoneDialog({ phone, open, onOpenChange, onPhoneUpdated }: EditPhoneDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(phone.image || null)
  const [formData, setFormData] = useState({
    brand: phone.brand,
    model: phone.model,
    storage: phone.storage,
    ram: phone.ram,
    battery: phone.battery || "",
    sim: phone.sim,
    price: phone.price.toString(),
    image: phone.image || "",
    message: phone.message || "",
    network: phone.network || "",
  })

  useEffect(() => {
    setFormData({
      brand: phone.brand,
      model: phone.model,
      storage: phone.storage,
      ram: phone.ram,
      battery: phone.battery || "",
      sim: phone.sim,
      price: phone.price.toString(),
      image: phone.image || "",
      message: phone.message || "",
      network: phone.network || "",
    })
    setImagePreview(phone.image || null)
  }, [phone])

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

    try {
      const supabase = createClient()

      const updateData = {
        brand: formData.brand,
        model: formData.model,
        storage: formData.storage,
        ram: formData.ram,
        battery: formData.brand === "iPhone" ? formData.battery : null,
        sim: formData.sim,
        network: formData.brand === "Samsung" ? formData.network : null,

        price: formData.price,
        image: formData.image || null,
        message: formData.message || null,
      }

      const { data, error: updateError } = await supabase
        .from("phones")
        .update(updateData)
        .eq("id", phone.id)
        .select()
        .single()

      if (updateError) throw updateError

      onPhoneUpdated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update phone")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Phone</DialogTitle>
          <DialogDescription>Update the details of this phone</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-brand">Brand *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="edit-model">Model *</Label>
              <Input
                id="edit-model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
                className="border-coral-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-storage">Storage *</Label>
              <Input
                id="edit-storage"
                value={formData.storage}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                required
                className="border-coral-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-ram">RAM *</Label>
              <Input
                id="edit-ram"
                value={formData.ram}
                onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                required
                className="border-coral-200"
              />
            </div>

            {formData.brand === "iPhone" && (
              <div className="space-y-2">
                <Label htmlFor="edit-battery">Battery *</Label>
                <Input
                  id="edit-battery"
                  value={formData.battery}
                  onChange={(e) => setFormData({ ...formData, battery: e.target.value })}
                  required={formData.brand === "iPhone"}
                  className="border-coral-200"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-sim">SIM *</Label>
              <Input
                id="edit-sim"
                value={formData.sim}
                onChange={(e) => setFormData({ ...formData, sim: e.target.value })}
                required
                className="border-coral-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-price">Price (ETB) *</Label>
              <Input
                id="edit-price"
                type="text"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="20000 or 20000 - 23000"
                required
                className="border-coral-200"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-image">Phone Image</Label>
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
                  <input type="file" id="edit-image" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <label htmlFor="edit-image" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-12 h-12 text-coral-400" />
                    <span className="text-sm text-muted-foreground">Click to upload phone image</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-message">Description/Message</Label>
              <Textarea
                id="edit-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
                className="border-coral-200"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-coral-200">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white"
            >
              {isLoading ? "Updating..." : "Update Phone"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
