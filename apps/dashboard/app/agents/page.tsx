'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface AgentRecord {
  id: string;
  name: string;
  revoked: boolean;
  createdAt: string;
  mandate?: {
    id: string;
    dailyCap: number;
    maxPerTransaction: number;
    autoApproveThreshold: number;
    allowedCategories: string[];
  } | null;
  stats: {
    totalTransactions: number;
    totalSpentPaise: number;
    todaySpentPaise: number;
    dailyCapPaise: number;
    perTxnCapPaise: number;
    autoApproveThresholdPaise: number;
    pendingApprovals: number;
    lastActiveAt: string;
    recentTransactions: any[];
  };
}

export default function AgentsHubPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simAgentName, setSimAgentName] = useState('ChatGPT Assistant');
  const [simSku, setSimSku] = useState('bread-white');
  const [simQty, setSimQty] = useState(1);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3000/v1/agents');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setAgents(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agents list. Make sure Fastify API is running on :3000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    try {
      // 1. Get quote
      const quoteRes = await fetch('http://localhost:3000/v1/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ sku: simSku, qty: simQty }] }),
      });
      const quote = await quoteRes.json();

      // 2. Ensure agent and initiate payment
      const payRes = await fetch('http://localhost:3000/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-name': simAgentName,
        },
        body: JSON.stringify({
          quoteId: quote.id,
          agentName: simAgentName,
        }),
      });
      const payData = await payRes.json();
      setSimResult({ quote, payData });
      fetchAgents();
    } catch (err: any) {
      setSimResult({ error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAgents = agents.length;
  const totalLifetimeSpend = agents.reduce((sum, a) => sum + (a.stats?.totalSpentPaise || 0), 0);
  const totalTodaySpend = agents.reduce((sum, a) => sum + (a.stats?.todaySpentPaise || 0), 0);
  const totalPendingApprovals = agents.reduce((sum, a) => sum + (a.stats?.pendingApprovals || 0), 0);

  const getAgentTheme = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('claude')) {
      return {
        bg: 'from-amber-500/20 to-orange-600/10 border-amber-500/30 text-amber-300',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        gradient: 'from-amber-500 to-orange-600',
      };
    }
    if (n.includes('gpt') || n.includes('openai') || n.includes('chatgpt')) {
      return {
        bg: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30 text-emerald-300',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        gradient: 'from-emerald-500 to-teal-600',
      };
    }
    if (n.includes('gemini')) {
      return {
        bg: 'from-blue-500/20 to-indigo-600/10 border-blue-500/30 text-blue-300',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        gradient: 'from-blue-500 to-indigo-600',
      };
    }
    return {
      bg: 'from-purple-500/20 to-pink-600/10 border-purple-500/30 text-purple-300',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      gradient: 'from-purple-500 to-pink-600',
    };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">AI Agent Commerce Directory</h1>
              <p className="text-xs text-zinc-400">
                Deterministic financial budgets, purchase histories, and live guardrails for all connected LLM agents
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSimulateOpen(!isSimulateOpen)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Simulate / Connect Agent</span>
          </button>
          <button
            onClick={fetchAgents}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs transition-all cursor-pointer"
            title="Refresh Agents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Simulator Card (Toggleable) */}
      {isSimulateOpen && (
        <div className="p-6 rounded-2xl bg-[#0e1424] border border-blue-500/30 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-blue-400 text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Interactive Multi-Agent Test Simulator</span>
            </div>
            <button
              onClick={() => setIsSimulateOpen(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Test how our system dynamically provisions a new LLM agent &amp; active mandate on its very first transaction.
          </p>

          <form onSubmit={handleSimulatePurchase} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Agent Identity / Name</label>
              <input
                type="text"
                value={simAgentName}
                onChange={(e) => setSimAgentName(e.target.value)}
                placeholder="e.g. ChatGPT Assistant, Gemini Pro, AutoGPT"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Store Product SKU</label>
              <select
                value={simSku}
                onChange={(e) => setSimSku(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="bread-white">White bread loaf (₹50) - Auto-Approved</option>
                <option value="milk-1l">Full-cream milk, 1L (₹70) - Auto-Approved</option>
                <option value="eggs-dozen">Eggs, dozen (₹90) - Auto-Approved</option>
                <option value="toor-dal-1kg">Toor dal, 1kg (₹180) - Auto-Approved</option>
                <option value="ghee-500ml">Pure ghee, 500ml (₹450) - Auto-Approved</option>
                <option value="rice-basmati-5kg">Basmati rice, 5kg (₹650) - Gated Review (&gt;₹500)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="10"
                value={simQty}
                onChange={(e) => setSimQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {simulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Test Purchase</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {simResult && (
            <div className="mt-4 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-blue-400">Simulation Result:</span>
                {simResult.payData?.status === 'payment_link_created' && (
                  <span className="text-emerald-400">Auto-Approved (Payment Link Created)</span>
                )}
                {simResult.payData?.status === 'awaiting_human_approval' && (
                  <span className="text-amber-400">Held for Human Review (&gt; ₹500 Threshold)</span>
                )}
              </div>
              <pre className="overflow-x-auto text-[11px] text-zinc-400">
                {JSON.stringify(simResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Registered Agents</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white tracking-tight">{totalAgents}</span>
            <span className="text-xs text-zinc-500">Autonomous LLMs</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Today&apos;s Total Spend</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-emerald-400 tracking-tight">
              ₹{(totalTodaySpend / 100).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-zinc-500">24h Cumulative</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Lifetime Agent Volume</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-purple-400 tracking-tight">
              ₹{(totalLifetimeSpend / 100).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-zinc-500">Settled via Razorpay</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Gated Approvals</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-amber-400 tracking-tight">{totalPendingApprovals}</span>
            <span className="text-xs text-zinc-500">Awaiting Operator</span>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search agents by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && agents.length === 0 && (
        <div className="py-16 text-center text-zinc-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          <span>Loading connected AI agents...</span>
        </div>
      )}

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const theme = getAgentTheme(agent.name);
          const dailyCap = agent.stats?.dailyCapPaise || 200000;
          const todaySpent = agent.stats?.todaySpentPaise || 0;
          const pctSpent = Math.min(100, Math.round((todaySpent / dailyCap) * 100));

          return (
            <div
              key={agent.id}
              className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 hover:border-zinc-700 transition-all p-6 flex flex-col justify-between group shadow-lg hover:shadow-xl hover:shadow-blue-500/5"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${theme.gradient} flex items-center justify-center shadow-md`}>
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white tracking-tight group-hover:text-blue-400 transition-colors">
                        {agent.name}
                      </h3>
                      <p className="text-[11px] font-mono text-zinc-500">{agent.id}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      agent.revoked
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {agent.revoked ? 'Revoked' : 'Active'}
                  </span>
                </div>

                {/* Spend Meter */}
                <div className="mt-5 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-zinc-400">Daily Spend Limit</span>
                    <span className="font-mono font-semibold text-zinc-200">
                      ₹{(todaySpent / 100).toLocaleString('en-IN')} / ₹{(dailyCap / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        pctSpent > 80 ? 'bg-rose-500' : pctSpent > 50 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${pctSpent}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{pctSpent}% utilized today</span>
                    <span>Reset at 00:00 UTC</span>
                  </div>
                </div>

                {/* Mandate Guardrails Breakdown */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 uppercase font-medium block">Per-Txn Cap</span>
                    <span className="font-semibold text-zinc-200">
                      ₹{((agent.stats?.perTxnCapPaise || 200000) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 uppercase font-medium block">Auto-Approve</span>
                    <span className="font-semibold text-emerald-400">
                      &le; ₹{((agent.stats?.autoApproveThresholdPaise || 50000) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Total Purchases</span>
                    <span className="font-bold text-white">{agent.stats?.totalTransactions || 0} orders</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 block text-[11px]">Lifetime Spend</span>
                    <span className="font-bold text-purple-400">
                      ₹{((agent.stats?.totalSpentPaise || 0) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80">
                <Link
                  href={`/agents/${agent.id}`}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-zinc-800/80 hover:bg-blue-600/20 text-zinc-300 hover:text-blue-300 border border-zinc-700/60 hover:border-blue-500/40 text-xs font-semibold transition-all group-hover:border-blue-500/30"
                >
                  <span>View Records &amp; History</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAgents.length === 0 && !loading && (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800">
          <Bot className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-300">No AI agents found</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Click &quot;Simulate / Connect Agent&quot; above to create a test agent or connect via MCP.
          </p>
        </div>
      )}
    </div>
  );
}
