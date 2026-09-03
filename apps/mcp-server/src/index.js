import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'acm-commerce-gateway',
  version: '1.0.0',
});

const API_BASE = process.env.ACM_API_URL || 'http://localhost:3000';
const AGENT_NAME = process.env.ACM_AGENT_NAME || process.env.AGENT_NAME || 'Claude Desktop';
const AGENT_ID = process.env.ACM_AGENT_ID || process.env.AGENT_ID || AGENT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const AGENT_API_KEY = process.env.ACM_AGENT_API_KEY || process.env.AGENT_API_KEY || null;

async function safeFetch(url, options = {}) {
  try {
    const defaultHeaders = {
      'x-agent-id': AGENT_ID,
      'x-agent-name': AGENT_NAME,
      ...(AGENT_API_KEY ? { 'authorization': `Bearer ${AGENT_API_KEY}`, 'x-api-key': AGENT_API_KEY } : {}),
    };
    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({ status: res.status, statusText: res.statusText }));
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Gateway Connection Error',
            message: err.message,
            hint: 'Ensure Fastify backend is running on ' + API_BASE,
          }),
        },
      ],
      isError: true,
    };
  }
}

server.tool(
  'order_product',
  'PRIMARY TOOL: Use this tool to purchase or order tickets, meals, electronics, rides, or groceries whenever the user asks to buy anything (e.g. "book PVR IMAX ticket", "order Smoky Paneer Pizza on Swiggy", "buy GaN 65W charger on Amazon", "book Uber airport cab", "order bread on Blinkit"). Searches the merchant catalog, gets a deterministic price quote, and executes payment under active zero-trust mandate, returning the Razorpay checkout link.',
  {
    query: z.string().describe('Item name or SKU to purchase (e.g. "pvr imax ticket", "paneer pizza", "bread", "charger", "power bank", "uber cab", "milk")'),
    quantity: z.number().default(1).describe('Quantity to purchase (defaults to 1)'),
  },
  async ({ query, quantity = 1 }) => {
    try {
      const catRes = await fetch(`${API_BASE}/v1/catalog`, {
        headers: { 'x-agent-id': AGENT_ID, 'x-agent-name': AGENT_NAME },
      });
      const catalog = await catRes.json();
      const q = query.toLowerCase().trim();

      const item = catalog.find((p) => {
        const skuLower = p.sku.toLowerCase();
        const nameLower = p.name.toLowerCase();
        if (skuLower === q || nameLower === q) return true;
        if (skuLower.includes(q) || nameLower.includes(q)) return true;
        const words = q.split(/\s+/).filter((w) => w.length > 2);
        if (words.length > 0 && words.every((w) => nameLower.includes(w) || skuLower.includes(w))) return true;
        return false;
      });

      if (!item) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Product not found matching "${query}"`,
                  availableItems: catalog.map((p) => ({ sku: p.sku, name: p.name, price: `₹${p.price / 100}` })),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const quoteRes = await fetch(`${API_BASE}/v1/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-id': AGENT_ID, 'x-agent-name': AGENT_NAME },
        body: JSON.stringify({ items: [{ sku: item.sku, qty: quantity }] }),
      });
      const quote = await quoteRes.json();

      const mandateRes = await fetch(`${API_BASE}/v1/mandates?agentId=${encodeURIComponent(AGENT_ID)}&agentName=${encodeURIComponent(AGENT_NAME)}`, {
        headers: { 'x-agent-id': AGENT_ID, 'x-agent-name': AGENT_NAME },
      });
      const mandates = await mandateRes.json();
      const mandateId = Array.isArray(mandates) && mandates.length > 0 ? mandates[0].id : null;

      const payRes = await fetch(`${API_BASE}/v1/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-id': AGENT_ID, 'x-agent-name': AGENT_NAME },
        body: JSON.stringify({
          quoteId: quote.id,
          mandateId,
          agentId: AGENT_ID,
          agentName: AGENT_NAME,
        }),
      });
      const payData = await payRes.json();

      if (payData.status === 'denied') {
        const diag = payData.diagnosis;
        const gemini = payData.geminiReport;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'TRANSACTION_BLOCKED',
                  reason: payData.reason,
                  agentRevoked: Boolean(payData.agentRevoked),
                  geminiVerdict: gemini?.verdict || null,
                  geminiBrief: gemini?.executiveBrief || null,
                  issueType: diag?.issueType || 'POLICY_VIOLATION',
                  forensicSummary: diag?.forensicSummary || payData.reason,
                  agentActionableGuidance: gemini?.recommendedAction || diag?.agentActionableInstructions || 'Review user request and policy limits.',
                  suggestedRemediation: gemini?.suggestedRemediation || diag?.suggestedRemediation || null,
                  safetyWarning: diag?.safetyWarning || null,
                  correlationId: payData.correlationId,
                  geminiReport: gemini || null,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      if (payData.status === 'awaiting_human_approval') {
        const diag = payData.diagnosis;
        const gemini = payData.geminiReport;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'HELD_FOR_HUMAN_APPROVAL',
                  reason: payData.reason,
                  geminiVerdict: gemini?.verdict || 'HOLD_FOR_HUMAN_REVIEW',
                  geminiBrief: gemini?.executiveBrief || null,
                  issueType: diag?.issueType || 'POLICY_THRESHOLD',
                  forensicSummary: diag?.forensicSummary || payData.reason,
                  agentActionableGuidance: gemini?.recommendedAction || diag?.agentActionableInstructions || 'Held for human review on ACM dashboard.',
                  suggestedRemediation: gemini?.suggestedRemediation || diag?.suggestedRemediation || null,
                  transactionId: payData.transactionId,
                  correlationId: payData.correlationId,
                  geminiReport: gemini || null,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                agent: { id: AGENT_ID, name: AGENT_NAME },
                itemPurchased: { sku: item.sku, name: item.name, qty: quantity, total: `₹${quote.total / 100}` },
                paymentResult: payData,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'browse_catalog',
  'List all available merchant products and grocery items with SKU, pricing, and stock (e.g. bread-white, milk-1l, eggs-dozen, ghee-500ml, toor-dal-1kg, rice-basmati-5kg)',
  {},
  async () => {
    return await safeFetch(`${API_BASE}/v1/catalog`);
  }
);

server.tool(
  'get_active_mandate',
  'Get active spending mandates and authorization limits for this AI agent (including max transaction cap, auto-approval thresholds, and merchant info)',
  {},
  async () => {
    return await safeFetch(`${API_BASE}/v1/mandates?agentId=${encodeURIComponent(AGENT_ID)}&agentName=${encodeURIComponent(AGENT_NAME)}`);
  }
);

server.tool(
  'get_quote',
  'Generate an official price quote for chosen items before initiating payment. Accepts an array of item objects with "sku" (e.g. "bread-white") and "qty" (e.g. 1)',
  {
    items: z.array(
      z.object({
        sku: z.string().describe('The product SKU identifier (e.g. pvr-imax-3d-ticket, swiggy-smoky-paneer-pizza, blinkit-artisan-bread, voltcharge-gan-65w, uber-premier-airport-cab)'),
        qty: z.number().describe('Quantity of the item to purchase'),
      })
    ),
  },
  async ({ items }) => {
    return await safeFetch(`${API_BASE}/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  }
);

