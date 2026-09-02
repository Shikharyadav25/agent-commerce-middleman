import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

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

  // 1. Merchant 1: Daily Fresh Mart (Grocery & Essentials)
  const groceryMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-grocery-01',
      name: 'Daily Fresh Mart',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'grocery',
        refundWindowDays: 7,
        maxDiscountPercent: 20,
      },
    },
  });

  const groceryProducts = [
    { merchantId: groceryMerchant.id, sku: 'bread-white', name: 'Artisan White Bread Loaf', price: 4500, stock: 80, category: 'grocery.bakery', pairsWith: ['butter-salted', 'eggs-dozen'], tags: ['bakery', 'breakfast', 'staple'] },
    { merchantId: groceryMerchant.id, sku: 'butter-salted', name: 'Farmhouse Salted Butter 200g', price: 6500, stock: 60, category: 'grocery.dairy', pairsWith: ['bread-white'], tags: ['dairy', 'breakfast'] },
    { merchantId: groceryMerchant.id, sku: 'milk-1l', name: 'Fresh Whole Milk, 1L', price: 6800, stock: 90, category: 'grocery.dairy', pairsWith: ['eggs-dozen', 'bread-white'], tags: ['dairy', 'daily'] },
    { merchantId: groceryMerchant.id, sku: 'eggs-dozen', name: 'Organic Farm Eggs (Dozen)', price: 9500, stock: 50, category: 'grocery.dairy', pairsWith: ['bread-white', 'butter-salted'], tags: ['protein', 'breakfast'] },
    { merchantId: groceryMerchant.id, sku: 'rice-basmati-5kg', name: 'Royal Basmati Rice, 5kg', price: 58000, stock: 40, category: 'grocery.staples', pairsWith: ['toor-dal-1kg', 'ghee-500ml'], tags: ['staple', 'grain'] },
    { merchantId: groceryMerchant.id, sku: 'toor-dal-1kg', name: 'Premium Unpolished Toor Dal, 1kg', price: 17500, stock: 65, category: 'grocery.staples', pairsWith: ['rice-basmati-5kg', 'ghee-500ml'], tags: ['staple', 'protein'] },
    { merchantId: groceryMerchant.id, sku: 'ghee-500ml', name: 'A2 Vedic Bilona Cow Ghee, 500ml', price: 48000, stock: 35, category: 'grocery.dairy', pairsWith: ['rice-basmati-5kg', 'toor-dal-1kg'], tags: ['pure', 'ayurvedic'] },
  ];

  await prisma.product.createMany({ data: groceryProducts });

  // 2. Merchant 2: VoltTech Electronics & Accessories (Tech & Gadgets)
  const techMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-tech-02',
      name: 'VoltTech Electronics & Accessories',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'electronics',
        refundWindowDays: 14,
        maxDiscountPercent: 15,
      },
    },
  });

  const techProducts = [
    { merchantId: techMerchant.id, sku: 'fast-charger-65w', name: 'VoltCharge GaN 65W Fast Charger', price: 189900, stock: 45, category: 'electronics.chargers', pairsWith: ['usbc-braided-cable', 'adapter-world-travel'], tags: ['gan', 'fast-charge'] },
    { merchantId: techMerchant.id, sku: 'usbc-braided-cable', name: 'UltraDurable Braided USB-C to USB-C (2m)', price: 49900, stock: 120, category: 'electronics.cables', pairsWith: ['fast-charger-65w', 'powerbank-20000mah'], tags: ['cable', '100w-pd'] },
    { merchantId: techMerchant.id, sku: 'powerbank-20000mah', name: 'PowerPulse 20000mAh 45W Power Bank', price: 249900, stock: 30, category: 'electronics.chargers', pairsWith: ['usbc-braided-cable'], tags: ['travel', 'power'] },
    { merchantId: techMerchant.id, sku: 'wireless-earbuds-pro', name: 'AcousticAir Pro ANC Wireless Earbuds', price: 349900, stock: 25, category: 'electronics.audio', pairsWith: ['earbuds-silicone-case'], tags: ['anc', 'bluetooth5.3'] },
    { merchantId: techMerchant.id, sku: 'earbuds-silicone-case', name: 'Rugged Silicone Case with Carabiner', price: 39900, stock: 90, category: 'electronics.accessories', pairsWith: ['wireless-earbuds-pro'], tags: ['protection', 'case'] },
  ];

  await prisma.product.createMany({ data: techProducts });

  // 3. Mandate Templates
  const groceryTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: groceryMerchant.id,
      maxPerTransaction: 200000,   // ₹2,000
      dailyCap: 500000,            // ₹5,000
      autoApproveThreshold: 50000, // ₹500
      allowedCategories: ['grocery.staples', 'grocery.dairy', 'grocery.bakery'],
    },
  });

  const techTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: techMerchant.id,
      maxPerTransaction: 500000,   // ₹5,000
      dailyCap: 1000000,           // ₹10,000
      autoApproveThreshold: 100000,// ₹1,000
      allowedCategories: ['electronics.chargers', 'electronics.cables', 'electronics.accessories', 'electronics.audio'],
    },
  });

  // 4. Autonomous Agents
  const agentClaude = await prisma.agent.create({
    data: {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      apiKeyHash: 'hash-claude-desktop-key',
      revoked: false,
    },
  });

  const agentChatGPT = await prisma.agent.create({
    data: {
      id: 'chatgpt-agent',
      name: 'ChatGPT Assistant',
      apiKeyHash: 'hash-chatgpt-agent-key',
      revoked: false,
    },
  });

  const agentAutonomousProcurement = await prisma.agent.create({
    data: {
      id: 'procure-bot',
      name: 'Autonomous Pantry & Office Procurement Bot',
      apiKeyHash: 'hash-procure-bot-key',
      revoked: false,
    },
  });

  // 5. Active Mandates
  const createMandate = async (agent, merchant, template) => {
    return prisma.mandate.create({
      data: {
        agentId: agent.id,
        merchantId: merchant.id,
        signedPayload: JSON.stringify({
          agentId: agent.id,
          merchantId: merchant.id,
          maxPerTransaction: template.maxPerTransaction,
          dailyCap: template.dailyCap,
          autoApproveThreshold: template.autoApproveThreshold,
          allowedCategories: template.allowedCategories,
          issuedAt: new Date().toISOString(),
        }),
        maxPerTransaction: template.maxPerTransaction,
        dailyCap: template.dailyCap,
        autoApproveThreshold: template.autoApproveThreshold,
        allowedCategories: template.allowedCategories,
      },
    });
  };

  const m1 = await createMandate(agentClaude, groceryMerchant, groceryTemplate);
  const m2 = await createMandate(agentChatGPT, groceryMerchant, groceryTemplate);
  const m3 = await createMandate(agentClaude, techMerchant, techTemplate);
  const m4 = await createMandate(agentChatGPT, techMerchant, techTemplate);
  const m5 = await createMandate(agentAutonomousProcurement, groceryMerchant, groceryTemplate);
  const m6 = await createMandate(agentAutonomousProcurement, techMerchant, techTemplate);

  // 6. Seed Historical Co-Purchase Transactions (for statistical affinity engine)
  console.log('📊 Seeding historical transaction baskets for co-purchase frequency engine...');

  const historicalBaskets = [
    // Grocery Baskets
    { mandate: m1, agent: agentClaude, items: [{ sku: 'bread-white', qty: 1, unitPrice: 4500 }, { sku: 'butter-salted', qty: 1, unitPrice: 6500 }] },
    { mandate: m2, agent: agentChatGPT, items: [{ sku: 'bread-white', qty: 2, unitPrice: 4500 }, { sku: 'butter-salted', qty: 1, unitPrice: 6500 }] },
    { mandate: m1, agent: agentClaude, items: [{ sku: 'bread-white', qty: 1, unitPrice: 4500 }, { sku: 'butter-salted', qty: 1, unitPrice: 6500 }, { sku: 'milk-1l', qty: 1, unitPrice: 6800 }] },
    { mandate: m4, agent: agentAutonomousProcurement, items: [{ sku: 'rice-basmati-5kg', qty: 1, unitPrice: 58000 }, { sku: 'toor-dal-1kg', qty: 2, unitPrice: 17500 }, { sku: 'ghee-500ml', qty: 1, unitPrice: 48000 }] },
    { mandate: m1, agent: agentClaude, items: [{ sku: 'rice-basmati-5kg', qty: 1, unitPrice: 58000 }, { sku: 'toor-dal-1kg', qty: 1, unitPrice: 17500 }] },
    { mandate: m2, agent: agentChatGPT, items: [{ sku: 'eggs-dozen', qty: 1, unitPrice: 9500 }, { sku: 'bread-white', qty: 1, unitPrice: 4500 }] },
    // Tech Baskets
    { mandate: m3, agent: agentClaude, items: [{ sku: 'fast-charger-65w', qty: 1, unitPrice: 189900 }, { sku: 'usbc-braided-cable', qty: 1, unitPrice: 49900 }] },
    { mandate: m3, agent: agentClaude, items: [{ sku: 'wireless-earbuds-pro', qty: 1, unitPrice: 349900 }, { sku: 'earbuds-silicone-case', qty: 1, unitPrice: 39900 }] },
    { mandate: m3, agent: agentClaude, items: [{ sku: 'fast-charger-65w', qty: 1, unitPrice: 189900 }, { sku: 'usbc-braided-cable', qty: 2, unitPrice: 49900 }] },
  ];

  for (let i = 0; i < historicalBaskets.length; i++) {
    const b = historicalBaskets[i];
    const total = b.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
    const correlationId = `seed-corr-${Date.now()}-${i}`;
    const quote = await prisma.quote.create({
      data: {
        items: b.items,
        total,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const tx = await prisma.transaction.create({
      data: {
        correlationId,
        mandateId: b.mandate.id,
        quoteId: quote.id,
        state: 'paid',
        razorpayOrderId: `order_seed_${i + 100}`,
        razorpayPaymentId: `pay_seed_${i + 100}`,
        createdAt: new Date(Date.now() - (i + 1) * 3600000 * 4), // spread over last few days
      },
    });

    await prisma.auditLogRow.create({
      data: {
        correlationId,
        transactionId: tx.id,
        step: 'order_created',
        decision: 'allow',
        reason: `Historical transaction seeded for ${b.agent.name}`,
        actor: 'system',
      },
    });
  }

  console.log('✅ Seed completed successfully:');
  console.log(`   - 2 Merchants: "${groceryMerchant.name}" & "${techMerchant.name}"`);
  console.log(`   - 12 Products across 5 categories`);
  console.log(`   - 3 Autonomous Agents & 4 Active Mandates`);
  console.log(`   - ${historicalBaskets.length} Initial Co-Purchase Order History Records`);
}

main().finally(() => prisma.$disconnect());