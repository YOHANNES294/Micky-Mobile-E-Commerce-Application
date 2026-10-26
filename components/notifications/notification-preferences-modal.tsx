"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Bell, Volume2, Mail, Smartphone, Package, MessageSquare, Tag, Shield } from "lucide-react"
import { toast } from "sonner"
import type { NotificationPreferences } from "@/lib/types"

interface NotificationPreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationPreferencesModal({ open, onOpenChange }: NotificationPreferencesModalProps) {
  const [prefs, setPrefs] = useState<Partial<NotificationPreferences>>({
    in_app_enabled: true,
    push_enabled: true,
    email_enabled: true,
    order_updates: true,
    support_messages: true,
    promotional_updates: false,
    sound_enabled: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/notifications/preferences")
        .then((res) => res.json())
        .then((data) => {
          if (data.preferences) {
            setPrefs(data.preferences)
          }
        })
        .catch((err) => console.error("Failed to load preferences:", err))
        .finally(() => setLoading(false))
    }
  }, [open])

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        toast.success("Notification preferences saved successfully")
        onOpenChange(false)
      } else {
        toast.error("Failed to save preferences")
      }
    } catch {
      toast.error("Could not update preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6 border-coral-100 dark:border-slate-800">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Bell className="w-5 h-5 text-coral-600" />
            Notification Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose which alerts you receive and your preferred delivery channels.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading settings...</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Delivery Channels */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery Channels</h4>
              <div className="space-y-3 rounded-xl border p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Smartphone className="w-4 h-4 text-coral-600" />
                      Push Notifications
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Receive browser and device popups</p>
                  </div>
                  <Switch
                    checked={prefs.push_enabled ?? true}
                    onCheckedChange={(val) => handleToggle("push_enabled", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Bell className="w-4 h-4 text-amber-600" />
                      In-App Notification Center
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Badges and notification drawer</p>
                  </div>
                  <Switch
                    checked={prefs.in_app_enabled ?? true}
                    onCheckedChange={(val) => handleToggle("in_app_enabled", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      Email Alerts
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Order receipts and inquiry replies</p>
                  </div>
                  <Switch
                    checked={prefs.email_enabled ?? true}
                    onCheckedChange={(val) => handleToggle("email_enabled", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Volume2 className="w-4 h-4 text-blue-600" />
                      Notification Sound
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Play gentle chime on new incoming message</p>
                  </div>
                  <Switch
                    checked={prefs.sound_enabled ?? true}
                    onCheckedChange={(val) => handleToggle("sound_enabled", val)}
                  />
                </div>
              </div>
            </div>

            {/* Notification Topics */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Event Categories</h4>
              <div className="space-y-3 rounded-xl border p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Package className="w-4 h-4 text-coral-600" />
                      Order & Delivery Updates
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Payment confirmations and shipment progress</p>
                  </div>
                  <Switch
                    checked={prefs.order_updates ?? true}
                    onCheckedChange={(val) => handleToggle("order_updates", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      Customer Support Messages
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Real-time answers to product questions</p>
                  </div>
                  <Switch
                    checked={prefs.support_messages ?? true}
                    onCheckedChange={(val) => handleToggle("support_messages", val)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Tag className="w-4 h-4 text-purple-600" />
                      Promotions & Arrivals
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Discounts and seasonal phone arrivals</p>
                  </div>
                  <Switch
                    checked={prefs.promotional_updates ?? false}
                    onCheckedChange={(val) => handleToggle("promotional_updates", val)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-coral-600 hover:bg-coral-700 text-white"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
