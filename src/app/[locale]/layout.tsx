import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Viewport with viewport-fit=cover for safe-area-insets (APK status bar)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "WazzapAI - The Ultimate WhatsApp Automation Platform powered by AI",
  description: "Transform your WhatsApp into a 24/7 Sales Machine. Automate conversations, qualify leads, and close deals globally with our advanced AI Agents. Works in any country.",
  keywords: ["WhatsApp Automation", "AI Chatbot", "WhatsApp CRM", "Sales Automation", "Lead Generation", "Customer Service AI", "Business WhatsApp"],
  authors: [{ name: "WazzapAI" }],
  openGraph: {
    title: "WazzapAI - The Ultimate WhatsApp Automation Platform",
    description: "Automate your sales and support on WhatsApp. No coding required. Try it for free.",
    url: "https://wazzapai.com",
    siteName: "WazzapAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WazzapAI - WhatsApp Automation Platform",
    description: "Automate your sales and support on WhatsApp. AI-powered agents for your business.",
  },
};

import WhatsAppButton from '@/components/landing/WhatsAppButton';
import HomeButton from '@/components/HomeButton';
import StatusBarInit from '@/components/StatusBarInit';
import MotionProvider from '@/components/MotionProvider';
import ChunkErrorReload from '@/components/ChunkErrorReload';

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
          <MotionProvider>
            <ChunkErrorReload />
            <StatusBarInit />
            {children}
            <WhatsAppButton />
            <HomeButton />
          </MotionProvider>
        </NextIntlClientProvider>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-91PK2CR3EC"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-91PK2CR3EC');
          `}
        </Script>
      </body>
    </html>
  );
}
