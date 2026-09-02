'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Check,
  X,
  RefreshCw,
  Clock,
  ExternalLink,
  Copy,
  CheckCheck,
  ShoppingBag,
  Bot,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Building2,
  TrendingUp,
  Sparkles,
  Shield,
  Zap,
} from 'lucide-react';

interface CartItem {
  sku: string;
  qty: number;
  unitPrice?: number;
  name?: string;
}

interface Quote {
  id: string;
  items: CartItem[];
  total: number; // in paise
  expiresAt: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Mandate {
  id: string;
  agentId: string;
  merchantId: string;
  maxPerTransaction: number;
  dailyCap: number;
  autoApproveThreshold: number;
  allowedCategories: string[];
  agent?: Agent;
}

interface AuditLogRow {
  id: string;
  correlationId: string;
  step: string;
  decision: string;
  reason: string;
  ruleId?: string | null;
  actor: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  correlationId: string;
  mandateId: string;
  quoteId: string;
  state: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
  quote?: Quote;
  mandate?: Mandate;
  auditLogs?: AuditLogRow[];
}

interface PendingApproval {
  id: string;
  transactionId: string;
  expiresAt: string;
  decidedBy?: string | null;
  decision?: string | null;
  createdAt: string;
  transaction: Transaction;
}

interface PaymentModalData {
  transactionId: string;
  orderId?: string;
  paymentLinkUrl: string;
  amountPaise: number;
  correlationId?: string;
  agentName?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function extractPaymentLink(approval: PendingApproval, localLinks: Record<string, string>): string | null {
  if (localLinks[approval.id]) return localLinks[approval.id];
  if (localLinks[approval.transactionId]) return localLinks[approval.transactionId];
  if (approval.transaction?.id && localLinks[approval.transaction.id]) return localLinks[approval.transaction.id];

  const logs = approval.transaction?.auditLogs || [];
  for (const log of logs) {
    const match = log.reason?.match(/https:\/\/rzp\.io\/[a-zA-Z0-9_\-\/]+/);
    if (match) return match[0];
  }
  return null;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'decided' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, 'approving' | 'declining' | null>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info'; linkUrl?: string } | null>(null);
  const [activePaymentModal, setActivePaymentModal] = useState<PaymentModalData | null>(null);
  const [generatedPaymentLinks, setGeneratedPaymentLinks] = useState<Record<string, string>>({});

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info', linkUrl?: string) => {
    setNotification({ message, type, linkUrl });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showNotification(`Copied ${label} to clipboard`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchApprovals = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/pending-approvals?status=${filter}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`API responded with status ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pending approvals';
      console.warn('Approvals fetch error:', message);
      setError(message);

      // If server is not responding during local standalone preview, use demo items
      if (approvals.length === 0) {
        setApprovals(getFallbackApprovals());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, approvals.length]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecision = async (id: string, decision: 'approved' | 'declined', customReason?: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: decision === 'approved' ? 'approving' : 'declining' }));

    try {
      const res = await fetch(`${API_BASE}/v1/pending-approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decidedBy: 'human:admin',
          reason: customReason || (decision === 'approved' ? 'Approved via dashboard interface' : 'Declined via dashboard interface'),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Action failed with status ${res.status}`);
      }

      const result = await res.json();
      const linkUrl = result.paymentLinkUrl;
      const currentItem = approvals.find((a) => a.id === id || a.transactionId === id);

      if (linkUrl) {
        setGeneratedPaymentLinks((prev) => ({
          ...prev,
          [id]: linkUrl,
          [result.transaction?.id || '']: linkUrl,
          [currentItem?.transactionId || '']: linkUrl,
        }));

        setActivePaymentModal({
          transactionId: result.transaction?.id || currentItem?.transactionId || id,
          orderId: result.transaction?.razorpayOrderId || undefined,
          paymentLinkUrl: linkUrl,
          amountPaise: currentItem?.transaction?.quote?.total || 0,
          correlationId: currentItem?.transaction?.correlationId,
          agentName: currentItem?.transaction?.mandate?.agent?.name,
        });
      }

      showNotification(
        decision === 'approved'
          ? `Transaction approved! ${linkUrl ? 'Razorpay payment link generated.' : ''}`
          : 'Transaction declined. Agent notified.',
        decision === 'approved' ? 'success' : 'error',
        linkUrl
      );

      // Optimistically update local state
      setApprovals((prev) =>
        prev.map((item) =>
          item.id === id || item.transactionId === id
            ? {
                ...item,
                decision,
                decidedBy: 'human:admin',
                transaction: {
                  ...item.transaction,
                  state: decision === 'approved' ? 'order_created' : 'failed',
                  razorpayOrderId: result.transaction?.razorpayOrderId || item.transaction?.razorpayOrderId,
                },
              }
            : item
        )
      );

      // Refresh list to sync with server
      setTimeout(() => fetchApprovals(), 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing decision';
      showNotification(`Failed to ${decision}: ${msg}`, 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const filteredApprovals = approvals.filter((item) => {
    if (filter === 'pending' && item.decision !== null && item.decision !== undefined) return false;
    if (filter === 'decided' && (item.decision === null || item.decision === undefined)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const agentName = item.transaction?.mandate?.agent?.name?.toLowerCase() || '';
    const correlationId = item.transaction?.correlationId?.toLowerCase() || '';
    const txId = item.transactionId?.toLowerCase() || '';
    return agentName.includes(q) || correlationId.includes(q) || txId.includes(q);
  });

  const pendingCount = approvals.filter((a) => !a.decision).length;
  const totalPendingValuePaise = approvals
    .filter((a) => !a.decision)
    .reduce((sum, a) => sum + (a.transaction?.quote?.total || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm font-medium border backdrop-blur-md transition-all max-w-md ${
            notification.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-950/50'
              : notification.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-500/50 shadow-rose-950/50'
              : 'bg-blue-950/95 text-blue-200 border-blue-500/50 shadow-blue-950/50'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {notification.type === 'info' && <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="text-xs leading-snug">{notification.message}</span>
          </div>

          {notification.linkUrl && (
            <a
              href={notification.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center space-x-1.5 shrink-0 shadow transition-all"
            >
              <span>Pay Now</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Razorpay Payment Link Modal */}
      {activePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Razorpay Payment Link Ready!</h3>
                  <p className="text-xs text-zinc-400">Human approval granted & payment order created</p>
                </div>
              </div>
              <button
                onClick={() => setActivePaymentModal(null)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Total Amount:</span>
                <span className="text-base font-extrabold text-white">
                  ₹{((activePaymentModal.amountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR
                </span>
              </div>

              {activePaymentModal.orderId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Razorpay Order ID:</span>
                  <span className="font-mono text-blue-400 font-semibold">{activePaymentModal.orderId}</span>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-800">
                <span className="text-[11px] text-zinc-400 block mb-1 font-semibold uppercase tracking-wider">Payment URL</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={activePaymentModal.paymentLinkUrl}
                    className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(activePaymentModal.paymentLinkUrl, 'Payment Link')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-3 text-[11px] text-zinc-300 leading-relaxed">
              <strong className="text-blue-400">💡 Test Mode Quick Guide:</strong> In Razorpay Test Mode, use UPI VPA <code className="text-white font-mono bg-blue-950 px-1 py-0.5 rounded">success@razorpay</code> to simulate a successful capture, or <code className="text-white font-mono bg-blue-950 px-1 py-0.5 rounded">failure@razorpay</code> to test graceful decline.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              {activePaymentModal.correlationId && (
                <Link
                  href={`/audit/${activePaymentModal.correlationId}`}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                >
                  View Audit Trail
                </Link>
              )}
              <a
                href={activePaymentModal.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 rounded-xl text-xs font-bold text-zinc-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-950/50 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>Open Razorpay Checkout</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header & Metric Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Pending Approvals</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendingCount} Awaiting Review
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Deterministic policy gates requiring human verification before Razorpay order authorization.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchApprovals(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : 'text-zinc-400'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Inbox'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pending Orders</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white tracking-tight">{pendingCount}</span>
            <span className="text-xs text-zinc-500">transactions</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Review Volume</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              ₹{(totalPendingValuePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-zinc-500">total paise</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Policy Engine</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-sm font-semibold text-emerald-400">Zero-LLM Deterministic</span>
            <span className="text-xs text-zinc-500">active rules</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center p-1 bg-zinc-900/90 rounded-xl border border-zinc-800">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pending ({approvals.filter((a) => !a.decision).length})
          </button>
          <button
            onClick={() => setFilter('decided')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === 'decided'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Decided ({approvals.filter((a) => a.decision).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All History
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by bot, correlation ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-zinc-900 text-xs text-zinc-200 placeholder-zinc-500 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start space-x-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> Backend API disconnected ({error}). Showing local preview records.
          </div>
          <button onClick={() => fetchApprovals(true)} className="underline hover:text-amber-200 cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Pending Approval List */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading pending approvals from gateway...</p>
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Inbox Zero</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
            {filter === 'pending'
              ? 'No pending approval requests requiring human review right now.'
              : 'No matching transaction records found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => {
            const tx = approval.transaction;
            const quote = tx?.quote;
            const agent = tx?.mandate?.agent;
            const isExpanded = !!expandedCards[approval.id];
            const isActing = actionLoading[approval.id];
            const isDecided = !!approval.decision;
            const gateAudit = tx?.auditLogs?.find((l) => l.step === 'gate_decision' || l.step === 'policy_check');
            const geminiAudit = tx?.auditLogs?.find((l) => l.actor === 'gemini_ai');
            const isExpressLane = tx?.auditLogs?.some((l) => l.step === 'express_lane_clearance' || l.ruleId === 'express_highway');
            const totalInInr = quote ? quote.total / 100 : 0;
            const paymentLink = extractPaymentLink(approval, generatedPaymentLinks);

            return (
              <div
                key={approval.id}
                className={`rounded-2xl border transition-all duration-200 ${
                  isDecided
                    ? 'bg-zinc-950/60 border-zinc-800/80 shadow-lg'
                    : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700/80 shadow-xl shadow-black/40'
                }`}
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Bar: Bot, Status Badge & Time */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/agents/${agent?.id || 'claude-desktop'}`}
                            className="font-semibold text-sm text-white hover:text-blue-400 transition-colors flex items-center space-x-1"
                          >
                            <span>{agent?.name || 'Autonomous Agent'}</span>
                            <ExternalLink className="w-3 h-3 text-zinc-500 hover:text-blue-400" />
                          </Link>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                            ID: {agent?.id || approval.transaction?.mandateId?.slice(0, 10) || 'agent'}
                          </span>
                          {isExpressLane ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                              <Zap className="w-3 h-3 text-emerald-400" />
                              <span>Express Highway (&lt; 0.1ms)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center space-x-1">
                              <Shield className="w-3 h-3 text-indigo-400" />
                              <span>Deep Inspection Lane</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          Initiated {new Date(approval.createdAt).toLocaleTimeString()} &bull; {new Date(approval.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center space-x-2">
                      {isDecided ? (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider flex items-center space-x-1 ${
                            approval.decision === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {approval.decision === 'approved' ? <Check className="w-3.5 h-3.5 mr-1" /> : <X className="w-3.5 h-3.5 mr-1" />}
                          {approval.decision}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-1"></span>
                          Pending Operator Review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: Amount & Policy Gate Reason */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/80">
                    {/* Amount */}
                    <div className="md:col-span-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Order Value
                      </span>
                      <div className="flex items-baseline space-x-2 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                          ₹{totalInInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-zinc-400">INR</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        Auto-Approve Threshold: ₹{(tx?.mandate?.autoApproveThreshold ? tx.mandate.autoApproveThreshold / 100 : 500).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Policy Gate Reason */}
                    <div className="md:col-span-8 border-t md:border-t-0 md:border-l border-zinc-800/80 pt-3 md:pt-0 md:pl-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 flex items-center space-x-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Policy Trigger: {gateAudit?.ruleId || 'gate_threshold'}</span>
                      </span>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {gateAudit?.reason || `Quote total ₹${totalInInr} exceeded mandate auto-approve ceiling. Requires human authorization.`}
                      </p>

                      {/* Correlation ID & Audit Link */}
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <button
                          onClick={() => copyToClipboard(tx?.correlationId || '', 'Correlation ID')}
                          className="flex items-center space-x-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800 font-mono transition-colors cursor-pointer"
                        >
                          <span className="text-zinc-400">CID:</span>
                          <span className="font-medium text-zinc-300">
                            {tx?.correlationId ? `${tx.correlationId.slice(0, 16)}...` : 'N/A'}
                          </span>
                          <Copy className="w-3 h-3 text-zinc-400 ml-1" />
                        </button>

                        <Link
                          href={`/audit/${tx?.correlationId || 'demo-correlation-001'}`}
                          className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-medium"
                        >
                          <span>View Full Audit Trail</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Google Gemini AI Security Assessment Banner */}
                  {geminiAudit && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-zinc-900/90 to-zinc-900 border border-purple-500/30 space-y-1.5 text-xs text-purple-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-300 flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Google Gemini AI Security Assessment</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-500/40">
                          gemini-3.1-flash-lite
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed text-[11px] font-mono">
                        {geminiAudit.reason}
                      </p>
                    </div>
                  )}

                  {/* Payment Link Banner (if already generated or approved) */}
                  {paymentLink && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-zinc-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-emerald-300">Razorpay Payment Link Ready</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-semibold">AUTHORIZED</span>
                          </div>
                          <p className="text-xs text-zinc-300 font-mono truncate max-w-sm sm:max-w-md mt-0.5 select-all">
                            {paymentLink}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => copyToClipboard(paymentLink, 'Payment Link')}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </button>
                        <a
                          href={paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                        >
                          <span>Pay Now</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Cart Items Toggle */}
                  <div>
                    <button
                      onClick={() => toggleExpand(approval.id)}
                      className="flex items-center justify-between w-full py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Cart Details ({quote?.items?.length || 0} item{quote?.items?.length === 1 ? '' : 's'})</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 overflow-x-auto text-xs animate-fadeIn">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase tracking-wider">
                              <th className="pb-2 font-medium">SKU / Item</th>
                              <th className="pb-2 font-medium text-center">Qty</th>
                              <th className="pb-2 font-medium text-right">Unit Price</th>
                              <th className="pb-2 font-medium text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-zinc-300">
                            {quote?.items?.map((item, idx) => {
                              const unitPrice = item.unitPrice ? item.unitPrice / 100 : (item.sku === 'rice-basmati-5kg' ? 650 : 180);
                              return (
                                <tr key={idx} className="hover:bg-zinc-900/50">
                                  <td className="py-2 font-mono text-zinc-300">{item.sku}</td>
                                  <td className="py-2 text-center text-zinc-400">{item.qty}</td>
                                  <td className="py-2 text-right text-zinc-400">₹{unitPrice.toFixed(2)}</td>
                                  <td className="py-2 text-right font-medium text-white">
                                    ₹{(unitPrice * item.qty).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Decision Actions Bottom Bar */}
                  {!isDecided ? (
                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800/80">
                      <button
                        onClick={() => handleDecision(approval.id, 'declined')}
                        disabled={isActing !== null && isActing !== undefined}
                        className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 hover:border-rose-700 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>{isActing === 'declining' ? 'Declining...' : 'Decline Transaction'}</span>
                      </button>

                      <button
                        onClick={() => handleDecision(approval.id, 'approved')}
                        disabled={isActing !== null && isActing !== undefined}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/70 border border-emerald-400/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 text-white" />
                        <span>{isActing === 'approving' ? 'Authorizing...' : 'Approve & Create Razorpay Order'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                      <span>Decided by <strong className="text-zinc-300">{approval.decidedBy || 'human:admin'}</strong></span>
                      <div className="flex items-center space-x-3">
                        {tx?.razorpayOrderId && (
                          <span className="font-mono text-[11px] text-blue-400">
                            Order: {tx.razorpayOrderId}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-zinc-400">
                          Tx State: <span className="text-emerald-400 font-semibold">{tx?.state}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getFallbackApprovals(): PendingApproval[] {
  return [
    {
      id: 'appr_demo_01',
      transactionId: 'txn_demo_9821',
      expiresAt: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
      decision: null,
      decidedBy: null,
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      transaction: {
        id: 'txn_demo_9821',
        correlationId: 'cid_demo_food_bot_001',
        mandateId: 'mnd_grocery_01',
        quoteId: 'quot_staples_42',
        state: 'gated',
        createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        quote: {
          id: 'quot_staples_42',
          items: [
            { sku: 'rice-basmati-5kg', qty: 2, unitPrice: 65000, name: 'Basmati rice, 5kg' },
            { sku: 'toor-dal-1kg', qty: 3, unitPrice: 18000, name: 'Toor dal, 1kg' },
          ],
          total: 184000, // ₹1,840.00
          expiresAt: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        },
        mandate: {
          id: 'mnd_grocery_01',
          agentId: 'agt_food_bot_01',
          merchantId: 'mch_demo_grocery',
          maxPerTransaction: 200000,
          dailyCap: 500000,
          autoApproveThreshold: 50000,
          allowedCategories: ['grocery.staples', 'grocery.dairy'],
          agent: {
            id: 'agt_food_bot_01',
            name: 'Demo Grocery Procurement Agent',
          },
        },
        auditLogs: [
          {
            id: 'log_01',
            correlationId: 'cid_demo_food_bot_001',
            step: 'policy_check',
            decision: 'allow',
            reason: 'agent credential is valid',
            ruleId: 'agent_valid',
            actor: 'system',
            createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          },
          {
            id: 'log_02',
            correlationId: 'cid_demo_food_bot_001',
            step: 'gate_decision',
            decision: 'pending',
            reason: 'quote ₹1,840 exceeds auto-approve threshold ₹500',
            ruleId: 'gate_threshold',
            actor: 'system',
            createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  ];
}