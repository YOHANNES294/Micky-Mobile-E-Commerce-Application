export type UserRole = "client" | "admin"

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export type PhoneBrand = "Samsung" | "iPhone"

export interface Phone {
  id: string
  brand: PhoneBrand
  model: string
  storage: string
  ram: string
  battery?: string // Only for iPhone
  network?: string // Only for Samsung (5G, 4G, etc.)
  sim: string
  price: string
  image?: string
  message?: string
  start_date: string
  end_date?: string
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  phone_id: string
  sold_quantity: number
  inventory_quantity: number
  sale_date: string
  created_at: string
}

export interface Chat {
  id: string
  client_id: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  content: string
  created_at: string
}

export type PaymentMethod = "telebirr" | "cbe" | "chapa" | "other"
export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled" | "refunded"
export type FulfillmentStatus = "unfulfilled" | "processing" | "fulfilled" | "cancelled"

export type OrderStatus =
  | "placed"
  | "payment_confirmed"
  | "confirmed"
  | "processing"
  | "ready_for_dispatch"
  | "ready_for_pickup"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "picked_up"
  | "cancelled"
  | "refunded"

export interface OrderItem {
  phone_id: string
  model: string
  brand: string
  storage?: string
  ram?: string
  quantity: number
  price: number
  image?: string
}

export interface OrderStatusHistoryItem {
  status: OrderStatus
  title: string
  description?: string
  notes?: string
  timestamp: string
  updated_by?: string
}

export interface Order {
  id: string
  client_id: string
  phone_id: string
  amount: number
  currency?: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  order_status?: OrderStatus
  fulfillment_status?: FulfillmentStatus
  transaction_ref?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  items?: OrderItem[]
  pickup_method?: "pickup" | "delivery"
  delivery_address?: string
  shipping_carrier?: string
  tracking_number?: string
  estimated_delivery?: string
  delivery_notes?: string
  status_history?: OrderStatusHistoryItem[]
  created_at: string
  updated_at: string
  phone?: Phone
}

export type ChapaTransactionStatus = "pending" | "successful" | "failed" | "cancelled"

export interface Payment {
  id: string
  order_id: string
  customer_id: string
  provider: "chapa" | string
  transaction_ref: string
  provider_tx_id?: string
  amount: number
  currency: string
  status: ChapaTransactionStatus
  raw_verification?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type NotificationCategory = "orders" | "messages" | "products" | "promotions" | "account"

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  category: NotificationCategory
  target_type?: "order" | "chat" | "phone" | "url" | string
  target_id?: string
  is_read: boolean
  metadata?: Record<string, any>
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  in_app_enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  order_updates: boolean
  support_messages: boolean
  promotional_updates: boolean
  sound_enabled: boolean
  dont_ask_again: boolean
  updated_at?: string
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh?: string
  auth?: string
  device_type: "web" | "android" | "ios"
  device_token?: string
  user_agent?: string
  created_at: string
  updated_at: string
}

export interface EmailLog {
  id: string
  user_id?: string
  recipient_email: string
  subject: string
  category: NotificationCategory | string
  status: "sent" | "failed" | "pending_config"
  error_message?: string
  metadata?: Record<string, any>
  created_at: string
}

