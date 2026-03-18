import { Resend } from "resend";
import { render } from "@react-email/render";
import { getSiteSettings } from "@/lib/actions/config";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "");
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@factorled.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@factorled.com";
const IS_EMAIL_ENABLED = !!process.env.RESEND_API_KEY;

export interface OrderEmailData {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  items: { variantId: string; quantity: number; price: number }[];
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    zipCode: string;
    country: string;
    phone: string;
  };
  paymentMethod: string;
  isB2B: boolean;
  vatNumber?: string;
  isReverseCharge?: boolean;
}

export interface B2BApplicationEmailData {
  to: string;
  customerName: string;
  companyName: string;
  taxId: string;
}

export interface B2BStatusEmailData {
  to: string;
  customerName: string;
  companyName: string;
  status: "APPROVED" | "REJECTED";
  reason?: string;
}

async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  if (!IS_EMAIL_ENABLED) {
    console.log(`[Email disabled] Would send to ${options.to}: ${options.subject}`);
    return { success: true, skipped: true };
  }

  try {
    const settings = await getSiteSettings();
    const from = `${settings.siteName} <${FROM_EMAIL}>`;

    const { data, error } = await getResend().emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err };
  }
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  const { OrderConfirmationEmail } = await import("@/emails/order-confirmation");
  const settings = await getSiteSettings();

  const html = await render(
    OrderConfirmationEmail({ ...data, siteName: settings.siteName, siteEmail: settings.contactEmail })
  );

  const subject = data.isB2B
    ? `Pedido B2B confirmado: ${data.orderNumber}`
    : `Confirmación de pedido: ${data.orderNumber}`;

  return sendEmail({ to: data.to, subject, html });
}

export async function sendB2BApplicationEmail(data: B2BApplicationEmailData) {
  const { B2BApplicationEmail } = await import("@/emails/b2b-application");
  const settings = await getSiteSettings();

  const customerHtml = await render(
    B2BApplicationEmail({ ...data, siteName: settings.siteName, siteEmail: settings.contactEmail })
  );

  await sendEmail({
    to: data.to,
    subject: "Solicitud B2B recibida – en revisión",
    html: customerHtml,
  });

  const adminHtml = `
    <h2>Nueva solicitud B2B</h2>
    <p><strong>Cliente:</strong> ${data.customerName} (${data.to})</p>
    <p><strong>Empresa:</strong> ${data.companyName}</p>
    <p><strong>NIF/CIF:</strong> ${data.taxId}</p>
    <p><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/customers">Ver en panel admin</a></p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nueva solicitud B2B: ${data.companyName}`,
    html: adminHtml,
  });
}

export async function sendB2BStatusEmail(data: B2BStatusEmailData) {
  const { B2BStatusEmail } = await import("@/emails/b2b-status");
  const settings = await getSiteSettings();

  const html = await render(
    B2BStatusEmail({ ...data, siteName: settings.siteName, siteEmail: settings.contactEmail })
  );

  const subject =
    data.status === "APPROVED"
      ? "¡Tu cuenta B2B ha sido aprobada!"
      : "Actualización de tu solicitud B2B";

  return sendEmail({ to: data.to, subject, html });
}

export async function sendLowStockAlertEmail(variants: {
  sku: string;
  productName: string;
  physicalStock: number;
  minStock: number;
}[]) {
  if (variants.length === 0) return;

  const { LowStockAlertEmail } = await import("@/emails/low-stock-alert");
  const settings = await getSiteSettings();
  const adminUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/inventory`;

  const html = await render(
    LowStockAlertEmail({ variants, siteName: settings.siteName, siteEmail: settings.contactEmail, adminUrl })
  );

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `Low Stock Alert: ${variants.length} variant(s) need restocking`,
    html,
  });
}

export async function sendPasswordResetEmail(data: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { PasswordResetEmail } = await import("@/emails/password-reset");
  const settings = await getSiteSettings();

  const html = await render(
    PasswordResetEmail({
      customerName: data.name,
      resetUrl: data.resetUrl,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
    })
  );

  return sendEmail({
    to: data.to,
    subject: `Password Reset - ${settings.siteName}`,
    html,
  });
}

export async function sendVerificationEmail(data: {
  to: string;
  name: string;
  verifyUrl: string;
}) {
  const settings = await getSiteSettings();

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h1 style="color:#1e3a5f">${settings.siteName}</h1>
      <h2>Verify Your Email</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for registering at <strong>${settings.siteName}</strong>. Please verify your email address by clicking the button below:</p>
      <p style="text-align:center;margin:30px 0">
        <a href="${data.verifyUrl}" style="background:#1e3a5f;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold">Verify Email</a>
      </p>
      <p>This link will expire in 24 hours.</p>
      <hr/>
      <p style="color:#888;font-size:12px">${settings.siteName} · ${settings.address} · ${settings.contactEmail}</p>
    </body>
    </html>
  `;

  return sendEmail({
    to: data.to,
    subject: `Verify your email - ${settings.siteName}`,
    html,
  });
}

