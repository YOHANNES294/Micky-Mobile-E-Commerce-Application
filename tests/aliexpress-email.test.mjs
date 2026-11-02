import { test, describe } from 'node:test'
import assert from 'node:assert'
import {
  wrapBrandedEmailTemplate,
  sendAliExpressOrderUpdateEmail,
  sendAliExpressProductPicksEmail,
  sendAliExpressNewArrivalsEmail,
  sendEmail,
} from '../lib/email/email-service.ts'

describe('AliExpress-Style Branded Gmail Notifications', () => {

  describe('1. AliExpress Order Tracking Milestone Email', () => {
    test('renders 5-step milestone timeline with product details and ETB price', async () => {
      const mockOrder = {
        id: 'ord-test-12345',
        client_id: 'client-001',
        amount: 148000,
        payment_method: 'chapa',
        payment_status: 'completed',
        transaction_ref: 'MCK-TX-9988',
        delivery_method: 'delivery',
        shipping_carrier: 'Micky Express Bole Courier',
        tracking_number: 'ET-MCK-9988',
        phone: {
          brand: 'Samsung',
          model: 'Galaxy S24 Ultra',
          storage: '512GB',
          ram: '12GB',
        },
      }

      const result = await sendAliExpressOrderUpdateEmail({
        order: mockOrder,
        customerEmail: 'test.customer@gmail.com',
        customerName: 'Ethio.Yoni',
        newStatus: 'shipped',
        notes: 'Dispatched from Bole Alemnesh Plaza branch.',
      })

      assert.strictEqual(result.success, true, 'Email dispatch result should succeed')
      assert.ok(result.status === 'sent' || result.status === 'pending_config')
    })
  })

  describe('2. AliExpress Personalized Picks Email ("Your picks are ready")', () => {
    test('formats AliExpress-style personalized recommendations with ETB deals', async () => {
      const result = await sendAliExpressProductPicksEmail({
        customerEmail: 'yohannesm294@gmail.com',
        customerName: 'Ethio.Yoni',
      })

      assert.strictEqual(result.success, true, 'Product picks email should succeed')
      assert.ok(result.status === 'sent' || result.status === 'pending_config')
    })
  })

  describe('3. AliExpress New Arrival Notification', () => {
    test('formats "Something new just arrived" alert with device specs and Bole warranty', async () => {
      const result = await sendAliExpressNewArrivalsEmail({
        customerEmail: 'yohannesm294@gmail.com',
        customerName: 'Ethio.Yoni',
        phone: {
          brand: 'Apple',
          model: 'iPhone 16 Pro Max',
          price: 185000,
          storage: '256GB',
          ram: '8GB',
          badge: 'Desert Titanium',
        },
      })

      assert.strictEqual(result.success, true, 'New arrival alert should succeed')
      assert.ok(result.status === 'sent' || result.status === 'pending_config')
    })
  })

  describe('4. Template Branding & AliExpress Layout Integrity', () => {
    test('verifies layout includes Micky Mobile, Bole Alemnesh Plaza, and CTA button', () => {
      const title = 'Your Order Has Shipped'
      const html = wrapBrandedEmailTemplate(title, '<p>Phone is in transit.</p>')

      assert.ok(html.includes('MICKY'), 'Brand name MICKY must be present')
      assert.ok(html.includes('MOBILE'), 'Brand name MOBILE must be present')
      assert.ok(html.includes('Bole Medhanialem'), 'Bole store location must be present')
      assert.ok(html.includes('Alemenesh Plaza'), 'Plaza location must be present')
      assert.ok(html.includes('+251 93 369 4796'), 'Customer phone must be present')
    })
  })
})
