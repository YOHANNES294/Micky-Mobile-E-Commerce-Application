import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PhoneTabs } from "@/components/phone-tabs"
import { BrandTitle } from "@/components/brand-title"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { logout } from "@/app/actions/auth-actions"
import { Phone, MapPin, LogOut, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { ChatButton } from "@/components/chat-interface"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { NotificationPermissionPopup } from "@/components/notifications/permission-popup"

export default async function ClientPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user profile role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const isAdmin = profile?.role === "admin"

  // Fetch all phones
  const { data: phones } = await supabase.from("phones").select("*").order("created_at", { ascending: false })

  // Separate Samsung and iPhone
  const samsungPhones = phones?.filter((phone) => phone.brand === "Samsung") || []
  const iphonePhones = phones?.filter((phone) => phone.brand === "iPhone") || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-gold-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-coral-100 dark:border-slate-800 shadow-sm sticky top-0 z-50 transition-colors duration-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src="/miko.png"
                alt="Micky Mobile Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                <BrandTitle />
              </h1>
              <p className="text-xs text-muted-foreground">Ethiopia's Trusted Phone Store</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "Administrator" : "Client Account"}</p>
            </div>
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent text-coral-700">
                  Admin Panel
                </Button>
              </Link>
            )}
            <NotificationCenter />
            <Link href="/client/orders">
              <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent">
                <ShoppingBag className="w-4 h-4 mr-2 text-coral-600" />
                My Orders
              </Button>
            </Link>
            <form action={logout}>
              <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </form>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">Browse Our Collection</h2>
          <p className="text-muted-foreground">Choose from premium Samsung and iPhone devices</p>
        </div>

        <PhoneTabs samsungPhones={samsungPhones} iphonePhones={iphonePhones} />

        <div className="mt-16 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Visit Our Store</h2>
            <p className="text-muted-foreground">Come see us at Alemenesh Plaza, Bole Medhanialem</p>
          </div>

          <div className="w-full h-[400px] bg-white rounded-xl shadow-lg border border-coral-100 overflow-hidden relative mt-8">
            <div className="absolute top-4 left-4 z-10 bg-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
              <MapPin className="w-5 h-5 text-coral-600" />
              <span className="font-semibold text-gray-800">Our Location: Alemnesh Plaza, Bole Medhanialem</span>
            </div>

            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.602304456789!2d38.783737315322!3d8.995485493566!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOMKwNTknNDMuOCJOIDM4wrA0NycwOS40IkU!5e0!3m2!1sen!2set!4v1739999999999"
            ></iframe>
          </div>
        </div>
      </main>

      {/* Chat UI */}
      <ChatButton />

      {/* AliExpress-Style Notification Permission Prompt */}
      <NotificationPermissionPopup delayMs={3500} />
    </div>
  )
}
