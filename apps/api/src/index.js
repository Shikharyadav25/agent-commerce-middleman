import Fastify from 'fastify';
import 'dotenv/config';
import crypto from 'crypto';
import rawBody from 'fastify-raw-body';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });

app.post('/webhooks/razorpay', { config: { rawBody: true } }, async (request, reply) => {
  const receivedSignature = request.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(request.rawBody)
    .digest('hex');

  if (!receivedSignature) {
    return reply.code(400).send({ error: 'missing signature' });
  }

  const bufReceived = Buffer.from(receivedSignature, 'utf8');
  const bufExpected = Buffer.from(expectedSignature, 'utf8');

  const isValid =
    bufReceived.length === bufExpected.length &&
    crypto.timingSafeEqual(bufReceived, bufExpected);

  if (!isValid) {
    console.warn('Webhook rejected: signature mismatch');
    return reply.code(400).send({ error: 'invalid signature' });
  }

  const event = request.body;
  console.log('Verified webhook event:', event.event);

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const razorpayOrderId = event.payload.order?.entity?.id || event.payload.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload.payment?.entity?.id;

    if (razorpayOrderId) {
      const existing = await prisma.transaction.findUnique({ where: { razorpayOrderId } });
      if (existing) {
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
      } else {
        console.log(`Transaction for order ${razorpayOrderId} not found in DB`);
      }
    }
  }

  if (event.event === 'payment.failed') {
    const razorpayOrderId = event.payload.payment?.entity?.order_id || event.payload.order?.entity?.id;
    const errorReason = event.payload.payment?.entity?.error_reason || 'unknown_reason';

    if (razorpayOrderId) {
      const existing = await prisma.transaction.findUnique({ where: { razorpayOrderId } });
      if (existing) {
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
      } else {
        console.log(`Transaction for order ${razorpayOrderId} not found in DB`);
      }
    }
  }

  return reply.code(200).send({ received: true });
});

app.listen({ port: process.env.PORT || 3000 }, (err, address) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`API running at ${address}`);
});