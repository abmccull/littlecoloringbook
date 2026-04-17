import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { Bree_Serif, Nunito_Sans, Patrick_Hand } from "next/font/google";
import { AnalyticsProvider } from "../components/analytics-provider";
import { brandTheme } from "../lib/brand-theme";
import "./globals.css";

const bodyFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Bree_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const accentFont = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-accent",
});

export const metadata: Metadata = {
  title: "Little Color Book | Turn favorite photos into coloring books kids love",
  description:
    "Start with one free sample page, then turn favorite photos into a 30, 50, or 100-page coloring book you can print tonight or order as a spiral-bound keepsake.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeVariables = {
    "--color-cream": brandTheme.palette.cream,
    "--color-paper": brandTheme.palette.paper,
    "--color-ink": brandTheme.palette.ink,
    "--color-coral": brandTheme.palette.coral,
    "--color-apricot": brandTheme.palette.apricot,
    "--color-sunshine": brandTheme.palette.sunshine,
    "--color-mint": brandTheme.palette.mint,
    "--color-sky": brandTheme.palette.sky,
    "--color-cocoa": brandTheme.palette.cocoa,
    "--color-fog": brandTheme.palette.fog,
    "--radius-xl": brandTheme.radii.xl,
    "--radius-lg": brandTheme.radii.lg,
    "--radius-md": brandTheme.radii.md,
    "--radius-pill": brandTheme.radii.pill,
    "--shadow-soft": brandTheme.shadows.soft,
    "--shadow-lift": brandTheme.shadows.lift,
    "--shadow-inset": brandTheme.shadows.inset,
    "--frame-photo": brandTheme.imageFrames.photo,
    "--frame-page": brandTheme.imageFrames.page,
    "--frame-book": brandTheme.imageFrames.book,
  } as CSSProperties;

  return (
    <html data-scroll-behavior="smooth" lang="en" style={themeVariables}>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${accentFont.variable}`}>
        {children}
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
      </body>
    </html>
  );
}
