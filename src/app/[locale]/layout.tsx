import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WhatsAI - The Ultimate WhatsApp Automation Platform powered by AI",
  description: "Transform your WhatsApp into a 24/7 Sales Machine. Automate conversations, qualify leads, and close deals globally with our advanced AI Agents. Works in any country.",
  keywords: ["WhatsApp Automation", "AI Chatbot", "WhatsApp CRM", "Sales Automation", "Lead Generation", "Customer Service AI", "Business WhatsApp"],
  authors: [{ name: "WhatsAI" }],
  openGraph: {
    title: "WhatsAI - The Ultimate WhatsApp Automation Platform",
    description: "Automate your sales and support on WhatsApp. No coding required. Try it for free.",
    url: "https://whatsai.app",
    siteName: "WhatsAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsAI - WhatsApp Automation Platform",
    description: "Automate your sales and support on WhatsApp. AI-powered agents for your business.",
  },
};

import WhatsAppButton from '@/components/landing/WhatsAppButton';
import HomeButton from '@/components/HomeButton';

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className="scroll-smooth" style={{ overflowY: 'scroll' }}>
      <body className={`${inter.variable} antialiased`}>
        <NextIntlClientProvider messages={messages} locale={locale} timeZone="Africa/Abidjan">
          {children}
          <WhatsAppButton />
          <HomeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
