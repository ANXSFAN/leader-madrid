import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Row,
  Column,
} from "@react-email/components";

interface ShipmentNotificationEmailProps {
  customerName: string;
  orderNumber: string;
  status: "SHIPPED" | "DELIVERED";
  trackingNumber?: string;
  trackingUrl?: string;
  siteName: string;
  siteEmail: string;
}

export function ShipmentNotificationEmail({
  customerName,
  orderNumber,
  status,
  trackingNumber,
  trackingUrl,
  siteName,
  siteEmail,
}: ShipmentNotificationEmailProps) {
  const isShipped = status === "SHIPPED";

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: "32px auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          {/* Header */}
          <Section style={{ backgroundColor: "#1e3a5f", padding: "24px 32px" }}>
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: 24 }}>{siteName}</Heading>
          </Section>

          {/* Status banner */}
          <Section style={{ backgroundColor: isShipped ? "#dbeafe" : "#dcfce7", padding: "16px 32px" }}>
            <Text style={{ color: isShipped ? "#1d4ed8" : "#15803d", fontWeight: "bold", fontSize: 16, margin: 0, textAlign: "center" }}>
              {isShipped ? "🚚 Tu pedido está en camino" : "✅ Tu pedido ha sido entregado"}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "32px" }}>
            <Text style={{ fontSize: 16, color: "#374151" }}>Hola {customerName},</Text>
            <Text style={{ fontSize: 15, color: "#374151", lineHeight: "1.6" }}>
              {isShipped
                ? `Tu pedido <strong>#${orderNumber}</strong> ha sido enviado y ya está en manos del transportista.`
                : `¡Buenas noticias! Tu pedido <strong>#${orderNumber}</strong> ha sido entregado con éxito.`}
            </Text>

            {trackingNumber && (
              <Section style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "16px 20px", margin: "20px 0" }}>
                <Row>
                  <Column>
                    <Text style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Número de seguimiento
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "bold", fontFamily: "monospace", color: "#1e3a5f", margin: 0 }}>
                      {trackingNumber}
                    </Text>
                  </Column>
                </Row>
              </Section>
            )}

            {trackingUrl && isShipped && (
              <Section style={{ textAlign: "center", margin: "24px 0" }}>
                <Button
                  href={trackingUrl}
                  style={{
                    backgroundColor: "#1e3a5f",
                    color: "#ffffff",
                    padding: "12px 28px",
                    borderRadius: 6,
                    fontWeight: "bold",
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  Rastrear mi pedido
                </Button>
              </Section>
            )}

            {!isShipped && (
              <Text style={{ fontSize: 14, color: "#6b7280" }}>
                Gracias por confiar en {siteName}. Esperamos que tu compra supere tus expectativas.
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: 0 }} />

          {/* Footer */}
          <Section style={{ padding: "20px 32px", backgroundColor: "#f8fafc" }}>
            <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", margin: 0 }}>
              {siteName} · {siteEmail}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
