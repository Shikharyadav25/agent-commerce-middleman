import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const isMockMode =
  process.env.NODE_ENV === 'test' ||
  !process.env.RAZORPAY_KEY_ID ||
  process.env.RAZORPAY_KEY_ID.includes('YourKeyId');

export const razorpay = !isMockMode
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : {
      orders: {
        create: async (params) => ({
          id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          entity: 'order',
          amount: params.amount,
          amount_paid: 0,
          amount_due: params.amount,
          currency: params.currency || 'INR',
          receipt: params.receipt,
          status: 'created',
          notes: params.notes,
          created_at: Math.floor(Date.now() / 1000),
        }),
        fetch: async (orderId) => ({
          id: orderId,
          entity: 'order',
          amount: 50000,
          amount_paid: 50000,
          status: 'paid',
        }),
        fetchPayments: async (orderId) => ({
          items: [
            {
              id: `pay_mock_${Date.now()}`,
              entity: 'payment',
              amount: 50000,
              currency: 'INR',
              status: 'captured',
              order_id: orderId,
            },
          ],
        }),
      },
      paymentLink: {
        create: async (params) => ({
          id: `plink_mock_${Date.now()}`,
          short_url: `https://rzp.io/i/mock_${Date.now()}`,
          amount: params.amount,
          currency: params.currency || 'INR',
          status: 'created',
          notes: params.notes,
        }),
      },
      payments: {
        all: async () => ({ items: [] }),
        fetch: async (paymentId) => ({
          id: paymentId,
          entity: 'payment',
          amount: 50000,
          currency: 'INR',
          status: 'captured',
        }),
        refund: async (paymentId, params) => ({
          id: `rfnd_mock_${Date.now()}`,
          entity: 'refund',
          amount: params.amount,
          payment_id: paymentId,
          status: 'processed',
        }),
      },
    };

export async function createOrder({ quoteId, amountPaise, notes }) {
  return razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: quoteId,       // idempotency: reusing the same receipt returns the existing order
    notes,                  // { transactionId, agentId, mandateId }
  });
}

export async function createPaymentLink({ amountPaise, description, notes }) {
  return razorpay.paymentLink.create({
    amount: amountPaise,
    currency: 'INR',
    description,
    notes,
  });
}

export async function fetchPayment(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

export async function refundPayment(paymentId, amountPaise) {
  return razorpay.payments.refund(paymentId, { amount: amountPaise });
}