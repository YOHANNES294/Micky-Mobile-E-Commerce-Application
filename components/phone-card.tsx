"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Phone } from "@/lib/types"
import { useState } from "react"
import { PhoneDetailModal } from "@/components/phone-detail-modal"
import { Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"

interface PhoneCardProps {
  phone: Phone
}

export function PhoneCard({ phone }: PhoneCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const router = useRouter()

  return (
    <>
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] border-coral-100 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer group">
        <CardHeader className="p-0">
          <div className="relative aspect-square bg-gradient-to-br from-coral-50 to-gold-50 flex items-center justify-center">
            {phone.image ? (
              <img src={phone.image || "/placeholder.svg"} alt={phone.model} className="w-full h-full object-cover" />
            ) : (
              <Smartphone className="w-24 h-24 text-coral-300" />
            )}
            <Badge className="absolute top-3 right-3 bg-gradient-to-r from-coral-600 to-gold-600 text-white border-none">
              {phone.brand}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-1">{phone.model}</h3>
            {phone.message && <p className="text-sm text-muted-foreground line-clamp-2">{phone.message}</p>}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-coral-600">{phone.price} ETB</p>
              <p className="text-xs text-muted-foreground">
                {phone.storage} • {phone.ram} RAM
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button
            onClick={() => setShowDetails(true)}
            className="w-full bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white font-semibold"
          >
            View Details
          </Button>
        </CardFooter>
      </Card>

      <PhoneDetailModal phone={phone} open={showDetails} onOpenChange={setShowDetails} />
    </>
  )
}
