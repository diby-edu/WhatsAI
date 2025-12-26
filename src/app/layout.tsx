import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WhatsAI - Automatisez votre WhatsApp avec l'IA",
  description: "WhatsAI est une solution d'automatisation WhatsApp qui vous permet de gérer vos conversations, qualifier vos leads et prendre des rendez-vous automatiquement grâce à l'intelligence artificielle.",
  keywords: ["WhatsApp", "IA", "automatisation", "chatbot", "leads", "CRM", "Afrique"],
  authors: [{ name: "WhatsAI" }],
  openGraph: {
    title: "WhatsAI - Automatisez votre WhatsApp avec l'IA",
    description: "Transformez votre WhatsApp en machine à leads avec l'intelligence artificielle",
    url: "https://whatsai.com",
    siteName: "WhatsAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsAI - Automatisez votre WhatsApp avec l'IA",
    description: "Transformez votre WhatsApp en machine à leads avec l'intelligence artificielle",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
