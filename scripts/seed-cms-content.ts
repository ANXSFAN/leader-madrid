/**
 * Seed script: CMS legal pages + solution pages + mega menu config
 * Run: npx tsx scripts/seed-cms-content.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Legal Pages ───────────────────────────────────────────────

const legalPages = [
  {
    slug: "terms",
    type: "LEGAL" as const,
    order: 1,
    content: {
      en: {
        title: "Terms of Service",
        description: "Terms and conditions for using our services",
        body: `
<div style="background:#fffbe6;border:1px solid #ffe066;border-radius:8px;padding:16px;margin-bottom:24px;">
<strong>Disclaimer:</strong> This website is currently in demonstration mode. The content, products, and services shown are for preview purposes only and do not constitute a binding commercial offer. These Terms of Service will be updated with final legal content before official launch.
</div>

<h2>1. Acceptance of Terms</h2>
<p>By accessing and using ZELURA's website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>

<h2>2. Account Registration</h2>
<p>To access certain features, you may need to register for an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.</p>
<ul>
<li>You must provide accurate and complete information during registration.</li>
<li>You must be at least 18 years old or have legal authority to enter into contracts.</li>
<li>Business accounts must be registered by authorized representatives.</li>
</ul>

<h2>3. Products and Pricing</h2>
<p>All product descriptions, specifications, and prices are subject to change without prior notice. We make every effort to ensure accuracy but do not warrant that descriptions or pricing are error-free.</p>
<ul>
<li>Prices are displayed excluding VAT unless otherwise stated.</li>
<li>B2B pricing is available only to verified business customers.</li>
<li>Bulk pricing and volume discounts are applied automatically at checkout.</li>
</ul>

<h2>4. Orders and Payment</h2>
<p>Submitting an order constitutes an offer to purchase. We reserve the right to accept or decline any order. Payment must be received in full before dispatch.</p>

<h2>5. Intellectual Property</h2>
<p>All content on this website, including text, images, logos, and product designs, is the intellectual property of ZELURA or its licensors. Unauthorized reproduction is prohibited.</p>

<h2>6. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, ZELURA shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services.</p>

<h2>7. Governing Law</h2>
<p>These terms are governed by the laws of the European Union and the applicable national laws of the customer's jurisdiction.</p>

<h2>8. Contact</h2>
<p>For questions regarding these Terms of Service, please contact us at <strong>legal@zelura.com</strong>.</p>
`,
      },
      zh: {
        title: "服务条款",
        description: "使用我们服务的条款和条件",
        body: `
<h2>1. 条款接受</h2>
<p>访问和使用 ZELURA 网站及服务即表示您同意受本服务条款的约束。如果您不同意这些条款，请勿使用我们的服务。</p>

<h2>2. 账户注册</h2>
<p>要访问某些功能，您可能需要注册账户。您有责任维护登录凭据的保密性，并对账户下的所有活动负责。</p>
<ul>
<li>注册时必须提供准确、完整的信息。</li>
<li>您必须年满18周岁或具有签订合同的法律资格。</li>
<li>企业账户必须由授权代表注册。</li>
</ul>

<h2>3. 产品与定价</h2>
<p>所有产品描述、规格和价格如有变更，恕不另行通知。我们尽一切努力确保准确性，但不保证描述或定价没有错误。</p>
<ul>
<li>除非另有说明，显示价格不含增值税。</li>
<li>B2B 定价仅对经过验证的企业客户开放。</li>
<li>批量定价和数量折扣将在结账时自动应用。</li>
</ul>

<h2>4. 订单与付款</h2>
<p>提交订单即构成购买要约。我们保留接受或拒绝任何订单的权利。在发货前必须全额付款。</p>

<h2>5. 知识产权</h2>
<p>本网站上的所有内容，包括文字、图片、标识和产品设计，均为 ZELURA 或其许可方的知识产权。未经授权禁止转载。</p>

<h2>6. 责任限制</h2>
<p>在法律允许的最大范围内，ZELURA 不对因使用我们的产品或服务而产生的任何间接、附带或后果性损害承担责任。</p>

<h2>7. 适用法律</h2>
<p>本条款受欧盟法律及客户所在司法管辖区适用的国家法律管辖。</p>

<h2>8. 联系方式</h2>
<p>如对本服务条款有任何疑问，请联系 <strong>legal@zelura.com</strong>。</p>
`,
      },
      es: {
        title: "Términos de Servicio",
        description: "Términos y condiciones para el uso de nuestros servicios",
        body: `
<h2>1. Aceptación de los Términos</h2>
<p>Al acceder y utilizar el sitio web y los servicios de ZELURA, usted acepta quedar vinculado por estos Términos de Servicio. Si no está de acuerdo con estos términos, por favor no utilice nuestros servicios.</p>

<h2>2. Registro de Cuenta</h2>
<p>Para acceder a ciertas funciones, es posible que necesite registrar una cuenta. Usted es responsable de mantener la confidencialidad de sus credenciales de inicio de sesión y de todas las actividades realizadas bajo su cuenta.</p>
<ul>
<li>Debe proporcionar información precisa y completa durante el registro.</li>
<li>Debe tener al menos 18 años o tener autoridad legal para celebrar contratos.</li>
<li>Las cuentas empresariales deben ser registradas por representantes autorizados.</li>
</ul>

<h2>3. Productos y Precios</h2>
<p>Todas las descripciones, especificaciones y precios de productos están sujetos a cambios sin previo aviso. Hacemos todo lo posible para garantizar la precisión, pero no garantizamos que las descripciones o precios estén libres de errores.</p>
<ul>
<li>Los precios se muestran sin IVA a menos que se indique lo contrario.</li>
<li>Los precios B2B solo están disponibles para clientes empresariales verificados.</li>
<li>Los descuentos por volumen se aplican automáticamente en el proceso de pago.</li>
</ul>

<h2>4. Pedidos y Pagos</h2>
<p>Enviar un pedido constituye una oferta de compra. Nos reservamos el derecho de aceptar o rechazar cualquier pedido. El pago debe recibirse en su totalidad antes del envío.</p>

<h2>5. Propiedad Intelectual</h2>
<p>Todo el contenido de este sitio web, incluyendo textos, imágenes, logotipos y diseños de productos, es propiedad intelectual de ZELURA o sus licenciantes. Queda prohibida la reproducción no autorizada.</p>

<h2>6. Limitación de Responsabilidad</h2>
<p>En la máxima medida permitida por la ley, ZELURA no será responsable de ningún daño indirecto, incidental o consecuente derivado del uso de nuestros productos o servicios.</p>

<h2>7. Ley Aplicable</h2>
<p>Estos términos se rigen por las leyes de la Unión Europea y las leyes nacionales aplicables de la jurisdicción del cliente.</p>

<h2>8. Contacto</h2>
<p>Para preguntas sobre estos Términos de Servicio, contáctenos en <strong>legal@zelura.com</strong>.</p>
`,
      },
    },
  },
  {
    slug: "privacy",
    type: "LEGAL" as const,
    order: 2,
    content: {
      en: {
        title: "Privacy Policy",
        description: "How we collect, use, and protect your personal data",
        body: `
<div style="background:#fffbe6;border:1px solid #ffe066;border-radius:8px;padding:16px;margin-bottom:24px;">
<strong>Disclaimer:</strong> This website is currently in demonstration mode. The content, products, and services shown are for preview purposes only and do not constitute a binding commercial offer. This Privacy Policy will be updated with final legal content before official launch.
</div>

<h2>1. Introduction</h2>
<p>ZELURA is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal data when you visit our website or use our services.</p>

<h2>2. Data We Collect</h2>
<h3>Personal Information</h3>
<ul>
<li><strong>Account data:</strong> Name, email address, phone number, company name, VAT number</li>
<li><strong>Order data:</strong> Billing and shipping addresses, payment information, order history</li>
<li><strong>Communication data:</strong> Emails, support tickets, contact form submissions</li>
</ul>
<h3>Automatically Collected Data</h3>
<ul>
<li>IP address, browser type, device information</li>
<li>Pages visited, time spent, referring URLs</li>
<li>Cookies and similar tracking technologies</li>
</ul>

<h2>3. How We Use Your Data</h2>
<ul>
<li>Processing and fulfilling your orders</li>
<li>Managing your account and providing customer support</li>
<li>Sending order confirmations, shipping updates, and invoices</li>
<li>Improving our website and services</li>
<li>Marketing communications (with your consent)</li>
</ul>

<h2>4. Data Sharing</h2>
<p>We do not sell your personal data. We may share data with:</p>
<ul>
<li><strong>Logistics partners:</strong> For order fulfillment and delivery</li>
<li><strong>Payment processors:</strong> For secure payment handling</li>
<li><strong>Legal authorities:</strong> When required by law</li>
</ul>

<h2>5. Data Retention</h2>
<p>We retain personal data only as long as necessary for the purposes described in this policy or as required by law. You may request deletion of your data at any time.</p>

<h2>6. Your Rights (GDPR)</h2>
<p>Under the General Data Protection Regulation, you have the right to:</p>
<ul>
<li>Access your personal data</li>
<li>Rectify inaccurate data</li>
<li>Request erasure of your data</li>
<li>Object to data processing</li>
<li>Data portability</li>
</ul>

<h2>7. Cookies</h2>
<p>We use cookies for essential website functionality, analytics, and preference storage. You can manage cookie preferences through your browser settings.</p>

<h2>8. Contact</h2>
<p>For privacy-related inquiries, contact our Data Protection Officer at <strong>privacy@zelura.com</strong>.</p>
`,
      },
      zh: {
        title: "隐私政策",
        description: "我们如何收集、使用和保护您的个人数据",
        body: `
<h2>1. 引言</h2>
<p>ZELURA 致力于保护您的隐私。本隐私政策说明了当您访问我们的网站或使用我们的服务时，我们如何收集、使用、披露和保护您的个人数据。</p>

<h2>2. 我们收集的数据</h2>
<h3>个人信息</h3>
<ul>
<li><strong>账户数据：</strong>姓名、电子邮件地址、电话号码、公司名称、税号</li>
<li><strong>订单数据：</strong>账单和收货地址、支付信息、订单历史</li>
<li><strong>通讯数据：</strong>电子邮件、客服工单、联系表单提交</li>
</ul>
<h3>自动收集的数据</h3>
<ul>
<li>IP 地址、浏览器类型、设备信息</li>
<li>访问页面、停留时间、来源 URL</li>
<li>Cookie 和类似追踪技术</li>
</ul>

<h2>3. 数据用途</h2>
<ul>
<li>处理和履行您的订单</li>
<li>管理您的账户并提供客户支持</li>
<li>发送订单确认、物流更新和发票</li>
<li>改善我们的网站和服务</li>
<li>营销通讯（经您同意）</li>
</ul>

<h2>4. 数据共享</h2>
<p>我们不出售您的个人数据。我们可能会与以下方共享数据：</p>
<ul>
<li><strong>物流合作伙伴：</strong>用于订单履行和配送</li>
<li><strong>支付处理商：</strong>用于安全支付处理</li>
<li><strong>法律机构：</strong>法律要求时</li>
</ul>

<h2>5. 数据保留</h2>
<p>我们仅在本政策所述目的或法律要求的期限内保留个人数据。您可随时请求删除您的数据。</p>

<h2>6. 您的权利（GDPR）</h2>
<p>根据《通用数据保护条例》，您有权：</p>
<ul>
<li>访问您的个人数据</li>
<li>更正不准确的数据</li>
<li>请求删除您的数据</li>
<li>反对数据处理</li>
<li>数据可移植性</li>
</ul>

<h2>7. Cookie</h2>
<p>我们使用 Cookie 来实现网站基本功能、数据分析和偏好存储。您可以通过浏览器设置管理 Cookie 偏好。</p>

<h2>8. 联系方式</h2>
<p>如有隐私相关问题，请联系我们的数据保护官：<strong>privacy@zelura.com</strong>。</p>
`,
      },
      es: {
        title: "Política de Privacidad",
        description: "Cómo recopilamos, usamos y protegemos sus datos personales",
        body: `
<h2>1. Introducción</h2>
<p>ZELURA se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos sus datos personales cuando visita nuestro sitio web o utiliza nuestros servicios.</p>

<h2>2. Datos que Recopilamos</h2>
<h3>Información Personal</h3>
<ul>
<li><strong>Datos de cuenta:</strong> Nombre, dirección de email, teléfono, nombre de empresa, número de IVA</li>
<li><strong>Datos de pedido:</strong> Direcciones de facturación y envío, información de pago, historial de pedidos</li>
<li><strong>Datos de comunicación:</strong> Emails, tickets de soporte, formularios de contacto</li>
</ul>
<h3>Datos Recopilados Automáticamente</h3>
<ul>
<li>Dirección IP, tipo de navegador, información del dispositivo</li>
<li>Páginas visitadas, tiempo de permanencia, URLs de referencia</li>
<li>Cookies y tecnologías de seguimiento similares</li>
</ul>

<h2>3. Cómo Usamos sus Datos</h2>
<ul>
<li>Procesar y cumplir sus pedidos</li>
<li>Gestionar su cuenta y proporcionar soporte al cliente</li>
<li>Enviar confirmaciones de pedido, actualizaciones de envío y facturas</li>
<li>Mejorar nuestro sitio web y servicios</li>
<li>Comunicaciones de marketing (con su consentimiento)</li>
</ul>

<h2>4. Compartición de Datos</h2>
<p>No vendemos sus datos personales. Podemos compartir datos con:</p>
<ul>
<li><strong>Socios logísticos:</strong> Para cumplimiento y entrega de pedidos</li>
<li><strong>Procesadores de pago:</strong> Para manejo seguro de pagos</li>
<li><strong>Autoridades legales:</strong> Cuando lo requiera la ley</li>
</ul>

<h2>5. Retención de Datos</h2>
<p>Conservamos los datos personales solo durante el tiempo necesario para los fines descritos en esta política o según lo exija la ley. Puede solicitar la eliminación de sus datos en cualquier momento.</p>

<h2>6. Sus Derechos (RGPD)</h2>
<p>Bajo el Reglamento General de Protección de Datos, usted tiene derecho a:</p>
<ul>
<li>Acceder a sus datos personales</li>
<li>Rectificar datos inexactos</li>
<li>Solicitar la eliminación de sus datos</li>
<li>Oponerse al procesamiento de datos</li>
<li>Portabilidad de datos</li>
</ul>

<h2>7. Cookies</h2>
<p>Utilizamos cookies para la funcionalidad esencial del sitio web, análisis y almacenamiento de preferencias. Puede gestionar las preferencias de cookies a través de la configuración de su navegador.</p>

<h2>8. Contacto</h2>
<p>Para consultas relacionadas con la privacidad, contacte a nuestro Delegado de Protección de Datos en <strong>privacy@zelura.com</strong>.</p>
`,
      },
    },
  },
  {
    slug: "returns",
    type: "LEGAL" as const,
    order: 3,
    content: {
      en: {
        title: "Returns & Refunds",
        description: "Our return and refund policy for all orders",
        body: `
<h2>1. Return Policy Overview</h2>
<p>We want you to be completely satisfied with your purchase. If you are not satisfied, you may return most items within <strong>30 days</strong> of delivery for a full refund or exchange.</p>

<h2>2. Eligibility</h2>
<ul>
<li>Items must be in original, unused condition with all packaging intact.</li>
<li>Custom or made-to-order products cannot be returned unless defective.</li>
<li>Bulk orders (over 100 units) are subject to a 15% restocking fee.</li>
<li>Clearance or final-sale items are non-returnable.</li>
</ul>

<h2>3. How to Initiate a Return</h2>
<ol>
<li>Log into your account and navigate to <strong>My Orders</strong>.</li>
<li>Select the order and click <strong>Request Return</strong>.</li>
<li>Choose the items and reason for return.</li>
<li>You will receive a Return Merchandise Authorization (RMA) number and shipping label via email.</li>
</ol>

<h2>4. Return Shipping</h2>
<ul>
<li><strong>Defective products:</strong> We cover all return shipping costs.</li>
<li><strong>Change of mind:</strong> Return shipping is at the customer's expense.</li>
<li>We recommend using a trackable shipping service for all returns.</li>
</ul>

<h2>5. Refund Processing</h2>
<p>Once we receive and inspect the returned items:</p>
<ul>
<li>Refunds are processed within <strong>5-10 business days</strong>.</li>
<li>The refund will be issued to the original payment method.</li>
<li>You will receive an email confirmation when the refund is processed.</li>
</ul>

<h2>6. Damaged or Defective Items</h2>
<p>If you receive a damaged or defective product, please contact us within <strong>48 hours</strong> of delivery with photos of the damage. We will arrange a free replacement or full refund.</p>

<h2>7. Contact</h2>
<p>For return-related questions, email <strong>returns@zelura.com</strong> or call our support team.</p>
`,
      },
      zh: {
        title: "退换货政策",
        description: "所有订单的退换货和退款政策",
        body: `
<h2>1. 退货政策概述</h2>
<p>我们希望您对购买完全满意。如果您不满意，大多数商品可在收货后 <strong>30天内</strong> 退货，获得全额退款或换货。</p>

<h2>2. 退货条件</h2>
<ul>
<li>商品必须处于原始、未使用状态，包装完好。</li>
<li>定制或按单生产的产品不可退货，除非存在缺陷。</li>
<li>大宗订单（超过100件）需收取15%的重新入库费。</li>
<li>清仓或最终特价商品不可退货。</li>
</ul>

<h2>3. 如何发起退货</h2>
<ol>
<li>登录您的账户，进入 <strong>我的订单</strong>。</li>
<li>选择订单并点击 <strong>申请退货</strong>。</li>
<li>选择退货商品和退货原因。</li>
<li>您将通过电子邮件收到退货授权（RMA）编号和退货运单。</li>
</ol>

<h2>4. 退货运费</h2>
<ul>
<li><strong>产品缺陷：</strong>我们承担所有退货运费。</li>
<li><strong>非质量问题：</strong>退货运费由客户承担。</li>
<li>建议使用可追踪的物流服务进行退货。</li>
</ul>

<h2>5. 退款处理</h2>
<p>收到并检查退货商品后：</p>
<ul>
<li>退款将在 <strong>5-10个工作日</strong> 内处理。</li>
<li>退款将退至原始支付方式。</li>
<li>退款处理完成后您将收到电子邮件确认。</li>
</ul>

<h2>6. 损坏或缺陷商品</h2>
<p>如果您收到损坏或有缺陷的产品，请在收货后 <strong>48小时内</strong> 联系我们并附上损坏照片。我们将安排免费更换或全额退款。</p>

<h2>7. 联系方式</h2>
<p>退换货相关问题请发送邮件至 <strong>returns@zelura.com</strong> 或致电客服团队。</p>
`,
      },
      es: {
        title: "Devoluciones y Reembolsos",
        description: "Nuestra política de devoluciones y reembolsos para todos los pedidos",
        body: `
<h2>1. Resumen de la Política de Devoluciones</h2>
<p>Queremos que esté completamente satisfecho con su compra. Si no lo está, puede devolver la mayoría de los artículos dentro de los <strong>30 días</strong> posteriores a la entrega para obtener un reembolso completo o un cambio.</p>

<h2>2. Elegibilidad</h2>
<ul>
<li>Los artículos deben estar en condición original, sin usar y con todo el embalaje intacto.</li>
<li>Los productos personalizados o fabricados bajo pedido no se pueden devolver a menos que sean defectuosos.</li>
<li>Los pedidos a granel (más de 100 unidades) están sujetos a una tarifa de reposición del 15%.</li>
<li>Los artículos en liquidación o venta final no son retornables.</li>
</ul>

<h2>3. Cómo Iniciar una Devolución</h2>
<ol>
<li>Inicie sesión en su cuenta y vaya a <strong>Mis Pedidos</strong>.</li>
<li>Seleccione el pedido y haga clic en <strong>Solicitar Devolución</strong>.</li>
<li>Elija los artículos y el motivo de la devolución.</li>
<li>Recibirá un número de Autorización de Devolución (RMA) y una etiqueta de envío por email.</li>
</ol>

<h2>4. Envío de Devolución</h2>
<ul>
<li><strong>Productos defectuosos:</strong> Cubrimos todos los costos de envío de devolución.</li>
<li><strong>Cambio de opinión:</strong> El envío de devolución corre por cuenta del cliente.</li>
<li>Recomendamos usar un servicio de envío con seguimiento para todas las devoluciones.</li>
</ul>

<h2>5. Procesamiento de Reembolsos</h2>
<p>Una vez que recibamos e inspeccionemos los artículos devueltos:</p>
<ul>
<li>Los reembolsos se procesan en <strong>5-10 días hábiles</strong>.</li>
<li>El reembolso se emitirá al método de pago original.</li>
<li>Recibirá una confirmación por email cuando se procese el reembolso.</li>
</ul>

<h2>6. Artículos Dañados o Defectuosos</h2>
<p>Si recibe un producto dañado o defectuoso, contáctenos dentro de las <strong>48 horas</strong> posteriores a la entrega con fotos del daño. Organizaremos un reemplazo gratuito o un reembolso completo.</p>

<h2>7. Contacto</h2>
<p>Para consultas sobre devoluciones, envíe un email a <strong>returns@zelura.com</strong> o llame a nuestro equipo de soporte.</p>
`,
      },
    },
  },
  {
    slug: "shipping",
    type: "LEGAL" as const,
    order: 4,
    content: {
      en: {
        title: "Shipping Information",
        description: "Delivery options, timeframes, and shipping policies",
        body: `
<h2>1. Shipping Zones & Delivery Times</h2>
<table>
<thead><tr><th>Zone</th><th>Standard</th><th>Express</th></tr></thead>
<tbody>
<tr><td>EU (Western Europe)</td><td>3-5 business days</td><td>1-2 business days</td></tr>
<tr><td>EU (Eastern Europe)</td><td>5-7 business days</td><td>2-3 business days</td></tr>
<tr><td>United Kingdom</td><td>5-7 business days</td><td>2-3 business days</td></tr>
<tr><td>Rest of World</td><td>10-15 business days</td><td>5-7 business days</td></tr>
</tbody>
</table>

<h2>2. Free Shipping</h2>
<p>We offer <strong>free standard shipping</strong> on all orders over <strong>€500</strong> within the European Union. Orders under €500 are subject to a flat-rate shipping fee based on destination.</p>

<h2>3. Order Processing</h2>
<ul>
<li>Orders placed before <strong>2:00 PM CET</strong> on business days are processed the same day.</li>
<li>Orders placed after this time or on weekends/holidays are processed the next business day.</li>
<li>You will receive a tracking number via email once your order has shipped.</li>
</ul>

<h2>4. Large & Heavy Items</h2>
<p>For industrial lighting fixtures and bulk orders, delivery may be arranged via freight service. Our logistics team will contact you to coordinate delivery for orders exceeding 200 kg or requiring pallet delivery.</p>

<h2>5. International Shipping</h2>
<p>For shipments outside the EU, please note:</p>
<ul>
<li>Customs duties and import taxes are the responsibility of the buyer.</li>
<li>Delivery times may vary due to customs processing.</li>
<li>We provide all necessary export documentation.</li>
</ul>

<h2>6. Order Tracking</h2>
<p>Track your order anytime through your account dashboard or using the tracking link sent via email. For any delivery issues, please contact our support team.</p>

<h2>7. Contact</h2>
<p>For shipping inquiries, email <strong>logistics@zelura.com</strong>.</p>
`,
      },
      zh: {
        title: "物流配送",
        description: "配送选项、时效和物流政策",
        body: `
<h2>1. 配送区域与时效</h2>
<table>
<thead><tr><th>区域</th><th>标准配送</th><th>加急配送</th></tr></thead>
<tbody>
<tr><td>欧盟（西欧）</td><td>3-5个工作日</td><td>1-2个工作日</td></tr>
<tr><td>欧盟（东欧）</td><td>5-7个工作日</td><td>2-3个工作日</td></tr>
<tr><td>英国</td><td>5-7个工作日</td><td>2-3个工作日</td></tr>
<tr><td>其他地区</td><td>10-15个工作日</td><td>5-7个工作日</td></tr>
</tbody>
</table>

<h2>2. 免运费</h2>
<p>欧盟境内所有超过 <strong>€500</strong> 的订单均享受 <strong>免费标准配送</strong>。低于 €500 的订单根据目的地收取统一运费。</p>

<h2>3. 订单处理</h2>
<ul>
<li>工作日 <strong>中欧时间下午2:00前</strong> 下的订单当天处理。</li>
<li>此时间之后或周末/节假日的订单将在下一个工作日处理。</li>
<li>订单发货后您将通过电子邮件收到物流追踪号。</li>
</ul>

<h2>4. 大件及重型商品</h2>
<p>工业照明灯具和大宗订单可能通过货运服务安排配送。超过200公斤或需要托盘配送的订单，我们的物流团队将与您联系协调配送。</p>

<h2>5. 国际配送</h2>
<p>欧盟以外的配送请注意：</p>
<ul>
<li>关税和进口税由买方承担。</li>
<li>因海关处理，配送时间可能有所不同。</li>
<li>我们提供所有必要的出口文件。</li>
</ul>

<h2>6. 物流追踪</h2>
<p>您可以随时通过账户面板或电子邮件中的追踪链接查看订单状态。如有配送问题，请联系我们的客服团队。</p>

<h2>7. 联系方式</h2>
<p>物流相关问题请发送邮件至 <strong>logistics@zelura.com</strong>。</p>
`,
      },
      es: {
        title: "Información de Envío",
        description: "Opciones de entrega, plazos y políticas de envío",
        body: `
<h2>1. Zonas de Envío y Tiempos de Entrega</h2>
<table>
<thead><tr><th>Zona</th><th>Estándar</th><th>Express</th></tr></thead>
<tbody>
<tr><td>UE (Europa Occidental)</td><td>3-5 días hábiles</td><td>1-2 días hábiles</td></tr>
<tr><td>UE (Europa Oriental)</td><td>5-7 días hábiles</td><td>2-3 días hábiles</td></tr>
<tr><td>Reino Unido</td><td>5-7 días hábiles</td><td>2-3 días hábiles</td></tr>
<tr><td>Resto del Mundo</td><td>10-15 días hábiles</td><td>5-7 días hábiles</td></tr>
</tbody>
</table>

<h2>2. Envío Gratuito</h2>
<p>Ofrecemos <strong>envío estándar gratuito</strong> en todos los pedidos superiores a <strong>€500</strong> dentro de la Unión Europea. Los pedidos inferiores a €500 están sujetos a una tarifa de envío fija según el destino.</p>

<h2>3. Procesamiento de Pedidos</h2>
<ul>
<li>Los pedidos realizados antes de las <strong>14:00 CET</strong> en días hábiles se procesan el mismo día.</li>
<li>Los pedidos realizados después de esta hora o en fines de semana/festivos se procesan el siguiente día hábil.</li>
<li>Recibirá un número de seguimiento por email una vez que su pedido haya sido enviado.</li>
</ul>

<h2>4. Artículos Grandes y Pesados</h2>
<p>Para luminarias industriales y pedidos a granel, la entrega puede organizarse mediante servicio de carga. Nuestro equipo de logística se pondrá en contacto con usted para coordinar la entrega de pedidos que superen los 200 kg o que requieran entrega en palé.</p>

<h2>5. Envío Internacional</h2>
<p>Para envíos fuera de la UE, tenga en cuenta:</p>
<ul>
<li>Los aranceles aduaneros e impuestos de importación son responsabilidad del comprador.</li>
<li>Los tiempos de entrega pueden variar debido al procesamiento aduanero.</li>
<li>Proporcionamos toda la documentación de exportación necesaria.</li>
</ul>

<h2>6. Seguimiento de Pedidos</h2>
<p>Realice el seguimiento de su pedido en cualquier momento a través del panel de su cuenta o usando el enlace de seguimiento enviado por email. Para cualquier problema de entrega, contacte a nuestro equipo de soporte.</p>

<h2>7. Contacto</h2>
<p>Para consultas de envío, escriba a <strong>logistics@zelura.com</strong>.</p>
`,
      },
    },
  },
  {
    slug: "cookie-policy",
    type: "LEGAL" as const,
    order: 5,
    content: {
      en: {
        title: "Cookie Policy",
        description: "How we use cookies and similar technologies on our website",
        body: `
<div style="background:#fffbe6;border:1px solid #ffe066;border-radius:8px;padding:16px;margin-bottom:24px;">
<strong>Disclaimer:</strong> This website is currently in demonstration mode. The content, products, and services shown are for preview purposes only and do not constitute a binding commercial offer. This Cookie Policy will be updated with final legal content before official launch.
</div>

<h2>1. What Are Cookies</h2>
<p>Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.</p>

<h2>2. How We Use Cookies</h2>
<p>We use the following categories of cookies:</p>

<h3>2.1 Essential Cookies (Always Active)</h3>
<p>These cookies are strictly necessary for the website to function. They enable core features such as:</p>
<ul>
<li><strong>Authentication</strong> — keeping you signed in during your session (next-auth.session-token)</li>
<li><strong>Security</strong> — CSRF protection tokens (next-auth.csrf-token)</li>
<li><strong>Cookie Consent</strong> — remembering your cookie preferences (cookie_consent)</li>
<li><strong>Locale</strong> — serving the site in your preferred language (NEXT_LOCALE)</li>
</ul>
<p>These cookies cannot be disabled as they are essential to providing the service.</p>

<h3>2.2 Functional Cookies</h3>
<p>These cookies enhance your experience by remembering choices you make:</p>
<ul>
<li><strong>Currency Preference</strong> — your selected display currency (preferred_currency)</li>
<li><strong>Search History</strong> — your recent search queries (stored in localStorage)</li>
<li><strong>Shopping Cart</strong> — items in your shopping cart (stored in localStorage)</li>
<li><strong>Product Comparison</strong> — products you are comparing (stored in localStorage)</li>
</ul>

<h3>2.3 Analytics Cookies</h3>
<p>If enabled, these cookies help us understand how visitors interact with our website by collecting anonymous usage statistics. We currently do not use third-party analytics cookies. If we implement analytics in the future, this policy will be updated accordingly.</p>

<h3>2.4 Marketing Cookies</h3>
<p>If enabled, these cookies may be used by advertising partners to build a profile of your interests and show relevant advertisements on other sites. We currently do not use marketing cookies. If we implement marketing cookies in the future, this policy will be updated accordingly.</p>

<h2>3. Managing Your Preferences</h2>
<p>You can manage your cookie preferences at any time by:</p>
<ul>
<li>Clicking <strong>"Cookie Settings"</strong> in the website footer</li>
<li>Adjusting your browser settings to block or delete cookies</li>
</ul>
<p>Please note that disabling certain cookies may affect the functionality of the website.</p>

<h2>4. Data Retention</h2>
<p>Cookie consent preferences are stored for <strong>12 months</strong>. Session cookies are deleted when you close your browser. Persistent cookies have specific expiration dates as described in the table above.</p>

<h2>5. Your Rights Under GDPR</h2>
<p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
<ul>
<li>Access the personal data we hold about you</li>
<li>Request correction of inaccurate data</li>
<li>Request deletion of your data ("right to be forgotten")</li>
<li>Withdraw consent at any time</li>
<li>Lodge a complaint with a supervisory authority</li>
</ul>

<h2>6. Contact Us</h2>
<p>For questions about this Cookie Policy, please contact us at <strong>privacy@zelura.com</strong>.</p>

<h2>7. Updates to This Policy</h2>
<p>We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.</p>

<p><em>Last updated: March 2026</em></p>
`,
      },
      zh: {
        title: "Cookie 政策",
        description: "我们如何在网站上使用Cookie及类似技术",
        body: `
<div style="background:#fffbe6;border:1px solid #ffe066;border-radius:8px;padding:16px;margin-bottom:24px;">
<strong>免责声明：</strong>本网站目前处于演示模式。所展示的内容、产品和服务仅供预览，不构成具有约束力的商业要约。本Cookie政策将在正式上线前更新最终法律内容。
</div>

<h2>1. 什么是Cookie</h2>
<p>Cookie是您访问我们网站时存储在您设备上的小型文本文件。它们帮助我们通过记住您的偏好和了解您如何使用网站来为您提供更好的体验。</p>

<h2>2. 我们如何使用Cookie</h2>
<p>我们使用以下类别的Cookie：</p>

<h3>2.1 必要Cookie（始终启用）</h3>
<p>这些Cookie是网站正常运行所必需的，包括：</p>
<ul>
<li><strong>身份认证</strong> — 在会话期间保持登录状态</li>
<li><strong>安全</strong> — CSRF保护令牌</li>
<li><strong>Cookie同意</strong> — 记住您的Cookie偏好设置</li>
<li><strong>语言</strong> — 以您偏好的语言提供网站服务</li>
</ul>
<p>这些Cookie无法禁用，因为它们对提供服务至关重要。</p>

<h3>2.2 功能性Cookie</h3>
<p>这些Cookie通过记住您的选择来增强体验：</p>
<ul>
<li><strong>货币偏好</strong> — 您选择的显示货币</li>
<li><strong>搜索历史</strong> — 您最近的搜索记录（存储在localStorage中）</li>
<li><strong>购物车</strong> — 购物车中的商品（存储在localStorage中）</li>
<li><strong>产品对比</strong> — 您正在对比的产品（存储在localStorage中）</li>
</ul>

<h3>2.3 分析Cookie</h3>
<p>启用后，这些Cookie帮助我们了解访问者如何与网站互动。我们目前不使用第三方分析Cookie。如未来使用，本政策将相应更新。</p>

<h3>2.4 营销Cookie</h3>
<p>启用后，这些Cookie可能被广告合作伙伴用于展示相关广告。我们目前不使用营销Cookie。如未来使用，本政策将相应更新。</p>

<h2>3. 管理您的偏好</h2>
<p>您可以随时通过以下方式管理Cookie偏好：</p>
<ul>
<li>点击网站页脚的<strong>"Cookie 设置"</strong></li>
<li>调整浏览器设置以阻止或删除Cookie</li>
</ul>

<h2>4. 数据保留</h2>
<p>Cookie同意偏好存储<strong>12个月</strong>。会话Cookie在关闭浏览器时删除。</p>

<h2>5. 您在GDPR下的权利</h2>
<p>根据《通用数据保护条例》（GDPR），您有权：</p>
<ul>
<li>访问我们持有的您的个人数据</li>
<li>要求更正不准确的数据</li>
<li>要求删除您的数据（"被遗忘权"）</li>
<li>随时撤回同意</li>
<li>向监管机构提出投诉</li>
</ul>

<h2>6. 联系我们</h2>
<p>如对本Cookie政策有疑问，请联系 <strong>privacy@zelura.com</strong>。</p>

<p><em>最后更新：2026年3月</em></p>
`,
      },
      es: {
        title: "Política de Cookies",
        description: "Cómo utilizamos cookies y tecnologías similares en nuestro sitio web",
        body: `
<div style="background:#fffbe6;border:1px solid #ffe066;border-radius:8px;padding:16px;margin-bottom:24px;">
<strong>Aviso:</strong> Este sitio web se encuentra actualmente en modo de demostración. El contenido, productos y servicios mostrados son solo para fines de vista previa y no constituyen una oferta comercial vinculante. Esta Política de Cookies se actualizará con el contenido legal final antes del lanzamiento oficial.
</div>

<h2>1. ¿Qué Son las Cookies?</h2>
<p>Las cookies son pequeños archivos de texto almacenados en su dispositivo cuando visita nuestro sitio web. Nos ayudan a ofrecerle una mejor experiencia recordando sus preferencias y comprendiendo cómo utiliza nuestro sitio.</p>

<h2>2. Cómo Utilizamos las Cookies</h2>

<h3>2.1 Cookies Esenciales (Siempre Activas)</h3>
<p>Estas cookies son estrictamente necesarias para el funcionamiento del sitio web:</p>
<ul>
<li><strong>Autenticación</strong> — mantener su sesión iniciada</li>
<li><strong>Seguridad</strong> — tokens de protección CSRF</li>
<li><strong>Consentimiento de Cookies</strong> — recordar sus preferencias de cookies</li>
<li><strong>Idioma</strong> — servir el sitio en su idioma preferido</li>
</ul>

<h3>2.2 Cookies Funcionales</h3>
<ul>
<li><strong>Preferencia de Moneda</strong> — su moneda de visualización seleccionada</li>
<li><strong>Historial de Búsqueda</strong> — sus consultas de búsqueda recientes</li>
<li><strong>Carrito de Compras</strong> — artículos en su carrito</li>
<li><strong>Comparación de Productos</strong> — productos que está comparando</li>
</ul>

<h3>2.3 Cookies Analíticas</h3>
<p>Actualmente no utilizamos cookies analíticas de terceros. Si implementamos análisis en el futuro, esta política se actualizará.</p>

<h3>2.4 Cookies de Marketing</h3>
<p>Actualmente no utilizamos cookies de marketing. Si las implementamos en el futuro, esta política se actualizará.</p>

<h2>3. Gestión de Preferencias</h2>
<p>Puede gestionar sus preferencias de cookies en cualquier momento haciendo clic en <strong>"Configuración de Cookies"</strong> en el pie de página del sitio web.</p>

<h2>4. Sus Derechos bajo el RGPD</h2>
<ul>
<li>Acceder a sus datos personales</li>
<li>Solicitar la corrección de datos inexactos</li>
<li>Solicitar la eliminación de sus datos</li>
<li>Retirar el consentimiento en cualquier momento</li>
<li>Presentar una reclamación ante una autoridad supervisora</li>
</ul>

<h2>5. Contacto</h2>
<p>Para preguntas sobre esta Política de Cookies, contáctenos en <strong>privacy@zelura.com</strong>.</p>

<p><em>Última actualización: Marzo 2026</em></p>
`,
      },
    },
  },
];

// ─── Solution Pages ────────────────────────────────────────────

const solutionPages = [
  {
    slug: "warehouse-lighting",
    menuGroup: "by_industry",
    order: 1,
    content: {
      en: {
        title: "Warehouse & Logistics Lighting",
        description: "High-bay LED solutions for warehouses, distribution centers, and logistics facilities",
        body: `
<h2>Illuminate Your Warehouse for Maximum Efficiency</h2>
<p>Modern warehouses demand lighting that delivers high lumen output, energy efficiency, and minimal maintenance. Our LED high-bay fixtures are engineered specifically for warehouse environments with ceiling heights from 6 to 20 meters.</p>

<h3>Key Benefits</h3>
<ul>
<li><strong>Energy savings up to 70%</strong> compared to traditional HID lighting</li>
<li><strong>50,000+ hour lifespan</strong> — reduce maintenance costs dramatically</li>
<li><strong>Instant-on capability</strong> — no warm-up time, ideal for motion-sensor integration</li>
<li><strong>High CRI (>80)</strong> — improve picking accuracy and reduce errors</li>
</ul>

<h3>Recommended Products</h3>
<ul>
<li><strong>UFO High Bay 100W-240W:</strong> Compact design, 140 lm/W efficiency, ideal for 6-12m heights</li>
<li><strong>Linear High Bay 150W-300W:</strong> Wide beam angle for aisle lighting, uniform illumination</li>
<li><strong>Motion Sensor Kits:</strong> Microwave sensors for automated on/off in low-traffic zones</li>
</ul>

<h3>Case Study</h3>
<p>A 25,000 m² distribution center in Rotterdam replaced 400W HPS fixtures with our 150W UFO High Bays, achieving <strong>62% energy reduction</strong> and <strong>€48,000 annual savings</strong>, with full ROI in just 14 months.</p>

<h3>Free Lighting Design</h3>
<p>Our engineering team provides complimentary DIALux lighting designs for warehouse projects. Contact us with your floor plans and we'll deliver a complete lighting specification within 48 hours.</p>
`,
      },
      zh: {
        title: "仓库与物流照明",
        description: "适用于仓库、配送中心和物流设施的大功率LED照明方案",
        body: `
<h2>打造高效仓库照明环境</h2>
<p>现代仓库需要高光通量、高能效、低维护的照明方案。我们的LED工矿灯专为6至20米层高的仓库环境设计。</p>

<h3>核心优势</h3>
<ul>
<li><strong>节能高达70%</strong>——相比传统HID照明</li>
<li><strong>50,000+小时寿命</strong>——大幅降低维护成本</li>
<li><strong>即时启动</strong>——无需预热，适合搭配感应器使用</li>
<li><strong>高显色指数（>80）</strong>——提高拣货准确率，减少错误</li>
</ul>

<h3>推荐产品</h3>
<ul>
<li><strong>UFO工矿灯 100W-240W：</strong>紧凑设计，140 lm/W 光效，适合6-12米层高</li>
<li><strong>线性工矿灯 150W-300W：</strong>宽光束角，适用于通道照明，光线均匀</li>
<li><strong>感应器套件：</strong>微波感应器，在低流量区域实现自动开关</li>
</ul>

<h3>案例分享</h3>
<p>荷兰鹿特丹一座25,000平方米的配送中心将400W高压钠灯替换为我们的150W UFO工矿灯，实现了<strong>62%的能耗降低</strong>和<strong>年节省€48,000</strong>，仅14个月即收回全部投资。</p>

<h3>免费照明设计</h3>
<p>我们的工程团队为仓库项目提供免费的DIALux照明设计。发送您的平面图，我们将在48小时内提供完整的照明方案。</p>
`,
      },
      es: {
        title: "Iluminación para Almacenes y Logística",
        description: "Soluciones LED de gran altura para almacenes, centros de distribución e instalaciones logísticas",
        body: `
<h2>Ilumine su Almacén para Máxima Eficiencia</h2>
<p>Los almacenes modernos exigen iluminación que ofrezca alta producción lumínica, eficiencia energética y mantenimiento mínimo. Nuestras luminarias LED de gran altura están diseñadas específicamente para entornos de almacén con alturas de techo de 6 a 20 metros.</p>

<h3>Beneficios Clave</h3>
<ul>
<li><strong>Ahorro energético de hasta el 70%</strong> en comparación con iluminación HID tradicional</li>
<li><strong>Vida útil de más de 50,000 horas</strong> — reduzca drásticamente los costos de mantenimiento</li>
<li><strong>Encendido instantáneo</strong> — sin tiempo de calentamiento, ideal para sensores de movimiento</li>
<li><strong>Alto CRI (>80)</strong> — mejore la precisión de picking y reduzca errores</li>
</ul>

<h3>Productos Recomendados</h3>
<ul>
<li><strong>High Bay UFO 100W-240W:</strong> Diseño compacto, eficiencia de 140 lm/W, ideal para alturas de 6-12m</li>
<li><strong>High Bay Lineal 150W-300W:</strong> Ángulo de haz amplio para pasillos, iluminación uniforme</li>
<li><strong>Kits de Sensores de Movimiento:</strong> Sensores de microondas para encendido/apagado automático</li>
</ul>

<h3>Caso de Éxito</h3>
<p>Un centro de distribución de 25,000 m² en Rotterdam reemplazó luminarias HPS de 400W por nuestros High Bays UFO de 150W, logrando una <strong>reducción del 62% en energía</strong> y un <strong>ahorro anual de €48,000</strong>, con ROI completo en solo 14 meses.</p>

<h3>Diseño de Iluminación Gratuito</h3>
<p>Nuestro equipo de ingeniería proporciona diseños de iluminación DIALux gratuitos para proyectos de almacén. Contáctenos con sus planos y le entregaremos una especificación completa en 48 horas.</p>
`,
      },
    },
  },
  {
    slug: "factory-lighting",
    menuGroup: "by_industry",
    order: 2,
    content: {
      en: {
        title: "Factory & Industrial Lighting",
        description: "Robust LED lighting for manufacturing plants and industrial facilities",
        body: `<h2>Industrial-Grade Lighting for Manufacturing Excellence</h2><p>Our industrial LED solutions withstand harsh factory environments — dust, vibration, temperature extremes, and 24/7 operation. Designed to meet stringent safety standards while delivering superior light quality for precision work.</p><h3>Key Benefits</h3><ul><li><strong>IP65/IP66 rated</strong> — dust-tight and water-resistant</li><li><strong>IK08+ impact resistance</strong> — built for rugged environments</li><li><strong>Flicker-free drivers</strong> — reduce eye fatigue during long shifts</li><li><strong>ATEX options available</strong> — for explosive atmosphere zones</li></ul><h3>Applications</h3><ul><li>Assembly lines and workstations</li><li>CNC machining areas</li><li>Quality inspection zones (CRI >90)</li><li>Loading docks and outdoor areas</li></ul><h3>Why Choose Us</h3><p>We provide complete lighting audits, ROI calculations, and phased upgrade plans that minimize production downtime. Our fixtures come with 5-year warranties and dedicated technical support.</p>`,
      },
      zh: {
        title: "工厂与工业照明",
        description: "适用于制造工厂和工业设施的坚固LED照明方案",
        body: `<h2>工业级照明助力卓越生产</h2><p>我们的工业LED照明方案可抵御严苛的工厂环境——粉尘、振动、极端温度和全天候运行。满足严格的安全标准，同时为精密作业提供卓越照明品质。</p><h3>核心优势</h3><ul><li><strong>IP65/IP66防护等级</strong>——防尘防水</li><li><strong>IK08+抗冲击</strong>——适应恶劣环境</li><li><strong>无频闪驱动</strong>——减轻长时间工作的视觉疲劳</li><li><strong>可选ATEX认证</strong>——适用于易爆环境</li></ul><h3>应用场景</h3><ul><li>装配线和工作站</li><li>CNC加工区域</li><li>质检区域（CRI >90）</li><li>装卸码头和室外区域</li></ul><h3>选择我们的理由</h3><p>我们提供完整的照明审计、投资回报计算和分阶段升级方案，最大程度减少生产停机。所有灯具享有5年保修和专属技术支持。</p>`,
      },
      es: {
        title: "Iluminación Industrial y de Fábricas",
        description: "Iluminación LED robusta para plantas de fabricación e instalaciones industriales",
        body: `<h2>Iluminación de Grado Industrial para Excelencia en Manufactura</h2><p>Nuestras soluciones LED industriales resisten entornos de fábrica hostiles — polvo, vibraciones, temperaturas extremas y operación 24/7. Diseñadas para cumplir estrictos estándares de seguridad mientras ofrecen calidad de luz superior para trabajo de precisión.</p><h3>Beneficios Clave</h3><ul><li><strong>Clasificación IP65/IP66</strong> — hermético al polvo y resistente al agua</li><li><strong>Resistencia al impacto IK08+</strong> — construido para entornos rigurosos</li><li><strong>Drivers sin parpadeo</strong> — reduce la fatiga ocular en turnos largos</li><li><strong>Opciones ATEX disponibles</strong> — para zonas con atmósferas explosivas</li></ul><h3>Aplicaciones</h3><ul><li>Líneas de ensamblaje y estaciones de trabajo</li><li>Áreas de mecanizado CNC</li><li>Zonas de inspección de calidad (CRI >90)</li><li>Muelles de carga y áreas exteriores</li></ul><h3>Por Qué Elegirnos</h3><p>Proporcionamos auditorías completas de iluminación, cálculos de ROI y planes de actualización por fases que minimizan el tiempo de inactividad. Nuestras luminarias incluyen garantía de 5 años y soporte técnico dedicado.</p>`,
      },
    },
  },
  {
    slug: "parking-lighting",
    menuGroup: "by_industry",
    order: 3,
    content: {
      en: {
        title: "Parking & Garage Lighting",
        description: "Energy-efficient LED solutions for parking structures and garages",
        body: `<h2>Smart Parking Lighting Solutions</h2><p>Our LED parking fixtures deliver uniform, safe illumination while cutting energy costs by up to 75%. With intelligent controls and motion sensing, lights operate at full power only when needed.</p><h3>Key Benefits</h3><ul><li><strong>75% energy savings</strong> with dimming and occupancy sensors</li><li><strong>Vandal-resistant IK10 housing</strong></li><li><strong>Emergency battery backup</strong> options available</li><li><strong>Dark-sky compliant</strong> — reduced light pollution</li></ul><h3>Product Range</h3><ul><li>Tri-proof Linear Fixtures (IP65, 40W-80W)</li><li>Surface-mount Canopy Lights (60W-150W)</li><li>Smart Controller Systems with daylight harvesting</li></ul>`,
      },
      zh: {
        title: "停车场照明",
        description: "适用于停车场结构和车库的节能LED照明方案",
        body: `<h2>智能停车场照明方案</h2><p>我们的LED停车场灯具提供均匀、安全的照明，同时降低高达75%的能耗。配合智能控制和感应系统，灯具仅在需要时以全功率运行。</p><h3>核心优势</h3><ul><li><strong>节能75%</strong>——调光和人体感应联动</li><li><strong>防破坏IK10外壳</strong></li><li><strong>应急电池备份</strong>可选</li><li><strong>暗天空合规</strong>——减少光污染</li></ul><h3>产品系列</h3><ul><li>三防线性灯（IP65，40W-80W）</li><li>吸顶式罩棚灯（60W-150W）</li><li>智能控制系统，支持日光采集</li></ul>`,
      },
      es: {
        title: "Iluminación para Estacionamientos",
        description: "Soluciones LED eficientes para estructuras de estacionamiento y garajes",
        body: `<h2>Soluciones Inteligentes de Iluminación para Estacionamientos</h2><p>Nuestras luminarias LED para estacionamientos ofrecen iluminación uniforme y segura reduciendo los costos de energía hasta un 75%. Con controles inteligentes y sensores de movimiento, las luces operan a máxima potencia solo cuando es necesario.</p><h3>Beneficios Clave</h3><ul><li><strong>75% de ahorro energético</strong> con atenuación y sensores de ocupación</li><li><strong>Carcasa antivandálica IK10</strong></li><li><strong>Batería de emergencia</strong> disponible</li><li><strong>Cumplimiento dark-sky</strong> — contaminación lumínica reducida</li></ul><h3>Gama de Productos</h3><ul><li>Luminarias Lineales Tri-proof (IP65, 40W-80W)</li><li>Luces de Marquesina de montaje en superficie (60W-150W)</li><li>Sistemas de Control Inteligente con aprovechamiento de luz natural</li></ul>`,
      },
    },
  },
  {
    slug: "sports-lighting",
    menuGroup: "by_industry",
    order: 4,
    content: {
      en: {
        title: "Sports Facility Lighting",
        description: "Professional LED floodlights for stadiums, courts, and sports venues",
        body: `<h2>Professional Sports Lighting</h2><p>Deliver broadcast-quality illumination for sports venues of all sizes. Our LED floodlights offer precise beam control, zero flicker, and exceptional uniformity to meet international sporting standards.</p><h3>Key Benefits</h3><ul><li><strong>TÜV flicker-free certified</strong> — for HD/4K broadcast</li><li><strong>Uniformity ratio >0.7</strong> — meets FIFA/UEFA standards</li><li><strong>Precise beam angles</strong> — 15° to 90° options, minimize spill light</li><li><strong>Instant restrike</strong> — no delay after power interruption</li></ul><h3>Applications</h3><ul><li>Football/soccer stadiums</li><li>Tennis and basketball courts</li><li>Swimming pools and aquatic centers</li><li>Athletic tracks and multi-sport facilities</li></ul>`,
      },
      zh: {
        title: "体育场馆照明",
        description: "适用于体育场、球场和运动场馆的专业LED泛光灯",
        body: `<h2>专业体育照明</h2><p>为各类体育场馆提供转播级照明。我们的LED泛光灯提供精准光束控制、零频闪和卓越的均匀度，满足国际体育赛事标准。</p><h3>核心优势</h3><ul><li><strong>TÜV无频闪认证</strong>——适用于高清/4K转播</li><li><strong>均匀度>0.7</strong>——满足FIFA/UEFA标准</li><li><strong>精准光束角</strong>——15°至90°可选，最小化溢出光</li><li><strong>即时再启动</strong>——断电后无延迟</li></ul><h3>应用场景</h3><ul><li>足球场</li><li>网球和篮球场</li><li>游泳池和水上运动中心</li><li>田径跑道和综合体育设施</li></ul>`,
      },
      es: {
        title: "Iluminación para Instalaciones Deportivas",
        description: "Proyectores LED profesionales para estadios, canchas y recintos deportivos",
        body: `<h2>Iluminación Deportiva Profesional</h2><p>Ofrezca iluminación de calidad de transmisión para recintos deportivos de todos los tamaños. Nuestros proyectores LED ofrecen control preciso del haz, cero parpadeo y uniformidad excepcional para cumplir estándares deportivos internacionales.</p><h3>Beneficios Clave</h3><ul><li><strong>Certificación TÜV sin parpadeo</strong> — para transmisión HD/4K</li><li><strong>Ratio de uniformidad >0.7</strong> — cumple estándares FIFA/UEFA</li><li><strong>Ángulos de haz precisos</strong> — opciones de 15° a 90°</li><li><strong>Reencendido instantáneo</strong> — sin retraso tras interrupción</li></ul><h3>Aplicaciones</h3><ul><li>Estadios de fútbol</li><li>Canchas de tenis y baloncesto</li><li>Piscinas y centros acuáticos</li><li>Pistas de atletismo e instalaciones multideportivas</li></ul>`,
      },
    },
  },
  {
    slug: "supermarket-lighting",
    menuGroup: "retail_hospitality",
    order: 5,
    content: {
      en: {
        title: "Supermarket & Retail Lighting",
        description: "LED lighting that enhances product appeal and drives sales in retail environments",
        body: `<h2>Lighting That Sells</h2><p>Strategic retail lighting increases dwell time and influences purchasing decisions. Our retail LED range combines excellent color rendering with energy efficiency to make your products shine.</p><h3>Key Benefits</h3><ul><li><strong>CRI >90, R9 >50</strong> — products look their best</li><li><strong>Tunable white (2700K-6500K)</strong> — match lighting to product zones</li><li><strong>Integrated track systems</strong> — easy repositioning for seasonal displays</li></ul><h3>Zone-Specific Solutions</h3><ul><li><strong>Fresh produce:</strong> High CRI panels with warm white accents</li><li><strong>Bakery:</strong> 2700K warm tone to enhance golden hues</li><li><strong>Frozen foods:</strong> 5000K cool white for clean, fresh appearance</li><li><strong>General aisles:</strong> Uniform 4000K neutral white panels</li></ul>`,
      },
      zh: {
        title: "超市与零售照明",
        description: "提升产品吸引力、促进零售销售的LED照明方案",
        body: `<h2>让灯光促进销售</h2><p>策略性的零售照明能增加顾客停留时间并影响购买决策。我们的零售LED系列兼具出色的显色性和节能性，让您的商品焕发光彩。</p><h3>核心优势</h3><ul><li><strong>CRI >90，R9 >50</strong>——产品呈现最佳效果</li><li><strong>可调色温（2700K-6500K）</strong>——根据产品区域匹配照明</li><li><strong>集成轨道系统</strong>——方便季节性陈列调整</li></ul><h3>分区照明方案</h3><ul><li><strong>生鲜区：</strong>高显色面板灯搭配暖白重点照明</li><li><strong>烘焙区：</strong>2700K暖色调提升金黄色泽</li><li><strong>冷冻区：</strong>5000K冷白色呈现清新感</li><li><strong>普通货架：</strong>均匀4000K中性白面板灯</li></ul>`,
      },
      es: {
        title: "Iluminación para Supermercados y Retail",
        description: "Iluminación LED que realza el atractivo de los productos e impulsa las ventas",
        body: `<h2>Iluminación que Vende</h2><p>La iluminación estratégica en retail aumenta el tiempo de permanencia e influye en las decisiones de compra. Nuestra gama LED retail combina excelente reproducción cromática con eficiencia energética para hacer brillar sus productos.</p><h3>Beneficios Clave</h3><ul><li><strong>CRI >90, R9 >50</strong> — los productos lucen mejor</li><li><strong>Blanco ajustable (2700K-6500K)</strong> — adapte la iluminación por zonas</li><li><strong>Sistemas de riel integrados</strong> — fácil reposicionamiento para exhibiciones</li></ul><h3>Soluciones por Zona</h3><ul><li><strong>Productos frescos:</strong> Paneles de alto CRI con acentos cálidos</li><li><strong>Panadería:</strong> Tono cálido 2700K para realzar tonos dorados</li><li><strong>Congelados:</strong> Blanco frío 5000K para apariencia limpia</li><li><strong>Pasillos generales:</strong> Paneles blanco neutro 4000K uniformes</li></ul>`,
      },
    },
  },
  {
    slug: "fashion-lighting",
    menuGroup: "retail_hospitality",
    order: 6,
    content: {
      en: {
        title: "Fashion & Boutique Lighting",
        description: "Accent and display lighting for fashion stores and luxury retail",
        body: `<h2>Elevate Your Fashion Retail Experience</h2><p>Create compelling visual stories with precision LED accent lighting. From window displays to fitting rooms, our solutions help fashion retailers create immersive shopping experiences that reflect brand identity.</p><h3>Key Benefits</h3><ul><li><strong>CRI >95</strong> — true-to-life color rendering for fabrics</li><li><strong>Adjustable beam angles</strong> — spotlight, wash, or accent modes</li><li><strong>Dimming compatible</strong> — set the perfect ambiance</li><li><strong>Minimal UV/IR emission</strong> — protects delicate fabrics</li></ul><h3>Applications</h3><ul><li>Window displays and mannequin lighting</li><li>Fitting room mirrors (high CRI, flattering tones)</li><li>Shelf and rack accent lighting</li><li>Architectural cove and feature lighting</li></ul>`,
      },
      zh: {
        title: "时尚与精品店照明",
        description: "适用于时装店和高端零售的重点照明和展示照明",
        body: `<h2>提升时尚零售体验</h2><p>通过精准的LED重点照明讲述引人入胜的视觉故事。从橱窗展示到试衣间，我们的方案帮助时尚零售商打造沉浸式购物体验，彰显品牌个性。</p><h3>核心优势</h3><ul><li><strong>CRI >95</strong>——面料色彩还原逼真</li><li><strong>可调光束角</strong>——聚光、洗墙或重点照明模式</li><li><strong>支持调光</strong>——营造完美氛围</li><li><strong>低紫外/红外辐射</strong>——保护精致面料</li></ul><h3>应用场景</h3><ul><li>橱窗展示和模特照明</li><li>试衣间镜面照明（高显色、修饰色调）</li><li>货架和衣架重点照明</li><li>建筑灯槽和特色照明</li></ul>`,
      },
      es: {
        title: "Iluminación para Moda y Boutiques",
        description: "Iluminación de acento y exhibición para tiendas de moda y retail de lujo",
        body: `<h2>Eleve su Experiencia de Retail de Moda</h2><p>Cree historias visuales convincentes con iluminación LED de acento de precisión. Desde escaparates hasta probadores, nuestras soluciones ayudan a los retailers de moda a crear experiencias de compra inmersivas que reflejan la identidad de marca.</p><h3>Beneficios Clave</h3><ul><li><strong>CRI >95</strong> — reproducción cromática fiel para tejidos</li><li><strong>Ángulos de haz ajustables</strong> — modos spotlight, wash o acento</li><li><strong>Compatible con regulación</strong> — establezca la ambientación perfecta</li><li><strong>Emisión UV/IR mínima</strong> — protege tejidos delicados</li></ul><h3>Aplicaciones</h3><ul><li>Escaparates y iluminación de maniquíes</li><li>Espejos de probadores (alto CRI, tonos favorecedores)</li><li>Iluminación de acento para estantes y percheros</li><li>Iluminación arquitectónica y de características</li></ul>`,
      },
    },
  },
  {
    slug: "hotel-lighting",
    menuGroup: "retail_hospitality",
    order: 7,
    content: {
      en: {
        title: "Hotel & Resort Lighting",
        description: "Hospitality LED lighting for hotels, resorts, and accommodation facilities",
        body: `<h2>Create Memorable Guest Experiences</h2><p>Lighting sets the tone for every guest touchpoint — from the grand lobby to intimate guest rooms. Our hospitality range combines elegant design with smart controls for the ultimate guest experience.</p><h3>Key Benefits</h3><ul><li><strong>Tunable white technology</strong> — circadian-friendly room lighting</li><li><strong>DALI/DMX compatible</strong> — integrate with building management systems</li><li><strong>Architectural decorative options</strong> — custom finishes and designs</li><li><strong>Scene control ready</strong> — preset lighting moods per area</li></ul><h3>Area Solutions</h3><ul><li><strong>Lobby:</strong> Grand chandeliers, indirect cove lighting, accent walls</li><li><strong>Guest rooms:</strong> Tunable bedside, reading, and ambient lighting</li><li><strong>Restaurants:</strong> Dimmable warm-tone fixtures for dining ambiance</li><li><strong>Exterior:</strong> Facade, landscape, and pool area lighting</li></ul>`,
      },
      zh: {
        title: "酒店与度假村照明",
        description: "适用于酒店、度假村和住宿设施的酒店LED照明",
        body: `<h2>打造难忘的宾客体验</h2><p>照明为每个宾客接触点定下基调——从宏伟的大堂到私密的客房。我们的酒店照明系列将优雅设计与智能控制相结合，提供极致宾客体验。</p><h3>核心优势</h3><ul><li><strong>可调白光技术</strong>——人因照明，助眠节律</li><li><strong>兼容DALI/DMX</strong>——集成楼宇管理系统</li><li><strong>建筑装饰选项</strong>——定制饰面和设计</li><li><strong>场景控制就绪</strong>——按区域预设照明模式</li></ul><h3>分区方案</h3><ul><li><strong>大堂：</strong>大型吊灯、间接灯槽照明、重点墙面</li><li><strong>客房：</strong>可调床头灯、阅读灯和环境照明</li><li><strong>餐厅：</strong>可调光暖色灯具营造用餐氛围</li><li><strong>外部：</strong>建筑立面、景观和泳池区照明</li></ul>`,
      },
      es: {
        title: "Iluminación para Hoteles y Resorts",
        description: "Iluminación LED de hospitalidad para hoteles, resorts e instalaciones de alojamiento",
        body: `<h2>Cree Experiencias Memorables para los Huéspedes</h2><p>La iluminación establece el tono en cada punto de contacto — desde el vestíbulo hasta las habitaciones. Nuestra gama de hospitalidad combina diseño elegante con controles inteligentes para la experiencia definitiva del huésped.</p><h3>Beneficios Clave</h3><ul><li><strong>Tecnología de blanco ajustable</strong> — iluminación amigable con el ritmo circadiano</li><li><strong>Compatible con DALI/DMX</strong> — integración con sistemas de gestión</li><li><strong>Opciones decorativas arquitectónicas</strong> — acabados y diseños personalizados</li><li><strong>Control de escenas listo</strong> — ambientes de iluminación predefinidos</li></ul><h3>Soluciones por Área</h3><ul><li><strong>Vestíbulo:</strong> Lámparas de araña, iluminación de cala indirecta</li><li><strong>Habitaciones:</strong> Iluminación de mesita, lectura y ambiente ajustable</li><li><strong>Restaurantes:</strong> Luminarias regulables de tono cálido</li><li><strong>Exterior:</strong> Iluminación de fachada, paisaje y piscina</li></ul>`,
      },
    },
  },
  {
    slug: "restaurant-lighting",
    menuGroup: "retail_hospitality",
    order: 8,
    content: {
      en: {
        title: "Restaurant & Bar Lighting",
        description: "Atmospheric LED lighting for restaurants, bars, and food service venues",
        body: `<h2>Set the Perfect Dining Atmosphere</h2><p>The right lighting transforms a meal into an experience. Our restaurant lighting solutions create the ideal ambiance while ensuring food looks appetizing and spaces feel inviting.</p><h3>Key Benefits</h3><ul><li><strong>Warm dimming (1800K-3000K)</strong> — mimics candlelight at low levels</li><li><strong>CRI >90</strong> — food and décor look their natural best</li><li><strong>Flexible control</strong> — transition from bright lunch service to intimate dinner</li><li><strong>Low glare designs</strong> — comfortable for extended dining</li></ul><h3>Design Approach</h3><ul><li>Layer ambient, task, and accent lighting for depth</li><li>Highlight architectural features and art pieces</li><li>Create distinct zones: bar, dining, private areas</li><li>Outdoor patio and terrace solutions available</li></ul>`,
      },
      zh: {
        title: "餐厅与酒吧照明",
        description: "适用于餐厅、酒吧和餐饮场所的氛围LED照明",
        body: `<h2>营造完美用餐氛围</h2><p>合适的照明让一顿饭变成一种体验。我们的餐厅照明方案创造理想氛围，同时确保食物看起来诱人，空间感觉温馨。</p><h3>核心优势</h3><ul><li><strong>暖调光（1800K-3000K）</strong>——低亮度时模拟烛光效果</li><li><strong>CRI >90</strong>——食物和装饰呈现自然最佳效果</li><li><strong>灵活控制</strong>——从明亮午餐过渡到私密晚餐</li><li><strong>低眩光设计</strong>——长时间用餐也舒适</li></ul><h3>设计理念</h3><ul><li>层叠环境光、功能光和重点照明，营造空间深度</li><li>突出建筑特色和艺术品</li><li>创建独立区域：吧台、用餐区、私人包间</li><li>提供户外露台和阳台照明方案</li></ul>`,
      },
      es: {
        title: "Iluminación para Restaurantes y Bares",
        description: "Iluminación LED atmosférica para restaurantes, bares y locales gastronómicos",
        body: `<h2>Establezca la Atmósfera Perfecta para Cenar</h2><p>La iluminación correcta transforma una comida en una experiencia. Nuestras soluciones de iluminación para restaurantes crean el ambiente ideal mientras aseguran que la comida luzca apetitosa y los espacios sean acogedores.</p><h3>Beneficios Clave</h3><ul><li><strong>Regulación cálida (1800K-3000K)</strong> — simula luz de vela a niveles bajos</li><li><strong>CRI >90</strong> — la comida y decoración lucen naturales</li><li><strong>Control flexible</strong> — transición de almuerzo brillante a cena íntima</li><li><strong>Diseños de bajo deslumbramiento</strong> — cómodos para cenas prolongadas</li></ul><h3>Enfoque de Diseño</h3><ul><li>Capas de iluminación ambiental, de tarea y de acento</li><li>Resalte características arquitectónicas y obras de arte</li><li>Cree zonas distintas: barra, comedor, áreas privadas</li><li>Soluciones para terrazas y patios exteriores disponibles</li></ul>`,
      },
    },
  },
  {
    slug: "dialux-design",
    menuGroup: "pro_services",
    order: 9,
    content: {
      en: {
        title: "DIALux Lighting Design",
        description: "Professional lighting simulation and design services using DIALux",
        body: `<h2>Professional Lighting Design Service</h2><p>Our certified lighting designers use DIALux evo to create precise, standards-compliant lighting plans for your project. From initial concept to final specification, we ensure optimal light distribution and energy efficiency.</p><h3>What We Deliver</h3><ul><li>Complete DIALux simulation with 3D rendering</li><li>Lux level calculations per EN 12464 standards</li><li>Uniformity analysis and glare rating (UGR) reports</li><li>Energy consumption and cost comparison reports</li><li>Product specification with bill of materials</li></ul><h3>Process</h3><ol><li><strong>Submit your plans</strong> — floor plans, ceiling heights, usage requirements</li><li><strong>Design phase</strong> — our team creates the lighting layout (2-3 business days)</li><li><strong>Review & refine</strong> — collaborative review with adjustments</li><li><strong>Final deliverables</strong> — complete specification package</li></ol><p><strong>This service is complimentary</strong> for projects using our LED products.</p>`,
      },
      zh: {
        title: "DIALux照明设计",
        description: "使用DIALux进行专业照明模拟和设计服务",
        body: `<h2>专业照明设计服务</h2><p>我们的认证照明设计师使用DIALux evo为您的项目创建精确、符合标准的照明方案。从初始概念到最终规格，确保最优光分布和能源效率。</p><h3>交付内容</h3><ul><li>完整的DIALux模拟及3D渲染</li><li>符合EN 12464标准的照度计算</li><li>均匀度分析和眩光评级（UGR）报告</li><li>能耗和成本对比报告</li><li>产品规格和材料清单</li></ul><h3>服务流程</h3><ol><li><strong>提交图纸</strong>——平面图、层高、使用需求</li><li><strong>设计阶段</strong>——我们的团队创建照明布局（2-3个工作日）</li><li><strong>评审与优化</strong>——协同评审并调整</li><li><strong>最终交付</strong>——完整的规格方案包</li></ol><p><strong>使用我们LED产品的项目可免费享受此服务。</strong></p>`,
      },
      es: {
        title: "Diseño de Iluminación DIALux",
        description: "Servicios profesionales de simulación y diseño de iluminación con DIALux",
        body: `<h2>Servicio Profesional de Diseño de Iluminación</h2><p>Nuestros diseñadores de iluminación certificados utilizan DIALux evo para crear planes de iluminación precisos y conformes a normativas. Desde el concepto inicial hasta la especificación final, aseguramos una distribución lumínica óptima y eficiencia energética.</p><h3>Lo que Entregamos</h3><ul><li>Simulación DIALux completa con renderizado 3D</li><li>Cálculos de niveles de lux según normas EN 12464</li><li>Análisis de uniformidad e informes de deslumbramiento (UGR)</li><li>Informes de consumo energético y comparación de costos</li><li>Especificación de producto con lista de materiales</li></ul><h3>Proceso</h3><ol><li><strong>Envíe sus planos</strong> — planos de planta, alturas, requisitos de uso</li><li><strong>Fase de diseño</strong> — nuestro equipo crea el diseño (2-3 días hábiles)</li><li><strong>Revisión y ajuste</strong> — revisión colaborativa con ajustes</li><li><strong>Entregables finales</strong> — paquete de especificación completo</li></ol><p><strong>Este servicio es gratuito</strong> para proyectos que utilicen nuestros productos LED.</p>`,
      },
    },
  },
  {
    slug: "energy-audit",
    menuGroup: "pro_services",
    order: 10,
    content: {
      en: {
        title: "Energy Audit & ROI Analysis",
        description: "Comprehensive energy audits and return-on-investment calculations for LED upgrades",
        body: `<h2>Know Your Savings Before You Invest</h2><p>Our energy audit service provides a detailed analysis of your current lighting infrastructure and a clear roadmap to LED conversion with projected savings and payback period.</p><h3>Audit Includes</h3><ul><li>On-site survey of existing lighting systems</li><li>Energy consumption baseline measurement</li><li>LED replacement specification and mapping</li><li>Detailed ROI calculation with payback timeline</li><li>Carbon footprint reduction report</li><li>Available subsidies and incentive identification</li></ul><h3>Typical Results</h3><ul><li><strong>50-75% energy reduction</strong></li><li><strong>12-24 month payback period</strong></li><li><strong>80% maintenance cost reduction</strong></li></ul><p>Contact us to schedule a no-obligation energy audit for your facility.</p>`,
      },
      zh: {
        title: "能源审计与投资回报分析",
        description: "LED升级的全面能源审计和投资回报计算",
        body: `<h2>投资前了解您的节能效果</h2><p>我们的能源审计服务对您现有的照明基础设施进行详细分析，并提供清晰的LED改造路线图，包含预计节能和投资回收期。</p><h3>审计内容</h3><ul><li>现有照明系统现场勘察</li><li>能耗基准测量</li><li>LED替代产品规格和映射方案</li><li>详细的投资回报计算和回收时间表</li><li>碳足迹减排报告</li><li>可用补贴和激励政策识别</li></ul><h3>典型成果</h3><ul><li><strong>节能50-75%</strong></li><li><strong>12-24个月投资回收期</strong></li><li><strong>维护成本降低80%</strong></li></ul><p>联系我们预约免费能源审计。</p>`,
      },
      es: {
        title: "Auditoría Energética y Análisis de ROI",
        description: "Auditorías energéticas integrales y cálculos de retorno de inversión para actualizaciones LED",
        body: `<h2>Conozca sus Ahorros Antes de Invertir</h2><p>Nuestro servicio de auditoría energética proporciona un análisis detallado de su infraestructura de iluminación actual y una hoja de ruta clara para la conversión a LED con ahorros proyectados y período de recuperación.</p><h3>La Auditoría Incluye</h3><ul><li>Relevamiento in situ de sistemas de iluminación existentes</li><li>Medición de línea base de consumo energético</li><li>Especificación y mapeo de reemplazo LED</li><li>Cálculo detallado de ROI con cronograma de recuperación</li><li>Informe de reducción de huella de carbono</li><li>Identificación de subsidios e incentivos disponibles</li></ul><h3>Resultados Típicos</h3><ul><li><strong>50-75% de reducción energética</strong></li><li><strong>Período de recuperación de 12-24 meses</strong></li><li><strong>80% de reducción en costos de mantenimiento</strong></li></ul><p>Contáctenos para programar una auditoría energética sin compromiso.</p>`,
      },
    },
  },
  {
    slug: "turnkey-projects",
    menuGroup: "pro_services",
    order: 11,
    content: {
      en: {
        title: "Turnkey Installation Projects",
        description: "End-to-end lighting project management from design to installation",
        body: `<h2>Complete Lighting Solutions, Delivered</h2><p>From initial consultation to final commissioning, our turnkey service handles every aspect of your lighting project. We coordinate design, procurement, installation, and commissioning so you can focus on your business.</p><h3>Our Process</h3><ol><li><strong>Consultation:</strong> Understand your requirements and constraints</li><li><strong>Design:</strong> DIALux lighting plan and product selection</li><li><strong>Procurement:</strong> Product sourcing and logistics coordination</li><li><strong>Installation:</strong> Professional installation by certified electricians</li><li><strong>Commissioning:</strong> Testing, tuning, and scene programming</li><li><strong>Handover:</strong> Documentation, training, and warranty activation</li></ol><h3>Why Turnkey?</h3><ul><li>Single point of contact for the entire project</li><li>Guaranteed timelines and fixed pricing</li><li>Certified installation with full compliance</li><li>Post-installation support and maintenance contracts</li></ul>`,
      },
      zh: {
        title: "交钥匙工程",
        description: "从设计到安装的端到端照明项目管理",
        body: `<h2>完整照明方案，一站式交付</h2><p>从初始咨询到最终调试，我们的交钥匙服务处理照明项目的每个环节。我们协调设计、采购、安装和调试，让您专注于核心业务。</p><h3>服务流程</h3><ol><li><strong>咨询：</strong>了解您的需求和限制条件</li><li><strong>设计：</strong>DIALux照明方案和产品选型</li><li><strong>采购：</strong>产品采购和物流协调</li><li><strong>安装：</strong>持证电工专业安装</li><li><strong>调试：</strong>测试、调光和场景编程</li><li><strong>交付：</strong>文档移交、培训和保修激活</li></ol><h3>为何选择交钥匙？</h3><ul><li>整个项目的单一联络人</li><li>保证时间节点和固定价格</li><li>认证安装，完全合规</li><li>安装后支持和维保合同</li></ul>`,
      },
      es: {
        title: "Proyectos Llave en Mano",
        description: "Gestión integral de proyectos de iluminación desde el diseño hasta la instalación",
        body: `<h2>Soluciones Completas de Iluminación, Entregadas</h2><p>Desde la consulta inicial hasta la puesta en marcha final, nuestro servicio llave en mano gestiona cada aspecto de su proyecto de iluminación. Coordinamos diseño, adquisición, instalación y puesta en marcha para que usted se enfoque en su negocio.</p><h3>Nuestro Proceso</h3><ol><li><strong>Consulta:</strong> Comprender sus requisitos y restricciones</li><li><strong>Diseño:</strong> Plan de iluminación DIALux y selección de productos</li><li><strong>Adquisición:</strong> Abastecimiento de productos y coordinación logística</li><li><strong>Instalación:</strong> Instalación profesional por electricistas certificados</li><li><strong>Puesta en marcha:</strong> Pruebas, ajuste y programación de escenas</li><li><strong>Entrega:</strong> Documentación, capacitación y activación de garantía</li></ol><h3>¿Por Qué Llave en Mano?</h3><ul><li>Un solo punto de contacto para todo el proyecto</li><li>Plazos garantizados y precios fijos</li><li>Instalación certificada con total cumplimiento normativo</li><li>Soporte post-instalación y contratos de mantenimiento</li></ul>`,
      },
    },
  },
  {
    slug: "oem-solutions",
    menuGroup: "pro_services",
    order: 12,
    content: {
      en: {
        title: "OEM & Custom Manufacturing",
        description: "Custom LED lighting manufacturing and OEM/ODM partnerships",
        body: `<h2>Your Vision, Our Manufacturing Expertise</h2><p>Partner with us for custom LED lighting solutions tailored to your brand and specifications. Our OEM/ODM capabilities span from minor customizations to fully bespoke product development.</p><h3>OEM Services</h3><ul><li><strong>Private labeling:</strong> Your brand on our proven products</li><li><strong>Custom specifications:</strong> Modified CCT, wattage, beam angles, or housing colors</li><li><strong>Custom packaging:</strong> Branded boxes, manuals, and documentation</li><li><strong>Certification support:</strong> CE, RoHS, ENEC, TÜV under your brand</li></ul><h3>ODM Services</h3><ul><li><strong>Product development:</strong> From concept sketch to production-ready design</li><li><strong>Tooling and prototyping:</strong> Rapid prototyping with production tooling</li><li><strong>Testing and certification:</strong> Complete regulatory compliance</li></ul><h3>MOQ & Lead Times</h3><ul><li>Standard OEM: MOQ 500 units, 4-6 weeks lead time</li><li>Custom ODM: MOQ 1,000 units, 8-12 weeks lead time</li></ul><p>Contact our OEM team to discuss your project requirements.</p>`,
      },
      zh: {
        title: "OEM定制生产",
        description: "定制LED照明生产和OEM/ODM合作",
        body: `<h2>您的愿景，我们的制造专长</h2><p>与我们合作，获得根据您品牌和规格定制的LED照明方案。我们的OEM/ODM能力涵盖从小型定制到全定制产品开发。</p><h3>OEM服务</h3><ul><li><strong>贴牌生产：</strong>在我们成熟产品上使用您的品牌</li><li><strong>定制规格：</strong>修改色温、功率、光束角或外壳颜色</li><li><strong>定制包装：</strong>品牌包装盒、说明书和文档</li><li><strong>认证支持：</strong>以您的品牌获取CE、RoHS、ENEC、TÜV认证</li></ul><h3>ODM服务</h3><ul><li><strong>产品开发：</strong>从概念草图到量产设计</li><li><strong>模具和打样：</strong>快速打样及生产模具</li><li><strong>测试和认证：</strong>完整的法规合规</li></ul><h3>起订量与交期</h3><ul><li>标准OEM：起订量500件，交期4-6周</li><li>定制ODM：起订量1,000件，交期8-12周</li></ul><p>联系我们的OEM团队讨论您的项目需求。</p>`,
      },
      es: {
        title: "OEM y Fabricación Personalizada",
        description: "Fabricación personalizada de iluminación LED y asociaciones OEM/ODM",
        body: `<h2>Su Visión, Nuestra Experiencia en Fabricación</h2><p>Asóciese con nosotros para soluciones de iluminación LED personalizadas adaptadas a su marca y especificaciones. Nuestras capacidades OEM/ODM abarcan desde personalizaciones menores hasta desarrollo de productos completamente a medida.</p><h3>Servicios OEM</h3><ul><li><strong>Etiqueta privada:</strong> Su marca en nuestros productos probados</li><li><strong>Especificaciones personalizadas:</strong> CCT, potencia, ángulos o colores modificados</li><li><strong>Empaque personalizado:</strong> Cajas, manuales y documentación con su marca</li><li><strong>Soporte de certificación:</strong> CE, RoHS, ENEC, TÜV bajo su marca</li></ul><h3>Servicios ODM</h3><ul><li><strong>Desarrollo de producto:</strong> Del boceto al diseño listo para producción</li><li><strong>Herramental y prototipado:</strong> Prototipado rápido con herramental de producción</li><li><strong>Pruebas y certificación:</strong> Cumplimiento regulatorio completo</li></ul><h3>MOQ y Tiempos de Entrega</h3><ul><li>OEM estándar: MOQ 500 unidades, 4-6 semanas</li><li>ODM personalizado: MOQ 1,000 unidades, 8-12 semanas</li></ul><p>Contacte a nuestro equipo OEM para discutir los requisitos de su proyecto.</p>`,
      },
    },
  },
];

// ─── Mega Menu Solutions Config ────────────────────────────────

const megaMenuSolutionsConfig = {
  columns: [
    {
      title: { en: "By Industry", zh: "按行业", es: "Por Industria" },
      items: [
        { label: { en: "Warehouses & Logistics", zh: "仓库与物流", es: "Almacenes y Logística" }, pageSlug: "warehouse-lighting" },
        { label: { en: "Factories & Industrial", zh: "工厂与工业", es: "Fábricas e Industrial" }, pageSlug: "factory-lighting" },
        { label: { en: "Parking & Garages", zh: "停车场", es: "Estacionamientos" }, pageSlug: "parking-lighting" },
        { label: { en: "Sports Facilities", zh: "体育场馆", es: "Instalaciones Deportivas" }, pageSlug: "sports-lighting" },
      ],
    },
    {
      title: { en: "Retail & Hospitality", zh: "零售与酒店", es: "Retail y Hostelería" },
      items: [
        { label: { en: "Supermarkets & Retail", zh: "超市与零售", es: "Supermercados y Retail" }, pageSlug: "supermarket-lighting" },
        { label: { en: "Fashion & Boutiques", zh: "时尚与精品店", es: "Moda y Boutiques" }, pageSlug: "fashion-lighting" },
        { label: { en: "Hotels & Resorts", zh: "酒店与度假村", es: "Hoteles y Resorts" }, pageSlug: "hotel-lighting" },
        { label: { en: "Restaurants & Bars", zh: "餐厅与酒吧", es: "Restaurantes y Bares" }, pageSlug: "restaurant-lighting" },
      ],
    },
    {
      title: { en: "Professional Services", zh: "专业服务", es: "Servicios Profesionales" },
      items: [
        { label: { en: "DIALux Design", zh: "DIALux照明设计", es: "Diseño DIALux" }, pageSlug: "dialux-design" },
        { label: { en: "Energy Audit & ROI", zh: "能源审计与ROI", es: "Auditoría Energética" }, pageSlug: "energy-audit" },
        { label: { en: "Turnkey Projects", zh: "交钥匙工程", es: "Proyectos Llave en Mano" }, pageSlug: "turnkey-projects" },
        { label: { en: "OEM & Custom", zh: "OEM定制生产", es: "OEM y Personalización" }, pageSlug: "oem-solutions" },
      ],
    },
  ],
  promo: {
    badge: { en: "Special Projects", zh: "特殊项目", es: "Proyectos Especiales" },
    heading: { en: "Custom Manufacturing & Large-Scale Projects", zh: "定制生产与大型项目", es: "Fabricación Personalizada y Proyectos a Gran Escala" },
    buttonText: { en: "Contact an Engineer", zh: "联系工程师", es: "Contactar Ingeniero" },
    buttonHref: "/contact",
  },
};

// ─── Main seed function ────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding CMS content...\n");

  // 1. Legal pages
  console.log("📄 Creating legal pages...");
  for (const page of legalPages) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {
        content: page.content,
        type: page.type,
        order: page.order,
        isActive: true,
      },
      create: {
        slug: page.slug,
        type: page.type,
        content: page.content,
        order: page.order,
        isActive: true,
      },
    });
    console.log(`  ✅ ${page.slug}`);
  }

  // 2. Solution pages
  console.log("\n💡 Creating solution pages...");
  for (const page of solutionPages) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {
        content: page.content,
        type: "SOLUTION",
        menuGroup: page.menuGroup,
        order: page.order,
        isActive: true,
      },
      create: {
        slug: page.slug,
        type: "SOLUTION",
        content: page.content,
        menuGroup: page.menuGroup,
        order: page.order,
        isActive: true,
      },
    });
    console.log(`  ✅ ${page.slug}`);
  }

  // 3. Mega menu solutions config
  console.log("\n🧭 Updating mega menu solutions config...");
  await prisma.globalConfig.upsert({
    where: { key: "mega_menu_solutions" },
    update: { value: megaMenuSolutionsConfig },
    create: { key: "mega_menu_solutions", value: megaMenuSolutionsConfig },
  });
  console.log("  ✅ mega_menu_solutions");

  console.log("\n✨ CMS content seeding complete!");
  console.log(`   - ${legalPages.length} legal pages`);
  console.log(`   - ${solutionPages.length} solution pages`);
  console.log(`   - 1 mega menu config`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
