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

// ---------- Customer confirmation email ----------

interface RFQConfirmationEmailProps {
  customerName: string;
  rfqNumber: string;
  itemCount: number;
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

const infoBox: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #1e3a5f",
  padding: "14px 16px",
  margin: "16px 0",
};

const footerStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
};

export function RFQConfirmationEmail({
  customerName,
  rfqNumber,
  itemCount,
  siteName,
  siteEmail,
}: RFQConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your quote request {rfqNumber} has been received — {siteName}
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
            <Heading style={headingStyle}>Quote Request Received</Heading>
            <Text style={paragraph}>
              Hello {customerName}, thank you for submitting your quote request.
              Our team will review it and get back to you as soon as possible.
            </Text>

            <Section style={infoBox}>
              <Text
                style={{ ...paragraph, margin: "0 0 4px", fontWeight: "600" }}
              >
                Request Reference: {rfqNumber}
              </Text>
              <Text style={{ ...paragraph, margin: "2px 0", fontSize: "13px" }}>
                {itemCount} product{itemCount !== 1 ? "s" : ""} included in this
                request.
              </Text>
            </Section>

            <Text style={paragraph}>
              Our sales team typically responds within 1-2 business days. You
              will receive a notification when your quote is ready.
            </Text>

            <Text
              style={{ ...paragraph, marginTop: "24px", fontSize: "13px" }}
            >
              If you have any questions in the meantime, feel free to contact
              us at{" "}
              <Link href={`mailto:${siteEmail}`} style={{ color: "#1e3a5f" }}>
                {siteEmail}
              </Link>
              .
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

// ---------- Admin notification email ----------

interface RFQAdminNotificationEmailProps {
  contactName: string;
  contactEmail: string;
  companyName?: string;
  itemCount: number;
  rfqId: string;
  siteName: string;
  siteEmail: string;
  adminUrl: string;
}

export function RFQAdminNotificationEmail({
  contactName,
  contactEmail,
  companyName,
  itemCount,
  rfqId,
  siteName,
  siteEmail,
  adminUrl,
}: RFQAdminNotificationEmailProps) {
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

  return (
    <Html>
      <Head />
      <Preview>
        {`New RFQ from ${contactName}${companyName ? ` (${companyName})` : ""} — ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
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
            <Heading style={headingStyle}>New Quote Request</Heading>
            <Text style={paragraph}>
              A new quote request has been submitted and is waiting for review.
            </Text>

            <Section style={infoBox}>
              <Text
                style={{ ...paragraph, margin: "0 0 4px", fontWeight: "600" }}
              >
                Contact: {contactName}
              </Text>
              <Text style={{ ...paragraph, margin: "2px 0", fontSize: "13px" }}>
                Email: {contactEmail}
              </Text>
              {companyName && (
                <Text
                  style={{ ...paragraph, margin: "2px 0", fontSize: "13px" }}
                >
                  Company: {companyName}
                </Text>
              )}
              <Text style={{ ...paragraph, margin: "2px 0", fontSize: "13px" }}>
                Items: {itemCount} product{itemCount !== 1 ? "s" : ""}
              </Text>
            </Section>

            <Button href={`${adminUrl}/admin/rfq/${rfqId}`} style={buttonStyle}>
              Review RFQ
            </Button>
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

export default RFQConfirmationEmail;