export async function sendShipmentNotificationEmail(data: {
  to: string;
  customerName: string;
  orderNumber: string;
  status: "SHIPPED" | "DELIVERED";
  trackingNumber?: string;
  trackingUrl?: string;
}) {
  const { ShipmentNotificationEmail } = await import("@/emails/shipment-notification");
  const settings = await getSiteSettings();

  const html = await render(
    ShipmentNotificationEmail({
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      status: data.status,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
    })
  );

  const subject =
    data.status === "SHIPPED"
      ? `Tu pedido #${data.orderNumber} está en camino – ${settings.siteName}`
      : `Tu pedido #${data.orderNumber} ha sido entregado – ${settings.siteName}`;

  return sendEmail({ to: data.to, subject, html });
}

export async function sendWelcomeEmail(data: {
  to: string;
  name: string;
}) {
  const { WelcomeEmail } = await import("@/emails/welcome");
  const settings = await getSiteSettings();
  const applyB2BUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/apply-b2b`;

  const html = await render(
    WelcomeEmail({
      customerName: data.name,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
      applyB2BUrl,
    })
  );

  return sendEmail({
    to: data.to,
    subject: `¡Bienvenido/a a ${settings.siteName}!`,
    html,
  });
}

export async function sendInvoiceEmail(data: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  dueDate: string;
  invoiceUrl: string;
}) {
  const { InvoiceEmail } = await import("@/emails/invoice-email");
  const settings = await getSiteSettings();

  const html = await render(
    InvoiceEmail({
      customerName: data.customerName,
      invoiceNumber: data.invoiceNumber,
      totalAmount: data.totalAmount,
      currency: data.currency,
      dueDate: data.dueDate,
      invoiceUrl: data.invoiceUrl,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
    })
  );

  return sendEmail({
    to: data.to,
    subject: `Invoice ${data.invoiceNumber} — ${settings.siteName}`,
    html,
  });
}

export async function sendRFQConfirmationEmail(data: {
  to: string;
  customerName: string;
  rfqNumber: string;
  itemCount: number;
}) {
  const { RFQConfirmationEmail } = await import("@/emails/rfq-confirmation");
  const settings = await getSiteSettings();

  const html = await render(
    RFQConfirmationEmail({
      customerName: data.customerName,
      rfqNumber: data.rfqNumber,
      itemCount: data.itemCount,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
    })
  );

  return sendEmail({
    to: data.to,
    subject: `Quote Request ${data.rfqNumber} Received — ${settings.siteName}`,
    html,
  });
}

export async function sendRFQAdminNotificationEmail(data: {
  contactName: string;
  contactEmail: string;
  companyName?: string;
  itemCount: number;
  rfqId: string;
}) {
  const { RFQAdminNotificationEmail } = await import("@/emails/rfq-confirmation");
  const settings = await getSiteSettings();
  const adminUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const html = await render(
    RFQAdminNotificationEmail({
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      companyName: data.companyName,
      itemCount: data.itemCount,
      rfqId: data.rfqId,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
      adminUrl,
    })
  );

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `New RFQ from ${data.contactName}${data.companyName ? ` (${data.companyName})` : ""} — ${data.itemCount} item(s)`,
    html,
  });
}

export async function sendReturnStatusEmail(data: {
  to: string;
  customerName: string;
  returnNumber: string;
  orderNumber: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";
  adminNotes?: string;
  refundAmount?: number;
  currency?: string;
}) {
  const { ReturnStatusEmail } = await import("@/emails/return-status-email");
  const settings = await getSiteSettings();

  const html = await render(
    ReturnStatusEmail({
      customerName: data.customerName,
      returnNumber: data.returnNumber,
      orderNumber: data.orderNumber,
      status: data.status,
      adminNotes: data.adminNotes,
      refundAmount: data.refundAmount,
      currency: data.currency,
      siteName: settings.siteName,
      siteEmail: settings.contactEmail,
    })
  );

  const subjectMap = {
    REQUESTED: `Return Request ${data.returnNumber} Received`,
    APPROVED: `Return Request ${data.returnNumber} Approved`,
    REJECTED: `Update on Return Request ${data.returnNumber}`,
    REFUNDED: `Refund Processed for Return ${data.returnNumber}`,
  };

  return sendEmail({
    to: data.to,
    subject: `${subjectMap[data.status]} — ${settings.siteName}`,
    html,
  });
}

export async function sendContactNotificationEmail(data: {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
}) {
  const settings = await getSiteSettings();
  const adminUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/cms/contact-submissions`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h1 style="color:#1e3a5f">${settings.siteName}</h1>
      <h2>New Contact Form Submission</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Name</td><td style="padding:8px;border-bottom:1px solid #eee">${data.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Email</td><td style="padding:8px;border-bottom:1px solid #eee">${data.email}</td></tr>
        ${data.company ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Company</td><td style="padding:8px;border-bottom:1px solid #eee">${data.company}</td></tr>` : ""}
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">Subject</td><td style="padding:8px;border-bottom:1px solid #eee">${data.subject}</td></tr>
      </table>
      <div style="margin-top:20px;padding:15px;background:#f5f5f5;border-radius:8px">
        <p style="margin:0;white-space:pre-wrap">${data.message}</p>
      </div>
      <p style="margin-top:20px"><a href="${adminUrl}" style="background:#1e3a5f;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">View in Admin</a></p>
      <hr style="margin-top:30px"/>
      <p style="color:#888;font-size:12px">${settings.siteName} · ${settings.contactEmail}</p>
    </body>
    </html>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Contact Form] ${data.subject} — from ${data.name}`,
    html,
  });
}
