import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Razorpay ACM | Human Approval & Audit Dashboard',
  description: 'Deterministic Guardrails, Human Approval Inbox, and Immutable Audit Trail for Autonomous AI Agents',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#080c14] text-zinc-100 antialiased flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500 bg-[#070a10]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Razorpay Agent Commerce Middleman (ACM) &bull; Zero-Trust Policy Intermediary</span>
            <span className="text-zinc-600">Deterministic Financial Boundaries & HMAC Webhooks</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
