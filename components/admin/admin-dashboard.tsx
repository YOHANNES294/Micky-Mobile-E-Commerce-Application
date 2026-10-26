"use client"

import { useState, useEffect, useRef } from "react"
import type { Phone } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, BarChart3, LogOut, Smartphone, Users, MessageSquare, Bell, ShoppingBag } from "lucide-react"
import { PhoneManagement } from "@/components/admin/phone-management"
import { AddPhoneDialog } from "@/components/admin/add-phone-dialog"
import { BrandTitle } from "@/components/brand-title"
import { UserManagementDialog } from "@/components/admin/user-management-dialog"
import { AdminChatManager } from "@/components/admin/admin-chat-manager"
import { AdminOrdersManager } from "@/components/admin/admin-orders-manager"
import { NotificationCenter } from "@/components/notifications/notification-center"
import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { logout } from "@/app/actions/auth-actions"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AdminDashboardProps {
  initialPhones: Phone[]
  userEmail: string
}

export function AdminDashboard({ initialPhones, userEmail }: AdminDashboardProps) {
  const [phones, setPhones] = useState<Phone[]>(initialPhones)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const [adminId, setAdminId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Background listener for notifications
    const setupAndSubscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setAdminId(user.id)

      const channel = supabase
        .channel('dashboard_notifications_global')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload: any) => {
            // Fresh check for current user to avoid closure issues
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const myId = currentUser?.id || adminId

            if (payload.new.sender_id !== myId) {
              setHasUnreadMessages(true)
              toast("New Message", {
                description: payload.new.content,
                icon: <Bell className="w-4 h-4 text-coral-500" />,
              })

              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3")
              audio.play().catch(() => { })
            }
          }
        )
        .subscribe()

      return channel
    }

    const channelPromise = setupAndSubscribe()

    return () => {
      channelPromise.then(channel => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [adminId])

  const handlePhoneAdded = (newPhone: Phone) => {
    setPhones([newPhone, ...phones])
    setShowAddDialog(false)
  }

  const handlePhoneUpdated = (updatedPhone: Phone) => {
    setPhones(phones.map((p) => (p.id === updatedPhone.id ? updatedPhone : p)))
  }

  const handlePhoneDeleted = (phoneId: string) => {
    setPhones(phones.filter((p) => p.id !== phoneId))
  }

  const samsungPhones = phones.filter((p) => p.brand === "Samsung")
  const iphonePhones = phones.filter((p) => p.brand === "iPhone")

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-gold-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-coral-100 dark:border-slate-800 shadow-sm sticky top-0 z-50 transition-colors duration-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/miko.png"
              alt="Micky Mobile Logo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold">
                <BrandTitle suffix=" Admin" suffixClassName="text-coral-700" />
              </h1>
              <p className="text-xs text-muted-foreground">Inventory Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>

            {/* Notification Center */}
            <NotificationCenter isAdmin />

            {/* Top Bar Chat Icon */}
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setActiveTab("chats")
                  setHasUnreadMessages(false)
                }}
                className={cn(
                  "border-coral-200 hover:bg-coral-50 bg-transparent transition-all",
                  activeTab === "chats" ? "bg-coral-50 border-coral-400" : ""
                )}
              >
                <MessageSquare className="w-5 h-5 text-coral-600" />
              </Button>
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                </span>
              )}
            </div>

            <Link href="/client">
              <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent text-coral-700">
                <Smartphone className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Store View</span>
              </Button>
            </Link>

            <form action={logout}>
              <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </form>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h2>
            <p className="text-muted-foreground">Manage your inventory, customers, and real-time chats</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/reports">
              <Button variant="outline" className="border-coral-200 hover:bg-coral-50 bg-transparent">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Reports
              </Button>
            </Link>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Phone
            </Button>
            <Button
              onClick={() => setShowUserDialog(true)}
              className="bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white"
            >
              <Users className="w-4 h-4 mr-2" />
              User Management
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Phones</p>
                <p className="text-3xl font-bold text-foreground">{phones.length}</p>
              </div>
              <div className="w-12 h-12 bg-coral-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-coral-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Samsung Phones</p>
                <p className="text-3xl font-bold text-foreground">{samsungPhones.length}</p>
              </div>
              <div className="w-12 h-12 bg-gold-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-gold-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">iPhone Phones</p>
                <p className="text-3xl font-bold text-foreground">{iphonePhones.length}</p>
              </div>
              <div className="w-12 h-12 bg-coral-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-coral-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-5 h-12 mb-6 bg-white dark:bg-slate-900 border border-coral-100 dark:border-slate-800">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold flex-1"
            >
              Inventory ({phones.length})
            </TabsTrigger>
            <TabsTrigger
              value="samsung"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold flex-1"
            >
              Samsung ({samsungPhones.length})
            </TabsTrigger>
            <TabsTrigger
              value="iphone"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold flex-1"
            >
              iPhone ({iphonePhones.length})
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold flex-1"
            >
              <ShoppingBag className="w-4 h-4 mr-1.5" />
              Orders
            </TabsTrigger>
            <TabsTrigger
              value="chats"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral-600 data-[state=active]:to-gold-600 data-[state=active]:text-white font-semibold flex-1 relative"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Inquiries
              {hasUnreadMessages && (
                <span className="w-2 h-2 rounded-full bg-red-500 ml-1.5 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <PhoneManagement phones={phones} onPhoneUpdated={handlePhoneUpdated} onPhoneDeleted={handlePhoneDeleted} />
          </TabsContent>

          <TabsContent value="samsung">
            <PhoneManagement
              phones={samsungPhones}
              onPhoneUpdated={handlePhoneUpdated}
              onPhoneDeleted={handlePhoneDeleted}
            />
          </TabsContent>

          <TabsContent value="iphone">
            <PhoneManagement
              phones={iphonePhones}
              onPhoneUpdated={handlePhoneUpdated}
              onPhoneDeleted={handlePhoneDeleted}
            />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersManager />
          </TabsContent>

          <TabsContent value="chats">
            <AdminChatManager />
          </TabsContent>
        </Tabs>
      </main>

      <AddPhoneDialog open={showAddDialog} onOpenChange={setShowAddDialog} onPhoneAdded={handlePhoneAdded} />
      <UserManagementDialog open={showUserDialog} onOpenChange={setShowUserDialog} />
    </div>
  )
}
