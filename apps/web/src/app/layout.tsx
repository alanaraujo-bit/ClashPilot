import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { appUrl } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ClashPilot — copiloto de evolução da sua vila",
    template: "%s · ClashPilot",
  },
  description:
    "Análise, histórico e recomendações para evoluir sua vila de Clash of Clans com o máximo de eficiência. Sem automação — só decisão melhor.",
  applicationName: "ClashPilot",
  keywords: ["Clash of Clans", "planejador", "upgrade", "vila máxima", "análise", "estatísticas"],
  authors: [{ name: "ClashPilot" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: appUrl,
    siteName: "ClashPilot",
    title: "ClashPilot — copiloto de evolução da sua vila",
    description:
      "Descubra o próximo upgrade de maior retorno, quanto falta para a vila máxima e onde você está perdendo tempo.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ClashPilot", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
