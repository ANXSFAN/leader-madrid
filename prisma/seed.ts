import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

function createContent(
  enName: string,
  enDesc: string,
  esName: string,
  esDesc: string
) {
  return {
    en: { name: enName, description: enDesc },
    es: { name: esName, description: esDesc },
  };
}

interface CategoryData {
  slug: string;
  parentId?: string;
  content: ReturnType<typeof createContent>;
}

async function main() {
  await prisma.returnItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.attributeOption.deleteMany();
  await prisma.attributeDefinition.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  console.log("Cleaned up database");

  const supplier = await prisma.supplier.create({
    data: {
      name: "LEDME EUROPA",
      code: "LEDME-EUROPA",
      contact: {
        name: "Support Team",
        email: "info@ledmeuropa.es",
        website: "https://ledmeuropa.es",
      },
    },
  });

  console.log("Created supplier");

  const attrCct = await prisma.attributeDefinition.create({
    data: {
      key: "cct",
      type: "SELECT",
      unit: "K",
      scope: "VARIANT",
      name: { en: "Color Temperature", es: "Temperatura de Color" },
      options: {
        create: [
          { value: "2700K", color: "#FFCF9E" },
          { value: "3000K", color: "#FDF4DC" },
          { value: "4000K", color: "#E5E5E5" },
          { value: "5000K", color: "#D9ECFF" },
          { value: "6000K", color: "#D4EBFF" },
          { value: "6500K", color: "#CFE4FF" },
        ],
      },
    },
  });

  const attrPower = await prisma.attributeDefinition.create({
    data: {
      key: "power",
      type: "NUMBER",
      unit: "W",
      scope: "VARIANT",
      name: { en: "Power", es: "Potencia" },
    },
  });

  const attrLumens = await prisma.attributeDefinition.create({
    data: {
      key: "lumens",
      type: "NUMBER",
      unit: "lm",
      scope: "VARIANT",
      name: { en: "Luminous Flux", es: "Luminosidad" },
    },
  });

  const attrIpRating = await prisma.attributeDefinition.create({
    data: {
      key: "ip_rating",
      type: "SELECT",
      scope: "PRODUCT",
      name: { en: "IP Rating", es: "Protección IP" },
      options: {
        create: [
          { value: "IP20" },
          { value: "IP21" },
          { value: "IP23" },
          { value: "IP40" },
          { value: "IP44" },
          { value: "IP54" },
          { value: "IP65" },
          { value: "IP66" },
          { value: "IP67" },
          { value: "IP68" },
        ],
      },
    },
  });

  const attrDimmable = await prisma.attributeDefinition.create({
    data: {
      key: "dimmable",
      type: "SELECT",
      scope: "VARIANT",
      name: { en: "Dimmable", es: "Regulable" },
      options: {
        create: [{ value: "Yes" }, { value: "No" }],
      },
    },
  });

  console.log("Created attribute definitions");

  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@led-erp.com",
      name: "Admin User",
      role: "ADMIN",
      password: hashedPassword,
      isActive: true,
      b2bStatus: "APPROVED",
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "customer@example.com",
      name: "John Doe",
      role: "CUSTOMER",
    },
  });

  console.log("Created users");

  const level1Categories = await prisma.category.createManyAndReturn({
    data: [
      {
        slug: "iluminacion-interior",
        content: createContent(
          "Indoor Lighting",
          "Professional LED solutions for residential and commercial interior spaces",
          "Iluminación Interior",
          "Soluciones LED profesionales para espacios interiores residenciales y comerciales"
        ),
      },
      {
        slug: "iluminacion-exterior",
        content: createContent(
          "Outdoor Lighting",
          "Robust LED fixtures for gardens, facades, and outdoor spaces",
          "Iluminación Exterior",
          "Luminarias LED robustas para jardines, fachadas y espacios exteriores"
        ),
      },
      {
        slug: "iluminacion-comercial",
        content: createContent(
          "Commercial Lighting",
          "Professional lighting solutions for retail, offices, and display applications",
          "Iluminación Comercial",
          "Soluciones de iluminación profesional para retail, oficinas y aplicaciones de display"
        ),
      },
      {
        slug: "tiras-neon-y-perfil",
        content: createContent(
          "Strips, Neon & Profiles",
          "LED strips, neon flex, aluminum profiles, and accessories",
          "Tiras, Neón LED y Perfil",
          "Tiras LED, neón flex, perfiles de aluminio y accesorios"
        ),
      },
      {
        slug: "iluminacion-decorativa",
        content: createContent(
          "Decorative Lighting",
          "Designer lighting fixtures for ambient and stylistic illumination",
          "Iluminación Decorativa",
          "Luminarias de diseño para iluminación ambiental y estilística"
        ),
      },
      {
        slug: "material-electrico",
        content: createContent(
          "Electrical Material",
          "Electrical components, wiring, and installation accessories",
          "Material Eléctrico",
          "Componentes eléctricos, cableado y accesorios de instalación"
        ),
      },
    ],
  });

  const l1 = {
    interior: level1Categories.find((c) => c.slug === "iluminacion-interior")!,
    exterior: level1Categories.find((c) => c.slug === "iluminacion-exterior")!,
    comercial: level1Categories.find(
      (c) => c.slug === "iluminacion-comercial"
    )!,
    strips: level1Categories.find((c) => c.slug === "tiras-neon-y-perfil")!,
    decorativa: level1Categories.find(
      (c) => c.slug === "iluminacion-decorativa"
    )!,
    electrical: level1Categories.find((c) => c.slug === "material-electrico")!,
  };

  console.log("Created Level 1 categories");

  const l2Data: CategoryData[] = [
    {
      slug: "downlights-y-plafones",
      parentId: l1.interior.id,
      content: createContent(
        "Downlights & Ceiling Lights",
        "Recessed and surface-mounted downlights and plafonds",
        "Downlights y Plafones",
        "Downlights empotrables y plafones de superficie"
      ),
    },
    {
      slug: "paneles-y-lineales",
      parentId: l1.interior.id,
      content: createContent(
        "Panels & Linear Fixtures",
        "LED panels, tubes, and linear fixtures for commercial spaces",
        "Paneles y Lineales",
        "Paneles LED, tubos y regletas para espacios comerciales"
      ),
    },
    {
      slug: "iluminacion-industrial",
      parentId: l1.interior.id,
      content: createContent(
        "Industrial Lighting",
        "High-bay and emergency fixtures for warehouses and industrial facilities",
        "Iluminación Industrial",
        "Campanas y emergencias para almacenes e instalaciones industriales"
      ),
    },
    {
      slug: "bombillas-y-especiales",
      parentId: l1.interior.id,
      content: createContent(
        "Bulbs & Specialty Lighting",
        "LED bulbs, grow lights, and smart home lighting",
        "Bombillas y Especiales",
        "Bombillas LED, iluminación Grow y SmartHome"
      ),
    },
    {
      slug: "proyectores-led",
      parentId: l1.exterior.id,
      content: createContent(
        "LED Floodlights",
        "Professional floodlights for facades, sports areas, and security",
        "Proyectores LED",
        "Proyectores profesionales para fachadas, zonas deportivas y seguridad"
      ),
    },
    {
      slug: "jardin-y-paisaje",
      parentId: l1.exterior.id,
      content: createContent(
        "Garden & Landscape",
        "Lights for gardens, pathways, pools, and landscape design",
        "Jardín y Paisaje",
        "Luminarias para jardín, caminos, piscinas y diseño paisajístico"
      ),
    },
    {
      slug: "alumbrado-publico-solar",
      parentId: l1.exterior.id,
      content: createContent(
        "Street & Solar Lighting",
        "Street lights and solar-powered lighting solutions",
        "Alumbrado Público y Solar",
        "Farolas y soluciones de iluminación alimentadas por energía solar"
      ),
    },
    {
      slug: "sistemas-de-carril",
      parentId: l1.comercial.id,
      content: createContent(
        "Track Lighting Systems",
        "Rail-mounted spotlights for retail displays and galleries",
        "Sistemas de Carril",
        "Focos sobre rail para escaparates y galerías"
      ),
    },
    {
      slug: "publicidad-y-display",
      parentId: l1.comercial.id,
      content: createContent(
        "Advertising & Display",
        "LED signage, poster displays, and accent lighting",
        "Publicidad y Display",
        "Cartelería LED, displays de cartel y iluminación de acentuación"
      ),
    },
    {
      slug: "tiras-led",
      parentId: l1.strips.id,
      content: createContent(
        "LED Strips",
        "Flexible LED strips in various voltages",
        "Tiras LED",
        "Tiras LED flexibles en diferentes tensiones"
      ),
    },
    {
      slug: "neon-led",
      parentId: l1.strips.id,
      content: createContent(
        "LED Neon",
        "Neon flex and silicone LED strips",
        "Neón LED",
        "Neón flex y tiras LED de silicona"
      ),
    },
    {
      slug: "perfiles-y-fuentes",
      parentId: l1.strips.id,
      content: createContent(
        "Profiles & Power Supplies",
        "Aluminum profiles, diffusers, and LED drivers",
        "Perfiles y Fuentes",
        "Perfiles de aluminio, difusores y drivers LED"
      ),
    },
    {
      slug: "lamparas-techo",
      parentId: l1.decorativa.id,
      content: createContent(
        "Ceiling Lamps & Fans",
        "Ceiling fans, pendant lights, and decorative ceiling fixtures",
        "Lámparas de Techo",
        "Ventiladores de techo, lámparas colgantes y luminarias de techo decorativas"
      ),
    },
    {
      slug: "pared-y-sobremesa",
      parentId: l1.decorativa.id,
      content: createContent(
        "Wall & Table Lights",
        "Wall sconces, mirrors, and table lamps",
        "Pared y Sobremesa",
        "Apliques de pared, espejos LED y lámparas de sobremesa"
      ),
    },
    {
      slug: "instalacion-y-conectividad",
      parentId: l1.electrical.id,
      content: createContent(
        "Installation & Connectivity",
        "Switches, sockets, cables, and connectors",
        "Instalación y Conectividad",
        "Mecanismos, enchufes, cables y conectores"
      ),
    },
    {
      slug: "gestion-y-control",
      parentId: l1.electrical.id,
      content: createContent(
        "Management & Control",
        "Drivers, controllers, and presence sensors",
        "Gestión y Control",
        "Drivers, controladores y detectores de presencia"
      ),
    },
    {
      slug: "equipamiento-y-seguridad",
      parentId: l1.electrical.id,
      content: createContent(
        "Equipment & Safety",
        "Emergency kits, extractors, and mounting accessories",
        "Equipamiento y Seguridad",
        "Kits de emergencia, extractores y accesorios de montaje"
      ),
    },
  ];

  const level2Categories = await prisma.category.createManyAndReturn({
    data: l2Data,
  });

  const l2 = {
    downlightsPlafones: level2Categories.find(
      (c) => c.slug === "downlights-y-plafones"
    )!,
    panelesLineales: level2Categories.find((c) => c.slug === "paneles-y-lineales")!,
    industrial: level2Categories.find((c) => c.slug === "iluminacion-industrial")!,
    bombillasEspeciales: level2Categories.find(
      (c) => c.slug === "bombillas-y-especiales"
    )!,
    proyectores: level2Categories.find((c) => c.slug === "proyectores-led")!,
    jardin: level2Categories.find((c) => c.slug === "jardin-y-paisaje")!,
    alumbrado: level2Categories.find(
      (c) => c.slug === "alumbrado-publico-solar"
    )!,
    carril: level2Categories.find((c) => c.slug === "sistemas-de-carril")!,
    publicidad: level2Categories.find(
      (c) => c.slug === "publicidad-y-display"
    )!,
    tiras: level2Categories.find((c) => c.slug === "tiras-led")!,
    neon: level2Categories.find((c) => c.slug === "neon-led")!,
    perfiles: level2Categories.find((c) => c.slug === "perfiles-y-fuentes")!,
    lamparasTecho: level2Categories.find(
      (c) => c.slug === "lamparas-techo"
    )!,
    pared: level2Categories.find((c) => c.slug === "pared-y-sobremesa")!,
    instalacion: level2Categories.find(
      (c) => c.slug === "instalacion-y-conectividad"
    )!,
    control: level2Categories.find((c) => c.slug === "gestion-y-control")!,
    seguridad: level2Categories.find(
      (c) => c.slug === "equipamiento-y-seguridad"
    )!,
  };

  console.log("Created Level 2 categories");

  const l3Data: CategoryData[] = [
    {
      slug: "downlight-led",
      parentId: l2.downlightsPlafones.id,
      content: createContent(
        "LED Downlights",
        "Recessed downlights with LED technology",
        "Downlight LED",
        "Downlights empotrables con tecnología LED"
      ),
    },
    {
      slug: "plafones-led",
      parentId: l2.downlightsPlafones.id,
      content: createContent(
        "LED Ceiling Lights",
        "Surface-mounted ceiling lights and plafonds",
        "Plafones LED",
        "Luces de techo y plafones de superficie"
      ),
    },
    {
      slug: "aros-gu10-mr16",
      parentId: l2.downlightsPlafones.id,
      content: createContent(
        "GU10/MR16 Rings",
        "Recessed rings and holders for GU10 and MR16 bulbs",
        "Aros GU10/MR16",
        "Aros empotrables y portalámparas para bombillas GU10 y MR16"
      ),
    },
    {
      slug: "paneles-led",
      parentId: l2.panelesLineales.id,
      content: createContent(
        "LED Panels",
        "Slim LED panels for commercial ceilings",
        "Paneles LED",
        "Paneles LED delgados para techos comerciales"
      ),
    },
    {
      slug: "tubos-led",
      parentId: l2.panelesLineales.id,
      content: createContent(
        "LED Tubes",
        "T8 and T5 LED tube replacements",
        "Tubos LED",
        "Tubos LED T8 y T5 de reemplazo"
      ),
    },
    {
      slug: "regletas-led",
      parentId: l2.panelesLineales.id,
      content: createContent(
        "LED Linear Fixtures",
        "Surface-mounted linear LED fixtures",
        "Regletas LED",
        "Luminarias lineales LED de superficie"
      ),
    },
    {
      slug: "campanas-ufo",
      parentId: l2.industrial.id,
      content: createContent(
        "UFO High Bays",
        "UFO-shaped high bay LED fixtures",
        "Campanas UFO",
        "Luminarias LED tipo campana UFO de alta bahía"
      ),
    },
    {
      slug: "pantallas-estancas",
      parentId: l2.panelesLineales.id,
      content: createContent(
        "Waterproof Fixtures",
        "IP65 rated linear fixtures for industrial use",
        "Pantallas LED",
        "Luminarias lineales con protección IP65"
      ),
    },
    {
      slug: "emergencias-led",
      parentId: l2.industrial.id,
      content: createContent(
        "Emergency Lighting",
        "LED emergency lights and exit signs",
        "Emergencias LED",
        "Luces de emergencia y señalización LED"
      ),
    },
    {
      slug: "iluminacion-led-grow",
      parentId: l2.bombillasEspeciales.id,
      content: createContent(
        "LED Grow Lights",
        "Specialized LED lighting for indoor plants and horticulture",
        "Iluminación LED Grow",
        "Iluminación LED especializada para plantas de interior"
      ),
    },
    {
      slug: "smarthome",
      parentId: l2.bombillasEspeciales.id,
      content: createContent(
        "Smart Home",
        "Smart lighting systems with WiFi, Zigbee, and voice control",
        "SmartHome",
        "Sistemas de iluminación inteligente"
      ),
    },
    {
      slug: "bombillas-led",
      parentId: l2.bombillasEspeciales.id,
      content: createContent(
        "LED Bulbs",
        "LED replacement bulbs in various bases",
        "Bombillas LED",
        "Bombillas LED de reemplazo en varios casquillos"
      ),
    },
    {
      slug: "proyectores-smd",
      parentId: l2.proyectores.id,
      content: createContent(
        "SMD Floodlights",
        "Standard SMD LED floodlights",
        "Proyectores SMD",
        "Proyectores LED SMD estándar"
      ),
    },
    {
      slug: "proyectores-modulares",
      parentId: l2.proyectores.id,
      content: createContent(
        "Modular Floodlights",
        "Modular LED floodlights for replaceable components",
        "Proyectores Modulares",
        "Proyectores LED modulares con componentes reemplazables"
      ),
    },
    {
      slug: "proyectores-con-sensor",
      parentId: l2.proyectores.id,
      content: createContent(
        "Floodlights with Sensor",
        "Floodlights with integrated motion sensor",
        "Proyectores con Sensor",
        "Proyectores con sensor de movimiento integrado"
      ),
    },
    {
      slug: "proyectores-rgb",
      parentId: l2.proyectores.id,
      content: createContent(
        "RGB Floodlights",
        "Color-changing RGB LED floodlights",
        "Proyectores RGB",
        "Proyectores LED RGB de cambio de color"
      ),
    },
    {
      slug: "proyectores-bateria",
      parentId: l2.proyectores.id,
      content: createContent(
        "Battery Floodlights",
        "Portable LED floodlights with battery",
        "Proyectores con Batería",
        "Proyectores LED portátiles con batería"
      ),
    },
    {
      slug: "proyectores-lineales",
      parentId: l2.proyectores.id,
      content: createContent(
        "Linear Floodlights",
        "Linear LED floodlights for facades",
        "Proyectores Lineales",
        "Proyectores LED lineales para fachadas"
      ),
    },
    {
      slug: "proyectores-gasolineras",
      parentId: l2.proyectores.id,
      content: createContent(
        "Canopy Lights",
        "LED lights for gas stations and canopies",
        "Proyectores Gasolineras",
        "Luminarias LED para gasolineras y marquesinas"
      ),
    },
    {
      slug: "focos-empotrables-jardin",
      parentId: l2.jardin.id,
      content: createContent(
        "Recessed Garden Spots",
        "Recessed ground spots for garden lighting",
        "Focos Empotrables",
        "Focos empotrables de suelo para jardín"
      ),
    },
    {
      slug: "focos-pincho-jardin",
      parentId: l2.jardin.id,
      content: createContent(
        "Spike Spotlights",
        "Adjustable spike-mounted spotlights",
        "Focos con Pincho",
        "Focos ajustables con pincho para jardín"
      ),
    },
    {
      slug: "balizas-led",
      parentId: l2.jardin.id,
      content: createContent(
        "LED Bollards",
        "Bollard path lights for gardens",
        "Baliza LED",
        "Balizas de iluminación para jardines"
      ),
    },
    {
      slug: "focos-piscina",
      parentId: l2.jardin.id,
      content: createContent(
        "Pool Lights",
        "Underwater LED lights for pools",
        "Focos para Piscina",
        "Luces LED subacuáticas para piscinas"
      ),
    },
    {
      slug: "apliques-pared-exterior",
      parentId: l2.jardin.id,
      content: createContent(
        "Outdoor Wall Lights",
        "Wall-mounted outdoor fixtures",
        "Apliques de Pared",
        "Luminarias de pared para exterior"
      ),
    },
    {
      slug: "plafones-exterior",
      parentId: l2.jardin.id,
      content: createContent(
        "Outdoor Ceiling Lights",
        "Surface-mounted outdoor ceiling lights",
        "Plafones de Exterior",
        "Plafones LED de superficie para exterior"
      ),
    },
    {
      slug: "alumbrado-publico",
      parentId: l2.alumbrado.id,
      content: createContent(
        "Street Lighting",
        "LED street and area lights",
        "Alumbrado Público",
        "Farolas LED para iluminación vial"
      ),
    },
    {
      slug: "iluminacion-solar",
      parentId: l2.alumbrado.id,
      content: createContent(
        "Solar Lighting",
        "Solar-powered street and area lights",
        "Iluminación Solar",
        "Alumbrado público y de áreas alimentado por energía solar"
      ),
    },
    {
      slug: "focos-monofasicos",
      parentId: l2.carril.id,
      content: createContent(
        "Single Phase Spots",
        "Single phase track spotlights",
        "Focos Monofásicos",
        "Focos de rail monofásico"
      ),
    },
    {
      slug: "focos-trifasicos",
      parentId: l2.carril.id,
      content: createContent(
        "Three Phase Spots",
        "Three phase track spotlights",
        "Focos Trifásicos",
        "Focos de rail trifásico"
      ),
    },
    {
      slug: "focos-magneticos",
      parentId: l2.carril.id,
      content: createContent(
        "Magnetic Track Spots",
        "Magnetic track system spotlights",
        "Focos Magnéticos",
        "Focos de rail magnético"
      ),
    },
    {
      slug: "poster-led",
      parentId: l2.publicidad.id,
      content: createContent(
        "LED Posters",
        "LED poster frames and displays",
        "Poster LED",
        "Marcos y displays LED para carteles"
      ),
    },
    {
      slug: "carteleria-led",
      parentId: l2.publicidad.id,
      content: createContent(
        "LED Signage",
        "LED displays and digital signage",
        "Cartelería LED",
        "Displays LED y señalización digital"
      ),
    },
    {
      slug: "iluminacion-acentuacion",
      parentId: l2.publicidad.id,
      content: createContent(
        "Accent Lighting",
        "Spotlights for product highlighting",
        "Iluminación Acentuación",
        "Focos para resaltado de productos"
      ),
    },
    {
      slug: "tiras-12v-24v",
      parentId: l2.tiras.id,
      content: createContent(
        "12V/24V LED Strips",
        "Low voltage flexible LED strips",
        "Tiras 12V/24V",
        "Tiras LED flexibles de baja tensión"
      ),
    },
    {
      slug: "tiras-220v",
      parentId: l2.tiras.id,
      content: createContent(
        "220V LED Strips",
        "High voltage LED strips for long runs",
        "Tiras 220V",
        "Tiras LED de alta tensión para tramos largos"
      ),
    },
    {
      slug: "accesorios-tiras",
      parentId: l2.tiras.id,
      content: createContent(
        "Strip Accessories",
        "Connectors, controllers, and mounting accessories",
        "Accesorios Tiras",
        "Conectores, controladores y accesorios de montaje"
      ),
    },
    {
      slug: "neon-12v-24v",
      parentId: l2.neon.id,
      content: createContent(
        "12V/24V Neon Flex",
        "Low voltage neon flex strips",
        "Neón 12V/24V",
        "Neón flex de baja tensión"
      ),
    },
    {
      slug: "neon-220v",
      parentId: l2.neon.id,
      content: createContent(
        "220V Neon Flex",
        "High voltage neon flex strips",
        "Neón 220V",
        "Neón flex de alta tensión"
      ),
    },
    {
      slug: "accesorios-neon",
      parentId: l2.neon.id,
      content: createContent(
        "Neon Accessories",
        "Power supplies and connectors for neon",
        "Accesorios Neón",
        "Fuentes y conectores para neón"
      ),
    },
    {
      slug: "perfiles-aluminio",
      parentId: l2.perfiles.id,
      content: createContent(
        "Aluminum Profiles",
        "Aluminum profiles and diffusers for LED strips",
        "Perfiles de Aluminio",
        "Perfiles de aluminio y difusores"
      ),
    },
    {
      slug: "fuentes-alimentacion",
      parentId: l2.perfiles.id,
      content: createContent(
        "Power Supplies",
        "LED drivers and power supplies",
        "Fuentes de Alimentación",
        "Drivers y fuentes de alimentación LED"
      ),
    },
    {
      slug: "ventiladores-techo",
      parentId: l2.lamparasTecho.id,
      content: createContent(
        "Ceiling Fans",
        "Ceiling fans with integrated lighting",
        "Ventiladores de Techo",
        "Ventiladores de techo con iluminación"
      ),
    },
    {
      slug: "lamparas-colgantes",
      parentId: l2.lamparasTecho.id,
      content: createContent(
        "Pendant Lights",
        "Hanging designer lamps",
        "Lámparas de Techo",
        "Lámparas colgantes de diseño"
      ),
    },
    {
      slug: "guirnaldas-led",
      parentId: l2.lamparasTecho.id,
      content: createContent(
        "LED String Lights",
        "Decorative LED string lights",
        "Guirnaldas LED",
        "Luces LED decorativas de cuerda"
      ),
    },
    {
      slug: "apliques-decorativos",
      parentId: l2.pared.id,
      content: createContent(
        "Wall Sconces",
        "Decorative wall-mounted fixtures",
        "Apliques Decorativos",
        "Luminarias decorativas de pared"
      ),
    },
    {
      slug: "espejos-led",
      parentId: l2.pared.id,
      content: createContent(
        "LED Mirrors",
        "Backlit and smart mirrors",
        "Espejos LED",
        "Espejos retroiluminados e inteligentes"
      ),
    },
    {
      slug: "lamparas-sobremesa",
      parentId: l2.pared.id,
      content: createContent(
        "Table Lamps",
        "Decorative table lamps",
        "Lámparas de Sobremesa",
        "Lámparas decorativas de sobremesa"
      ),
    },
    {
      slug: "mecanismos-electricos",
      parentId: l2.instalacion.id,
      content: createContent(
        "Electrical Switches",
        "Switches, sockets, and plates",
        "Mecanismos Eléctricos",
        "Interruptores, enchufes y placas"
      ),
    },
    {
      slug: "cable-electrico",
      parentId: l2.instalacion.id,
      content: createContent(
        "Electrical Cables",
        "Power cables and wiring",
        "Cable Eléctrico",
        "Cables de alimentación y cableado"
      ),
    },
    {
      slug: "conectores-y-fijaciones",
      parentId: l2.instalacion.id,
      content: createContent(
        "Connectors & Fixings",
        "Cable connectors and mounting hardware",
        "Conectores y Fijaciones",
        "Conectores de cable y herrajes de montaje"
      ),
    },
    {
      slug: "drivers-led",
      parentId: l2.control.id,
      content: createContent(
        "LED Drivers",
        "Dimmable and non-dimmable LED drivers",
        "Drivers",
        "Drivers LED regulables y no regulables"
      ),
    },
    {
      slug: "controladores-led",
      parentId: l2.control.id,
      content: createContent(
        "LED Controllers",
        "RGB controllers, dimmers, and receivers",
        "Controladores",
        "Controladores RGB, reguladores y receptores"
      ),
    },
    {
      slug: "detectores-presencia",
      parentId: l2.control.id,
      content: createContent(
        "Presence Sensors",
        "Motion sensors and twilight switches",
        "Detectores de Presencia",
        "Sensores de movimiento e interruptores crepusculares"
      ),
    },
    {
      slug: "kits-emergencia",
      parentId: l2.seguridad.id,
      content: createContent(
        "Emergency Kits",
        "Emergency lighting and exit signs",
        "Kits de Emergencia",
        "Iluminación de emergencia y señalización"
      ),
    },
    {
      slug: "extractores",
      parentId: l2.seguridad.id,
      content: createContent(
        "Extractors & Fans",
        "Ventilation fans for bathrooms and kitchens",
        "Extractores",
        "Ventiladores de extracción para baños y cocinas"
      ),
    },
    {
      slug: "linternas-y-soportes",
      parentId: l2.seguridad.id,
      content: createContent(
        "Torches & Mounts",
        "Work torches and mounting accessories",
        "Linternas y Soportes",
        "Linternas de trabajo y accesorios de montaje"
      ),
    },
    {
      slug: "soportes-proyectores",
      parentId: l2.seguridad.id,
      content: createContent(
        "Floodlight & Street Light Mounts",
        "Mounting brackets for floodlights and street lights",
        "Soportes para Proyectores y Farolas",
        "Soportes y brazos de montaje para proyectores y farolas"
      ),
    },
  ];

  await prisma.category.createMany({
    data: l3Data,
  });

  console.log("Created Level 3 categories");

  const productImageUrl =
    "https://images.slv.com/270x288/filters:focal(174x99:175x100)/f/113144/274x296/46af7b949e/slv_web_references_image-text-teaser_grid-4_274x297px_shopbeleuchtung.jpg";

  const leafCategories = await prisma.category.findMany({
    where: { children: { none: {} } },
    orderBy: { slug: "asc" },
  });

  const categoriesForProducts =
    leafCategories.length > 0
      ? leafCategories
      : await prisma.category.findMany({ orderBy: { slug: "asc" } });

  const brands = [
    "LEDME",
    "SLV",
    "Philips",
    "OSRAM",
    "GE Lighting",
    "TRILUX",
    "Zumtobel",
    "Acuity",
    "Cree",
    "Panasonic",
  ];

  const cctOptions = ["2700K", "3000K", "4000K", "5000K", "6000K", "6500K"];
  const beamAngles = [15, 24, 36, 60, 90, 120];
  const ipRatings = ["IP20", "IP44", "IP54", "IP65", "IP66", "IP67"];
  const materials = ["Aluminum", "PC", "Steel", "Glass", "ABS"];
  const finishes = ["White", "Black", "Silver", "Grey", "Gold"];

  function pick<T>(arr: T[]) {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  function pad(n: number, len: number) {
    return String(n).padStart(len, "0");
  }

  const baseProductCount = Math.max(categoriesForProducts.length * 3, 60);
  const productsToCreate = baseProductCount;

  for (let i = 0; i < productsToCreate; i++) {
    const category = categoriesForProducts[i % categoriesForProducts.length]!;
    const brand = pick(brands);

    const baseSku = `DEMO-${pad(i + 1, 5)}`;
    const slug = `demo-${category.slug}-${pad(i + 1, 5)}`;

    const ip = pick(ipRatings);
    const finish = pick(finishes);
    const material = pick(materials);

    const enName = `Demo ${brand} ${finish} LED Fixture ${pad(i + 1, 3)}`;
    const esName = `Demo ${brand} ${finish} Luminaria LED ${pad(i + 1, 3)}`;

    const enDesc = `Demo product for testing. Category: ${category.slug}. Finish: ${finish}. Material: ${material}. Rating: ${ip}.`;
    const esDesc = `Producto demo para pruebas. Categoría: ${category.slug}. Acabado: ${finish}. Material: ${material}. Protección: ${ip}.`;

    const variantCount = 1 + Math.floor(Math.random() * 3);
    const variants: Array<{
      sku: string;
      ean: string | null;
      price: number;
      b2bPrice: number | null;
      compareAtPrice: number | null;
      costPrice: number | null;
      physicalStock: number;
      allocatedStock: number;
      minStock: number;
      specs: Record<string, string | number | boolean | string[]>;
    }> = [];

    for (let v = 0; v < variantCount; v++) {
      const power = [6, 8, 10, 12, 15, 18, 20, 24, 30, 40, 50][
        Math.floor(Math.random() * 11)
      ]!;
      const lumens = Math.round(power * (90 + Math.random() * 30));
      const cct = pick(cctOptions);
      const dimmable = Math.random() > 0.4;
      const beam = pick(beamAngles);

      const price = Number((power * (2.5 + Math.random() * 1.8)).toFixed(2));
      const compareAtPrice =
        Math.random() > 0.65 ? Number((price * 1.15).toFixed(2)) : null;
      const costPrice = Number(
        (price * (0.55 + Math.random() * 0.1)).toFixed(2)
      );
      const b2bPrice = Number((price * 0.85).toFixed(2));
      const physicalStock = Math.floor(Math.random() * 120);

      variants.push({
        sku: `${baseSku}-${v + 1}`,
        ean: null,
        price,
        b2bPrice,
        compareAtPrice,
        costPrice,
        physicalStock,
        allocatedStock: 0,
        minStock: Math.floor(Math.random() * 10),
        specs: {
          power,
          lumens,
          cct,
          dimmable: dimmable ? "Yes" : "No",
          beamAngle: beam,
          cri: Math.random() > 0.7 ? 90 : 80,
        },
      });
    }

    const product = await prisma.product.create({
      data: {
        slug,
        sku: baseSku,
        type: "SIMPLE",
        brand,
        isActive: true,
        categoryId: category.id,
        supplierId: supplier.id,
        content: {
          ...createContent(enName, enDesc, esName, esDesc),
          specs: {
            ip_rating: ip,
            finish,
            material,
            warrantyYears: [2, 3, 5][Math.floor(Math.random() * 3)]!,
          },
          images: [productImageUrl],
        },
        variants: {
          create: variants.map((variant) => ({
            sku: variant.sku,
            ean: variant.ean,
            price: variant.price,
            b2bPrice: variant.b2bPrice,
            compareAtPrice: variant.compareAtPrice,
            costPrice: variant.costPrice,
            physicalStock: variant.physicalStock,
            allocatedStock: variant.allocatedStock,
            minStock: variant.minStock,
            specs: variant.specs as any,
          })),
        },
      },
    });

    const createdVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { id: true, physicalStock: true },
    });

    await prisma.inventoryTransaction.createMany({
      data: createdVariants
        .filter((v) => v.physicalStock > 0)
        .map((v) => ({
          variantId: v.id,
          quantity: v.physicalStock,
          type: "ADJUSTMENT",
          reference: "SEED_PRODUCTS",
          note: "Initial stock from seed",
        })),
    });
  }

  console.log(`Created ${productsToCreate} demo products`);
  const productCount = await prisma.product.count();
  const variantCount = await prisma.productVariant.count();
  console.log(
    `Database totals: ${productCount} products, ${variantCount} variants`
  );

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
