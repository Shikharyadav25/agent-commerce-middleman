import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'acg-mcp-server', version: '0.1.0' });

server.tool(
  'browse_catalog',
  'List available products from the merchant catalog',
  {},
  async () => {
    const res = await fetch('http://localhost:3000/v1/catalog');
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'get_quote',
  'Get a price quote for chosen items',
  { items: z.array(z.object({ sku: z.string(), qty: z.number() })) },
  async ({ items }) => {
    const res = await fetch('http://localhost:3000/v1/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'initiate_payment',
  'Start payment for a quote, subject to mandate checks',
  { quoteId: z.string(), mandateId: z.string() },
  async ({ quoteId, mandateId }) => {
    const res = await fetch('http://localhost:3000/v1/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, mandateId }),
    });
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'check_status',
  'Check the status of a transaction',
  { transactionId: z.string() },
  async ({ transactionId }) => {
    const res = await fetch(`http://localhost:3000/v1/transactions/${transactionId}`);
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
server.tool(
  'suggest_addons',
  'Suggest complementary products based on items already in the cart',
  { skus: z.array(z.string()) },
  async ({ skus }) => {
    const res = await fetch('http://localhost:3000/v1/suggest-addons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus }),
    });
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'request_refund',
  'Request a refund for a completed transaction',
  { transactionId: z.string(), reason: z.string().optional() },
  async ({ transactionId, reason }) => {
    const res = await fetch(`http://localhost:3000/v1/transactions/${transactionId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);