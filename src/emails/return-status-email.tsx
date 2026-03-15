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

type ReturnEmailStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "REFUNDED";

interface ReturnStatusEmailProps {
  customerName: string;
  returnNumber: string;
  orderNumber: string;
  status: ReturnEmailStatus;
  adminNotes?: string;
  refundAmount?: number;
  currency?: string;
  siteName: string;
  siteEmail: string;
}

const STATUS_CONFIG: Record<
  ReturnEmailStatus,
  { heading: string; preview: string; message: string; color: string }
> = {
  REQUESTED: {
    heading: "Return Request Received",
    preview: "Your return request has been received",
    message:
      "We have received your return request and it is being reviewed by our team. You will be notified once a decision has been made.",
    color: "#3b82f6",
  },
  APPROVED: {
    heading: "Return Request Approved",
    preview: "Your return request has been approved",
    message:
      "Your return request has been approved. Please ship the item(s) back to us using the instructions provided. Once we receive and inspect the items, we will process your refund.",
    color: "#22c55e",
  },
  REJECTED: {
    heading: "Return Request Update",
    preview: "Update on your return request",
    message:
      "After reviewing your return request, we are unable to approve it at this time. Please see the details below for more information.",
    color: "#ef4444",
  },
  REFUNDED: {
    heading: "Refund Processed",
    preview: "Your refund has been processed",
    message:
      "Your refund has been processed. The amount should appear in your account within 5-10 business days depending on your payment method.",
    color: "#22c55e",
  },
};

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

const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

export function ReturnStatusEmail({
  customerName,
  returnNumber,
  orderNumber,
  status,
  adminNotes,
  refundAmount,
  currency = "EUR",
  siteName,
  siteEmail,
}: ReturnStatusEmailProps) {
  const config = STATUS_CONFIG[status];
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency }).format(n);

  return (
    <Html>
      <Head />
      <Preview>
        {config.preview} — {returnNumber}
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
            <Heading style={headingStyle}>{config.heading}</Heading>
            <Text style={paragraph}>Hello {customerName},</Text>
            <Text style={paragraph}>{config.message}</Text>

            <Section
              style={{
                backgroundColor: "#f1f5f9",
                borderRadius: "8px",
                padding: "20px",
                margin: "20px 0",
              }}
            >
              <table style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>
                        Return Number
                      </Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 12px",
                          fontWeight: "700",
                        }}
                      >
                        {returnNumber}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>
                        Order Number
                      </Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 12px",
                          fontWeight: "600",
                        }}
                      >
                        {orderNumber}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0" }}>
                      <Text style={{ ...labelStyle, margin: "0" }}>Status</Text>
                      <Text
                        style={{
                          ...paragraph,
                          margin: "2px 0 0",
                          fontWeight: "700",
                          color: config.color,
                        }}
                      >
                        {status}
                      </Text>
                    </td>
                  </tr>
                  {status === "REFUNDED" && refundAmount != null && (
                    <tr>
                      <td style={{ padding: "8px 0 0" }}>
                        <Text style={{ ...labelStyle, margin: "0" }}>
                          Refund Amount
                        </Text>
                        <Text
                          style={{
                            ...paragraph,
                            margin: "2px 0 0",
                            fontWeight: "700",
                            fontSize: "18px",
                            color: "#1e3a5f",
                          }}
                        >
                          {fmt(refundAmount)}
                        </Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            {adminNotes && (
              <Section
                style={{
                  backgroundColor: "#fef3c7",
                  borderLeft: "4px solid #f59e0b",
                  padding: "14px 16px",
                  margin: "16px 0",
                }}
              >
                <Text
                  style={{
                    ...paragraph,
                    margin: "0 0 4px",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  Note from our team:
                </Text>
                <Text
                  style={{
                    ...paragraph,
                    margin: "2px 0",
                    fontSize: "13px",
                  }}
                >
                  {adminNotes}
                </Text>
              </Section>
            )}

            <Button href={`${baseUrl}/profile/returns`} style={buttonStyle}>
              View Return Details
            </Button>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />
          <Section style={{ padding: "16px 40px" }}>
            <Text style={footerStyle}>
              {siteName} ·{" "}
              <Link href={`mailto:${siteEmail}`}>{siteEmail}</Link>
            </Text>
            <Text style={footerStyle}>
              If you have any questions, reply to this email or contact us.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ReturnStatusEmail;
