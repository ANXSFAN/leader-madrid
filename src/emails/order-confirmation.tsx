import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// Centralised label dictionary – replace with i18n integration later
const LABELS = {
  preview_b2b: (n: string) => `B2B Order ${n} confirmed`,
  preview_standard: (n: string) => `Your order ${n} is confirmed`,
  heading_b2b: "B2B Order Confirmed",
  heading_standard: "Order Confirmed",
  greeting: (name: string) =>
    `Hello ${name}, your order has been received and is being processed.`,
  order_number: "Order Number",
  payment_method: "Payment Method",
  payment_cecabank: "Tarjeta de Cr\u00e9dito / D\u00e9bito (Cecabank)",
  payment_bank: "Bank Transfer",
  vat_label: "Intra-community VAT/Tax ID",
  reverse_charge: "Reverse Charge applied",
  bank_pending_title: "Pending bank transfer payment.",
  bank_pending_body:
    "You will receive a separate email with banking details. Your order will be processed after payment confirmation.",
  order_summary: "Order Summary",
  col_product: "Product",
  col_qty: "Qty",
  col_price: "Price",
  shipping_address: "Shipping Address",
  view_order: "View Order Details",
  contact_prompt: "If you have any questions, reply to this email or contact us.",
};

interface OrderItem {
  variantId: string;
  quantity: number;
  price: number;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zipCode: string;
  country: string;
  phone: string;
}

interface OrderConfirmationEmailProps {
  customerName: string;
  orderNumber: string;
  orderId: string;
  items: OrderItem[];
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  isB2B: boolean;
  vatNumber?: string;
  isReverseCharge?: boolean;
  siteName: string;
  siteEmail: string;
  /** ISO currency code, e.g. "EUR", "USD". Defaults to "EUR". */
  currency?: string;
  /** BCP-47 locale for number/date formatting, e.g. "en", "es". Defaults to "en". */
  locale?: string;
  to?: string;
}

const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header: React.CSSProperties = {
  backgroundColor: "#1e3a5f",
  padding: "24px 40px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "24px",
  lineHeight: "1.3",
  fontWeight: "700",
  color: "#1e3a5f",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.4",
  color: "#3c4149",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  marginBottom: "4px",
};

const tableHeader: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: "600",
  color: "#555",
  textTransform: "uppercase" as const,
};

const tableCell: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "14px",
  borderBottom: "1px solid #e2e8f0",
};

const totalRow: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "16px",
  fontWeight: "700",
  color: "#1e3a5f",
  backgroundColor: "#f1f5f9",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#1e3a5f",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
};

const footerStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export function OrderConfirmationEmail({
  customerName,
  orderNumber,
  orderId,
  items,
  total,
  shippingAddress,
  paymentMethod,
  isB2B,
  vatNumber,
  isReverseCharge,
  siteName,
  siteEmail,
  currency = "EUR",
  locale = "en",
}: OrderConfirmationEmailProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);

  const paymentLabel =
    paymentMethod === "CECABANK"
      ? LABELS.payment_cecabank
      : paymentMethod === "BANK_TRANSFER"
      ? LABELS.payment_bank
      : paymentMethod;

  return (
    <Html>
      <Head />
      <Preview>
        {isB2B
          ? LABELS.preview_b2b(orderNumber)
          : LABELS.preview_standard(orderNumber)}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: "20px",
                fontWeight: "700",
                margin: "0",
              }}
            >
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px 24px" }}>
            <Heading style={headingStyle}>
              {isB2B ? LABELS.heading_b2b : LABELS.heading_standard}
            </Heading>
            <Text style={paragraph}>{LABELS.greeting(customerName)}</Text>

            <Row style={{ marginTop: "20px" }}>
              <Column>
                <Text style={labelStyle}>{LABELS.order_number}</Text>
                <Text
                  style={{ ...paragraph, fontWeight: "700", fontSize: "18px" }}
                >
                  {orderNumber}
                </Text>
              </Column>
              <Column>
                <Text style={labelStyle}>{LABELS.payment_method}</Text>
                <Text style={paragraph}>{paymentLabel}</Text>
              </Column>
            </Row>

            {isB2B && vatNumber && (
              <Section
                style={{
                  backgroundColor: "#eff6ff",
                  borderLeft: "4px solid #3b82f6",
                  padding: "12px 16px",
                  marginTop: "16px",
                }}
              >
                <Text style={{ ...paragraph, margin: "0", fontSize: "13px" }}>
                  <strong>{LABELS.vat_label}:</strong> {vatNumber}
                  {isReverseCharge && (
                    <>
                      {" "}
                      · <em>{LABELS.reverse_charge}</em>
                    </>
                  )}
                </Text>
              </Section>
            )}

            {paymentMethod === "BANK_TRANSFER" && (
              <Section
                style={{
                  backgroundColor: "#fff7ed",
                  borderLeft: "4px solid #f59e0b",
                  padding: "12px 16px",
                  marginTop: "16px",
                }}
              >
                <Text style={{ ...paragraph, margin: "0", fontSize: "13px" }}>
                  <strong>{LABELS.bank_pending_title}</strong>{" "}
                  {LABELS.bank_pending_body}
                </Text>
              </Section>
            )}
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />

          <Section style={{ padding: "24px 40px" }}>
            <Heading
              as="h3"
              style={{ ...headingStyle, fontSize: "16px", marginBottom: "12px" }}
            >
              {LABELS.order_summary}
            </Heading>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <td style={tableHeader}>{LABELS.col_product}</td>
                  <td style={{ ...tableHeader, textAlign: "center" }}>
                    {LABELS.col_qty}
                  </td>
                  <td style={{ ...tableHeader, textAlign: "right" }}>
                    {LABELS.col_price}
                  </td>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={tableCell}>
                      Ref. {item.variantId.substring(0, 8)}…
                    </td>
                    <td style={{ ...tableCell, textAlign: "center" }}>
                      {item.quantity}
                    </td>
                    <td style={{ ...tableCell, textAlign: "right" }}>
                      {fmt(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={totalRow}>
                    TOTAL
                  </td>
                  <td style={{ ...totalRow, textAlign: "right" }}>
                    {fmt(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />

          <Section style={{ padding: "24px 40px" }}>
            <Heading
              as="h3"
              style={{ ...headingStyle, fontSize: "16px", marginBottom: "12px" }}
            >
              {LABELS.shipping_address}
            </Heading>
            <Text style={{ ...paragraph, margin: "0" }}>
              {shippingAddress.firstName} {shippingAddress.lastName}
            </Text>
            <Text style={{ ...paragraph, margin: "2px 0" }}>
              {shippingAddress.street}
            </Text>
            <Text style={{ ...paragraph, margin: "2px 0" }}>
              {shippingAddress.zipCode} {shippingAddress.city}
            </Text>
            <Text style={{ ...paragraph, margin: "2px 0" }}>
              {shippingAddress.country}
            </Text>
            <Text style={{ ...paragraph, margin: "2px 0" }}>
              {shippingAddress.phone}
            </Text>
          </Section>

          <Section style={{ padding: "0 40px 32px" }}>
            <Button
              href={`${baseUrl}/profile/orders/${orderId}`}
              style={buttonStyle}
            >
              {LABELS.view_order}
            </Button>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />

          <Section style={{ padding: "16px 40px" }}>
            <Text style={footerStyle}>
              {siteName} ·{" "}
              <Link href={`mailto:${siteEmail}`}>{siteEmail}</Link>
            </Text>
            <Text style={footerStyle}>{LABELS.contact_prompt}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderConfirmationEmail;
