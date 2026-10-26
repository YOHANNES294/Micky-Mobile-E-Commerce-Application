export interface ChapaCustomization {
  title?: string
  description?: string
  logo?: string
}

export interface ChapaInitializeRequest {
  amount: string | number
  currency: "ETB"
  email: string
  first_name: string
  last_name?: string
  phone_number?: string
  tx_ref: string
  callback_url?: string
  return_url?: string
  customization?: ChapaCustomization
  meta?: Record<string, unknown>
}

export interface ChapaInitializeResponse {
  message: string
  status: "success" | "failed"
  data?: {
    checkout_url: string
  } | null
}

export interface ChapaVerifyData {
  first_name?: string
  last_name?: string
  email?: string
  currency: string
  amount: number | string
  charge?: number | string
  mode?: string
  method?: string
  type?: string
  status: "success" | "failed" | "pending" | "cancelled" | string
  reference?: string
  tx_ref: string
  customization?: ChapaCustomization
  meta?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export interface ChapaVerifyResponse {
  message: string
  status: "success" | "failed"
  data?: ChapaVerifyData | null
}

export interface ChapaWebhookPayload {
  event?: string
  first_name?: string
  last_name?: string
  email?: string
  currency?: string
  amount?: string | number
  charge?: string | number
  mode?: string
  method?: string
  type?: string
  status?: string
  reference?: string
  tx_ref: string
  customization?: ChapaCustomization
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}
