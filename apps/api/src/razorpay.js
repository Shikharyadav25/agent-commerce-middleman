import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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