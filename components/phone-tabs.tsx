"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhoneCard } from "@/components/phone-card"
import type { Phone } from "@/lib/types"
import { Smartphone } from "lucide-react"

interface PhoneTabsProps {
  samsungPhones: Phone[]
  iphonePhones: Phone[]
}

export function PhoneTabs({ samsungPhones, iphonePhones }: PhoneTabsProps) {
  return (
    <Tabs defaultValue="samsung" className="w-full">
      <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-12 mb-8 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800">
        <TabsTrigger
          value="samsung"
          className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          Samsung ({samsungPhones.length})
        </TabsTrigger>
        <TabsTrigger
          value="iphone"
          className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          iPhone ({iphonePhones.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="samsung">
        {samsungPhones.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No Samsung phones available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {samsungPhones.map((phone) => (
              <PhoneCard key={phone.id} phone={phone} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="iphone">
        {iphonePhones.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No iPhone devices available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {iphonePhones.map((phone) => (
              <PhoneCard key={phone.id} phone={phone} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
