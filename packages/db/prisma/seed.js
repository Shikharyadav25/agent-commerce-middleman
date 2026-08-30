import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // Clean up in reverse relation order for clean re-seeding
  await prisma.auditLogRow.deleteMany({});
  await prisma.pendingApproval.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.mandate.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.mandateTemplate.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.merchant.deleteMany({});

  const merchant = await prisma.merchant.create({
    data: {
      name: 'Demo Grocery Store',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: { refundWindowDays: 7 },
    },
  });

  await prisma.product.createMany({
    data: [
      { merchantId: merchant.id, sku: 'rice-basmati-5kg', name: 'Basmati rice, 5kg', price: 65000, stock: 42, category: 'grocery.staples', pairsWith: ['ghee-500ml', 'toor-dal-1kg'], tags: ['vegetarian'] },
      { merchantId: merchant.id, sku: 'ghee-500ml', name: 'Pure ghee, 500ml', price: 45000, stock: 30, category: 'grocery.dairy', pairsWith: [], tags: ['vegetarian'] },
      { merchantId: merchant.id, sku: 'toor-dal-1kg', name: 'Toor dal, 1kg', price: 18000, stock: 60, category: 'grocery.staples', pairsWith: [], tags: ['vegetarian'] },
      { merchantId: merchant.id, sku: 'milk-1l', name: 'Full-cream milk, 1L', price: 7000, stock: 80, category: 'grocery.dairy', pairsWith: [], tags: [] },
      { merchantId: merchant.id, sku: 'bread-white', name: 'White bread loaf', price: 5000, stock: 50, category: 'grocery.bakery', pairsWith: [], tags: [] },
      { merchantId: merchant.id, sku: 'eggs-dozen', name: 'Eggs, dozen', price: 9000, stock: 40, category: 'grocery.dairy', pairsWith: [], tags: [] },
    ],
  });

  const template = await prisma.mandateTemplate.create({
    data: {
      merchantId: merchant.id,
      maxPerTransaction: 200000,   // ₹2,000
      dailyCap: 200000,
      autoApproveThreshold: 50000, // ₹500
      allowedCategories: ['grocery.staples', 'grocery.dairy', 'grocery.bakery'],
    },
  });

  const agent = await prisma.agent.create({
    data: { name: 'Demo Grocery Bot', apiKeyHash: 'demo-key-hash-replace-me' },
  });

  await prisma.mandate.create({
    data: {
      agentId: agent.id,
      merchantId: merchant.id,
      signedPayload: JSON.stringify({ agentId: agent.id, merchantId: merchant.id, ...template }),
      maxPerTransaction: template.maxPerTransaction,
      dailyCap: template.dailyCap,
      autoApproveThreshold: template.autoApproveThreshold,
      allowedCategories: template.allowedCategories,
    },
  });

  console.log('Seed complete. Merchant ID:', merchant.id, 'Agent ID:', agent.id);
}

main().finally(() => prisma.$disconnect());