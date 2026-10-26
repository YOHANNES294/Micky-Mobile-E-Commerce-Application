"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
    MessageSquare, User, Send, ChevronLeft, Smartphone, Bell, 
    AlertCircle, RefreshCw, CheckCircle2, Clock, Tag, ExternalLink,
    Check, Filter, Volume2, VolumeX, Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { NotificationPreferencesModal } from "@/components/notifications/notification-preferences-modal"
import { displayLocalBrowserNotification, enablePushNotifications } from "@/lib/notifications/web-push-client"

export function AdminChatManager() {
    const [chats, setChats] = useState<any[]>([])
    const [selectedChat, setSelectedChat] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set())
    const [unreadCountsMap, setUnreadCountsMap] = useState<Record<string, number>>({})
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [showPreferences, setShowPreferences] = useState(false)
    const [adminId, setAdminId] = useState<string | null>(null)
    const [role, setRole] = useState<string | null>(null)
    const [dbError, setDbError] = useState<string | null>(null)
    const [filterTab, setFilterTab] = useState<"all" | "inquiries" | "open" | "resolved">("all")
    const scrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const isNearBottomRef = useRef<boolean>(true)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const supabase = createClient()

    useEffect(() => {
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
    }, [])

    const handleToggleBrowserNotifs = async () => {
        const res = await enablePushNotifications()
        if (res.granted) {
            toast.success("Desktop alerts enabled", { description: "You will receive desktop alerts for incoming customer inquiries." })
        } else {
            toast.info("Browser notifications disabled", { description: "You can enable notifications in browser permissions." })
        }
    }

    const fetchChats = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.log("DEBUG: No authenticated user found in AdminChatManager")
            return
        }
        setAdminId(user.id)

        // Check if this user is an admin in user_profiles, fallback to users view
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle()

        let currentRole = profile?.role
        if (!currentRole) {
            const { data: viewUser } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .maybeSingle()
            currentRole = viewUser?.role
        }

        setRole(currentRole || "none")
        console.log("DEBUG: Admin session user:", user.email, "Role in DB:", currentRole || "NONE")

        // Fetch all chats
        const { data: rawChats, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .order("updated_at", { ascending: false })

        if (chatError) {
            console.error("DEBUG: Admin fetchChats Error:", JSON.stringify(chatError, null, 2))
            setDbError(chatError.message)
            return
        }
        setDbError(null)

        if (!rawChats || rawChats.length === 0) {
            setChats([])
            return
        }

        // Resiliently fetch emails from user_profiles
        const clientIds = Array.from(new Set(rawChats.map((c: any) => c.client_id).filter(Boolean)))
        const profilesMap: Record<string, string> = {}
        if (clientIds.length > 0) {
            const { data: profiles } = await supabase
                .from("user_profiles")
                .select("id, email")
                .in("id", clientIds)

            if (profiles) {
                profiles.forEach((p: any) => { profilesMap[p.id] = p.email })
            }
        }

        // Fetch phones for chats that have phone_id but no product_snapshot
        const phoneIds = Array.from(new Set(rawChats.map((c: any) => c.phone_id).filter(Boolean)))
        const phonesMap: Record<string, any> = {}
        if (phoneIds.length > 0) {
            try {
                const { data: phones } = await supabase
                    .from("phones")
                    .select("id, brand, model, price, image_url, condition, ram, storage")
                    .in("id", phoneIds)

                if (phones) {
                    phones.forEach((p: any) => { phonesMap[p.id] = p })
                }
            } catch (e) {
                console.warn("Could not fetch phones table for chats:", e)
            }
        }

        // Fetch latest messages and persistent unread counts
        const chatIds = rawChats.map((c: any) => c.id)
        const latestMsgMap: Record<string, any> = {}
        const unreadSet = new Set<string>()
        const countsMap: Record<string, number> = {}

        try {
            let { data: msgs, error: msgErr } = await supabase
                .from("messages")
                .select("id, chat_id, content, created_at, sender_id, is_read")
                .in("chat_id", chatIds)
                .order("created_at", { ascending: true })

            if (msgErr && msgErr.message && msgErr.message.includes("is_read")) {
                const fallback = await supabase
                    .from("messages")
                    .select("id, chat_id, content, created_at, sender_id")
                    .in("chat_id", chatIds)
                    .order("created_at", { ascending: true })
                msgs = fallback.data as any
            }

            if (msgs) {
                msgs.forEach((m: any) => {
                    latestMsgMap[m.chat_id] = m
                    const isFromClient = m.sender_id !== user.id
                    const isUnread = m.is_read === false || m.is_read === null
                    if (isFromClient && isUnread && (!selectedChat || m.chat_id !== selectedChat.id)) {
                        unreadSet.add(m.chat_id)
                        countsMap[m.chat_id] = (countsMap[m.chat_id] || 0) + 1
                    }
                })
            }
        } catch (e) {
            console.warn("Could not fetch messages metadata:", e)
        }

        setUnreadChats(unreadSet)
        setUnreadCountsMap(countsMap)

        const formattedChats = rawChats.map((c: any) => {
            const product = c.product_snapshot || phonesMap[c.phone_id] || null
            return {
                ...c,
                status: c.status || "open",
                product,
                latestMessage: latestMsgMap[c.id] || null,
                users: { email: profilesMap[c.client_id] || null }
            }
        })

        setChats(formattedChats)
        if (selectedChat) {
            const updatedSelected = formattedChats.find((c: any) => c.id === selectedChat.id)
            if (updatedSelected) setSelectedChat(updatedSelected)
        }
    }

    useEffect(() => {
        fetchChats()

        const chatChannel = supabase
            .channel('admin_chats_list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, () => fetchChats())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, () => fetchChats())
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload: any) => {
                    fetchChats()
                    if (payload.new.sender_id !== adminId) {
                        if (selectedChat?.id === payload.new.chat_id) {
                            supabase
                                .from("messages")
                                .update({ is_read: true })
                                .eq("id", payload.new.id)
                                .then(() => {})
                        } else {
                            setUnreadChats(prev => new Set(prev).add(payload.new.chat_id))
                            setUnreadCountsMap(prev => ({
                                ...prev,
                                [payload.new.chat_id]: (prev[payload.new.chat_id] || 0) + 1
                            }))
                            if (soundEnabled && audioRef.current) {
                                audioRef.current.play().catch(() => {})
                            }
                            displayLocalBrowserNotification("New Customer Inquiry", {
                                body: payload.new.content,
                                data: { url: "/admin" }
                            })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(chatChannel)
        }
    }, [adminId, selectedChat?.id])

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat.id)

            const channel = supabase
                .channel(`admin_chat:${selectedChat.id}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChat.id}` },
                    (payload: any) => {
                        setMessages((prev) => {
                            if (prev.find(m => m.id === payload.new.id)) return prev
                            return [...prev, payload.new]
                        })
                    }
                )
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }
    }, [selectedChat?.id])

    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        // If within 70px of the bottom, keep auto-scroll active
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 70
        isNearBottomRef.current = isNearBottom
    }

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior
            })
        }
    }

    // Scroll to bottom and refocus when opening/switching chats
    useEffect(() => {
        isNearBottomRef.current = true
        scrollToBottom("auto")
        if (selectedChat) {
            setTimeout(() => {
                textareaRef.current?.focus()
            }, 100)
        }
    }, [selectedChat?.id])

    // Auto-scroll when new messages arrive (unless admin is reading older messages)
    useEffect(() => {
        if (!scrollRef.current || messages.length === 0) return
        const lastMsg = messages[messages.length - 1]
        const isOwn = lastMsg?.sender_id === adminId

        if (isOwn || isNearBottomRef.current) {
            scrollToBottom(isOwn ? "smooth" : "auto")
        }
    }, [messages, adminId])

    // Adjust textarea height up to 140px dynamically
    const adjustTextareaHeight = () => {
        if (!textareaRef.current) return
        textareaRef.current.style.height = "auto"
        const nextHeight = Math.min(textareaRef.current.scrollHeight, 140)
        textareaRef.current.style.height = `${Math.max(nextHeight, 40)}px`
    }

    useEffect(() => {
        adjustTextareaHeight()
    }, [input])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (!loading && input.trim()) {
                handleSend()
            }
        }
    }

    const fetchMessages = async (chatId: string) => {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })

        if (error) {
            console.error("DEBUG: Admin fetchMessages Error:", JSON.stringify(error, null, 2))
        }
        if (data) setMessages(data)
    }

    const handleSend = async () => {
        const textToSend = input.trim()
        if (!textToSend || !selectedChat || !adminId || loading) return
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from("messages")
                .insert({
                    chat_id: selectedChat.id,
                    sender_id: adminId,
                    content: textToSend
                })
                .select()
                .single()

            if (error) throw error
            setMessages(prev => [...prev, data])

            // Update chat updated_at
            await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id)

            // Trigger notification to customer (in-app, push, and email if enabled)
            fetch("/api/notifications/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientId: selectedChat.client_id,
                    title: "Reply from Micky Mobile Support",
                    message: textToSend,
                    category: "messages",
                    targetType: "chat",
                    targetId: selectedChat.id,
                    emailDetails: {
                        customerEmail: selectedChat.users?.email || "",
                        customerName: selectedChat.users?.email?.split("@")[0] || "Customer",
                        replyContent: textToSend,
                        phoneInfo: selectedChat.product ? `${selectedChat.product.brand} ${selectedChat.product.model}` : undefined,
                    },
                }),
            }).catch(() => {})

            setInput("")
            if (textareaRef.current) {
                textareaRef.current.style.height = "40px"
                textareaRef.current.focus()
            }
            isNearBottomRef.current = true
            setTimeout(() => scrollToBottom("smooth"), 50)
        } catch (error: any) {
            console.error("DEBUG: Admin Chat Error:", error)
            toast.error(error?.message || "Failed to send message.")
        } finally {
            setLoading(false)
        }
    }

    const toggleChatStatus = async (chatId: string, currentStatus: string) => {
        const newStatus = currentStatus === "resolved" ? "open" : "resolved"
        try {
            const { error } = await supabase
                .from("chats")
                .update({ status: newStatus })
                .eq("id", chatId)

            if (error) throw error

            setSelectedChat((prev: any) => prev?.id === chatId ? { ...prev, status: newStatus } : prev)
            setChats((prev) => prev.map(c => c.id === chatId ? { ...c, status: newStatus } : c))
            toast.success(`Inquiry marked as ${newStatus}`)
        } catch (err: any) {
            // If status column does not exist yet, fallback gracefully
            setSelectedChat((prev: any) => prev?.id === chatId ? { ...prev, status: newStatus } : prev)
            setChats((prev) => prev.map(c => c.id === chatId ? { ...c, status: newStatus } : c))
            toast.info(`Updated status to ${newStatus}`)
        }
    }

    const filteredChats = chats.filter((c) => {
        if (filterTab === "inquiries") return Boolean(c.product || c.phone_id)
        if (filterTab === "open") return (c.status || "open") === "open"
        if (filterTab === "resolved") return c.status === "resolved"
        return true
    })

    return (
        <div className="flex flex-col h-full gap-4">
            {dbError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-5 rounded-xl text-red-900 dark:text-red-300 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span>Database Setup Required</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => fetchChats()} className="gap-1.5 h-8">
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </Button>
                    </div>
                    <p className="text-sm">
                        The live chat database tables are not set up yet in your Supabase project (<code>{dbError}</code>).
                    </p>
                    <div className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto space-y-1">
                        <p className="text-slate-400">Please execute this script in Supabase SQL Editor:</p>
                        <code className="text-amber-300 font-mono">scripts/009_create_chat_and_sales_tables.sql</code>
                    </div>
                </div>
            )}

            {(!role || role !== 'admin') && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-6 rounded-xl text-amber-900 dark:text-amber-400 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Badge variant="destructive" className="animate-pulse">Access blocked</Badge>
                        <span className="font-semibold">
                            {role === 'none'
                                ? "Database Error: Your account has no user record in the 'public.user_profiles' table."
                                : "Permission Error: Your account role is set to 'client' (expected 'admin')."}
                        </span>
                    </div>
                    <div className="text-xs bg-white/50 dark:bg-black/20 p-4 rounded border border-amber-200/50 space-y-2">
                        <p>To fix this, please run this command in your <strong>Supabase SQL Editor</strong>:</p>
                        <pre className="bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto">
                            {`INSERT INTO public.user_profiles (id, email, role)
VALUES ('${adminId}', 'yohannesm294@gmail.com', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';`}
                        </pre>
                        <p className="opacity-70 italic">Note: Replace email with your actual admin email if different.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-210px)] min-h-[520px] max-h-[720px] border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm border-coral-100 dark:border-slate-800">
                {/* Sidebar - Chat List & Customer Inquiries */}
                <div className={cn(
                    "border-r border-coral-100 dark:border-slate-800 flex flex-col h-full min-h-0 overflow-hidden",
                    selectedChat ? "hidden md:flex" : "flex"
                )}>
                    {/* Header */}
                    <div className="p-4 border-b bg-coral-50/50 dark:bg-slate-800/50 space-y-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4 text-coral-600" />
                                Customer Inquiries & Messages
                            </h3>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-coral-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleToggleBrowserNotifs}
                                    title="Desktop alert permissions"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowPreferences(true)}
                                    title="Configure inquiry email alerts"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => fetchChats()} title="Refresh list" className="h-7 w-7">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 p-1 rounded-lg border text-xs">
                            <button
                                onClick={() => setFilterTab("all")}
                                className={cn(
                                    "flex-1 py-1 px-2 rounded font-medium transition-colors",
                                    filterTab === "all" ? "bg-coral-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                All ({chats.length})
                            </button>
                            <button
                                onClick={() => setFilterTab("inquiries")}
                                className={cn(
                                    "flex-1 py-1 px-2 rounded font-medium transition-colors",
                                    filterTab === "inquiries" ? "bg-coral-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Phones
                            </button>
                            <button
                                onClick={() => setFilterTab("open")}
                                className={cn(
                                    "flex-1 py-1 px-2 rounded font-medium transition-colors",
                                    filterTab === "open" ? "bg-coral-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Open
                            </button>
                            <button
                                onClick={() => setFilterTab("resolved")}
                                className={cn(
                                    "flex-1 py-1 px-2 rounded font-medium transition-colors",
                                    filterTab === "resolved" ? "bg-coral-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Resolved
                            </button>
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {filteredChats.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No conversations found.
                            </div>
                        ) : (
                            filteredChats.map((chat) => {
                                const hasPhone = Boolean(chat.product)
                                const unreadCount = unreadCountsMap[chat.id] || 0
                                const isUnread = unreadCount > 0 || unreadChats.has(chat.id)
                                const isResolved = chat.status === "resolved"

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => {
                                            setSelectedChat(chat)
                                            if (adminId) {
                                                supabase
                                                    .from("messages")
                                                    .update({ is_read: true })
                                                    .eq("chat_id", chat.id)
                                                    .neq("sender_id", adminId)
                                                    .eq("is_read", false)
                                                    .then(() => {})
                                            }
                                            setUnreadCountsMap(prev => ({ ...prev, [chat.id]: 0 }))
                                            setUnreadChats(prev => {
                                                const next = new Set(prev)
                                                next.delete(chat.id)
                                                return next
                                            })
                                        }}
                                        className={cn(
                                            "w-full p-3.5 flex items-start gap-3 border-b hover:bg-coral-50/40 transition-colors text-left relative",
                                            selectedChat?.id === chat.id ? "bg-coral-50/70 dark:bg-coral-950/20" : ""
                                        )}
                                    >
                                        {/* Avatar / Product Thumbnail */}
                                        <div className="relative shrink-0">
                                            {hasPhone && chat.product?.image_url ? (
                                                <div className="w-11 h-11 rounded-lg border bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center p-0.5">
                                                    <img 
                                                        src={chat.product.image_url} 
                                                        alt={chat.product.model || "Phone"} 
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-11 h-11 rounded-full bg-coral-100 dark:bg-coral-900/50 flex items-center justify-center text-coral-600">
                                                    <User className="w-5 h-5" />
                                                </div>
                                            )}
                                            {isUnread && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <p className="font-semibold text-xs text-foreground truncate">
                                                    {chat.users?.email || `Customer ${chat.client_id.slice(0, 6)}`}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {chat.latestMessage 
                                                        ? new Date(chat.latestMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {/* Product preview line if inquiry */}
                                            {hasPhone && (
                                                <div className="flex items-center gap-1.5 my-0.5">
                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-coral-200 text-coral-700 bg-coral-50 dark:bg-coral-950/40">
                                                        <Smartphone className="w-2.5 h-2.5 mr-1" />
                                                        {chat.product.model || chat.product.brand || "Phone"}
                                                    </Badge>
                                                    {chat.product.price && (
                                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                                            {Number(chat.product.price).toLocaleString()} ETB
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Latest Message preview */}
                                            <p className="text-xs text-muted-foreground truncate">
                                                {chat.latestMessage?.content || "Click to open conversation..."}
                                            </p>

                                            {/* Status & Unread Badge */}
                                            <div className="flex items-center justify-between mt-1">
                                                <span className={cn(
                                                    "text-[9px] font-medium px-1.5 py-0.2 rounded-full",
                                                    isResolved
                                                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                                )}>
                                                    {isResolved ? "Resolved" : "Open Inquiry"}
                                                </span>

                                                {unreadCount > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500 text-white animate-in zoom-in-75 shadow-xs">
                                                        {unreadCount} new
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Main - Message Area */}
                <div className={cn(
                    "col-span-1 md:col-span-2 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/40",
                    !selectedChat ? "hidden md:flex" : "flex"
                )}>
                    {selectedChat ? (
                        <>
                            {/* Selected Chat Header */}
                            <div className="p-3.5 border-b bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-xs shrink-0 z-10">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="md:hidden h-8 w-8"
                                        onClick={() => setSelectedChat(null)}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    <div className="w-9 h-9 rounded-full bg-coral-100 dark:bg-coral-950 flex items-center justify-center text-coral-600 shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm truncate">
                                                {selectedChat.users?.email || `Customer ${selectedChat.client_id.slice(0, 8)}`}
                                            </p>
                                            <Badge 
                                                variant="outline" 
                                                className={cn(
                                                    "text-[10px] py-0",
                                                    selectedChat.status === "resolved"
                                                        ? "border-slate-300 text-slate-600"
                                                        : "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                                                )}
                                            >
                                                {selectedChat.status === "resolved" ? "Resolved" : "Open"}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            Customer ID: <code className="font-mono text-[9px]">{selectedChat.client_id}</code>
                                        </p>
                                    </div>
                                </div>

                                {/* Status Toggle Action */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant={selectedChat.status === "resolved" ? "outline" : "secondary"}
                                        onClick={() => toggleChatStatus(selectedChat.id, selectedChat.status)}
                                        className="h-8 text-xs gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        {selectedChat.status === "resolved" ? "Reopen Inquiry" : "Mark as Resolved"}
                                    </Button>
                                </div>
                            </div>

                            {/* Product Context Banner (Feature Requirement) */}
                            {selectedChat.product && (
                                <div className="p-3 bg-gradient-to-r from-coral-50/90 to-amber-50/90 dark:from-coral-950/30 dark:to-amber-950/20 border-b border-coral-100 dark:border-coral-900/30 flex items-center gap-3 shrink-0 z-10">
                                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-lg border border-coral-200/60 p-1 flex items-center justify-center shrink-0 shadow-xs">
                                        {selectedChat.product.image_url ? (
                                            <img
                                                src={selectedChat.product.image_url}
                                                alt={selectedChat.product.model}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <Smartphone className="w-7 h-7 text-coral-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-xs text-foreground truncate">
                                                {selectedChat.product.brand} {selectedChat.product.model}
                                            </h4>
                                            <Badge className="text-[9px] py-0 px-1.5 bg-coral-600 text-white">
                                                {selectedChat.product.condition === "used" ? "USED" : "NEW"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                                            <span className="font-bold text-coral-700 dark:text-coral-400">
                                                {Number(selectedChat.product.price).toLocaleString()} ETB
                                            </span>
                                            {selectedChat.product.storage && (
                                                <span>• {selectedChat.product.storage} / {selectedChat.product.ram || "RAM"}</span>
                                            )}
                                            <span className="font-mono text-[10px] text-slate-400">
                                                ID: {selectedChat.product.id?.slice(0, 8)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Messages */}
                            <div 
                                ref={scrollRef} 
                                onScroll={handleScroll}
                                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
                            >
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                                        <div className="w-12 h-12 rounded-full bg-coral-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                                            <MessageSquare className="w-6 h-6 text-coral-500" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">No messages yet</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Type your reply below to start assisting the customer.</p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isSystem = msg.sender_id === "system"
                                        const isOwn = msg.sender_id === adminId
                                        return (
                                            <div key={msg.id || i} className={cn("flex flex-col group", isOwn ? "items-end" : "items-start")}>
                                                <div
                                                    className={cn(
                                                        "max-w-[85%] md:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm shadow-xs whitespace-pre-wrap break-words leading-relaxed transition-all",
                                                        isOwn
                                                            ? "bg-amber-500 text-slate-950 font-medium rounded-tr-xs shadow-amber-500/10"
                                                            : isSystem
                                                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 italic text-xs rounded-xl"
                                                                : "bg-white dark:bg-slate-800 border rounded-tl-xs border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100"
                                                    )}
                                                >
                                                    {msg.content}
                                                </div>
                                                <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground mt-1 px-1", isOwn ? "justify-end" : "justify-start")}>
                                                    <span>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isOwn && <Check className="w-3 h-3 text-slate-700 dark:text-slate-400 inline" />}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Footer / Reply Input (Telegram style) */}
                            <div className="p-3 border-t bg-white dark:bg-slate-900 shrink-0 z-10">
                                <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-1.5 focus-within:ring-2 focus-within:ring-coral-500/30 focus-within:border-coral-500 transition-all">
                                    <textarea
                                        ref={textareaRef}
                                        placeholder="Type your reply to customer... (Enter to send, Shift+Enter for new line)"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={loading}
                                        rows={1}
                                        className="flex-1 bg-transparent border-0 resize-none outline-none text-sm p-2 max-h-[140px] min-h-[38px] text-foreground placeholder:text-muted-foreground overflow-y-auto leading-relaxed"
                                    />
                                    <Button 
                                        size="icon" 
                                        onClick={handleSend} 
                                        disabled={loading || !input.trim()} 
                                        className={cn(
                                            "bg-coral-600 hover:bg-coral-700 text-white shrink-0 h-9 w-9 rounded-xl shadow-xs transition-transform active:scale-95 mb-0.5",
                                            !input.trim() ? "opacity-50 cursor-not-allowed" : "opacity-100"
                                        )}
                                        title="Send message (Enter)"
                                    >
                                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-1.5 select-none">
                                    <span className="flex items-center gap-1.5">
                                        <span>Press</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[10px] font-mono">Enter ↵</kbd>
                                        <span>to send,</span>
                                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[10px] font-mono">Shift + Enter</kbd>
                                        <span>for new line</span>
                                    </span>
                                    {input.length > 0 && <span className="text-[10px] tabular-nums font-mono">{input.length} chars</span>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                            <div className="w-16 h-16 bg-coral-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-coral-400" />
                            </div>
                            <p className="font-semibold text-foreground">Select a conversation or phone inquiry</p>
                            <p className="text-xs text-muted-foreground max-w-xs mt-1">
                                Click on any inquiry in the sidebar to review the customer's question and phone details, and send an instant reply.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <NotificationPreferencesModal
                open={showPreferences}
                onOpenChange={setShowPreferences}
            />
        </div>
    )
}
