"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Bell, Check, CheckCheck, Package, MessageSquare, Smartphone, 
  Tag, ShieldCheck, Settings, ExternalLink, Trash2, Clock 
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { NotificationItem, NotificationCategory } from "@/lib/types"
import { NotificationPreferencesModal } from "./notification-preferences-modal"
import { useRouter } from "next/navigation"

interface NotificationCenterProps {
  isAdmin?: boolean
  className?: string
}

export function NotificationCenter({ isAdmin = false, className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<"all" | NotificationCategory>("all")
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
  }, [])

  // Fetch initial notifications and current user
  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.warn("Could not load notifications:", err)
    }
  }

  useEffect(() => {
    // 1. Get current user
    supabase.auth.getUser().then((res: any) => {
      const user = res?.data?.user
      if (user) {
        setUserId(user.id)
        loadNotifications()

        // Fetch sound preference
        fetch("/api/notifications/preferences")
          .then((r) => r.json())
          .then((p) => {
            if (p.preferences?.sound_enabled !== undefined) {
              setSoundEnabled(p.preferences.sound_enabled)
            }
          })
          .catch(() => {})

        // 2. Realtime listener on notifications table
        const channel = supabase
          .channel(`user-notifications-${user.id}`)
          .on(
            "postgres_changes" as any,
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            (payload: any) => {
              const newNotification = payload.new as NotificationItem
              setNotifications((prev) => [newNotification, ...prev])
              setUnreadCount((c) => c + 1)

              // Play subtle chime if enabled
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch(() => {})
              }

              // Toast preview
              toast(newNotification.title, {
                description: newNotification.message,
                icon: getCategoryIcon(newNotification.category, "w-4 h-4 text-coral-500"),
              })
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      }
    })
  }, [])

  const markAsRead = async (id?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      })

      if (id) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch {
      toast.error("Could not update status")
    }
  }

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markAsRead(item.id)
    }

    setIsOpen(false)

    // Route according to target
    if (item.target_type === "order") {
      if (isAdmin) {
        router.push("/admin")
      } else {
        router.push("/client/orders")
      }
    } else if (item.target_type === "chat") {
      if (isAdmin) {
        router.push("/admin")
      } else {
        router.push("/client")
      }
    } else if (item.target_type === "phone" && item.target_id) {
      router.push(`/client#phone-${item.target_id}`)
    } else if (item.target_id && item.target_id.startsWith("/")) {
      router.push(item.target_id)
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true
    return n.category === filter
  })

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "relative border-coral-200 hover:bg-coral-50 dark:border-slate-800 bg-transparent transition-all",
              className
            )}
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-coral-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white shadow-xs animate-in zoom-in-75">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border-coral-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
        >
          {/* Header */}
          <div className="p-3.5 border-b bg-coral-50/50 dark:bg-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-coral-600" />
                Notifications
              </h3>
              {unreadCount > 0 && (
                <Badge className="bg-coral-600 text-white text-[10px] py-0 px-1.5 h-4">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead()}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-coral-600" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Notification Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Filter Pills (AliExpress style) */}
          <div className="flex items-center gap-1 px-3 py-2 border-b bg-slate-50/60 dark:bg-slate-900/40 text-xs overflow-x-auto no-scrollbar">
            {(["all", "orders", "messages", "products", "promotions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium capitalize shrink-0 transition-colors",
                  filter === tab
                    ? "bg-coral-600 text-white shadow-xs"
                    : "text-muted-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-coral-50 dark:bg-slate-800 mx-auto flex items-center justify-center">
                  <Bell className="w-6 h-6 text-coral-400 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-foreground">No notifications yet</p>
                <p className="text-[11px] text-muted-foreground">
                  {filter === "all"
                    ? "We'll notify you here when you have order updates or messages."
                    : `No ${filter} notifications at this time.`}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "p-3.5 flex items-start gap-3 hover:bg-coral-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative group",
                      !item.is_read ? "bg-coral-50/20 dark:bg-slate-800/30 font-medium" : ""
                    )}
                  >
                    {/* Unread indicator bar */}
                    {!item.is_read && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-coral-600 rounded-r" />
                    )}

                    {/* Category Icon */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                      {getCategoryIcon(item.category, "w-4 h-4")}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={cn("text-xs truncate", !item.is_read ? "font-bold text-foreground" : "text-slate-700 dark:text-slate-300")}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {/* Mark read button */}
                    {!item.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(item.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-coral-600 p-1 transition-opacity shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-slate-50/50 dark:bg-slate-900 text-center">
            <button
              onClick={() => {
                setIsOpen(false)
                setShowSettings(true)
              }}
              className="text-[11px] text-coral-600 hover:text-coral-700 font-semibold"
            >
              Configure Notification Channels →
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <NotificationPreferencesModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  )
}

function getCategoryIcon(category: NotificationCategory, className = "w-4 h-4") {
  switch (category) {
    case "orders":
      return <Package className={cn(className, "text-coral-600")} />
    case "messages":
      return <MessageSquare className={cn(className, "text-amber-600")} />
    case "products":
      return <Smartphone className={cn(className, "text-blue-600")} />
    case "promotions":
      return <Tag className={cn(className, "text-purple-600")} />
    case "account":
    default:
      return <ShieldCheck className={cn(className, "text-emerald-600")} />
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 60) return "Just now"
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 172800) return "Yesterday"
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  } catch {
    return "Recently"
  }
}
