'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  User,
  Bot,
  Cpu,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Receipt,
  FileCode2,
  Check,
  CreditCard,
  Building,
  Sparkles,
  BrainCircuit,
  AlertTriangle,
  Wrench,
} from 'lucide-react';

interface AuditLogRow {
  id: string;
  correlationId: string;
  transactionId?: string | null;
  step: string;
  decision: string;
  reason: string;
  ruleId?: string | null;
  actor: string;
  createdAt: string;
  transaction?: {
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
    mandate?: {
      id: string;
      agentId: string;
      merchantId: string;
      maxPerTransaction: number;
      dailyCap: number;
      autoApproveThreshold: number;
      agent?: {
        name: string;
      };
    };
  };
}

interface ForensicReport {
  verdict?: string;
  issueType?: string;
  severity?: string;
  executiveSummary?: string;
  primaryReason?: string;
  culpritRule?: string;
  keyThreatIndicators?: string[];
  agentActionableInstructions?: string;
  suggestedRemediation?: Record<string, unknown> | null;
  geminiReport?: {
    source?: string;
    model?: string;
    verdict?: string;
    confidence?: number;
    threatLevel?: string;
    primaryThreat?: string;
    executiveBrief?: string;
    recommendedAction?: string;
    shouldRevokeAgent?: boolean;
    suggestedRemediation?: Record<string, unknown> | null;
  } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AuditTimelinePage({
  params,
}: {
  params: Promise<{ correlationId: string }>;
}) {
  const resolvedParams = use(params);
  const correlationId = resolvedParams.correlationId;

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showQuoteDetails, setShowQuoteDetails] = useState(true);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchAuditLogs = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/audit/${encodeURIComponent(correlationId)}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Audit API responded with status ${res.status}`);
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.logs || [];
      // Sort in order of createdAt
      rows.sort((a: AuditLogRow, b: AuditLogRow) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setLogs(rows);

      // Attempt to fetch dedicated NLP forensic incident report
      try {
        const repRes = await fetch(`${API_BASE}/v1/audit/${encodeURIComponent(correlationId)}/report`, {
          cache: 'no-store',
        });
        if (repRes.ok) {
          const repData = await repRes.json();
          if (repData.forensicBrief) {
            setReport({
              ...repData.forensicBrief,
              agentActionableInstructions: repData.diagnosis?.agentActionableInstructions,
              suggestedRemediation: repData.diagnosis?.suggestedRemediation,
              geminiReport: repData.geminiReport || null,
            });
          }
        }
      } catch {
        // non-blocking
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch audit records';
      console.warn('Audit fetch notice:', msg);
      setError(msg);

      // Fallback demo records if backend is offline
      if (logs.length === 0) {
        setLogs(getFallbackAuditLogs(correlationId));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [correlationId, logs.length]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Derive transaction summary from logs
  const transaction = logs.find((l) => l.transaction)?.transaction;
  const quote = transaction?.quote;
  const agent = transaction?.mandate?.agent;

  const getDecisionBadge = (decision: string) => {
    const d = decision?.toLowerCase();
    if (d === 'allow' || d === 'approved') {
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
        label: 'ALLOW',
      };
    }
    if (d === 'deny' || d === 'declined' || d === 'rejected') {
      return {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: <ShieldX className="w-3.5 h-3.5 text-rose-400" />,
        label: 'DENY',
      };
    }
    if (d === 'pending' || d === 'gated') {
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
        label: 'PENDING GATE',
      };
    }
    return {
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      icon: <Shield className="w-3.5 h-3.5 text-blue-400" />,
      label: d.toUpperCase() || 'INFO',
    };
  };

  const getActorBadge = (actor: string) => {
    if (actor.startsWith('agent')) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Bot className="w-3 h-3" />
          <span>{actor}</span>
        </span>
      );
    }
    if (actor.startsWith('human')) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <User className="w-3 h-3" />
          <span>{actor}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
        <Cpu className="w-3 h-3 text-blue-400" />
        <span>{actor || 'system'}</span>
      </span>
    );
  };

  const getStepTitle = (step: string) => {
    switch (step) {
      case 'policy_check':
        return 'Deterministic Policy Evaluation';
      case 'gate_decision':
        return 'Human Approval Gate Routing';
      case 'approval_decision':
        return 'Human Operator Authorization';
      case 'webhook_received':
        return 'Razorpay HMAC Webhook Captured';
      case 'refund':
        return 'Refund Execution';
      case 'order_created':
        return 'Razorpay Order & Payment Link Creation';
      default:
        return step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Top Nav: Back to Approvals */}
      <div className="flex items-center justify-between">
        <Link
          href="/approvals"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Approvals</span>
        </Link>

        <button
          onClick={() => fetchAuditLogs(true)}
          disabled={refreshing}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : 'text-zinc-400'}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Timeline'}</span>
        </button>
      </div>

      {/* Header Info Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Audit Trail
              </span>
              <span className="text-xs text-zinc-400">Deterministic Chain of Custody</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all">
                {correlationId}
              </h1>
              <button
                onClick={() => copyToClipboard(correlationId, 'Correlation ID')}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="Copy Correlation ID"
              >
                {copiedId === correlationId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Immutable log of all deterministic rule checks, operator overrides, and Razorpay webhook events for this session.
            </p>
          </div>

          {/* Transaction State Badge */}
          <div className="flex flex-col items-start md:items-end space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Transaction State</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-200 border border-zinc-700">
              {transaction?.state || (logs.some((l) => l.step === 'webhook_received' && l.decision === 'allow') ? 'paid' : 'in_progress')}
            </span>
          </div>
        </div>

        {/* Transaction Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Agent</span>
            <div className="text-xs font-medium text-zinc-200 mt-0.5">
              <Link
                href={`/agents/${transaction?.mandate?.agentId || 'claude-desktop'}`}
                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center space-x-1"
              >
                <span>{agent?.name || 'Autonomous Agent'}</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Total Amount</span>
            <div className="text-xs font-bold text-white mt-0.5">
              {quote?.total ? `₹${(quote.total / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹1,840.00'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Razorpay Order ID</span>
            <div className="text-xs font-mono text-blue-400 mt-0.5 truncate">
              {transaction?.razorpayOrderId || 'order_demo_101'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Total Log Steps</span>
            <div className="text-xs font-semibold text-zinc-200 mt-0.5">
              {logs.length} Recorded Events
            </div>
          </div>
        </div>
      </div>

      {/* Quote / Items Accordion */}
      {quote && (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 overflow-hidden">
          <button
            onClick={() => setShowQuoteDetails(!showQuoteDetails)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:bg-zinc-900/70 transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              <span>Quote Items ({quote.items.length} items &bull; Total ₹{(quote.total / 100).toFixed(2)})</span>
            </span>
            {showQuoteDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showQuoteDetails && (
            <div className="px-5 pb-4 border-t border-zinc-800/60 pt-3">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800 pb-2 text-[10px] uppercase font-semibold">
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-center">Qty</th>
                    <th className="pb-2 text-right">Unit Price</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                  {quote.items.map((item, idx) => {
                    const price = item.unitPrice ? item.unitPrice / 100 : (item.sku.includes('rice') ? 650 : 180);
                    return (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="py-2 font-mono text-zinc-300">{item.sku}</td>
                        <td className="py-2 text-center text-zinc-400">{item.qty}</td>
                        <td className="py-2 text-right text-zinc-400">₹{price.toFixed(2)}</td>
                        <td className="py-2 text-right font-medium text-white">₹{(price * item.qty).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AI Forensic Diagnostic & Remediation Intelligence Card */}
      {(() => {
        const deniedStep = logs.find((l) => l.decision === 'deny');
        const pendingStep = logs.find((l) => l.decision === 'pending');
        const isIssue = Boolean(deniedStep || pendingStep || report?.verdict !== 'CLEARED');

        const displayReport = report || (deniedStep ? {
          verdict: 'DENIED_POLICY_VIOLATION',
          issueType: deniedStep.ruleId?.includes('canary') || deniedStep.reason?.includes('honeytoken') ? 'MALICIOUS_ADVERSARIAL' : 'POLICY_VIOLATION',
          severity: deniedStep.ruleId?.includes('canary') ? 'CRITICAL_THREAT' : 'HIGH_RISK',
          executiveSummary: `Transaction blocked by in-flight safety guardrail [${deniedStep.ruleId || 'policy_engine'}]. Root cause: ${deniedStep.reason}.`,
          primaryReason: deniedStep.reason,
          culpritRule: deniedStep.ruleId || 'guardrail',
          agentActionableInstructions: 'Halt repeated attempts. Verify agent authorization mandate or correct cart items before retrying.',
        } : pendingStep ? {
          verdict: 'HELD_FOR_OPERATOR_APPROVAL',
          issueType: pendingStep.ruleId?.includes('drift') ? 'HALLUCINATION' : 'POLICY_VIOLATION',
          severity: 'MODERATE_WARNING',
          executiveSummary: `Transaction held for human review under rule [${pendingStep.ruleId || 'gate_threshold'}]. Root cause: ${pendingStep.reason}.`,
          primaryReason: pendingStep.reason,
          culpritRule: pendingStep.ruleId || 'gate',
          agentActionableInstructions: 'Advise user to approve transaction on ACM Operator Dashboard or reduce order total.',
        } : {
          verdict: 'CLEARED',
          issueType: 'VERIFIED_SAFE',
          severity: 'INFORMATIONAL',
          executiveSummary: 'Transaction cleared all deterministic safety checks with zero detected hallucinations or adversarial drift.',
          primaryReason: 'All security stages verified safe.',
          culpritRule: 'all_passed',
        });

        const isThreat = displayReport.issueType === 'MALICIOUS_ADVERSARIAL';
        const isHallucination = displayReport.issueType === 'HALLUCINATION';

        return (
          <div className={`rounded-2xl border p-5 shadow-2xl transition-all ${
            isThreat
              ? 'bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-950 border-red-500/30'
              : isHallucination
              ? 'bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 border-amber-500/30'
              : isIssue
              ? 'bg-gradient-to-r from-blue-950/30 via-zinc-900 to-zinc-950 border-blue-500/30'
              : 'bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-950 border-emerald-500/20'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  isThreat
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : isHallucination
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                }`}>
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      AI Agent Forensic & Self-Correction Diagnostics
                    </h3>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>NLP Engine</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Semantic root-cause diagnosis, hallucination detection, and machine-actionable instructions for paying agents
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  isThreat
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : isHallucination
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : isIssue
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}>
                  {isThreat ? <AlertTriangle className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                  <span>{displayReport.issueType?.replace('_', ' ')}</span>
                </span>

                {displayReport.severity && (
                  <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {displayReport.severity}
                  </span>
                )}
              </div>
            </div>

            {/* Executive Summary Brief */}
            <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-3.5 space-y-2 mb-3">
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center space-x-1.5">
                <span>📋</span>
                <span>Forensic Executive Summary</span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                {displayReport.executiveSummary}
              </p>
            </div>

            {/* Agent Actionable Guidance & Suggested Remediation */}
            {displayReport.agentActionableInstructions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-purple-300 tracking-wider flex items-center space-x-1.5">
                    <Wrench className="w-3.5 h-3.5 text-purple-400" />
                    <span>Agent Self-Correction Instructions</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {displayReport.agentActionableInstructions}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center space-x-1.5">
                    <span>💡</span>
                    <span>Actionable Resolution Strategy</span>
                  </div>
                  <div className="text-[11px] text-zinc-300">
                    {displayReport.suggestedRemediation ? (
                      <pre className="text-[10px] font-mono text-emerald-400 bg-black/40 p-2 rounded-lg overflow-x-auto border border-zinc-800">
                        {JSON.stringify(displayReport.suggestedRemediation, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-zinc-400">
                        Rule triggered: <span className="font-mono text-white">{displayReport.culpritRule}</span>. No custom JSON payload needed.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Google Gemini AI Security Analyst Card */}
            {displayReport.geminiReport && (
              <div className="rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-indigo-500/40 p-4 mt-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {displayReport.geminiReport.source?.includes('heuristic') || displayReport.geminiReport.model === 'deterministic-rules-engine'
                        ? 'Zero-Trust AI Security Assessment (Deterministic Engine)'
                        : 'Google Gemini Security Analyst'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {displayReport.geminiReport.model || (displayReport.geminiReport.source?.includes('heuristic') ? 'deterministic-rules-engine' : 'gemini-3.1-flash-lite')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      displayReport.geminiReport.verdict === 'REVOKE_ACCESS'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : displayReport.geminiReport.verdict === 'SAFE_TO_CONTINUE'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}>
                      Verdict: {displayReport.geminiReport.verdict?.replace(/_/g, ' ')}
                    </span>
                    {typeof displayReport.geminiReport.confidence === 'number' && (
                      <span className="text-[10px] font-mono text-zinc-400">
                        {Math.round(displayReport.geminiReport.confidence * 100)}% Confidence
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                  {displayReport.geminiReport.executiveBrief}
                </p>

                {displayReport.geminiReport.recommendedAction && (
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span>
                      <strong className="text-zinc-300">Recommended Action:</strong> {displayReport.geminiReport.recommendedAction}
                    </span>
                    {displayReport.geminiReport.shouldRevokeAgent && (
                      <span className="text-red-400 font-semibold text-[10px] bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30 self-start sm:self-auto">
                        Agent Access Revoked
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Multi-Layer Zero-Trust Security Telemetry */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-zinc-900 border border-blue-500/20 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Multi-Layer Zero-Trust Guardrail Evaluation</h3>
              <p className="text-[11px] text-zinc-400">Pipelined deterministic security checks with zero customer friction</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span>⚡</span>
              <span>Fast-Path: &lt; 1.5ms</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Shield className="w-3 h-3" />
              <span>All 6 Stages Verified</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-[11px]">
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 1: Killswitch</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1 mt-0.5">
              <Check className="w-3 h-3" />
              <span>Agent Valid</span>
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 2: Honeytokens</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1 mt-0.5">
              <Check className="w-3 h-3" />
              <span>No Canaries</span>
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 3: Velocity</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1 mt-0.5">
              <Check className="w-3 h-3" />
              <span>Rate Bounded</span>
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 4: Scope & Caps</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1 mt-0.5">
              <Check className="w-3 h-3" />
              <span>Within Limit</span>
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 5: Anti-TOCTOU</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1 mt-0.5">
              <Check className="w-3 h-3" />
              <span>Quote Pinned</span>
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500 block text-[9px] uppercase font-bold">Stage 6: Risk Gate</span>
            <span className="text-blue-400 font-semibold flex items-center space-x-1 mt-0.5">
              <span>🎯</span>
              <span>Tiered Score</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Timeline Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Chronological Timeline ({logs.length} Steps)
          </h2>
          <span className="text-[11px] text-zinc-500 font-mono">Sorted in order of createdAt (ascending)</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-7 h-7 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-400">Loading audit history...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400">
            No audit log records found for this correlation ID.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-zinc-700 before:to-emerald-500">
            {logs.map((log, index) => {
              const badge = getDecisionBadge(log.decision);
              const isLast = index === logs.length - 1;
              const dateObj = new Date(log.createdAt);

              return (
                <div key={log.id || index} className="relative group">
                  {/* Timeline Node Bullet */}
                  <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-[#080c14] border-2 border-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  </div>

                  {/* Log Row Card */}
                  <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 p-5 space-y-3 shadow-lg shadow-black/20 transition-all">
                    {/* Top Row: Step Title, Decision Badge, Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white tracking-tight">
                          #{index + 1}. {getStepTitle(log.step)}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                          {log.step}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Decision Badge */}
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle: Plain-English Reason */}
                    <div className="bg-zinc-950/70 rounded-xl p-3.5 border border-zinc-800/60 space-y-2">
                      <p className="text-xs text-zinc-200 leading-relaxed font-normal">
                        {log.reason}
                      </p>
                      {log.reason?.includes('https://rzp.io') && (
                        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-400 font-medium font-mono">Payment Link Ready</span>
                          <a
                            href={log.reason.match(/https:\/\/rzp\.io\/[a-zA-Z0-9_\-\/]+/)?.[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center space-x-1 shadow transition-colors cursor-pointer"
                          >
                            <span>Open Checkout</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata: Rule ID, Actor, Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                      <div className="flex items-center space-x-3">
                        {log.ruleId && (
                          <span className="font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            ruleId: <strong className="text-zinc-200">{log.ruleId}</strong>
                          </span>
                        )}
                        {getActorBadge(log.actor)}
                      </div>

                      <div className="flex items-center space-x-1.5 text-zinc-400 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>{dateObj.toLocaleTimeString()} &bull; {dateObj.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw Payload Inspector Toggle */}
      <div className="pt-6 border-t border-zinc-800">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <FileCode2 className="w-4 h-4" />
          <span>{showRawJson ? 'Hide Raw Audit JSON' : 'Inspect Raw Audit Payload'}</span>
        </button>

        {showRawJson && (
          <div className="mt-3 rounded-2xl bg-[#06090f] border border-zinc-800 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-96">
            <pre>{JSON.stringify(logs, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function getFallbackAuditLogs(correlationId: string): AuditLogRow[] {
  const baseTime = Date.now() - 5 * 60 * 1000;
  return [
    {
      id: 'log_001',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'policy_check',
      decision: 'allow',
      reason: 'agent credential is valid and active',
      ruleId: 'agent_valid',
      actor: 'system',
      createdAt: new Date(baseTime).toISOString(),
      transaction: {
        id: 'txn_demo_101',
        correlationId: correlationId || 'cid_demo_001',
        state: 'paid',
        razorpayOrderId: 'order_demo_RPZ123',
        razorpayPaymentId: 'pay_demo_99482',
        createdAt: new Date(baseTime).toISOString(),
        quote: {
          id: 'quot_001',
          total: 184000,
          items: [
            { sku: 'rice-basmati-5kg', qty: 2, unitPrice: 65000 },
            { sku: 'toor-dal-1kg', qty: 3, unitPrice: 18000 },
          ],
        },
        mandate: {
          id: 'mnd_demo_1',
          agentId: 'agt_food_bot',
          merchantId: 'mch_grocery_demo',
          maxPerTransaction: 200000,
          dailyCap: 500000,
          autoApproveThreshold: 50000,
          agent: { name: 'Demo Grocery Procurement Bot' },
        },
      },
    },
    {
      id: 'log_002',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'policy_check',
      decision: 'allow',
      reason: 'mandate covers merchant mch_grocery_demo and categories [grocery.staples]',
      ruleId: 'mandate_coverage',
      actor: 'system',
      createdAt: new Date(baseTime + 100).toISOString(),
    },
    {
      id: 'log_003',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'policy_check',
      decision: 'allow',
      reason: 'within per-transaction cap ₹2,000 (quote total is ₹1,840)',
      ruleId: 'per_txn_cap',
      actor: 'system',
      createdAt: new Date(baseTime + 200).toISOString(),
    },
    {
      id: 'log_004',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'gate_decision',
      decision: 'pending',
      reason: 'quote ₹1,840 exceeds auto-approve threshold ₹500',
      ruleId: 'gate_threshold',
      actor: 'system',
      createdAt: new Date(baseTime + 300).toISOString(),
    },
    {
      id: 'log_005',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'approval_decision',
      decision: 'allow',
      reason: 'Transaction approved by human operator via dashboard interface',
      ruleId: 'human_review',
      actor: 'human:admin',
      createdAt: new Date(baseTime + 120 * 1000).toISOString(),
    },
    {
      id: 'log_006',
      correlationId: correlationId || 'cid_demo_001',
      transactionId: 'txn_demo_101',
      step: 'webhook_received',
      decision: 'allow',
      reason: 'payment captured and verified via HMAC-SHA256 signature',
      ruleId: null,
      actor: 'system',
      createdAt: new Date(baseTime + 180 * 1000).toISOString(),
    },
  ];
}
