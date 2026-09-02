'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, CheckCircle2, History, Search, Bot, Terminal, ArrowUpRight, TrendingUp } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quickCorrelationId, setQuickCorrelationId] = useState('');

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickCorrelationId.trim()) {
      router.push(`/audit/${quickCorrelationId.trim()}`);
      setQuickCorrelationId('');
    }
  };

  const isApprovalsActive = pathname === '/approvals' || pathname === '/';
  const isAgentsActive = pathname.startsWith('/agents');
  const isAuditActive = pathname.startsWith('/audit');

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0f19]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-6">
            <Link href="/approvals" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-white tracking-tight">Razorpay ACM</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Middleman
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Agent Commerce Gateway & Policy Guard</p>
              </div>
            </Link>

            {/* Nav Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-zinc-800">
              <Link
                href="/approvals"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isApprovalsActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approvals Inbox</span>
              </Link>

              <Link
                href="/agents"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isAgentsActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>AI Agents</span>
              </Link>

              <Link
                href="/growth"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname.startsWith('/growth')
                    ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Growth & AOV</span>
              </Link>

              <Link
                href="/audit/demo-correlation-001"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isAuditActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Audit Trail</span>
              </Link>
            </nav>
          </div>

          {/* Right Side: Quick Search & Status */}
          <div className="flex items-center space-x-3">
            {/* Quick Correlation Search */}
            <form onSubmit={handleQuickSearch} className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Jump to correlation ID..."
                value={quickCorrelationId}
                onChange={(e) => setQuickCorrelationId(e.target.value)}
                className="w-48 lg:w-64 bg-zinc-900/90 text-xs text-zinc-200 placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/40 transition-all"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            </form>

            {/* Gateway Status Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">Gateway Active</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
