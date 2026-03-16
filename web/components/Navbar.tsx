"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">RC</span>
            </div>
            <span className="text-slate-100 font-semibold text-lg">Copilot</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm transition-colors ${pathname === "/dashboard" ? "text-slate-100 font-medium" : "text-slate-400 hover:text-slate-100"}`}
            >
              Dashboard
            </Link>
            <Link
              href="/copilot"
              className={`text-sm transition-colors flex items-center gap-1.5 ${pathname === "/copilot" ? "text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-100"}`}
            >
              <span>AI Copilot</span>
            </Link>
            <a
              href="https://github.com/caiovicentino/rc-copilot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
