import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with Real-World Tracks & Platforms...');

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

  // =========================================================================
  // TRACK 1: Movie & Entertainment (PVR INOX, IMAX & BookMyShow)
  // =========================================================================
  const pvrMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-pvr-inox',
      name: 'PVR INOX & IMAX Cinemas',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'entertainment.movies',
        track: 'Movie & Entertainment (PVR / IMAX / BookMyShow)',
        refundWindowDays: 1,
        maxDiscountPercent: 20,
      },
    },
  });

  const pvrProducts = [
    { merchantId: pvrMerchant.id, sku: 'pvr-imax-3d-ticket', name: 'PVR IMAX 3D Recliner Ticket (Interstellar)', price: 45000, stock: 120, category: 'entertainment.tickets', pairsWith: ['pvr-caramel-popcorn-tub', 'pvr-nachos-salsa-combo', 'pvr-pepsi-twin-fountain'], tags: ['imax', 'pvr', 'movie', 'weekend'] },
    { merchantId: pvrMerchant.id, sku: 'pvr-caramel-popcorn-tub', name: 'PVR Jumbo Caramel Gourmet Popcorn Tub', price: 28000, stock: 200, category: 'entertainment.concessions', pairsWith: ['pvr-pepsi-twin-fountain', 'pvr-imax-3d-ticket'], tags: ['popcorn', 'snack', 'pvr'] },
    { merchantId: pvrMerchant.id, sku: 'pvr-nachos-salsa-combo', name: 'PVR Crispy Tortilla Nachos with Hot Jalapeño Cheese', price: 24000, stock: 150, category: 'entertainment.concessions', pairsWith: ['pvr-pepsi-twin-fountain'], tags: ['nachos', 'snack'] },
    { merchantId: pvrMerchant.id, sku: 'pvr-pepsi-twin-fountain', name: 'PVR Twin Fountain Cold Beverage (Pepsi Black 500ml x 2)', price: 18000, stock: 300, category: 'entertainment.beverages', pairsWith: ['pvr-caramel-popcorn-tub', 'pvr-nachos-salsa-combo'], tags: ['drink', 'pepsi'] },
    { merchantId: pvrMerchant.id, sku: 'pvr-gold-recliner-upgrade', name: 'PVR Gold Class VIP Recliner & Blanket Upgrade', price: 15000, stock: 40, category: 'entertainment.tickets', pairsWith: ['pvr-imax-3d-ticket'], tags: ['luxury', 'vip'] },
  ];
  await prisma.product.createMany({ data: pvrProducts });

  // =========================================================================
  // TRACK 2: Food Delivery & Dining (Zomato & Swiggy)
  // =========================================================================
  const foodMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-zomato-swiggy',
      name: 'Zomato & Swiggy Gourmet Kitchen',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'food.delivery',
        track: 'Food Delivery & Dining (Zomato / Swiggy)',
        refundWindowDays: 1,
        maxDiscountPercent: 20,
      },
    },
  });

  const foodProducts = [
    { merchantId: foodMerchant.id, sku: 'swiggy-smoky-paneer-pizza', name: 'Wood-Fired Smoky Paneer Feast Pizza (Swiggy Gourmet)', price: 39900, stock: 60, category: 'food.mains', pairsWith: ['zomato-garlic-breadsticks', 'swiggy-choco-lava-cake', 'zomato-cold-coffee-frappe'], tags: ['pizza', 'swiggy', 'dinner'] },
    { merchantId: foodMerchant.id, sku: 'zomato-garlic-breadsticks', name: 'Stuffed Cheesy Garlic Breadsticks with Herb Dip (Zomato Top Choice)', price: 14900, stock: 90, category: 'food.sides', pairsWith: ['swiggy-smoky-paneer-pizza', 'zomato-cold-coffee-frappe'], tags: ['sides', 'cheesy', 'zomato'] },
    { merchantId: foodMerchant.id, sku: 'swiggy-choco-lava-cake', name: 'Molten Belgian Dark Choco Lava Cake (Swiggy Bakery)', price: 10900, stock: 80, category: 'food.desserts', pairsWith: ['swiggy-smoky-paneer-pizza'], tags: ['dessert', 'chocolate'] },
    { merchantId: foodMerchant.id, sku: 'zomato-cold-coffee-frappe', name: 'Hazelnut Cream Cold Brew Coffee Frappe (350ml)', price: 12900, stock: 75, category: 'food.beverages', pairsWith: ['zomato-garlic-breadsticks', 'swiggy-smoky-paneer-pizza'], tags: ['beverage', 'coffee'] },
  ];
  await prisma.product.createMany({ data: foodProducts });

  // =========================================================================
  // TRACK 3: Quick Commerce & Daily Essentials (Blinkit, Zepto & Instamart)
  // =========================================================================
  const groceryMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-blinkit-instamart',
      name: 'Blinkit & Instamart Quick Superstore',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'grocery.quickcommerce',
        track: 'Quick Commerce & Grocery (Blinkit / Zepto / Instamart)',
        refundWindowDays: 7,
        maxDiscountPercent: 20,
      },
    },
  });

  const groceryProducts = [
    { merchantId: groceryMerchant.id, sku: 'blinkit-artisan-bread', name: 'Artisan White Bread Loaf (Blinkit 10-Min Delivery)', price: 4500, stock: 80, category: 'grocery.bakery', pairsWith: ['blinkit-amul-butter', 'zepto-organic-eggs'], tags: ['bakery', 'blinkit', 'breakfast'] },
    { merchantId: groceryMerchant.id, sku: 'blinkit-amul-butter', name: 'Amul Farmhouse Salted Butter 200g', price: 6500, stock: 60, category: 'grocery.dairy', pairsWith: ['blinkit-artisan-bread'], tags: ['dairy', 'butter'] },
    { merchantId: groceryMerchant.id, sku: 'blinkit-amul-milk', name: 'Amul Taaza Homogenised Toned Milk (1L)', price: 6800, stock: 90, category: 'grocery.dairy', pairsWith: ['zepto-organic-eggs', 'blinkit-artisan-bread'], tags: ['dairy', 'milk'] },
    { merchantId: groceryMerchant.id, sku: 'zepto-organic-eggs', name: 'Organic Farm Brown Eggs (12 Pack - Zepto Fresh)', price: 9500, stock: 50, category: 'grocery.dairy', pairsWith: ['blinkit-artisan-bread', 'blinkit-amul-butter'], tags: ['protein', 'zepto'] },
    { merchantId: groceryMerchant.id, sku: 'blinkit-basmati-rice-5kg', name: 'Daawat Royal Basmati Biryani Rice (5kg)', price: 58000, stock: 40, category: 'grocery.staples', pairsWith: ['instamart-toor-dal-1kg', 'zepto-cow-ghee-500ml'], tags: ['staple', 'rice'] },
    { merchantId: groceryMerchant.id, sku: 'instamart-toor-dal-1kg', name: 'Swiggy Instamart Premium Unpolished Toor Dal (1kg)', price: 17500, stock: 65, category: 'grocery.staples', pairsWith: ['blinkit-basmati-rice-5kg', 'zepto-cow-ghee-500ml'], tags: ['staple', 'dal'] },
    { merchantId: groceryMerchant.id, sku: 'zepto-cow-ghee-500ml', name: 'A2 Vedic Bilona Pure Cow Ghee (500ml Jar)', price: 48000, stock: 35, category: 'grocery.dairy', pairsWith: ['blinkit-basmati-rice-5kg', 'instamart-toor-dal-1kg'], tags: ['pure', 'ghee'] },
  ];
  await prisma.product.createMany({ data: groceryProducts });

  // =========================================================================
  // TRACK 4: Electronics & Smart Hardware (Amazon & Croma)
  // =========================================================================
  const techMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-amazon-croma',
      name: 'Amazon & Croma Electronics Hub',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'electronics.hardware',
        track: 'Electronics & Smart Hardware (Amazon / Croma)',
        refundWindowDays: 14,
        maxDiscountPercent: 15,
      },
    },
  });

  const techProducts = [
    { merchantId: techMerchant.id, sku: 'croma-gan-65w-charger', name: 'VoltCharge GaN 65W Ultra-Fast Multi-Port Charger (Croma Retail)', price: 189900, stock: 45, category: 'electronics.chargers', pairsWith: ['amazon-usbc-braided-cable', 'croma-powerbank-20000mah'], tags: ['gan', 'fast-charge'] },
    { merchantId: techMerchant.id, sku: 'amazon-usbc-braided-cable', name: 'AmazonBasics 100W Braided USB-C to USB-C Cable (2m)', price: 49900, stock: 120, category: 'electronics.cables', pairsWith: ['croma-gan-65w-charger', 'croma-powerbank-20000mah'], tags: ['cable', 'amazon'] },
    { merchantId: techMerchant.id, sku: 'croma-powerbank-20000mah', name: 'PowerPulse 20000mAh 45W Travel Power Bank (Croma Verified)', price: 249900, stock: 30, category: 'electronics.chargers', pairsWith: ['amazon-usbc-braided-cable'], tags: ['travel', 'croma'] },
    { merchantId: techMerchant.id, sku: 'amazon-anc-earbuds-pro', name: 'AcousticAir Pro ANC Wireless Earbuds (Amazon Choice)', price: 349900, stock: 25, category: 'electronics.audio', pairsWith: ['amazon-earbuds-silicone-case'], tags: ['anc', 'audio'] },
    { merchantId: techMerchant.id, sku: 'amazon-earbuds-silicone-case', name: 'Rugged Silicone Earbuds Case with Metal Carabiner', price: 39900, stock: 90, category: 'electronics.accessories', pairsWith: ['amazon-anc-earbuds-pro'], tags: ['case', 'protection'] },
  ];
  await prisma.product.createMany({ data: techProducts });

  // =========================================================================
  // TRACK 5: Travel & Cab Mobility (MakeMyTrip & Uber)
  // =========================================================================
  const travelMerchant = await prisma.merchant.create({
    data: {
      id: 'merchant-mmt-uber',
      name: 'MakeMyTrip & Uber Mobility',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      sellingPolicy: {
        category: 'travel.mobility',
        track: 'Travel & Cab Mobility (MakeMyTrip / Uber)',
        refundWindowDays: 2,
        maxDiscountPercent: 15,
      },
    },
  });

  const travelProducts = [
    { merchantId: travelMerchant.id, sku: 'uber-airport-premier-cab', name: 'Uber Premier Airport Express Cab Voucher', price: 65000, stock: 50, category: 'travel.rides', pairsWith: ['mmt-travel-insurance', 'mmt-inflight-meal-seat'], tags: ['uber', 'airport', 'cab'] },
    { merchantId: travelMerchant.id, sku: 'mmt-travel-insurance', name: 'MakeMyTrip Comprehensive Trip Delay & Baggage Protection', price: 19900, stock: 200, category: 'travel.insurance', pairsWith: ['uber-airport-premier-cab'], tags: ['insurance', 'mmt'] },
    { merchantId: travelMerchant.id, sku: 'mmt-inflight-meal-seat', name: 'MakeMyTrip In-Flight Premium Window Seat & Hot Meal', price: 35000, stock: 100, category: 'travel.addons', pairsWith: ['uber-airport-premier-cab', 'mmt-travel-insurance'], tags: ['inflight', 'meal'] },
  ];
  await prisma.product.createMany({ data: travelProducts });

  // =========================================================================
  // Mandate Guardrail Templates
  // =========================================================================
  const pvrTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: pvrMerchant.id,
      maxPerTransaction: 300000,   // ₹3,000
      dailyCap: 600000,            // ₹6,000
      autoApproveThreshold: 60000, // ₹600 (Single movie ticket auto-approved; bulk tickets require human review)
      allowedCategories: ['entertainment.tickets', 'entertainment.concessions', 'entertainment.beverages'],
    },
  });

  const foodTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: foodMerchant.id,
      maxPerTransaction: 200000,   // ₹2,000
      dailyCap: 400000,            // ₹4,000
      autoApproveThreshold: 50000, // ₹500 (Snack/single meal auto-approved; large feasts gated)
      allowedCategories: ['food.mains', 'food.sides', 'food.desserts', 'food.beverages'],
    },
  });

  const groceryTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: groceryMerchant.id,
      maxPerTransaction: 200000,   // ₹2,000
      dailyCap: 500000,            // ₹5,000
      autoApproveThreshold: 50000, // ₹500 (Daily essentials auto-approved; bulk orders gated)
      allowedCategories: ['grocery.staples', 'grocery.dairy', 'grocery.bakery'],
    },
  });

  const techTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: techMerchant.id,
      maxPerTransaction: 500000,   // ₹5,000
      dailyCap: 1000000,           // ₹10,000
      autoApproveThreshold: 100000,// ₹1,000 (Cables auto-approved; high-value hardware gated)
      allowedCategories: ['electronics.chargers', 'electronics.cables', 'electronics.accessories', 'electronics.audio'],
    },
  });

  const travelTemplate = await prisma.mandateTemplate.create({
    data: {
      merchantId: travelMerchant.id,
      maxPerTransaction: 400000,   // ₹4,000
      dailyCap: 800000,            // ₹8,000
      autoApproveThreshold: 70000, // ₹700 (Cab ride auto-approved; flights gated)
      allowedCategories: ['travel.rides', 'travel.insurance', 'travel.addons'],
    },
  });

  // =========================================================================
  // Realistic Autonomous AI Agents with Real-World Tracks
  // =========================================================================
  const agentPVR = await prisma.agent.create({
    data: {
      id: 'movie-ticket-agent',
      name: 'Movie Ticket Booking Agent (PVR INOX & BookMyShow)',
      apiKeyHash: 'hash-pvr-movie-agent-key',
      revoked: false,
    },
  });

  const agentFood = await prisma.agent.create({
    data: {
      id: 'food-delivery-agent',
      name: 'Food Delivery Booking Agent (Zomato / Swiggy)',
      apiKeyHash: 'hash-food-delivery-agent-key',
      revoked: false,
    },
  });

  const agentGrocery = await prisma.agent.create({
    data: {
      id: 'quick-commerce-agent',
      name: 'Quick Commerce Agent (Blinkit / Zepto / Instamart)',
      apiKeyHash: 'hash-quick-commerce-agent-key',
      revoked: false,
    },
  });

  const agentTech = await prisma.agent.create({
    data: {
      id: 'amazon-tech-agent',
      name: 'Electronics & Gadget Agent (Amazon / Croma)',
      apiKeyHash: 'hash-amazon-tech-agent-key',
      revoked: false,
    },
  });

  const agentTravel = await prisma.agent.create({
    data: {
      id: 'travel-booking-agent',
      name: 'Travel & Cab Booking Agent (MakeMyTrip / Uber)',
      apiKeyHash: 'hash-travel-booking-agent-key',
      revoked: false,
    },
  });

  const agentClaude = await prisma.agent.create({
    data: {
      id: 'claude-desktop',
      name: 'Claude Desktop Personal Assistant (Multi-Platform MCP)',
      apiKeyHash: 'hash-claude-desktop-key',
      revoked: false,
    },
  });

  // =========================================================================
  // Active Mandates Binding Agents to Merchant Verticals
  // =========================================================================
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

  // Dedicated vertical mandates
  const mPVR = await createMandate(agentPVR, pvrMerchant, pvrTemplate);
  const mFood = await createMandate(agentFood, foodMerchant, foodTemplate);
  const mGrocery = await createMandate(agentGrocery, groceryMerchant, groceryTemplate);
  const mTech = await createMandate(agentTech, techMerchant, techTemplate);
  const mTravel = await createMandate(agentTravel, travelMerchant, travelTemplate);

  // Multi-merchant mandates for Claude Desktop personal assistant
  const mClaude1 = await createMandate(agentClaude, pvrMerchant, pvrTemplate);
  const mClaude2 = await createMandate(agentClaude, foodMerchant, foodTemplate);
  const mClaude3 = await createMandate(agentClaude, groceryMerchant, groceryTemplate);
  const mClaude4 = await createMandate(agentClaude, techMerchant, techTemplate);
  const mClaude5 = await createMandate(agentClaude, travelMerchant, travelTemplate);

  // =========================================================================
  // Seed Historical Co-Purchase Transactions across all Tracks
  // =========================================================================
  console.log('📊 Seeding historical transaction baskets for co-purchase frequency engine across all tracks...');

  const historicalBaskets = [
    // 🎬 Track 1: PVR / IMAX Movie Baskets
    { mandate: mPVR, agent: agentPVR, items: [{ sku: 'pvr-imax-3d-ticket', qty: 1, unitPrice: 45000 }, { sku: 'pvr-caramel-popcorn-tub', qty: 1, unitPrice: 28000 }] },
    { mandate: mPVR, agent: agentPVR, items: [{ sku: 'pvr-imax-3d-ticket', qty: 1, unitPrice: 45000 }, { sku: 'pvr-pepsi-twin-fountain', qty: 1, unitPrice: 18000 }] },
    { mandate: mClaude1, agent: agentClaude, items: [{ sku: 'pvr-imax-3d-ticket', qty: 1, unitPrice: 45000 }, { sku: 'pvr-caramel-popcorn-tub', qty: 1, unitPrice: 28000 }, { sku: 'pvr-pepsi-twin-fountain', qty: 1, unitPrice: 18000 }] },
    { mandate: mPVR, agent: agentPVR, items: [{ sku: 'pvr-nachos-salsa-combo', qty: 1, unitPrice: 24000 }, { sku: 'pvr-pepsi-twin-fountain', qty: 1, unitPrice: 18000 }] },

    // 🍕 Track 2: Zomato / Swiggy Food Baskets
    { mandate: mFood, agent: agentFood, items: [{ sku: 'swiggy-smoky-paneer-pizza', qty: 1, unitPrice: 39900 }, { sku: 'zomato-garlic-breadsticks', qty: 1, unitPrice: 14900 }] },
    { mandate: mFood, agent: agentFood, items: [{ sku: 'swiggy-smoky-paneer-pizza', qty: 1, unitPrice: 39900 }, { sku: 'swiggy-choco-lava-cake', qty: 1, unitPrice: 10900 }] },
    { mandate: mClaude2, agent: agentClaude, items: [{ sku: 'swiggy-smoky-paneer-pizza', qty: 1, unitPrice: 39900 }, { sku: 'zomato-garlic-breadsticks', qty: 1, unitPrice: 14900 }, { sku: 'zomato-cold-coffee-frappe', qty: 1, unitPrice: 12900 }] },

    // 🛒 Track 3: Blinkit / Zepto Grocery Baskets
    { mandate: mGrocery, agent: agentGrocery, items: [{ sku: 'blinkit-artisan-bread', qty: 1, unitPrice: 4500 }, { sku: 'blinkit-amul-butter', qty: 1, unitPrice: 6500 }] },
    { mandate: mGrocery, agent: agentGrocery, items: [{ sku: 'blinkit-artisan-bread', qty: 1, unitPrice: 4500 }, { sku: 'blinkit-amul-milk', qty: 1, unitPrice: 6800 }, { sku: 'zepto-organic-eggs', qty: 1, unitPrice: 9500 }] },
    { mandate: mClaude3, agent: agentClaude, items: [{ sku: 'blinkit-basmati-rice-5kg', qty: 1, unitPrice: 58000 }, { sku: 'instamart-toor-dal-1kg', qty: 1, unitPrice: 17500 }, { sku: 'zepto-cow-ghee-500ml', qty: 1, unitPrice: 48000 }] },

    // ⚡ Track 4: Amazon / Croma Tech Baskets
    { mandate: mTech, agent: agentTech, items: [{ sku: 'croma-gan-65w-charger', qty: 1, unitPrice: 189900 }, { sku: 'amazon-usbc-braided-cable', qty: 1, unitPrice: 49900 }] },
    { mandate: mClaude4, agent: agentClaude, items: [{ sku: 'amazon-anc-earbuds-pro', qty: 1, unitPrice: 349900 }, { sku: 'amazon-earbuds-silicone-case', qty: 1, unitPrice: 39900 }] },

    // ✈️ Track 5: MakeMyTrip / Uber Travel Baskets
    { mandate: mTravel, agent: agentTravel, items: [{ sku: 'uber-airport-premier-cab', qty: 1, unitPrice: 65000 }, { sku: 'mmt-travel-insurance', qty: 1, unitPrice: 19900 }] },
    { mandate: mClaude5, agent: agentClaude, items: [{ sku: 'uber-airport-premier-cab', qty: 1, unitPrice: 65000 }, { sku: 'mmt-inflight-meal-seat', qty: 1, unitPrice: 35000 }, { sku: 'mmt-travel-insurance', qty: 1, unitPrice: 19900 }] },
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
        createdAt: new Date(Date.now() - (i + 1) * 3600000 * 3), // spread over past few days
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

  console.log('✅ Seed completed successfully with Real-World Tracks & Platforms:');
  console.log(`   - 5 Real-World Merchants: "PVR INOX & IMAX", "Zomato & Swiggy Kitchen", "Blinkit & Instamart", "Amazon & Croma Hub", "MakeMyTrip & Uber"`);
  console.log(`   - 24 Products across 5 retail & service tracks`);
  console.log(`   - 6 Autonomous AI Agents & 10 Active Mandates`);
  console.log(`   - ${historicalBaskets.length} Initial Co-Purchase Order History Records`);
}

main().finally(() => prisma.$disconnect());