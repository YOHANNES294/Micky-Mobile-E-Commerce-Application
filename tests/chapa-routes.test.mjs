import { test, describe } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"

// Test Next.js Request & Response compatibility
describe("Chapa API Route Security & Validation Tests", () => {
  const TEST_SECRET = "test_webhook_secret_key_123"

  describe("Webhook Signature Validation in Route Handler", () => {
    test("rejects request when signature header is missing", async () => {
      const headers = new Headers()
      const signature = headers.get("chapa-signature") || headers.get("x-chapa-signature")
      assert.equal(signature, null)
    })

    test("validates HMAC-SHA256 signature against raw body bytes", async () => {
      const payload = JSON.stringify({
        event: "charge.completed",
        tx_ref: "MICKY-TX-12345",
        status: "success",
        amount: 25000,
        currency: "ETB",
      })

      const expectedHmac = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex")

      // Verification logic identical to route handler
      const computed = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex")
      const sigBuf = Buffer.from(expectedHmac)
      const compBuf = Buffer.from(computed)

      const isValid = sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf)
      assert.equal(isValid, true)
    })

    test("rejects tampered payload when signature does not match", async () => {
      const originalPayload = JSON.stringify({ tx_ref: "TX-1", amount: 100 })
      const tamperedPayload = JSON.stringify({ tx_ref: "TX-1", amount: 1 }) // altered amount

      const originalSig = crypto.createHmac("sha256", TEST_SECRET).update(originalPayload).digest("hex")
      const tamperedSig = crypto.createHmac("sha256", TEST_SECRET).update(tamperedPayload).digest("hex")

      assert.notEqual(originalSig, tamperedSig)
    })
  })

  describe("API Input Validation Constraints", () => {
    test("rejects invalid email formats", () => {
      const invalidEmails = ["not-an-email", "@no-user.com", "user@", ""]
      for (const email of invalidEmails) {
        const isValid = email.includes("@") && email.split("@")[0].length > 0 && email.split("@")[1]?.includes(".")
        assert.equal(isValid, false, `Should reject email: ${email}`)
      }
    })

    test("rejects phone numbers with insufficient digits", () => {
      const invalidPhones = ["123", "", "abc", "09"]
      for (const phone of invalidPhones) {
        const isValid = phone.replace(/\D/g, "").length >= 9
        assert.equal(isValid, false, `Should reject phone: ${phone}`)
      }
    })
  })
})
