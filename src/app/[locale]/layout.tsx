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
  title: "WhatsAI - Automatisez votre WhatsApp avec l'IA",
  description: "WhatsAI est une solution d'automatisation WhatsApp qui vous permet de gérer vos conversations, qualifier vos leads et prendre des rendez-vous automatiquement grâce à l'intelligence artificielle.",
  keywords: ["WhatsApp", "IA", "automatisation", "chatbot", "leads", "CRM", "Afrique"],
  authors: [{ name: "WhatsAI" }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/icon.svg',
  },
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
