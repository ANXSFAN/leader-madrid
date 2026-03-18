/**
 * Leader Madrid — 站点初始化数据脚本
 *
 * 填充所有空的管理模块：GlobalConfig、ShippingMethod、CountryVATConfig、
 * CmsPage（法律页面）、Banner（首页横幅）、ExchangeRate
 *
 * 运行方式: npx tsx scripts/init-site-data.ts
 *
 * 幂等：使用 upsert / findFirst 防止重复创建
 */

import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient, CmsPageType } from "@prisma/client";

const prisma = new PrismaClient();

// ─── 辅助 ────────────────────────────────────────────────────────────────────

function log(action: string, detail: string) {
  console.log(`  ✔ [${action}] ${detail}`);
}

function logSkip(action: string, detail: string) {
  console.log(`  ⏭ [${action}] ${detail} — 已存在，跳过`);
}

// ─── 1. GlobalConfig — 站点设置 ──────────────────────────────────────────────

async function seedGlobalConfig() {
  console.log("\n📦 1. GlobalConfig — 站点设置");

  const siteSettings = {
    siteName: "Leader Madrid",
    siteDescription: "Distribuidor mayorista de iluminación LED en Madrid",
    logoUrl: "/logo.svg",
    contactEmail: "leaderled@leadermadrid.es",
    contactPhone: "+34 916 156 311",
    contactWhatsApp: "+34 646 472 650",
    address: "C/ Matarrosa 32, C.P 28947 Fuenlabrada, Madrid",
    companyName: "LEADER TECHNOLOGY SL.",
    nif: "B88271275",
    storeHours: "Lunes-Viernes: 10:00 - 19:00, Domingo: 10:00 - 19:00",
    currency: "EUR",
    footerColumns: [
      {
        title: "Enlaces Rápidos",
        links: [
          { label: "Inicio", href: "/" },
          { label: "Todos los Productos", href: "/search" },
          { label: "Contacto", href: "/contact" },
          { label: "Mi Cuenta", href: "/profile" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Aviso Legal", href: "/legal/terms" },
          { label: "Política de Privacidad", href: "/legal/privacy" },
          { label: "Política de Cookies", href: "/legal/cookie-policy" },
          { label: "Devoluciones", href: "/legal/returns" },
        ],
      },
    ],
    socialLinks: {
      facebook: "https://www.facebook.com/people/Leadermadrid-Pantallas-LED",
      instagram: "https://www.instagram.com/leadermadrid",
      tiktok: "https://www.tiktok.com/@leaderled",
    },
  };

  await prisma.globalConfig.upsert({
    where: { key: "site_settings" },
    update: { value: siteSettings },
    create: { key: "site_settings", value: siteSettings },
  });
  log("GlobalConfig", "site_settings 已创建/更新");
}

// ─── 2. ShippingMethod — 运输方式 ────────────────────────────────────────────

async function seedShippingMethods() {
  console.log("\n🚚 2. ShippingMethod — 运输方式");

  const methods = [
    {
      name: "Envío Estándar",
      description: "Envío a domicilio en 2-5 días laborables. Tarifa plana de 4,12 €.",
      price: 4.12,
      estimatedDays: 5,
      isActive: true,
      isDefault: false,
    },
    {
      name: "Envío Gratuito",
      description: "Envío gratuito para pedidos superiores a 40 €. Entrega en 2-5 días laborables.",
      price: 0,
      estimatedDays: 5,
      isActive: true,
      isDefault: true,
    },
    {
      name: "Recogida en Tienda",
      description: "Recogida en C/ Matarrosa 32, Fuenlabrada. Sin coste adicional.",
      price: 0,
      estimatedDays: 0,
      isActive: true,
      isDefault: false,
    },
  ];

  for (const m of methods) {
    const existing = await prisma.shippingMethod.findFirst({
      where: { name: m.name },
    });
    if (existing) {
      logSkip("ShippingMethod", m.name);
      continue;
    }
    await prisma.shippingMethod.create({ data: m });
    log("ShippingMethod", m.name);
  }
}

// ─── 3. CountryVATConfig — 西班牙 21% IVA ───────────────────────────────────

async function seedVAT() {
  console.log("\n💰 3. CountryVATConfig — IVA 西班牙");

  await prisma.countryVATConfig.upsert({
    where: { countryCode: "ES" },
    update: {},
    create: {
      countryCode: "ES",
      countryName: "España",
      standardRate: 21,
      reducedRate: 10,
      isEU: true,
      isActive: true,
    },
  });
  log("CountryVATConfig", "ES — 21% IVA");
}

// ─── 4. CmsPage — 法律页面 ──────────────────────────────────────────────────

async function seedCmsPages() {
  console.log("\n📄 4. CmsPage — 法律页面");

  const pages = [
    {
      slug: "terms",
      type: CmsPageType.LEGAL,
      order: 0,
      content: {
        es: {
          title: "Aviso Legal",
          description: "Información legal sobre LEADER TECHNOLOGY SL.",
          body: `<h2>Datos Identificativos</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y Comercio Electrónico, se informa:</p>
<ul>
  <li><strong>Denominación social:</strong> LEADER TECHNOLOGY SL.</li>
  <li><strong>NIF:</strong> B88271275</li>
  <li><strong>Domicilio:</strong> Calle Matarrosa 32, 28947 Fuenlabrada, Madrid, España</li>
  <li><strong>Email:</strong> leaderled@leadermadrid.es</li>
  <li><strong>Teléfono:</strong> +34 916 156 311</li>
  <li><strong>Actividad:</strong> Venta de iluminación LED</li>
</ul>
<h2>Condiciones de Uso</h2>
<p>La utilización del sitio web le otorga la condición de Usuario, e implica la aceptación plena de todas las condiciones incluidas en este Aviso Legal y la Política de Privacidad.</p>
<p>El usuario debe ser mayor de 18 años o la edad legal de mayoría en su país para utilizar los servicios.</p>
<h2>Propiedad Intelectual</h2>
<p>Todos los contenidos del sitio web, incluyendo textos, imágenes, diseño gráfico y código fuente, están protegidos por derechos de propiedad intelectual. Todos los derechos están reservados.</p>
<h2>Legislación Aplicable</h2>
<p>El presente aviso legal se rige en todos y cada uno de sus extremos por la legislación española.</p>`,
        },
        en: {
          title: "Legal Notice",
          description: "Legal information about LEADER TECHNOLOGY SL.",
          body: `<h2>Identification Data</h2>
<p>In compliance with Article 10 of Law 34/2002, of July 11, on Information Society Services and Electronic Commerce, the following is stated:</p>
<ul>
  <li><strong>Company name:</strong> LEADER TECHNOLOGY SL.</li>
  <li><strong>Tax ID (NIF):</strong> B88271275</li>
  <li><strong>Address:</strong> Calle Matarrosa 32, 28947 Fuenlabrada, Madrid, Spain</li>
  <li><strong>Email:</strong> leaderled@leadermadrid.es</li>
  <li><strong>Phone:</strong> +34 916 156 311</li>
  <li><strong>Activity:</strong> Sale of LED lighting</li>
</ul>
<h2>Terms of Use</h2>
<p>Using this website grants you the status of User and implies full acceptance of all conditions included in this Legal Notice and the Privacy Policy.</p>
<p>Users must be at least 18 years old or the legal age of majority in their country to use these services.</p>
<h2>Intellectual Property</h2>
<p>All website content, including texts, images, graphic design, and source code, is protected by intellectual property rights. All rights are reserved.</p>
<h2>Applicable Law</h2>
<p>This legal notice is governed in all respects by Spanish law.</p>`,
        },
      },
    },
    {
      slug: "privacy",
      type: CmsPageType.LEGAL,
      order: 1,
      content: {
        es: {
          title: "Política de Privacidad",
          description: "Cómo tratamos tus datos personales en LEADER TECHNOLOGY SL.",
          body: `<h2>Responsable del Tratamiento</h2>
<ul>
  <li><strong>Denominación social:</strong> LEADER TECHNOLOGY SL.</li>
  <li><strong>NIF:</strong> B88271275</li>
  <li><strong>Domicilio:</strong> Calle Matarrosa 32, 28947 Fuenlabrada, Madrid, España</li>
  <li><strong>Email de contacto:</strong> leaderled@leadermadrid.es</li>
</ul>

<h2>Datos Recopilados</h2>
<p>Recopilamos los siguientes datos personales:</p>
<ul>
  <li>Datos de identificación: nombre, apellidos, dirección de correo electrónico.</li>
  <li>Datos de contacto: teléfono, dirección postal.</li>
  <li>Datos de navegación: dirección IP, tipo de navegador, páginas visitadas.</li>
  <li>Datos comerciales: historial de pedidos, preferencias de productos.</li>
</ul>

<h2>Finalidad del Tratamiento</h2>
<p>Los datos personales se tratan con las siguientes finalidades:</p>
<ul>
  <li>Gestión de la relación comercial y tramitación de pedidos.</li>
  <li>Envío de comunicaciones comerciales (con consentimiento previo).</li>
  <li>Cumplimiento de obligaciones legales y fiscales.</li>
  <li>Mejora de nuestros servicios y experiencia de usuario.</li>
</ul>

<h2>Base Legal</h2>
<p>La base legal para el tratamiento de sus datos es:</p>
<ul>
  <li>La ejecución de un contrato (tramitación de pedidos).</li>
  <li>El consentimiento del interesado (comunicaciones comerciales).</li>
  <li>El cumplimiento de obligaciones legales (facturación, fiscalidad).</li>
  <li>El interés legítimo del responsable (mejora de servicios).</li>
</ul>

<h2>Destinatarios</h2>
<p>Los datos podrán ser comunicados a:</p>
<ul>
  <li>Empresas de transporte para la entrega de pedidos.</li>
  <li>Entidades bancarias para la gestión de pagos.</li>
  <li>Administraciones públicas cuando exista obligación legal.</li>
</ul>
<p>No se realizan transferencias internacionales de datos fuera del Espacio Económico Europeo.</p>

<h2>Derechos del Usuario</h2>
<p>Usted tiene derecho a:</p>
<ul>
  <li><strong>Acceso:</strong> conocer qué datos personales tratamos sobre usted.</li>
  <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos.</li>
  <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
  <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y de uso común.</li>
  <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinadas circunstancias.</li>
  <li><strong>Limitación:</strong> solicitar la limitación del tratamiento en determinados supuestos.</li>
</ul>
<p>Para ejercer estos derechos, puede enviar un correo electrónico a <strong>leaderled@leadermadrid.es</strong> indicando el derecho que desea ejercer y adjuntando copia de su DNI.</p>
<p>También tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).</p>

<h2>Periodo de Conservación</h2>
<p>Los datos personales se conservarán durante el tiempo necesario para cumplir con la finalidad para la que se recabaron, y durante los plazos legalmente establecidos (generalmente 5 años para datos fiscales).</p>`,
        },
        en: {
          title: "Privacy Policy",
          description: "How we handle your personal data at LEADER TECHNOLOGY SL.",
          body: `<h2>Data Controller</h2>
<ul>
  <li><strong>Company name:</strong> LEADER TECHNOLOGY SL.</li>
  <li><strong>Tax ID (NIF):</strong> B88271275</li>
  <li><strong>Address:</strong> Calle Matarrosa 32, 28947 Fuenlabrada, Madrid, Spain</li>
  <li><strong>Contact email:</strong> leaderled@leadermadrid.es</li>
</ul>

<h2>Data Collected</h2>
<p>We collect the following personal data:</p>
<ul>
  <li>Identification data: name, surname, email address.</li>
  <li>Contact data: phone number, postal address.</li>
  <li>Browsing data: IP address, browser type, pages visited.</li>
  <li>Commercial data: order history, product preferences.</li>
</ul>

<h2>Purpose of Processing</h2>
<p>Personal data is processed for the following purposes:</p>
<ul>
  <li>Management of the commercial relationship and order processing.</li>
  <li>Sending commercial communications (with prior consent).</li>
  <li>Compliance with legal and tax obligations.</li>
  <li>Improvement of our services and user experience.</li>
</ul>

<h2>Legal Basis</h2>
<p>The legal basis for processing your data is:</p>
<ul>
  <li>Performance of a contract (order processing).</li>
  <li>Consent (commercial communications).</li>
  <li>Legal obligation (invoicing, taxation).</li>
  <li>Legitimate interest (service improvement).</li>
</ul>

<h2>Recipients</h2>
<p>Data may be disclosed to:</p>
<ul>
  <li>Shipping companies for order delivery.</li>
  <li>Banking entities for payment processing.</li>
  <li>Public authorities when legally required.</li>
</ul>
<p>No international data transfers outside the European Economic Area are made.</p>

<h2>User Rights</h2>
<p>You have the right to:</p>
<ul>
  <li><strong>Access:</strong> know what personal data we process about you.</li>
  <li><strong>Rectification:</strong> request correction of inaccurate data.</li>
  <li><strong>Erasure:</strong> request deletion of your data when no longer necessary.</li>
  <li><strong>Portability:</strong> receive your data in a structured, commonly used format.</li>
  <li><strong>Objection:</strong> object to the processing of your data in certain circumstances.</li>
  <li><strong>Restriction:</strong> request limitation of processing in certain cases.</li>
</ul>
<p>To exercise these rights, send an email to <strong>leaderled@leadermadrid.es</strong> stating the right you wish to exercise and attaching a copy of your ID.</p>
<p>You also have the right to file a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).</p>

<h2>Data Retention Period</h2>
<p>Personal data will be kept for the time necessary to fulfill the purpose for which it was collected, and for the legally established periods (generally 5 years for tax data).</p>`,
        },
      },
    },
    {
      slug: "cookie-policy",
      type: CmsPageType.LEGAL,
      order: 2,
      content: {
        es: {
          title: "Política de Cookies",
          description: "Información sobre el uso de cookies en nuestro sitio web.",
          body: `<h2>¿Qué son las cookies?</h2>
<p>Las cookies son pequeños archivos de texto que los sitios web almacenan en su navegador cuando los visita. Se utilizan ampliamente para hacer que los sitios web funcionen de manera más eficiente y proporcionar información a los propietarios del sitio.</p>

<h2>Tipos de Cookies que Utilizamos</h2>

<h3>Cookies Técnicas (Necesarias)</h3>
<p>Son esenciales para el funcionamiento del sitio web. Incluyen cookies de sesión, autenticación y carrito de compra. No requieren consentimiento.</p>
<ul>
  <li><strong>next-auth.session-token:</strong> gestión de la sesión del usuario.</li>
  <li><strong>NEXT_LOCALE:</strong> idioma preferido del usuario.</li>
  <li><strong>currency:</strong> moneda de visualización seleccionada.</li>
</ul>

<h3>Cookies Estadísticas</h3>
<p>Nos ayudan a entender cómo los visitantes interactúan con el sitio web, recopilando información de forma anónima.</p>
<ul>
  <li><strong>Google Analytics (_ga, _gid):</strong> análisis de tráfico web y comportamiento del usuario.</li>
</ul>

<h3>Cookies de Marketing</h3>
<p>Se utilizan para rastrear a los visitantes en los sitios web con el fin de mostrar anuncios relevantes.</p>
<ul>
  <li><strong>Google Tag Manager:</strong> gestión de etiquetas de marketing.</li>
  <li><strong>Facebook Pixel:</strong> seguimiento de conversiones y remarketing.</li>
</ul>

<h2>¿Cómo Desactivar las Cookies?</h2>
<p>Puede configurar su navegador para que rechace todas las cookies o para que le avise cuando se envía una cookie. Sin embargo, algunas funciones del sitio web pueden no funcionar correctamente sin cookies.</p>
<ul>
  <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
  <li><strong>Firefox:</strong> Opciones → Privacidad y seguridad → Cookies</li>
  <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies</li>
  <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio</li>
</ul>

<h2>Contacto</h2>
<p>Para cualquier consulta sobre nuestra política de cookies, puede contactarnos en <strong>leaderled@leadermadrid.es</strong>.</p>

<h2>Actualización</h2>
<p>Esta política de cookies puede ser actualizada periódicamente. La fecha de la última actualización se indica al pie de esta página.</p>
<p><em>Última actualización: marzo 2026</em></p>`,
        },
        en: {
          title: "Cookie Policy",
          description: "Information about the use of cookies on our website.",
          body: `<h2>What Are Cookies?</h2>
<p>Cookies are small text files that websites store on your browser when you visit them. They are widely used to make websites work more efficiently and to provide information to site owners.</p>

<h2>Types of Cookies We Use</h2>

<h3>Technical Cookies (Necessary)</h3>
<p>Essential for the website to function. They include session, authentication, and shopping cart cookies. They do not require consent.</p>
<ul>
  <li><strong>next-auth.session-token:</strong> user session management.</li>
  <li><strong>NEXT_LOCALE:</strong> user's preferred language.</li>
  <li><strong>currency:</strong> selected display currency.</li>
</ul>

<h3>Statistical Cookies</h3>
<p>Help us understand how visitors interact with the website by collecting anonymous information.</p>
<ul>
  <li><strong>Google Analytics (_ga, _gid):</strong> web traffic analysis and user behavior.</li>
</ul>

<h3>Marketing Cookies</h3>
<p>Used to track visitors across websites to display relevant ads.</p>
<ul>
  <li><strong>Google Tag Manager:</strong> marketing tag management.</li>
  <li><strong>Facebook Pixel:</strong> conversion tracking and remarketing.</li>
</ul>

<h2>How to Disable Cookies</h2>
<p>You can configure your browser to reject all cookies or to notify you when a cookie is sent. However, some website features may not work properly without cookies.</p>
<ul>
  <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies</li>
  <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies</li>
  <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
  <li><strong>Edge:</strong> Settings → Cookies and site permissions</li>
</ul>

<h2>Contact</h2>
<p>For any questions about our cookie policy, please contact us at <strong>leaderled@leadermadrid.es</strong>.</p>

<h2>Updates</h2>
<p>This cookie policy may be updated periodically. The date of the last update is indicated at the bottom of this page.</p>
<p><em>Last updated: March 2026</em></p>`,
        },
      },
    },
    {
      slug: "returns",
      type: CmsPageType.LEGAL,
      order: 3,
      content: {
        es: {
          title: "Devoluciones y Envíos",
          description: "Política de envíos, devoluciones y reembolsos de Leader Madrid.",
          body: `<h2>Métodos de Envío</h2>
<p>Ofrecemos las siguientes opciones de envío:</p>

<h3>Envío Estándar — 4,12 €</h3>
<p>Envío a domicilio en toda España peninsular. Plazo de entrega estimado: 2 a 5 días laborables.</p>

<h3>Envío Gratuito — Pedidos superiores a 40 €</h3>
<p>Para pedidos con un importe igual o superior a 40 €, el envío es completamente gratuito. Plazo de entrega estimado: 2 a 5 días laborables.</p>

<h3>Recogida en Tienda — Gratis</h3>
<p>Puede recoger su pedido sin coste adicional en nuestra tienda:</p>
<p><strong>C/ Matarrosa 32, C.P 28947 Fuenlabrada, Madrid</strong></p>
<p>Horario: Lunes a Viernes de 10:00 a 19:00, Domingos de 10:00 a 19:00.</p>

<h2>Plazos de Entrega</h2>
<p>Los plazos de entrega indicados son estimativos y comienzan a contar desde la confirmación del pedido. En periodos de alta demanda (Black Friday, Navidad, etc.), los plazos podrían verse incrementados.</p>

<h2>Política de Devoluciones</h2>
<p>De acuerdo con la legislación española de protección al consumidor (Real Decreto Legislativo 1/2007), tiene derecho a desistir de su compra en un plazo de <strong>14 días naturales</strong> desde la recepción del producto, sin necesidad de justificación.</p>

<h3>Condiciones para la Devolución</h3>
<ul>
  <li>El producto debe estar en su embalaje original, sin usar y en perfecto estado.</li>
  <li>Debe incluir todos los accesorios, manuales y documentación original.</li>
  <li>Los productos personalizados o hechos a medida no admiten devolución.</li>
  <li>Los productos con precinto de seguridad deben mantenerlo intacto.</li>
</ul>

<h3>Proceso de Devolución</h3>
<ol>
  <li>Contacte con nosotros en <strong>leaderled@leadermadrid.es</strong> o al <strong>+34 916 156 311</strong> indicando su número de pedido.</li>
  <li>Le proporcionaremos un número de autorización de devolución (RMA).</li>
  <li>Envíe el producto a nuestra dirección: C/ Matarrosa 32, 28947 Fuenlabrada, Madrid.</li>
  <li>Una vez recibido y verificado el estado del producto, procederemos al reembolso.</li>
</ol>

<h3>Reembolsos</h3>
<p>El reembolso se realizará por el mismo método de pago utilizado en la compra, en un plazo máximo de <strong>14 días</strong> desde la recepción del producto devuelto.</p>
<p>Los gastos de envío de la devolución corren por cuenta del cliente, salvo que el producto sea defectuoso o no corresponda con lo pedido.</p>

<h2>Productos Defectuosos</h2>
<p>Si recibe un producto defectuoso o dañado durante el transporte, contacte con nosotros en un plazo de 48 horas. Gestionaremos la recogida y sustitución o reembolso sin coste alguno para usted.</p>

<h2>Garantía</h2>
<p>Todos nuestros productos tienen una garantía legal de <strong>3 años</strong> conforme a la normativa europea vigente. Para hacer uso de la garantía, conserve el justificante de compra.</p>

<h2>Contacto</h2>
<p>Para cualquier consulta sobre envíos o devoluciones:</p>
<ul>
  <li><strong>Email:</strong> leaderled@leadermadrid.es</li>
  <li><strong>Teléfono:</strong> +34 916 156 311</li>
  <li><strong>WhatsApp:</strong> +34 646 472 650</li>
</ul>`,
        },
        en: {
          title: "Returns & Shipping",
          description: "Leader Madrid shipping, returns, and refund policy.",
          body: `<h2>Shipping Methods</h2>
<p>We offer the following shipping options:</p>

<h3>Standard Shipping — €4.12</h3>
<p>Home delivery throughout mainland Spain. Estimated delivery time: 2 to 5 business days.</p>

<h3>Free Shipping — Orders over €40</h3>
<p>For orders of €40 or more, shipping is completely free. Estimated delivery time: 2 to 5 business days.</p>

<h3>Store Pickup — Free</h3>
<p>You can pick up your order at no extra cost at our store:</p>
<p><strong>C/ Matarrosa 32, 28947 Fuenlabrada, Madrid</strong></p>
<p>Hours: Monday to Friday 10:00 AM - 7:00 PM, Sundays 10:00 AM - 7:00 PM.</p>

<h2>Delivery Times</h2>
<p>Delivery times shown are estimates and start from order confirmation. During high-demand periods (Black Friday, Christmas, etc.), delivery times may be extended.</p>

<h2>Return Policy</h2>
<p>In accordance with Spanish consumer protection law (Royal Legislative Decree 1/2007), you have the right to withdraw from your purchase within <strong>14 calendar days</strong> from receiving the product, without any justification required.</p>

<h3>Return Conditions</h3>
<ul>
  <li>The product must be in its original packaging, unused, and in perfect condition.</li>
  <li>All accessories, manuals, and original documentation must be included.</li>
  <li>Customized or made-to-order products cannot be returned.</li>
  <li>Products with security seals must have them intact.</li>
</ul>

<h3>Return Process</h3>
<ol>
  <li>Contact us at <strong>leaderled@leadermadrid.es</strong> or <strong>+34 916 156 311</strong> with your order number.</li>
  <li>We will provide you with a return authorization number (RMA).</li>
  <li>Ship the product to our address: C/ Matarrosa 32, 28947 Fuenlabrada, Madrid.</li>
  <li>Once received and verified, we will process your refund.</li>
</ol>

<h3>Refunds</h3>
<p>Refunds will be made using the same payment method used for the purchase, within a maximum of <strong>14 days</strong> from receiving the returned product.</p>
<p>Return shipping costs are the customer's responsibility, unless the product is defective or does not match the order.</p>

<h2>Defective Products</h2>
<p>If you receive a defective or damaged product during shipping, contact us within 48 hours. We will arrange pickup and replacement or refund at no cost to you.</p>

<h2>Warranty</h2>
<p>All our products have a legal warranty of <strong>3 years</strong> in accordance with current European regulations. To use the warranty, keep your proof of purchase.</p>

<h2>Contact</h2>
<p>For any questions about shipping or returns:</p>
<ul>
  <li><strong>Email:</strong> leaderled@leadermadrid.es</li>
  <li><strong>Phone:</strong> +34 916 156 311</li>
  <li><strong>WhatsApp:</strong> +34 646 472 650</li>
</ul>`,
        },
      },
    },
  ];

  for (const page of pages) {
    const existing = await prisma.cmsPage.findUnique({
      where: { slug: page.slug },
    });
    if (existing) {
      logSkip("CmsPage", `${page.slug} (${(page.content as any).es.title})`);
      continue;
    }
    await prisma.cmsPage.create({
      data: {
        slug: page.slug,
        type: page.type,
        order: page.order,
        content: page.content,
        isActive: true,
      },
    });
    log("CmsPage", `${page.slug} — ${(page.content as any).es.title}`);
  }
}

// ─── 5. Banner — 首页横幅 ───────────────────────────────────────────────────

async function seedBanners() {
  console.log("\n🖼️  5. Banner — 首页横幅");

  const banners = [
    {
      title: "Main Hero — LED Profesional",
      imageUrl: "/images/banners/hero-led.jpg",
      order: 0,
      isActive: true,
      content: {
        badge: { es: "Novedades 2026", en: "New 2026" },
        heading: { es: "Iluminación LED Profesional", en: "Professional LED Lighting" },
        highlightColor: "text-yellow-400",
        description: {
          es: "Distribuidor mayorista en Madrid. Calidad profesional a precios competitivos.",
          en: "Wholesale distributor in Madrid. Professional quality at competitive prices.",
        },
        buttons: [
          {
            text: { es: "Ver Catálogo", en: "View Catalog" },
            link: "/search",
            variant: "primary" as const,
          },
          {
            text: { es: "Contactar", en: "Contact Us" },
            link: "/contact",
            variant: "outline" as const,
          },
        ],
        stats: [
          {
            label: { es: "Garantía", en: "Warranty" },
            value: { es: "3 años", en: "3 years" },
            icon: "ShieldCheck",
          },
          {
            label: { es: "Envío gratis", en: "Free shipping" },
            value: { es: ">40€", en: ">€40" },
            icon: "Truck",
          },
          {
            label: { es: "Atención", en: "Support" },
            value: { es: "WhatsApp", en: "WhatsApp" },
            icon: "MessageCircle",
          },
        ],
        alignment: "left" as const,
      },
    },
    {
      title: "B2B Program Banner",
      imageUrl: "/images/banners/hero-b2b.jpg",
      order: 1,
      isActive: true,
      content: {
        badge: { es: "Profesionales", en: "Professionals" },
        heading: { es: "Programa B2B", en: "B2B Program" },
        highlightColor: "text-yellow-400",
        description: {
          es: "Precios especiales para profesionales e instaladores. Solicite su cuenta de distribuidor.",
          en: "Special prices for professionals and installers. Request your distributor account.",
        },
        buttons: [
          {
            text: { es: "Solicitar Cuenta", en: "Apply Now" },
            link: "/apply-b2b",
            variant: "primary" as const,
          },
        ],
        stats: [],
        alignment: "left" as const,
      },
    },
  ];

  for (const banner of banners) {
    const existing = await prisma.banner.findFirst({
      where: { title: banner.title },
    });
    if (existing) {
      logSkip("Banner", banner.title);
      continue;
    }
    await prisma.banner.create({
      data: {
        title: banner.title,
        imageUrl: banner.imageUrl,
        order: banner.order,
        isActive: banner.isActive,
        content: banner.content,
      },
    });
    log("Banner", banner.title);
  }
}

// ─── 6. ExchangeRate — EUR 基准汇率 ─────────────────────────────────────────

async function seedExchangeRate() {
  console.log("\n💱 6. ExchangeRate — EUR 基准汇率");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.exchangeRate.findFirst({
    where: { currency: "EUR" },
  });

  if (existing) {
    logSkip("ExchangeRate", "EUR = 1.0");
  } else {
    await prisma.exchangeRate.create({
      data: {
        currency: "EUR",
        rate: 1.0,
        source: "MANUAL",
        date: today,
        isManualOverride: true,
      },
    });
    log("ExchangeRate", "EUR = 1.0 (base currency)");
  }
}

// ─── 主函数 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Leader Madrid — 站点初始化数据脚本          ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    await seedGlobalConfig();
    await seedShippingMethods();
    await seedVAT();
    await seedCmsPages();
    await seedBanners();
    await seedExchangeRate();

    console.log("\n✅ 所有初始化数据已成功写入！");
    console.log("\n📋 后续步骤:");
    console.log("   1. 将横幅图片放入 public/images/banners/ 目录");
    console.log("   2. 将 logo.svg 放入 public/ 目录");
    console.log("   3. 在 .env 中设置 NEXT_PUBLIC_WHATSAPP=34646472650");
    console.log("   4. 启动开发服务器验证数据");
  } catch (error) {
    console.error("\n❌ 初始化失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
