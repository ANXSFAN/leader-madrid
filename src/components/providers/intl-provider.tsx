"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

interface IntlProviderProps {
  locale: string;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}

export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error) => {
        if (process.env.NODE_ENV === "development") {
          console.error(`[next-intl] ${error.message}`);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        if (process.env.NODE_ENV === "development") {
          return `[MISSING] ${namespace ? namespace + "." : ""}${key}`;
        }
        return "";
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
