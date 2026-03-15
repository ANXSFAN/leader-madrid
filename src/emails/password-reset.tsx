import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface PasswordResetEmailProps {
  customerName: string;
  resetUrl: string;
  siteName: string;
  siteEmail: string;
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
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
const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#3c4149",
};
const button: React.CSSProperties = {
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
const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
};

export function PasswordResetEmail({
  customerName,
  resetUrl,
  siteName,
  siteEmail,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password – link valid for 1 hour</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={{ color: "#fff", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading style={{ fontSize: "22px", fontWeight: "700", color: "#1e3a5f" }}>
              Password Reset Request
            </Heading>
            <Text style={paragraph}>Hi {customerName},</Text>
            <Text style={paragraph}>
              We received a request to reset your password. Click the button below to set a new password:
            </Text>

            <Section style={{ textAlign: "center" as const, margin: "32px 0" }}>
              <Button href={resetUrl} style={button}>
                Reset Password
              </Button>
            </Section>

            <Text style={{ ...paragraph, color: "#6b7280", fontSize: "13px" }}>
              This link will expire in <strong>1 hour</strong>. If you did not request a password
              reset, you can safely ignore this email.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "0 40px" }} />
          <Section style={{ padding: "16px 40px" }}>
            <Text style={footer}>
              {siteName} · {siteEmail}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;
