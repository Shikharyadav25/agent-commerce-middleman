import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const prisma = new PrismaClient();

/**
 * 1-Command Merchant Onboarding CLI
 * Usage:
 *   node scripts/onboard-merchant.js --name="QuickMed Pharmacy" --category="pharmacy" --file="path/to/catalog.json"
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (key, defaultVal) => {
    const found = args.find((a) => a.startsWith(`--${key}=`));
    return found ? found.split('=')[1].replace(/^["']|["']$/g, '') : defaultVal;
  };

  const name = getArg('name', 'QuickMed 24/7 Pharmacy');
  const category = getArg('category', 'healthcare.pharmacy');
  const maxPerTxn = parseInt(getArg('maxPerTxn', '300000'), 10); // ₹3,000
  const dailyCap = parseInt(getArg('dailyCap', '600000'), 10);    // ₹6,000
  const autoApprove = parseInt(getArg('autoApprove', '80000'), 10);// ₹800

  console.log(`\n🏥 =========================================================================`);
  console.log(`🚀 ONBOARDING NEW MERCHANT VERTICAL: "${name}"`);
  console.log(`=========================================================================\n`);

  // 1. Create Merchant
  const merchantId = `merchant-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const merchant = await prisma.merchant.create({
    data: {
      id: merchantId,
      name,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_merchant',
      sellingPolicy: {
        category,
        refundWindowDays: 14,
        onboardedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`✅ Merchant Created: ${merchant.name} (ID: ${merchant.id})`);

  // 2. Default or Custom Catalog Items
  const filePath = getArg('file', null);
  let productsData = [];

  if (filePath && fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    productsData = JSON.parse(fileContent);
  } else {
    // Default pharmacy starter catalog
    productsData = [
      { sku: 'first-aid-kit-pro', name: 'Comprehensive First Aid & Trauma Kit', price: 129900, stock: 50, category: 'healthcare.emergency', pairsWith: ['antiseptic-spray-100ml', 'thermometer-digital'], tags: ['emergency', 'medical'] },
      { sku: 'antiseptic-spray-100ml', name: 'RapidHeal Antiseptic Disinfectant Spray', price: 24900, stock: 120, category: 'healthcare.firstaid', pairsWith: ['first-aid-kit-pro', 'bandages-waterproof-pack'], tags: ['woundcare', 'antiseptic'] },
      { sku: 'thermometer-digital', name: 'Infrared No-Touch Instant Digital Thermometer', price: 79900, stock: 40, category: 'healthcare.devices', pairsWith: ['first-aid-kit-pro'], tags: ['device', 'diagnostic'] },
      { sku: 'bandages-waterproof-pack', name: 'Waterproof Sterile Bandages (50 Count)', price: 19900, stock: 200, category: 'healthcare.firstaid', pairsWith: ['antiseptic-spray-100ml'], tags: ['firstaid'] },
      { sku: 'electrolyte-hydration-powder', name: 'HydraMax Electrolyte Rehydration Sachets (Box of 10)', price: 34900, stock: 80, category: 'healthcare.wellness', pairsWith: [], tags: ['hydration', 'wellness'] },
    ];
  }

  const createdProducts = [];
  for (const item of productsData) {
    const prod = await prisma.product.create({
      data: {
        merchantId: merchant.id,
        sku: item.sku,
        name: item.name,
        price: item.price,
        currency: 'INR',
        stock: item.stock || 50,
        category: item.category || category,
        pairsWith: item.pairsWith || [],
        tags: item.tags || [],
      },
    });
    createdProducts.push(prod);
  }

  console.log(`📦 Registered ${createdProducts.length} catalog products:`);
  createdProducts.forEach((p) => {
    console.log(`   • [${p.sku}] ${p.name} — ₹${(p.price / 100).toFixed(2)} (Category: ${p.category})`);
  });

  // 3. Create Mandate Template
  const allowedCategories = [...new Set(createdProducts.map((p) => p.category))];
  const template = await prisma.mandateTemplate.create({
    data: {
      merchantId: merchant.id,
      maxPerTransaction: maxPerTxn,
      dailyCap: dailyCap,
      autoApproveThreshold: autoApprove,
      allowedCategories,
    },
  });

  console.log(`\n🛡️ Mandate Guardrails Configured:`);
  console.log(`   • Per-Transaction Cap      : ₹${(maxPerTxn / 100).toFixed(2)}`);
  console.log(`   • Daily Cumulative Cap     : ₹${(dailyCap / 100).toFixed(2)}`);
  console.log(`   • Auto-Approve Threshold   : ₹${(autoApprove / 100).toFixed(2)}`);
  console.log(`   • Category Whitelist       : ${allowedCategories.join(', ')}`);

  // 4. Auto-Provision Starter Mandate to Existing Active Agents
  const activeAgents = await prisma.agent.findMany({ where: { revoked: false } });
  for (const agent of activeAgents) {
    await prisma.mandate.create({
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
    console.log(`   ✨ Bound Mandate to Active Agent: "${agent.name}" (${agent.id})`);
  }

  console.log(`\n🎉 MERCHANT "${merchant.name}" IS NOW LIVE AND AGENT-TRANSACTABLE!`);
  console.log(`-------------------------------------------------------------------------\n`);
}

main()
  .catch((err) => console.error('Onboarding failed:', err))
  .finally(() => prisma.$disconnect());
