import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Toaster } from "sonner";
import { NextAuthProvider } from "@/components/providers/session-provider";
import { IntlProvider } from "@/components/providers/intl-provider";
import { getMessages } from 'next-intl/server';

import { defaultMetadata } from "@/lib/metadata";
import { getThemeConfig } from "@/lib/actions/config";
import { Analytics } from "@/components/analytics";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = defaultMetadata;

export default async function RootLayout(
  props: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }>
) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  const messages = await getMessages();
  const theme = await getThemeConfig();

  const themeStyle = {
    "--primary": theme.primary,
    "--accent": theme.accent,
    "--ring": theme.accent,
    "--radius": theme.radius,
  } as React.CSSProperties;

  return (
    <html lang={locale} style={themeStyle}>
      <body className={inter.className}>
        <NextAuthProvider>
          <IntlProvider locale={locale} messages={messages}>
            {children}
            <Toaster />
            <Analytics />
          </IntlProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
