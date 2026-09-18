import { describe, it, expect } from 'vitest';
import { createOrderSchema } from '../validators/order.validator';

describe('customer order payment method (online only, never cash)', () => {
  const items = [{ menuItemId: '11111111-1111-4111-8111-111111111111', quantity: 1 }];

  it('defaults to MOBILE_MONEY when the customer does not specify a payment method', () => {
    const result = createOrderSchema.safeParse({ body: { items }, query: {}, params: {} });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.paymentMethod).toBe('MOBILE_MONEY');
  });

  it('rejects CASH as a payment method for a customer order', () => {
    const result = createOrderSchema.safeParse({ body: { paymentMethod: 'CASH', items }, query: {}, params: {} });
    expect(result.success).toBe(false);
  });

  it('still allows other online-friendly payment methods', () => {
    for (const method of ['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER']) {
      const result = createOrderSchema.safeParse({ body: { paymentMethod: method, items }, query: {}, params: {} });
      expect(result.success).toBe(true);
    }
  });
});
