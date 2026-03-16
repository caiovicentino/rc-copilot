import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RC Copilot — Autonomous Subscription Analyst",
  description:
    "AI-powered subscription analytics for RevenueCat. Anomaly detection, trend analysis, and what-if simulations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
