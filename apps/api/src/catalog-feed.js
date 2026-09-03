/**
 * 📦 ACM Standards-Compliant Agent-Readable Product Feed
 * Implements W3C / Schema.org JSON-LD DataFeed and Agentic Commerce standards.
 */

export function buildJsonLdCatalogFeed(products = [], merchant = null, options = {}) {
  const merchantName = merchant?.name || 'ACM Certified Merchant';
  const merchantId = merchant?.id || 'merchant-default';

  const dataFeedElements = products.map((prod) => {
    const unitPriceRupees = (prod.price / 100).toFixed(2);
    const inStock = prod.stock > 0;

    return {
      '@type': 'Product',
      '@id': `urn:acm:product:${prod.sku}`,
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      offers: {
        '@type': 'Offer',
        price: unitPriceRupees,
        priceCurrency: prod.currency || 'INR',
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        inventoryLevel: {
          '@type': 'QuantitativeValue',
          value: prod.stock,
        },
        seller: {
          '@type': 'Organization',
          name: merchantName,
          identifier: merchantId,
        },
      },
      // Machine-actionable Agentic Commerce extensions
      agentPurchasing: {
        directCheckoutAllowed: inStock,
        maxQuantityPerOrder: Math.min(prod.stock, 10),
        supportedProtocols: ['MCP', 'ACP', 'REST', 'AP2'],
        requiredProofOfAuthority: false,
        intentKeywords: [
          ...(prod.tags || []),
          ...prod.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          prod.category,
        ],
        pairsWith: prod.pairsWith || [],
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'DataFeed',
    name: `${merchantName} - Autonomous Agent Catalog Feed`,
    description: 'Structured agent-readable product catalog with live inventory and pricing for autonomous AI buyers.',
    dateModified: new Date().toISOString(),
    provider: {
      '@type': 'Organization',
      name: 'Agent Commerce Middleman (ACM)',
      url: 'https://github.com/Shikharyadav25/agent-commerce-middleman',
    },
    dataFeedElement: dataFeedElements,
  };
}

export function buildAgentProductFeed(products = [], merchant = null) {
  const feed = buildJsonLdCatalogFeed(products, merchant);
  return {
    version: '1.0.0-agentic',
    standard: 'ACM-AgentFeed-v1',
    merchant: {
      id: merchant?.id || 'merchant-default',
      name: merchant?.name || 'ACM Certified Merchant',
    },
    totalProducts: products.length,
    inStockCount: products.filter((p) => p.stock > 0).length,
    products: feed.dataFeedElement,
  };
}

export function buildHtmlCatalogView(products = [], merchant = null) {
  const jsonLd = buildJsonLdCatalogFeed(products, merchant);
  const merchantName = merchant?.name || 'ACM Certified Merchant Store';

  const productCards = products
    .map((p) => {
      const priceRupees = (p.price / 100).toFixed(2);
      const inStock = p.stock > 0;
      return `
      <div class="product-card" id="product-${p.sku}">
        <div class="header">
          <span class="category-badge">${p.category}</span>
          <span class="stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">${inStock ? 'In Stock (' + p.stock + ')' : 'Sold Out'}</span>
        </div>
        <h3 class="product-name">${p.name}</h3>
        <p class="sku font-mono">SKU: ${p.sku}</p>
        <div class="footer">
          <span class="price">₹${priceRupees}</span>
          <span class="agent-tag">🤖 Agent Direct Checkout</span>
        </div>
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${merchantName} — Agent-Readable Catalog Feed</title>
  <meta name="description" content="Structured product feed designed for autonomous AI agents and conversational buyers via ACM Gateway.">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 2rem; }
    .container { max-width: 1100px; margin: 0 auto; }
    .header-box { border-bottom: 1px solid #27272a; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { margin: 0 0 0.5rem 0; font-size: 1.75rem; color: #fff; }
    .tagline { color: #a1a1aa; font-size: 0.875rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .product-card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 1.25rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .category-badge { font-size: 0.7rem; color: #60a5fa; background: #1e3a8a33; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; font-weight: 600; }
    .stock-badge.in-stock { font-size: 0.7rem; color: #34d399; background: #064e3b33; padding: 2px 8px; border-radius: 9999px; }
    .stock-badge.out-of-stock { font-size: 0.7rem; color: #f87171; background: #7f1d1d33; padding: 2px 8px; border-radius: 9999px; }
    .product-name { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.25rem 0; }
    .sku { font-size: 0.75rem; color: #71717a; margin: 0 0 1rem 0; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #27272a; padding-top: 0.75rem; }
    .price { font-size: 1.2rem; font-weight: 800; color: #fff; }
    .agent-tag { font-size: 0.7rem; color: #a1a1aa; }
    .font-mono { font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-box">
      <h1>${merchantName}</h1>
      <p class="tagline">W3C Schema.org compliant agent-readable product feed with embedded JSON-LD metadata for AI buyers.</p>
    </div>
    <div class="grid">
      ${productCards}
    </div>
  </div>
</body>
</html>`;
}
