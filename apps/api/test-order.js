import { createOrder, createPaymentLink } from './src/razorpay.js';
import 'dotenv/config';

async function main() {
  const quoteId = `test-quote-${Date.now()}`; // fake quote id for this manual test
  const amountPaise = 40000; // ₹400

  const order = await createOrder({
    quoteId,
    amountPaise,
    notes: { source: 'manual-test' },
  });
  console.log('Order created:', order.id);

  const link = await createPaymentLink({
    amountPaise,
    description: 'Test purchase',
    notes: { orderId: order.id },
  });
  console.log('Pay here:', link.short_url);
}

main().catch(err => {
  console.error('Error details:', err);
});