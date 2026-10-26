"use client"

import { useState, useEffect } from "react"
import { Bell, CheckCircle2, ShieldCheck, X, Sparkles, Smartphone, MessageSquare, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { enablePushNotifications, getNotificationPermissionState } from "@/lib/notifications/web-push-client"

interface NotificationPermissionPopupProps {
  delayMs?: number
  onPermissionChange?: (granted: boolean) => void
}

const STORAGE_KEY = "micky_notification_prompt_dismissed"
const DONT_ASK_KEY = "micky_notification_dont_ask_again"

export function NotificationPermissionPopup({
  delayMs = 4000,
  onPermissionChange,
}: NotificationPermissionPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // 1. Check if browser already granted or denied
    const permission = getNotificationPermissionState()
    if (permission === "granted" || permission === "denied" || permission === "unsupported") {
      return
    }

    // 2. Check localStorage for "Don't ask me again"
    const permanentlyDismissed = localStorage.getItem(DONT_ASK_KEY) === "true"
    if (permanentlyDismissed) return

    // 3. Check if dismissed recently (e.g. within 3 days)
    const lastDismissed = localStorage.getItem(STORAGE_KEY)
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10)
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        return
      }
    }

    // Delay prompt to respect user experience (after meaningful action or reading time)
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [delayMs])

  const handleEnable = async () => {
    setIsSubmitting(true)
    try {
      const res = await enablePushNotifications()
      if (res.granted) {
        toast.success("Notifications Enabled!", {
          description: "You'll now receive instant order updates and chat replies.",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        })
        onPermissionChange?.(true)
        setIsOpen(false)
      } else if (res.status === "denied") {
        toast.info("Notifications Blocked in Browser", {
          description: "You can enable notifications anytime in your browser site settings.",
        })
        onPermissionChange?.(false)
        setIsOpen(false)
      } else {
        setIsOpen(false)
      }
    } catch {
      toast.error("Could not activate notifications at this time.")
      setIsOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMaybeLater = () => {
    if (dontAskAgain) {
      localStorage.setItem(DONT_ASK_KEY, "true")
      // Also update DB preference if logged in
      fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dont_ask_again: true, push_enabled: false }),
      }).catch(() => {})
    } else {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-coral-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Decorative Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-coral-500 via-amber-500 to-gold-500" />

        {/* Close Button */}
        <button
          onClick={handleMaybeLater}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 text-center space-y-5">
          {/* Branded Bell Illustration */}
          <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-coral-100 to-amber-100 dark:from-coral-950/60 dark:to-amber-950/40 border border-coral-200/60 dark:border-coral-800/40 flex items-center justify-center shadow-inner">
            <Bell className="w-10 h-10 text-coral-600 dark:text-coral-400 animate-bounce" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
              1
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Never Miss an Update!
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get notified about order updates, new phones, special offers, and messages from our team.
            </p>
          </div>

          {/* Value Highlights (AliExpress style) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 text-left text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 p-1">
              <Package className="w-4 h-4 text-coral-600 shrink-0" />
              <span className="font-medium text-[11px] leading-tight">Orders & delivery updates</span>
            </div>
            <div className="flex items-center gap-2 p-1">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium text-[11px] leading-tight">Customer support chat replies</span>
            </div>
            <div className="flex items-center gap-2 p-1">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium text-[11px] leading-tight">New phones & special offers</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={handleEnable}
              disabled={isSubmitting}
              className="w-full h-11 bg-gradient-to-r from-coral-600 to-amber-600 hover:from-coral-700 hover:to-amber-700 text-white font-bold rounded-xl shadow-md transition-transform active:scale-98"
            >
              {isSubmitting ? "Activating..." : "Enable Notifications"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleMaybeLater}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Maybe Later
            </Button>
          </div>

          {/* Preference Checkbox */}
          <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground select-none">
            <Checkbox
              id="dont-ask"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label htmlFor="dont-ask" className="cursor-pointer hover:text-foreground">
              Don't ask me again
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