server.tool(
  'initiate_payment',
  'Submit a quote for payment evaluation under this agent. Automatically binds to this agent\'s mandate. Returns instant Razorpay payment link for approved orders, or routes to human approval if limits are exceeded.',
  {
    quoteId: z.string().describe('The quote ID obtained from get_quote'),
    mandateId: z.string().optional().describe('Optional mandate ID. If omitted, this agent\'s active mandate is used automatically.'),
  },
  async ({ quoteId, mandateId }) => {
    let resolvedMandateId = mandateId;
    if (!resolvedMandateId) {
      try {
        const res = await fetch(`${API_BASE}/v1/mandates?agentId=${encodeURIComponent(AGENT_ID)}&agentName=${encodeURIComponent(AGENT_NAME)}`, {
          headers: { 'x-agent-id': AGENT_ID, 'x-agent-name': AGENT_NAME },
        });
        const mandates = await res.json();
        if (Array.isArray(mandates) && mandates.length > 0) {
          resolvedMandateId = mandates[0].id;
        }
      } catch {
        // fallback
      }
    }

    return await safeFetch(`${API_BASE}/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId,
        mandateId: resolvedMandateId,
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
      }),
    });
  }
);

server.tool(
  'check_status',
  'Check the live status and payment state of a transaction (e.g. order_created, paid, gated, failed)',
  {
    transactionId: z.string().describe('The transaction ID or correlation ID'),
  },
  async ({ transactionId }) => {
    return await safeFetch(`${API_BASE}/v1/transactions/${transactionId}`);
  }
);

server.tool(
  'suggest_addons',
  'Suggest smart complementary add-ons based on items already in the shopping cart (e.g. passing ["bread-white"] recommends ["butter-salted-500g"])',
  {
    skus: z.array(z.string()).describe('Array of product SKUs currently in cart'),
  },
  async ({ skus }) => {
    return await safeFetch(`${API_BASE}/v1/suggest-addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus }),
    });
  }
);

server.tool(
  'request_refund',
  'Request a Razorpay refund for a completed paid transaction',
  {
    transactionId: z.string().describe('Transaction ID of the paid order'),
    reason: z.string().optional().describe('Reason for refund'),
  },
  async ({ transactionId, reason }) => {
    return await safeFetch(`${API_BASE}/v1/transactions/${transactionId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  }
);

server.tool(
  'diagnose_payment_issue',
  'AI Agent Self-Correction & Diagnostic Tool: Call this tool when an autonomous payment fails, is gated, or gets blocked. Returns root-cause analysis (hallucination vs malicious threat vs policy cap) and step-by-step actionable instructions on how to adjust your prompt or cart.',
  {
    correlationId: z.string().optional().describe('The correlationId of the failed or gated transaction'),
    userIntentPrompt: z.string().optional().describe('Original natural language prompt from user (e.g. "order bread under ₹100")'),
    errorReason: z.string().optional().describe('The error or denial reason received'),
    buyerAgentExplanation: z.string().optional().describe('Your self-explanation or defense for selecting the cart items'),
  },
  async ({ correlationId, userIntentPrompt, errorReason, buyerAgentExplanation }) => {
    return await safeFetch(`${API_BASE}/v1/diagnostics/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correlationId, userIntentPrompt, errorReason, buyerAgentExplanation }),
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);