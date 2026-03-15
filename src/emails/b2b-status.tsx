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

interface B2BStatusEmailProps {
  customerName: string;
  companyName: string;
  status: "APPROVED" | "REJECTED";
  reason?: string;
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
const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#3c4149",
};
const button: React.CSSProperties = {
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

export function B2BStatusEmail({
  customerName,
  companyName,
  status,
  reason,
  siteName,
  siteEmail,
}: B2BStatusEmailProps) {
  const isApproved = status === "APPROVED";

  const headerBg = isApproved ? "#16a34a" : "#dc2626";
  const boxBg = isApproved ? "#f0fdf4" : "#fef2f2";
  const boxBorder = isApproved ? "#22c55e" : "#ef4444";
  const btnBg = isApproved ? "#16a34a" : "#1e3a5f";

  return (
    <Html>
      <Head />
      <Preview>
        {isApproved
          ? `¡Cuenta B2B aprobada! Bienvenido/a a ${siteName} Pro`
          : `Actualización de tu solicitud B2B en ${siteName}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ backgroundColor: headerBg, padding: "24px 40px" }}>
            <Text style={{ color: "#fff", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: isApproved ? "#16a34a" : "#dc2626",
              }}
            >
              {isApproved ? "¡Cuenta B2B Aprobada! 🎉" : "Solicitud B2B No Aprobada"}
            </Heading>

            <Text style={paragraph}>Hola {customerName},</Text>

            {isApproved ? (
              <>
                <Text style={paragraph}>
                  ¡Enhorabuena! Tu cuenta B2B para <strong>{companyName}</strong> ha sido
                  aprobada. Ya puedes acceder a todos los beneficios profesionales.
                </Text>
                <Section
                  style={{
                    backgroundColor: boxBg,
                    borderLeft: `4px solid ${boxBorder}`,
                    padding: "14px 16px",
                    margin: "16px 0",
                  }}
                >
                  <Text style={{ ...paragraph, margin: "0 0 4px", fontWeight: "600" }}>
                    Ahora tienes acceso a:
                  </Text>
                  <Text style={{ ...paragraph, margin: "4px 0" }}>
                    ✓ Precios mayoristas exclusivos
                    <br />
                    ✓ Descuentos por volumen en todos los productos
                    <br />
                    ✓ Facturación con desglose de IVA e inversión del sujeto pasivo (UE)
                    <br />
                    ✓ Campo de número de pedido (PO) en checkout
                    <br />
                    ✓ Gestión de múltiples direcciones de entrega
                  </Text>
                </Section>
                <Button
                  href={`${baseUrl}/`}
                  style={{ ...button, backgroundColor: btnBg, marginTop: "8px" }}
                >
                  Ir al catálogo con precios B2B
                </Button>
              </>
            ) : (
              <>
                <Text style={paragraph}>
                  Lamentablemente, no hemos podido aprobar la solicitud B2B de{" "}
                  <strong>{companyName}</strong> en este momento.
                </Text>
                {reason && (
                  <Section
                    style={{
                      backgroundColor: boxBg,
                      borderLeft: `4px solid ${boxBorder}`,
                      padding: "14px 16px",
                      margin: "16px 0",
                    }}
                  >
                    <Text style={{ ...paragraph, margin: "0", fontWeight: "600" }}>
                      Motivo:
                    </Text>
                    <Text style={{ ...paragraph, margin: "4px 0 0" }}>{reason}</Text>
                  </Section>
                )}
                <Text style={paragraph}>
                  Puedes seguir comprando como cliente B2C. Si crees que hay un error o tienes
                  más información que acredite tu actividad profesional, responde a este correo.
                </Text>
                <Button
                  href={`mailto:${siteEmail}`}
                  style={{ ...button, backgroundColor: btnBg, marginTop: "8px" }}
                >
                  Contactar con soporte
                </Button>
              </>
            )}
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

export default B2BStatusEmail;
