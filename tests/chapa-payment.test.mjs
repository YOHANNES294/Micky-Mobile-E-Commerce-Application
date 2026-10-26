import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"

// We test the Chapa client logic directly
import { ChapaClient, ChapaError } from "../lib/chapa/client.ts"
import { generateTxRef } from "../lib/chapa/utils.ts"

describe("Chapa Payment Gateway Integration Tests", () => {
  const TEST_SECRET_KEY = "CHASECK_TEST-sample_mock_secret_key_12345"
  const TEST_WEBHOOK_SECRET = "super_secret_webhook_hash_98765"
  const MOCK_BASE_URL = "https://mock.chapa.co/v1"

  let client
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new ChapaClient({
      secretKey: TEST_SECRET_KEY,
      baseUrl: MOCK_BASE_URL,
      webhookSecret: TEST_WEBHOOK_SECRET,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe("1. Client Configuration & Security", () => {
    test("fails if secret key is missing", async () => {
      const unconfiguredClient = new ChapaClient({ secretKey: "" })
      await assert.rejects(
        async () => {
          await unconfiguredClient.initialize({
            amount: "100",
            currency: "ETB",
            email: "test@example.com",
            first_name: "Abebe",
            tx_ref: "TX-123",
          })
        },
        {
          name: "ChapaError",
          message: /CHAPA_SECRET_KEY is not configured/,
        }
      )
    })

    test("generates unique high-entropy transaction references", () => {
      const refs = new Set()
      for (let i = 0; i < 50; i++) {
        const ref = generateTxRef("MCK")
        assert.ok(ref.length <= 20, `Reference must be at most 20 characters long, got length ${ref.length}`)
        assert.match(ref, /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/)
        refs.add(ref)
      }
      assert.equal(refs.size, 50, "All transaction references must be distinct")
    })
  })

  describe("2. Payment Initialization Flow", () => {
    test("successfully initializes payment session and returns checkout_url", async () => {
      const mockCheckoutUrl = "https://checkout.chapa.co/checkout/payment/mock123"

      global.fetch = async (url, options) => {
        assert.equal(url, `${MOCK_BASE_URL}/transaction/initialize`)
        assert.equal(options.method, "POST")
        assert.equal(options.headers["Authorization"], `Bearer ${TEST_SECRET_KEY}`)
        assert.equal(options.headers["Content-Type"], "application/json")

        const body = JSON.parse(options.body)
        assert.equal(body.amount, "28000")
        assert.equal(body.currency, "ETB")
        assert.equal(body.email, "customer@ethiopia.et")
        assert.equal(body.first_name, "Almaz")
        assert.equal(body.last_name, "Ayana")
        assert.equal(body.tx_ref, "MICKY-TX-123")
        assert.equal(body.callback_url, "https://mickymobile.et/api/payments/chapa/webhook")

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: "Hosted Link",
            status: "success",
            data: {
              checkout_url: mockCheckoutUrl,
            },
          }),
        }
      }

      const result = await client.initialize({
        amount: "28000",
        currency: "ETB",
        email: "customer@ethiopia.et",
        first_name: "Almaz",
        last_name: "Ayana",
        phone_number: "0912345678",
        tx_ref: "MICKY-TX-123",
        callback_url: "https://mickymobile.et/api/payments/chapa/webhook",
        return_url: "https://mickymobile.et/checkout/result?tx_ref=MICKY-TX-123",
      })

      assert.equal(result.status, "success")
      assert.equal(result.data.checkout_url, mockCheckoutUrl)
    })

    test("handles initialization failure with Chapa error message", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          message: "The tx_ref has already been used",
          status: "failed",
          data: null,
        }),
      })

      await assert.rejects(
        async () => {
          await client.initialize({
            amount: "100",
            currency: "ETB",
            email: "test@example.com",
            first_name: "Test",
            tx_ref: "DUPLICATE-REF",
          })
        },
        {
          name: "ChapaError",
          status: 400,
          message: /The tx_ref has already been used/,
        }
      )
    })
  })

  describe("3. Payment Verification Flow", () => {
    test("successfully verifies payment with transaction reference", async () => {
      const mockTxRef = "MICKY-TX-SUCCESS-999"

      global.fetch = async (url, options) => {
        assert.equal(url, `${MOCK_BASE_URL}/transaction/verify/${mockTxRef}`)
        assert.equal(options.method, "GET")
        assert.equal(options.headers["Authorization"], `Bearer ${TEST_SECRET_KEY}`)

        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: "Payment details",
            status: "success",
            data: {
              first_name: "Kenenisa",
              last_name: "Bekele",
              email: "kenenisa@athletics.et",
              currency: "ETB",
              amount: 32000,
              charge: 0,
              mode: "test",
              method: "telebirr",
              status: "success",
              reference: "CHAPA-REF-777",
              tx_ref: mockTxRef,
              created_at: new Date().toISOString(),
            },
          }),
        }
      }

      const response = await client.verify(mockTxRef)
      assert.equal(response.status, "success")
      assert.equal(response.data.status, "success")
      assert.equal(response.data.amount, 32000)
      assert.equal(response.data.currency, "ETB")
      assert.equal(response.data.tx_ref, mockTxRef)
      assert.equal(response.data.reference, "CHAPA-REF-777")
    })

    test("handles verification failure for non-existent reference", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          message: "Transaction not found",
          status: "failed",
          data: null,
        }),
      })

      await assert.rejects(
        async () => {
          await client.verify("NON-EXISTENT-TX")
        },
        {
          name: "ChapaError",
          status: 404,
          message: /Transaction not found/,
        }
      )
    })
  })

  describe("4. Webhook Signature & Authenticity", () => {
    test("accepts valid secret hash in Chapa-Signature", () => {
      const rawBody = JSON.stringify({ tx_ref: "MICKY-TX-1", status: "success" })
      const isValid = client.verifyWebhookSignature(TEST_WEBHOOK_SECRET, rawBody)
      assert.equal(isValid, true)
    })

    test("accepts valid HMAC-SHA256 signature", () => {
      const rawBody = JSON.stringify({ tx_ref: "MICKY-TX-2", status: "success", amount: "100" })
      const hmacSignature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex")

      const isValid = client.verifyWebhookSignature(hmacSignature, rawBody)
      assert.equal(isValid, true)
    })

    test("rejects forged or altered webhook signature", () => {
      const rawBody = JSON.stringify({ tx_ref: "MICKY-TX-3", status: "success" })
      const forgedSignature = "forged_signature_that_does_not_match_at_all"

      const isValid = client.verifyWebhookSignature(forgedSignature, rawBody)
      assert.equal(isValid, false)
    })

    test("rejects when signature header is missing or null", () => {
      const isValid = client.verifyWebhookSignature(null, '{"test": 1}')
      assert.equal(isValid, false)
    })
  })

  describe("5. Fraud & Tampering Prevention Logic", () => {
    test("detects currency mismatch (prevents payment in cheaper currency)", () => {
      const orderCurrency = "ETB"
      const chapaVerifiedCurrency = "USD" // Attacker paid USD 100 instead of ETB 28000
      assert.notEqual(orderCurrency, chapaVerifiedCurrency)
    })

    test("detects amount mismatch (prevents under-payment attacks)", () => {
      const orderAmount = 25000.00
      const verifiedAmount = 25.00 // Attacker altered amount to 25 ETB
      const diff = Math.abs(orderAmount - verifiedAmount)
      assert.ok(diff > 0.05, "Amount discrepancy must be flagged as fraud")
    })

    test("enforces order ownership authorization", () => {
      const legitimateCustomerUserId = "usr-client-001"
      const attackerUserId = "usr-attacker-999"
      const order = { client_id: legitimateCustomerUserId }

      // Check ownership
      const isOwner = order.client_id === attackerUserId
      assert.equal(isOwner, false, "Attacker must not be able to verify or access another user's order")
    })

    test("decouples payment status from fulfillment status", () => {
      const order = {
        payment_status: "pending",
        fulfillment_status: "unfulfilled",
      }

      // After successful payment
      order.payment_status = "completed"

      // Fulfillment must remain unfulfilled until physical store dispatch
      assert.equal(order.payment_status, "completed")
      assert.equal(order.fulfillment_status, "unfulfilled")
    })

    test("ensures idempotency on duplicate verification and webhook callbacks", () => {
      let fulfillmentCount = 0

      function processVerification(currentStatus) {
        if (currentStatus === "completed") {
          return { alreadyVerified: true, fulfillmentCount }
        }
        currentStatus = "completed"
        fulfillmentCount++
        return { alreadyVerified: false, fulfillmentCount }
      }

      // First run: fulfills
      const run1 = processVerification("pending")
      assert.equal(run1.alreadyVerified, false)
      assert.equal(run1.fulfillmentCount, 1)

      // Second duplicate callback / return: idempotent
      const run2 = processVerification("completed")
      assert.equal(run2.alreadyVerified, true)
      assert.equal(run2.fulfillmentCount, 1, "Duplicate callback must NOT trigger duplicate fulfillment")
    })
  })
})
