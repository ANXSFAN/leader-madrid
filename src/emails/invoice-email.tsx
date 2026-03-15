import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface InvoiceEmailProps {
  customerName: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  dueDate: string;
  invoiceUrl: string;
  siteName: string;
  siteEmail: string;
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "560px",
};

const header: React.CSSProperties = {
  backgroundColor: "#1e3a5f",
  padding: "24px 40px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#1e3a5f",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#3c4149",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  marginBottom: "4px",
};

const infoBox: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
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
};

export function InvoiceEmail({
  customerName,
  invoiceNumber,
  totalAmount,
  currency,
  dueDate,
  invoiceUrl,
  siteName,
  siteEmail,
}: InvoiceEmailProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency }).format(n);

  return (
    <Html>
      <Head />
      <Preview>
        Invoice {invoiceNumber} — {fmt(totalAmount)} due {dueDate}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text
              style={{
                color: "#fff",
                fontSize: "20px",
                fontWeight: "700",
                margin: "0",
              }}
            >
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading style={headingStyle}>Invoice Available</Heading>
            <Text style={paragraph}>
              Hello {customerName}, a new invoice has been generated for your
              account.
            </Text>

            <Section style={infoBox}>
              <table style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>
                        Invoice Number
                      </Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 12px",
                          fontWeight: "700",
                          fontSize: "18px",
                        }}
                      >
                        {invoiceNumber}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>
                        Total Amount
                      </Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 12px",
                          fontWeight: "700",
                          fontSize: "18px",
                          color: "#1e3a5f",
                        }}
                      >
                        {fmt(totalAmount)}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>
                        Due Date
                      </Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 0",
                          fontWeight: "600",
                        }}
                      >
                        {dueDate}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Button href={invoiceUrl} style={buttonStyle}>
              View Invoice
            </Button>

            <Text style={{ ...paragraph, marginTop: "24px", fontSize: "13px" }}>
              Please ensure payment is made by the due date. If you have any
              questions about this invoice, please contact us.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />
          <Section style={{ padding: "16px 40px" }}>
            <Text style={footerStyle}>
              {siteName} ·{" "}
              <Link href={`mailto:${siteEmail}`}>{siteEmail}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default InvoiceEmail;
