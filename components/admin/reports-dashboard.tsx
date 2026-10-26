"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, TrendingUp, Package, DollarSign, Smartphone } from "lucide-react"
import Link from "next/link"
import type { Phone } from "@/lib/types"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { parsePrice } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"

interface ReportsDashboardProps {
  phones: Phone[]
  sales: any[]
  userEmail: string
}

export function ReportsDashboard({ phones, sales, userEmail }: ReportsDashboardProps) {
  // Calculate total inventory value
  const totalInventoryValue = phones.reduce((sum, phone) => sum + parsePrice(phone.price), 0)

  // Calculate total sales
  const totalSales = sales.reduce((sum, sale) => sum + sale.sold_quantity, 0)

  // Calculate total revenue
  const totalRevenue = sales.reduce((sum, sale) => {
    // If sale has phones info, use it. But changing Phone type affects this.
    // Assuming sale.phones is a partial Phone object with price
    const phonePrice = sale.phones?.price ? parsePrice(sale.phones.price) : 0
    return sum + phonePrice * sale.sold_quantity
  }, 0)

  // Prepare data for brand distribution chart
  const samsungPhones = phones.filter((p) => p.brand === "Samsung")
  const iphonePhones = phones.filter((p) => p.brand === "iPhone")

  const brandData = [
    {
      brand: "Samsung",
      count: samsungPhones.length,
      value: samsungPhones.reduce((sum, p) => sum + parsePrice(p.price), 0),
    },
    {
      brand: "iPhone",
      count: iphonePhones.length,
      value: iphonePhones.reduce((sum, p) => sum + parsePrice(p.price), 0),
    },
  ]

  // Prepare data for top phones by price
  const topPhones = [...phones].sort((a, b) => parsePrice(b.price) - parsePrice(a.price)).slice(0, 5)
  const topPhonesData = topPhones.map((phone) => ({
    name: phone.model.length > 20 ? phone.model.substring(0, 20) + "..." : phone.model,
    price: parsePrice(phone.price),
    brand: phone.brand,
  }))

  // Prepare data for inventory by storage
  const storageData = phones.reduce(
    (acc, phone) => {
      const storage = phone.storage
      const existing = acc.find((item) => item.storage === storage)
      if (existing) {
        existing.count += 1
      } else {
        acc.push({ storage, count: 1 })
      }
      return acc
    },
    [] as { storage: string; count: number }[],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-200 via-gold-100 to-coral-200 dark:from-coral-950 dark:via-slate-900 dark:to-gold-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-coral-100 dark:border-slate-800 shadow-sm sticky top-0 z-50 transition-colors duration-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="border-coral-200 hover:bg-coral-50 bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-coral-600 to-gold-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-coral-700">Reports Dashboard</h1>
                <p className="text-xs text-muted-foreground">Analytics & Insights</p>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{userEmail}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <div className="ml-4">
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-coral-900 dark:text-white mb-2">Business Analytics</h2>
          <p className="text-coral-800 dark:text-slate-200">Overview of sales, inventory, and performance metrics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center justify-between">
                <span>Total Inventory</span>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-coral-700 dark:text-white">{phones.length}</div>
              <p className="text-xs text-coral-600/70 dark:text-slate-300 mt-1">Total phones in stock</p>
            </CardContent>
          </Card>

          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md hover:shadow-lg hover:border-coral-300 dark:hover:border-slate-600 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center justify-between">
                <span>Total Sales</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold-700 dark:text-white">{totalSales}</div>
              <p className="text-xs text-gold-600/70 dark:text-slate-300 mt-1">Units sold</p>
            </CardContent>
          </Card>

          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md hover:shadow-lg hover:border-coral-300 dark:hover:border-slate-600 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center justify-between">
                <span>Revenue</span>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-coral-700 dark:text-white">{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-coral-600/70 dark:text-slate-300 mt-1">ETB total revenue</p>
            </CardContent>
          </Card>

          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center justify-between">
                <span>Inventory Value</span>
                <Smartphone className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold-700 dark:text-white">{totalInventoryValue.toLocaleString()}</div>
              <p className="text-xs text-gold-600/70 dark:text-slate-300 mt-1">ETB total value</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brand Distribution Chart */}
          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-coral-900 dark:text-white">Brand Distribution</CardTitle>
              <CardDescription>Inventory count and value by brand</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Count",
                    color: "#ee5f59",
                  },
                  value: {
                    label: "Value (ETB)",
                    color: "#ffe869",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="brand" stroke="currentColor" className="opacity-70" />
                    <YAxis stroke="currentColor" className="opacity-70" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="count" fill="var(--color-count)" name="Phone Count" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top Phones by Price Chart */}
          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-coral-900 dark:text-white">Top 5 Phones by Price</CardTitle>
              <CardDescription>Highest priced phones in inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  price: {
                    label: "Price (ETB)",
                    color: "#ee5f59",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPhonesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" stroke="currentColor" className="text-coral-900 dark:text-white" />
                    <YAxis dataKey="name" type="category" width={120} stroke="currentColor" className="text-coral-900 dark:text-white" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="price" fill="var(--color-price)" name="Price (ETB)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Storage Distribution Chart */}
          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-coral-900 dark:text-white">Inventory by Storage</CardTitle>
              <CardDescription>Phone distribution by storage capacity</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Count",
                    color: "#e6c84a",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="storage" stroke="currentColor" className="text-coral-900 dark:text-white" />
                    <YAxis stroke="currentColor" className="text-coral-900 dark:text-white" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" name="Phone Count" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Brand Value Chart */}
          <Card className="border-coral-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm shadow-md transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-coral-900 dark:text-white">Inventory Value by Brand</CardTitle>
              <CardDescription>Total value (ETB) by brand</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: {
                    label: "Value (ETB)",
                    color: "#ee5f59",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="brand" stroke="currentColor" className="opacity-70" />
                    <YAxis stroke="currentColor" className="opacity-70" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" name="Value (ETB)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
