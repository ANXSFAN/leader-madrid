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

interface B2BApplicationEmailProps {
  customerName: string;
  companyName: string;
  taxId: string;
  siteName: string;
  siteEmail: string;
  to?: string;
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
  backgroundColor: "#f0fdf4",
  borderLeft: "4px solid #22c55e",
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

export function B2BApplicationEmail({
  customerName,
  companyName,
  taxId,
  siteName,
  siteEmail,
}: B2BApplicationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Solicitud B2B recibida – estamos revisando tu cuenta profesional</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={{ color: "#fff", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading style={{ fontSize: "22px", fontWeight: "700", color: "#1e3a5f" }}>
              Solicitud B2B Recibida
            </Heading>
            <Text style={paragraph}>Hola {customerName},</Text>
            <Text style={paragraph}>
              Hemos recibido tu solicitud para acceder a nuestra cuenta B2B profesional.
              Nuestro equipo revisará tu información en <strong>un plazo de 24–48 horas</strong>.
            </Text>

            <Section style={infoBox}>
              <Text style={{ ...paragraph, margin: "0 0 4px", fontWeight: "600" }}>
                Datos de tu solicitud:
              </Text>
              <Text style={{ ...paragraph, margin: "2px 0" }}>
                <strong>Empresa:</strong> {companyName}
              </Text>
              <Text style={{ ...paragraph, margin: "2px 0" }}>
                <strong>NIF/CIF:</strong> {taxId}
              </Text>
            </Section>

            <Text style={paragraph}>
              Una vez aprobada tu cuenta, tendrás acceso a:
            </Text>
            <Text style={{ ...paragraph, paddingLeft: "16px" }}>
              ✓ Precios mayoristas exclusivos
              <br />
              ✓ Descuentos por volumen
              <br />
              ✓ Facturas con desglose de IVA
              <br />
              ✓ Referencia de número de pedido (PO)
            </Text>

            <Button href={`${baseUrl}/profile`} style={button}>
              Ver mi perfil
            </Button>
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

export default B2BApplicationEmail;
