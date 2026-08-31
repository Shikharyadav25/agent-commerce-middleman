import Fastify from 'fastify';
import 'dotenv/config';
import crypto from 'crypto';
import rawBody from 'fastify-raw-body';
import { PrismaClient } from '@prisma/client';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });

// ---- Health check ----
app.get('/health', async () => ({ status: 'ok' }));

// ---- Catalog & Quotes ----
app.get('/v1/catalog', async () => {
  return prisma.product.findMany();
});

app.post('/v1/quotes', async (request) => {
  const { items } = request.body;
  const products = await prisma.product.findMany({ where: { sku: { in: items.map(i => i.sku) } } });
  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.sku === item.sku);
    return sum + product.price * item.qty;
  }, 0);
  const quote = await prisma.quote.create({
    data: { items, total, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return quote;
});

// ---- Webhook ----
app.post('/webhooks/razorpay', { config: { rawBody: true } }, async (request, reply) => {
  const receivedSignature = request.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(request.rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));

  if (!isValid) {
    console.warn('Webhook rejected: signature mismatch');
    return reply.code(400).send({ error: 'invalid signature' });
  }

  const event = request.body;
  console.log('Verified webhook event:', event.event);

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const razorpayOrderId = event.payload.order.entity.id;
    const razorpayPaymentId = event.payload.payment?.entity?.id;

    const transaction = await prisma.transaction.update({
      where: { razorpayOrderId },
      data: { state: 'paid', razorpayPaymentId },
    });

    await prisma.auditLogRow.create({
      data: {
        correlationId: transaction.correlationId,
        transactionId: transaction.id,
        step: 'webhook_received',
        decision: 'allow',
        reason: 'payment captured and verified',
        actor: 'system',
      },
    });
  }

  if (event.event === 'payment.failed') {
    const razorpayOrderId = event.payload.payment.entity.order_id;
    const errorReason = event.payload.payment.entity.error_reason || 'unknown_reason';

    const transaction = await prisma.transaction.update({
      where: { razorpayOrderId },
      data: { state: 'failed' },
    });

    await prisma.auditLogRow.create({
      data: {
        correlationId: transaction.correlationId,
        transactionId: transaction.id,
        step: 'webhook_received',
        decision: 'deny',
        reason: `payment declined: ${errorReason}. no charge was made.`,
        actor: 'system',
      },
    });
  }

  return reply.code(200).send({ received: true });
});

// ---- Add-ons & Refunds ----
app.post('/v1/suggest-addons', async (request) => {
  const { skus } = request.body;
  const cartItems = await prisma.product.findMany({ where: { sku: { in: skus } } });
  const pairedSkus = [...new Set(cartItems.flatMap(p => p.pairsWith))];
  const suggestions = await prisma.product.findMany({ where: { sku: { in: pairedSkus } } });
  return suggestions;
});

app.post('/v1/transactions/:id/refund', async (request) => {
  const { id } = request.params;
  const { reason } = request.body;
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.state !== 'paid') {
    return { error: 'transaction not found or not eligible for refund' };
  }
  const { refundPayment } = await import('./razorpay.js');
  const refund = await refundPayment(transaction.razorpayPaymentId, transaction.quote.total);
  await prisma.transaction.update({ where: { id }, data: { state: 'refunded' } });
  await prisma.auditLogRow.create({
    data: { correlationId: transaction.correlationId, transactionId: id, step: 'refund', decision: 'allow', reason: reason || 'refund requested', actor: 'system' },
  });
  return refund;
});

// ---- Start server ----
app.listen({ port: process.env.PORT || 3000 }, (err, address) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`API running at ${address}`);
});