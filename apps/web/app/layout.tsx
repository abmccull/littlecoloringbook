import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Fraunces } from "next/font/google";
import { AnalyticsProvider } from "../components/analytics-provider";
import "./globals.css";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "littlecolorbook.com",
  description: "Turn favorite family photos into coloring books your kids can color.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const app = (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
      </body>
    </html>
  );

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return app;
  }

  return <ClerkProvider>{app}</ClerkProvider>;
}
