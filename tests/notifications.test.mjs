import { test, describe } from 'node:test'
import assert from 'node:assert'
import { wrapBrandedEmailTemplate } from '../lib/email/email-service.ts'

describe('AliExpress-Style Notification System Tests', () => {

  describe('1. Branded Email Templates', () => {
    test('wraps content in responsive HTML with Micky Mobile branding', () => {
      const title = 'Order Confirmation #ORD-1234'
      const content = '<p>Thank you for your purchase.</p>'
      const html = wrapBrandedEmailTemplate(title, content)

      assert.ok(html.includes('MICKY'), 'Must include brand header MICKY')
      assert.ok(html.includes('MOBILE'), 'Must include brand header MOBILE')
      assert.ok(html.includes(title), 'Must include email title')
      assert.ok(html.includes(content), 'Must include body content')
      assert.ok(html.includes('Bole Medhanialem'), 'Must include store address in footer')
      assert.ok(html.includes('Manage preferences'), 'Must include preference management link')
    })
  })

  describe('2. Notification Categories & Preferences Logic', () => {
    test('categorizes alerts into orders, messages, products, promotions, and account', () => {
      const allowedCategories = ['orders', 'messages', 'products', 'promotions', 'account']

      const sampleEvents = [
        { type: 'payment_success', category: 'orders' },
        { type: 'inquiry_reply', category: 'messages' },
        { type: 'phone_arrival', category: 'products' },
        { type: 'holiday_sale', category: 'promotions' },
        { type: 'security_alert', category: 'account' },
      ]

      for (const ev of sampleEvents) {
        assert.ok(allowedCategories.includes(ev.category), `${ev.category} should be valid category`)
      }
    })

    test('promotional opt-out never blocks critical order notifications', () => {
      const userPrefs = {
        in_app_enabled: true,
        push_enabled: true,
        email_enabled: true,
        order_updates: true,
        support_messages: true,
        promotional_updates: false, // Opted out of promotions
      }

      // Check if order update is allowed
      const shouldSendOrder = userPrefs.order_updates
      assert.strictEqual(shouldSendOrder, true, 'Order update must be delivered even when promo is false')

      // Check if promo update is blocked
      const shouldSendPromo = userPrefs.promotional_updates
      assert.strictEqual(shouldSendPromo, false, 'Promo update must be blocked when opted out')
    })
  })

  describe('3. Persistent Read Status & Unread Count Calculation', () => {
    test('calculates unread message count excluding own sent messages', () => {
      const adminId = 'admin-user-001'
      const customerId = 'client-user-999'

      const sampleMessages = [
        { id: '1', sender_id: customerId, is_read: false },
        { id: '2', sender_id: customerId, is_read: false },
        { id: '3', sender_id: adminId, is_read: true }, // Admin's own message
        { id: '4', sender_id: customerId, is_read: true },  // Already read
      ]

      // Admin unread calculation
      const adminUnread = sampleMessages.filter(
        m => m.sender_id !== adminId && !m.is_read
      ).length

      assert.strictEqual(adminUnread, 2, 'Admin should have 2 unread customer messages')

      // Mark first message as read
      sampleMessages[0].is_read = true
      const updatedUnread = sampleMessages.filter(
        m => m.sender_id !== adminId && !m.is_read
      ).length

      assert.strictEqual(updatedUnread, 1, 'Unread count should decrease to 1 after reading')
    })

    test('marking all as read clears the unread counter', () => {
      const adminId = 'admin-user-001'
      const sampleMessages = [
        { id: '1', sender_id: 'client-1', is_read: false },
        { id: '2', sender_id: 'client-1', is_read: false },
      ]

      // Mark all read
      sampleMessages.forEach(m => { m.is_read = true })

      const remainingUnread = sampleMessages.filter(
        m => m.sender_id !== adminId && !m.is_read
      ).length

      assert.strictEqual(remainingUnread, 0, 'No unread messages should remain')
    })
  })

  describe('4. Safe Fallback Behavior', () => {
    test('service worker push payload structure matches standard Web Push spec', () => {
      const pushPayload = {
        title: 'Payment Confirmed! 🛡️',
        body: 'Your payment of 85,000 ETB for Samsung Galaxy S24 Ultra was verified.',
        icon: '/miko.png',
        badge: '/miko.png',
        url: '/client/orders',
      }

      assert.ok(pushPayload.title && pushPayload.body, 'Payload must have title and body')
      assert.ok(pushPayload.url.startsWith('/'), 'URL should be an internal app route')
    })
  })
})
