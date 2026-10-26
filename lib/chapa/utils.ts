import crypto from "crypto"

/**
 * Generates a unique transaction reference with high entropy (<= 20 chars for Chapa)
 */
export function generateTxRef(prefix = "MCK"): string {
  // Chapa strictly enforces a 20-character maximum for transaction references
  const cleanPrefix = (prefix || "MCK").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "MCK"
  const timestamp = Date.now().toString(36).toUpperCase() // 8 chars
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase() // 6 chars
  // e.g. MCK-MVFAPXX8-A1B2C3 -> 3 + 1 + 8 + 1 + 6 = 19 characters (strictly <= 20)
  return `${cleanPrefix}-${timestamp}-${randomSuffix}`
}
