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

interface WelcomeEmailProps {
  customerName: string;
  siteName: string;
  siteEmail: string;
  applyB2BUrl: string;
}

const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

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
const infoBox: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #1e3a5f",
  padding: "14px 16px",
  margin: "16px 0",
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

export function WelcomeEmail({
  customerName,
  siteName,
  siteEmail,
  applyB2BUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>¡Bienvenido/a a {siteName}! Explora nuestro catálogo LED profesional</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={{ color: "#fff", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading style={{ fontSize: "22px", fontWeight: "700", color: "#1e3a5f" }}>
              ¡Bienvenido/a, {customerName}!
            </Heading>
            <Text style={paragraph}>
              Gracias por registrarte en <strong>{siteName}</strong>. Ya puedes explorar nuestro
              catálogo de iluminación LED profesional.
            </Text>

            <Section style={infoBox}>
              <Text style={{ ...paragraph, margin: "0 0 4px", fontWeight: "600" }}>
                ¿Eres profesional o empresa?
              </Text>
              <Text style={{ ...paragraph, margin: "2px 0" }}>
                Solicita tu cuenta B2B para acceder a precios mayoristas exclusivos, descuentos por
                volumen y facturas con desglose de IVA.
              </Text>
            </Section>

            <Button href={applyB2BUrl} style={button}>
              Solicitar cuenta B2B
            </Button>

            <Text style={{ ...paragraph, marginTop: "24px" }}>
              O explora nuestro catálogo directamente:{" "}
              <a href={`${baseUrl}/products`} style={{ color: "#1e3a5f" }}>
                Ver productos
              </a>
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

export default WelcomeEmail;
