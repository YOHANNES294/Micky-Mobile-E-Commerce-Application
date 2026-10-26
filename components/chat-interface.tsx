"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, Send, X, Smartphone, User, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandTitle } from "@/components/brand-title"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Message, Chat } from "@/lib/types"

export function ChatButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<any[]>([])
    const [input, setInput] = useState("")
    const [userId, setUserId] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [hasUnread, setHasUnread] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get user and existing chat
    useEffect(() => {
        const initChat = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)
            setUserEmail(user.email || null)

            // Get or create chat
            const { data: existingChat } = await supabase
                .from("chats")
                .select("id")
                .eq("client_id", user.id)
                .maybeSingle()

            if (existingChat) {
                setChatId(existingChat.id)
                // Fetch existing messages
                const { data: msgData } = await supabase
                    .from("messages")
                    .select("*")
                    .eq("chat_id", existingChat.id)
                    .order("created_at", { ascending: true })

                if (msgData) setMessages(msgData)
            } else {
                // Initial greeting for new users
                setMessages([
                    {
                        sender_id: "system",
                        content: "Selam! How can we help you today? ሰላም! ምን እንርዳዎት?",
                        created_at: new Date().toISOString()
                    }
                ])
            }
        }

        initChat()
    }, [])

    // Real-time subscription
    useEffect(() => {
        if (!chatId) return

        const channel = supabase
            .channel(`chat:${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                (payload: any) => {
                    setMessages((prev) => {
                        // Avoid duplicate if we just sent it
                        if (prev.find(m => m.id === payload.new.id)) return prev

                        // If chat is closed and message is from admin, show red dot
                        if (!isOpen && payload.new.sender_id !== userId) {
                            setHasUnread(true)
                        }

                        return [...prev, payload.new]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [chatId, isOpen, userId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async (content: string = input) => {
        const messageText = content.trim()
        if (!messageText || loading) return

        if (!userId) {
            toast.error("Please log in to chat with support.")
            return
        }

        setLoading(true)
        let currentChatId = chatId

        try {
            // 0. Ensure user profile exists (it might be missing for old accounts)
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("id, role")
                .eq("id", userId)
                .maybeSingle()

            if (!profile) {
                const { data: { user } } = await supabase.auth.getUser()
                const { error: insError } = await supabase.from("user_profiles").insert({
                    id: userId,
                    email: user?.email || "unknown@example.com",
                    role: "client"
                })

                if (insError) {
                    console.error("DEBUG: Profile creation failed:", insError)
                    throw insError
                }
            }

            // 1. Create chat if it doesn't exist
            if (!currentChatId) {
                const { data: newChat, error: chatError } = await supabase
                    .from("chats")
                    .insert({ client_id: userId })
                    .select()
                    .single()

                if (chatError) {
                    console.error("DEBUG: Chat creation error:", chatError)
                    throw chatError
                }
                currentChatId = newChat.id
                setChatId(newChat.id)
            }

            // 2. Insert message
            const { data: newMessage, error: msgError } = await supabase
                .from("messages")
                .insert({
                    chat_id: currentChatId,
                    sender_id: userId,
                    content: messageText
                })
                .select()
                .single()

            if (msgError) {
                console.error("Message insertion error:", msgError)
                throw msgError
            }

            // 3. Update chat updated_at
            await supabase
                .from("chats")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", currentChatId)

            // Trigger notification to admin
            fetch("/api/notifications/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientId: "admin",
                    title: "New Customer Inquiry",
                    message: messageText,
                    category: "messages",
                    targetType: "chat",
                    targetId: currentChatId,
                    emailDetails: {
                        customerEmail: userEmail || "customer@micky.et",
                    },
                }),
            }).catch(() => {})

            // Update local state
            setMessages(prev => [...prev, newMessage])
            setInput("")
        } catch (error: any) {
            console.error("DEBUG: Chat Error:", error)
            toast.error(error?.message || "Failed to send message. Please ensure chat tables are created.")
        } finally {
            setLoading(false)
        }
    }

    const presets = ["Is this available?", "Price? ዋጋ ስንት ነው?", "Where is your shop? ሱቃችሁ የት ነው?"]

    return (
        <>
            {/* Floating Button */}
            <Button
                onClick={() => {
                    setIsOpen(!isOpen)
                    if (!isOpen) setHasUnread(false)
                }}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 z-50 p-0"
            >
                {isOpen ? <X className="w-6 h-6" /> : (
                    <div className="relative">
                        <MessageSquare className="w-6 h-6" />
                        {hasUnread && (
                            <span className="absolute -top-2 -right-2 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                            </span>
                        )}
                    </div>
                )}
            </Button>

            {/* Chat Window */}
            {isOpen && (
                <Card className="fixed bottom-24 right-6 w-[350px] sm:w-[400px] h-[500px] flex flex-col shadow-2xl z-50 border-coral-100 overflow-hidden animate-in slide-in-from-bottom-5 transition-all">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-coral-600 to-gold-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold">
                                    <BrandTitle suffix=" Support" suffixClassName="text-white" />
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-coral-400 rounded-full animate-pulse" />
                                    <span className="text-[10px] opacity-80 uppercase tracking-wider">Online</span>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                        {!userId && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                                <span>Please log in to chat with support.</span>
                                <Link href="/auth/login" className="font-semibold underline flex items-center gap-1 hover:text-amber-900">
                                    <LogIn className="w-3.5 h-3.5" /> Sign in
                                </Link>
                            </div>
                        )}

                        {messages.map((msg, i) => {
                            const isOwn = msg.sender_id === userId
                            return (
                                <div key={msg.id || i} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                                    <div
                                        className={cn(
                                             "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                                            isOwn
                                                ? "bg-coral-600 text-white rounded-tr-none"
                                                : "bg-white dark:bg-slate-800 text-foreground rounded-tl-none border border-coral-50 dark:border-slate-700"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-white dark:bg-slate-900 space-y-3">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {presets.map((text, i) => (
                                <button
                                    key={i}
                                    disabled={loading || !userId}
                                    onClick={() => handleSend(text)}
                                    className="whitespace-nowrap px-3 py-1 bg-coral-50 dark:bg-coral-950/30 text-coral-700 dark:text-coral-400 text-xs rounded-full border border-coral-100 dark:border-coral-900 hover:bg-coral-100 transition-colors disabled:opacity-50"
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder={userId ? "Type your message... መልእክትዎን እዚህ ይጻፉ..." : "Please sign in to send messages..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                disabled={loading || !userId}
                                className="bg-slate-50 dark:bg-slate-800 border-coral-100"
                            />
                            <Button
                                onClick={() => handleSend()}
                                size="icon"
                                disabled={loading || !input.trim() || !userId}
                                className="bg-coral-600 hover:bg-coral-700 flex-shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </>
    )
}
