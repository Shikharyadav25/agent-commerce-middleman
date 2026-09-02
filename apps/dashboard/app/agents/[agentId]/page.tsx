'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  Calendar,
  Layers,
  History,
  Tag,
  ShoppingBag,
  Check,
  Copy,
} from 'lucide-react';

interface TransactionItem {
  id: string;
  correlationId: string;
  state: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
  quote?: {
    id: string;
    items: Array<{ sku: string; qty: number; unitPrice?: number }>;
    total: number;
  };
  pendingApproval?: {
    id: string;
    decision: string | null;
    decidedBy?: string | null;
  } | null;
  auditLogs?: Array<{
    id: string;
    step: string;
    decision: string;
    reason: string;
    ruleId?: string | null;
    actor: string;
    createdAt: string;
  }>;
}

interface AgentDetail {
  id: string;
  name: string;
  revoked: boolean;
  createdAt: string;
  stats: {
    totalTransactions: number;
    totalSpentPaise: number;
    todaySpentPaise: number;
    dailyCapPaise: number;
    perTxnCapPaise: number;
    autoApproveThresholdPaise: number;
    pendingApprovals: number;
  };
  mandates: Array<{
    id: string;
    merchantId: string;
    dailyCap: number;
    maxPerTransaction: number;
    autoApproveThreshold: number;
    allowedCategories: string[];
  }>;
  transactions: TransactionItem[];
}

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'paid' | 'gated' | 'failed' | 'other'>('all');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3000/v1/agents/${encodeURIComponent(agentId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setAgent(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agent profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
    const interval = setInterval(fetchAgent, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  const handleToggleRevoke = async () => {
    if (!agent) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`http://localhost:3000/v1/agents/${encodeURIComponent(agent.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: !agent.revoked }),
      });
      if (!res.ok) throw new Error('Failed to update agent status');
      await fetchAgent();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleSyncWithRazorpay = async () => {
    setSyncing(true);
    try {
      await fetchAgent();
    } finally {
      setSyncing(false);
    }
  };

  const syncSingleTransaction = async (txId: string) => {
    try {
      await fetch(`http://localhost:3000/v1/transactions/${txId}/sync`, { method: 'POST' });
      await fetchAgent();
    } catch (err) {
      console.warn('Sync error:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredTransactions = (agent?.transactions || []).filter((tx) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'paid') return tx.state === 'paid';
    if (activeFilter === 'gated') return tx.state === 'gated' || (tx.pendingApproval && !tx.pendingApproval.decision);
    if (activeFilter === 'failed') return tx.state === 'failed';
    return tx.state !== 'paid' && tx.state !== 'gated' && tx.state !== 'failed';
  });

  const getAgentTheme = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('claude')) return 'from-amber-500 to-orange-600';
    if (n.includes('gpt') || n.includes('openai')) return 'from-emerald-500 to-teal-600';
    if (n.includes('gemini')) return 'from-blue-500 to-indigo-600';
    return 'from-purple-500 to-pink-600';
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'paid':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Paid</span>;
      case 'gated':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">Gated (Review)</span>;
      case 'order_created':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">Order Created</span>;
      case 'refunded':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">Refunded</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">{state}</span>;
    }
  };

  if (loading && !agent) {
    return (
      <div className="py-24 text-center text-zinc-500 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
        <span>Loading agent profile and records...</span>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4 max-w-lg mx-auto py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Agent Not Found</h2>
        <p className="text-xs text-zinc-400">{error || 'Could not find agent with the specified ID.'}</p>
        <Link
          href="/agents"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Agent Directory</span>
        </Link>
      </div>
    );
  }

  const primaryMandate = agent.mandates?.[0];
  const dailyCap = agent.stats?.dailyCapPaise || 200000;
  const todaySpent = agent.stats?.todaySpentPaise || 0;
  const pctSpent = Math.min(100, Math.round((todaySpent / dailyCap) * 100));

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/agents"
          className="inline-flex items-center space-x-2 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Agents</span>
        </Link>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncWithRazorpay}
            disabled={syncing || loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 text-xs font-semibold transition-all cursor-pointer"
            title="Fetch latest payment capture states from Razorpay"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync with Razorpay'}</span>
          </button>

          <button
            onClick={handleToggleRevoke}
            disabled={togglingStatus}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              agent.revoked
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
            }`}
          >
            {agent.revoked ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Re-activate Agent</span>
              </>
            ) : (
              <>
                <ShieldX className="w-4 h-4" />
                <span>Revoke Agent Access</span>
              </>
            )}
          </button>

          <button
            onClick={fetchAgent}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Agent Banner Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAgentTheme(
                agent.name
              )} flex items-center justify-center shadow-lg flex-shrink-0`}
            >
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{agent.name}</h1>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    agent.revoked
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {agent.revoked ? 'Access Revoked' : 'Active & Authorized'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-400 font-mono">
                <span className="flex items-center space-x-1">
                  <span>ID: {agent.id}</span>
                  <button
                    onClick={() => copyToClipboard(agent.id)}
                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </span>
                <span className="text-zinc-600">&bull;</span>
                <span className="flex items-center space-x-1 text-zinc-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Provisioned: {new Date(agent.createdAt).toLocaleDateString()}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Guardrails & Spend Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Daily Cap Meter */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>Daily Spending Cap</span>
            </span>
            <span className="text-xs font-mono font-bold text-zinc-100">
              ₹{(todaySpent / 100).toLocaleString('en-IN')} / ₹{(dailyCap / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden mb-2">
            <div
              className={`h-full transition-all rounded-full ${
                pctSpent > 80 ? 'bg-rose-500' : pctSpent > 50 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${pctSpent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{pctSpent}% limit consumed today</span>
            <span>24h rolling reset</span>
          </div>
        </div>

        {/* Policy Limits */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Deterministic Policy Limits</span>
          </span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase font-medium block">Per-Txn Cap</span>
              <span className="font-bold text-zinc-100 text-sm">
                ₹{((primaryMandate?.maxPerTransaction || 200000) / 100).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase font-medium block">Auto-Approve</span>
              <span className="font-bold text-emerald-400 text-sm">
                &le; ₹{((primaryMandate?.autoApproveThreshold || 50000) / 100).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Allowed Categories */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2 mb-3">
            <Tag className="w-4 h-4 text-purple-400" />
            <span>Allowed Categories</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(primaryMandate?.allowedCategories || ['grocery.staples', 'grocery.dairy', 'grocery.bakery']).map(
              (cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] font-mono"
                >
                  {cat}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Transaction Records Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              <span>Purchase Records for {agent.name}</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Complete transaction log and policy decision history for this agent
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilter === 'all' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({agent.transactions?.length || 0})
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilter === 'paid' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Paid
            </button>
            <button
              onClick={() => setActiveFilter('gated')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilter === 'gated' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Gated
            </button>
            <button
              onClick={() => setActiveFilter('failed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilter === 'failed' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Date &amp; Time</th>
                  <th className="py-3.5 px-4 font-semibold">Items / SKU</th>
                  <th className="py-3.5 px-4 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 font-semibold">State</th>
                  <th className="py-3.5 px-4 font-semibold">Razorpay Order ID</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Audit Trail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTransactions.map((tx) => {
                  const items = tx.quote?.items || [];
                  const total = tx.quote?.total || 0;

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <span className="font-mono text-zinc-200">{item.sku}</span>
                              <span className="text-[10px] text-zinc-500 font-semibold">&times;{item.qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-white font-mono text-sm">
                        ₹{(total / 100).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStateBadge(tx.state)}
                          {tx.state === 'order_created' && tx.razorpayOrderId && (
                            <button
                              onClick={() => syncSingleTransaction(tx.id)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition-all cursor-pointer"
                              title="Check payment status with Razorpay"
                            >
                              Sync
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-zinc-400">
                        {tx.razorpayOrderId || <span className="text-zinc-600">&mdash;</span>}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link
                          href={`/audit/${tx.correlationId}`}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-blue-600/20 text-zinc-300 hover:text-blue-300 border border-zinc-700/60 hover:border-blue-500/40 text-[11px] font-semibold transition-all"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Audit Graph</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                      No purchase records match the selected filter for this agent.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
