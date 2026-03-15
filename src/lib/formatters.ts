type Numeric = number | string | { toNumber(): number };

export function formatMoney(
  amount: Numeric,
  { locale, currency }: { locale: string; currency: string }
): string {
  const num =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
      ? parseFloat(amount)
      : amount.toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(num);
}

export interface FormatDateOptions {
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
  year?: Intl.DateTimeFormatOptions["year"];
  month?: Intl.DateTimeFormatOptions["month"];
  day?: Intl.DateTimeFormatOptions["day"];
  hour?: Intl.DateTimeFormatOptions["hour"];
  minute?: Intl.DateTimeFormatOptions["minute"];
}

export function formatDate(
  date: Date | string,
  { locale, ...dtOpts }: { locale: string } & FormatDateOptions
): string {
  return new Intl.DateTimeFormat(locale, dtOpts).format(
    date instanceof Date ? date : new Date(date)
  );
}
