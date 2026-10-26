"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Phone } from "@/lib/types"
import { Smartphone, HardDrive, Cpu, Battery, Sigma as Sim, ShoppingCart, MessageCircle } from "lucide-react"
import { CheckoutModal } from "./checkout-modal"

interface PhoneDetailModalProps {
  phone: Phone
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PhoneDetailModal({ phone, open, onOpenChange }: PhoneDetailModalProps) {
  const [showCheckout, setShowCheckout] = useState(false)
  const [isPaid, setIsPaid] = useState(false)

  const handlePurchaseSuccess = (orderId: string) => {
    setIsPaid(true)
    setShowCheckout(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-foreground mb-2">{phone.model}</DialogTitle>
                <DialogDescription className="text-base">{phone.message || "Premium smartphone"}</DialogDescription>
              </div>
              <Badge className="bg-gradient-to-r from-coral-600 to-gold-600 text-white border-none">
                {phone.brand}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Image */}
            <div className="relative aspect-video bg-gradient-to-br from-coral-50 to-gold-50 dark:from-coral-950/30 dark:to-gold-950/30 rounded-lg flex items-center justify-center overflow-hidden">
              {phone.image ? (
                <img src={phone.image || "/placeholder.svg"} alt={phone.model} className="w-full h-full object-cover" />
              ) : (
                <Smartphone className="w-32 h-32 text-coral-300" />
              )}
            </div>

            {/* Price */}
            <div className="bg-gradient-to-r from-coral-50 to-gold-50 dark:from-coral-950/30 dark:to-gold-950/30 rounded-lg p-4 text-center border border-coral-100 dark:border-slate-800">
              <p className="text-sm text-muted-foreground mb-1">Price</p>
              <p className="text-3xl font-bold text-coral-700">{phone.price.toLocaleString()} ETB</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={() => setShowCheckout(true)}
                className="bg-coral-600 hover:bg-coral-700 text-white h-12 text-lg font-bold"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Buy Now / ይግዙ
              </Button>
              <Button
                variant="outline"
                className="border-coral-200 text-coral-700 h-12 text-lg"
                onClick={() => {
                  // This would trigger the ChatButton's state in a shared context or just reveal chat
                  const chatBtn = document.querySelector('button[class*="fixed bottom-6"]') as HTMLButtonElement
                  if (chatBtn) chatBtn.click()
                  onOpenChange(false)
                }}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Chat with Admin
              </Button>
            </div>

            {/* Specifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Technical Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-coral-100 dark:bg-coral-950/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-coral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="font-semibold">{phone.model}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-gold-100 dark:bg-gold-950/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HardDrive className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Storage</p>
                    <p className="font-semibold">{phone.storage}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-coral-100 dark:bg-coral-950/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-coral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">RAM</p>
                    <p className="font-semibold">{phone.ram}</p>
                  </div>
                </div>

                {phone.battery && (
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg">
                    <div className="w-10 h-10 bg-gold-100 dark:bg-gold-950/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Battery className="w-5 h-5 text-gold-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Battery</p>
                      <p className="font-semibold">{phone.battery}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-coral-100 dark:bg-coral-950/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sim className="w-5 h-5 text-coral-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SIM</p>
                    <p className="font-semibold">{phone.sim}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CheckoutModal
        phone={phone}
        open={showCheckout}
        onOpenChange={setShowCheckout}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  )
}
