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

interface LowStockVariant {
  sku: string;
  productName: string;
  physicalStock: number;
  minStock: number;
}

interface LowStockAlertEmailProps {
  variants: LowStockVariant[];
  siteName: string;
  siteEmail: string;
  adminUrl: string;
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
};
const header: React.CSSProperties = {
  backgroundColor: "#b45309",
  padding: "24px 40px",
};
const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#3c4149",
};
const alertBox: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  borderLeft: "4px solid #d97706",
  padding: "14px 16px",
  margin: "16px 0",
};
const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
  marginTop: "16px",
};
const th: React.CSSProperties = {
  textAlign: "left" as const,
  padding: "8px 12px",
  backgroundColor: "#f8fafc",
  borderBottom: "2px solid #e2e8f0",
  color: "#64748b",
  fontWeight: "600",
};
const tdBase: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle" as const,
};
const button: React.CSSProperties = {
  backgroundColor: "#b45309",
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

export function LowStockAlertEmail({
  variants,
  siteName,
  siteEmail,
  adminUrl,
}: LowStockAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {`⚠️ Low Stock Alert: ${variants.length} variant(s) need restocking`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={{ color: "#fff", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              {siteName}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Heading style={{ fontSize: "22px", fontWeight: "700", color: "#92400e" }}>
              ⚠️ Low Stock Alert
            </Heading>

            <Section style={alertBox}>
              <Text style={{ ...paragraph, margin: "0", fontWeight: "600" }}>
                {variants.length} variant(s) have reached or fallen below their minimum stock
                threshold and require restocking.
              </Text>
            </Section>

            <Text style={paragraph}>
              The following products need your attention:
            </Text>

            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: "right" as const }}>Current Stock</th>
                  <th style={{ ...th, textAlign: "right" as const }}>Min Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.sku}>
                    <td style={tdBase}>{v.productName}</td>
                    <td style={{ ...tdBase, fontFamily: "monospace", color: "#64748b" }}>
                      {v.sku}
                    </td>
                    <td
                      style={{
                        ...tdBase,
                        textAlign: "right" as const,
                        fontWeight: "700",
                        color: v.physicalStock === 0 ? "#dc2626" : "#d97706",
                      }}
                    >
                      {v.physicalStock === 0 ? "OUT OF STOCK" : v.physicalStock}
                    </td>
                    <td style={{ ...tdBase, textAlign: "right" as const, color: "#64748b" }}>
                      {v.minStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Section style={{ textAlign: "center" as const, margin: "32px 0" }}>
              <Button href={adminUrl} style={button}>
                View Inventory
              </Button>
            </Section>
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

export default LowStockAlertEmail;
