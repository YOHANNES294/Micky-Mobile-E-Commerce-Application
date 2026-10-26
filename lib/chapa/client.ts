import crypto from "crypto"
import type {
  ChapaInitializeRequest,
  ChapaInitializeResponse,
  ChapaVerifyResponse,
} from "./types"

export class ChapaError extends Error {
  public status?: number
  public chapaMessage?: string

  constructor(message: string, status?: number, chapaMessage?: string) {
    super(message)
    this.name = "ChapaError"
    this.status = status
    this.chapaMessage = chapaMessage
  }
}

export class ChapaClient {
  private secretKey: string
  private baseUrl: string
  private webhookSecret: string

  constructor(options?: {
    secretKey?: string
    baseUrl?: string
    webhookSecret?: string
  }) {
    this.secretKey = options?.secretKey || process.env.CHAPA_SECRET_KEY || ""
    const isGlobalKey = this.secretKey.startsWith("CHAPA_")
    const envUrl = process.env.CHAPA_BASE_URL
    const defaultUrl = isGlobalKey ? "https://api.chapa.global/v1" : "https://api.chapa.co/v1"
    const resolvedUrl = (isGlobalKey && envUrl?.includes("chapa.co")) ? "https://api.chapa.global/v1" : (envUrl || defaultUrl)
    this.baseUrl = (options?.baseUrl || resolvedUrl).replace(/\/+$/, "")
    this.webhookSecret = options?.webhookSecret || process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY || ""
  }

  private getAuthHeaders() {
    if (!this.secretKey) {
      throw new ChapaError(
        "Chapa configuration error: CHAPA_SECRET_KEY is not configured in backend environment variables.",
        500
      )
    }

    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  }

  /**
   * Initializes a transaction with Chapa and returns the hosted checkout URL
   */
  async initialize(payload: ChapaInitializeRequest): Promise<ChapaInitializeResponse> {
    const headers = this.getAuthHeaders()
    const url = `${this.baseUrl}/transaction/initialize`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = (await response.json()) as ChapaInitializeResponse

      if (!response.ok || data.status !== "success") {
        const errorMsg = data.message || `Chapa initialize request failed with status ${response.status}`
        throw new ChapaError(errorMsg, response.status, data.message)
      }

      if (!data.data?.checkout_url) {
        throw new ChapaError("Chapa did not return a checkout_url", response.status, data.message)
      }

      return data
    } catch (err: unknown) {
      if (err instanceof ChapaError) throw err
      if (err instanceof Error && err.name === "AbortError") {
        throw new ChapaError("Chapa API request timed out after 15 seconds", 504)
      }
      throw new ChapaError(
        `Failed to communicate with Chapa API: ${err instanceof Error ? err.message : "Unknown error"}`,
        502
      )
    }
  }

  /**
   * Verifies a transaction with Chapa using its unique transaction reference
   */
  async verify(txRef: string): Promise<ChapaVerifyResponse> {
    if (!txRef || typeof txRef !== "string" || txRef.trim() === "") {
      throw new ChapaError("Transaction reference is required for verification", 400)
    }

    const headers = this.getAuthHeaders()
    const url = `${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef.trim())}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = (await response.json()) as ChapaVerifyResponse

      if (!response.ok) {
        throw new ChapaError(
          data.message || `Chapa verify request failed with status ${response.status}`,
          response.status,
          data.message
        )
      }

      return data
    } catch (err: unknown) {
      if (err instanceof ChapaError) throw err
      if (err instanceof Error && err.name === "AbortError") {
        throw new ChapaError("Chapa verify request timed out after 15 seconds", 504)
      }
      throw new ChapaError(
        `Failed to verify transaction with Chapa: ${err instanceof Error ? err.message : "Unknown error"}`,
        502
      )
    }
  }

  /**
   * Verifies webhook authenticity using constant-time comparison
   * Supports both configured secret hash comparison and HMAC-SHA256 signature
   */
  verifyWebhookSignature(signature: string | null | undefined, rawBody: string): boolean {
    if (!signature) return false

    const secret = this.webhookSecret
    if (!secret) {
      console.error("[Chapa Security] Webhook signature verification failed: No webhook secret configured.")
      return false
    }

    try {
      // 1. Direct Secret Hash Match (Timing safe)
      const sigBuffer = Buffer.from(signature)
      const secretBuffer = Buffer.from(secret)
      if (sigBuffer.length === secretBuffer.length && crypto.timingSafeEqual(sigBuffer, secretBuffer)) {
        return true
      }

      // 2. HMAC-SHA256 Signature Match (Timing safe)
      const computedHmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
      const computedBuffer = Buffer.from(computedHmac)
      if (sigBuffer.length === computedBuffer.length && crypto.timingSafeEqual(sigBuffer, computedBuffer)) {
        return true
      }

      return false
    } catch {
      return false
    }
  }
}

// Export a singleton instance for standard use
export const chapa = new ChapaClient()
