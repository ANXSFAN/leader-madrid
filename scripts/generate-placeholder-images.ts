/**
 * Generate professional SVG banner and category images for Leader Madrid
 * and upload them to Supabase Storage, then update DB records.
 *
 * Usage: npx tsx scripts/generate-placeholder-images.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BUCKET = "public-files";

// ============================================================
// SVG Generators
// ============================================================

function generateBannerSvg(opts: {
  title: string;
  theme: "dark" | "warm";
  accentColor: string;
  iconType: "bulb" | "handshake";
}): string {
  const { title, theme, accentColor, iconType } = opts;

  const bgColor = theme === "dark" ? "#0a0a0a" : "#1a0a14";
  const bgColor2 = theme === "dark" ? "#1a1a2e" : "#2d1025";

  // LED light beam rays
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30) + 15;
    const rad = (angle * Math.PI) / 180;
    const x2 = 1400 + Math.cos(rad) * 800;
    const y2 = 450 + Math.sin(rad) * 800;
    const opacity = 0.03 + (i % 3) * 0.02;
    return `<line x1="1400" y1="450" x2="${x2}" y2="${y2}" stroke="${accentColor}" stroke-width="2" opacity="${opacity}"/>`;
  }).join("\n");

  // Floating geometric shapes
  const shapes = [
    `<circle cx="1500" cy="300" r="120" fill="${accentColor}" opacity="0.08"/>`,
    `<circle cx="1300" cy="600" r="80" fill="${accentColor}" opacity="0.05"/>`,
    `<circle cx="1600" cy="500" r="60" fill="white" opacity="0.03"/>`,
    `<rect x="1100" y="200" width="150" height="150" rx="20" fill="${accentColor}" opacity="0.04" transform="rotate(30 1175 275)"/>`,
    `<rect x="1450" y="650" width="100" height="100" rx="15" fill="white" opacity="0.03" transform="rotate(45 1500 700)"/>`,
  ].join("\n");

  // Dot grid pattern
  const dots = Array.from({ length: 20 }, (_, row) =>
    Array.from({ length: 30 }, (_, col) => {
      const x = 900 + col * 35;
      const y = 100 + row * 40;
      if (x > 1920 || y > 900) return "";
      return `<circle cx="${x}" cy="${y}" r="1" fill="white" opacity="0.06"/>`;
    }).join("")
  ).join("\n");

  // Central glowing orb (LED light effect)
  const glow = `
    <defs>
      <radialGradient id="glow-${title}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.3"/>
        <stop offset="40%" stop-color="${accentColor}" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="1400" cy="400" r="350" fill="url(#glow-${title})"/>
  `;

  // LED icon or handshake icon
  const icon = iconType === "bulb" ? `
    <!-- Stylized LED bulb -->
    <g transform="translate(1350, 300)" opacity="0.15">
      <circle cx="50" cy="50" r="45" fill="none" stroke="${accentColor}" stroke-width="2"/>
      <circle cx="50" cy="50" r="30" fill="${accentColor}" opacity="0.3"/>
      <line x1="50" y1="95" x2="50" y2="130" stroke="${accentColor}" stroke-width="2"/>
      <line x1="35" y1="105" x2="65" y2="105" stroke="${accentColor}" stroke-width="2"/>
      <line x1="38" y1="115" x2="62" y2="115" stroke="${accentColor}" stroke-width="2"/>
      <line x1="41" y1="125" x2="59" y2="125" stroke="${accentColor}" stroke-width="2"/>
      <!-- Light rays -->
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const r = (a * Math.PI) / 180;
        return `<line x1="${50 + Math.cos(r) * 55}" y1="${50 + Math.sin(r) * 55}" x2="${50 + Math.cos(r) * 75}" y2="${50 + Math.sin(r) * 75}" stroke="${accentColor}" stroke-width="1.5"/>`;
      }).join("")}
    </g>
  ` : `
    <!-- Professional handshake / business icon -->
    <g transform="translate(1350, 300)" opacity="0.12">
      <circle cx="50" cy="50" r="45" fill="none" stroke="${accentColor}" stroke-width="2"/>
      <path d="M25,55 Q35,35 50,45 Q65,55 75,40" fill="none" stroke="${accentColor}" stroke-width="2.5"/>
      <circle cx="30" cy="50" r="8" fill="none" stroke="${accentColor}" stroke-width="1.5"/>
      <circle cx="70" cy="45" r="8" fill="none" stroke="${accentColor}" stroke-width="1.5"/>
    </g>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 900" width="1920" height="900">
  <defs>
    <linearGradient id="bg-${title}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="900" fill="url(#bg-${title})"/>
  ${glow}
  ${rays}
  ${shapes}
  ${dots}
  ${icon}
  <!-- Subtle bottom gradient -->
  <rect x="0" y="700" width="1920" height="200" fill="url(#bg-${title})" opacity="0.5"/>
  <!-- Accent line at top -->
  <rect x="0" y="0" width="1920" height="3" fill="${accentColor}" opacity="0.8"/>
</svg>`;
}

function generateCategorySvg(opts: {
  label: string;
  iconPaths: string;
  color1: string;
  color2: string;
}): string {
  const { label, iconPaths, color1, color2 } = opts;
  const id = label.replace(/\s/g, "-");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="catbg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
    <radialGradient id="catglow-${id}" cx="60%" cy="40%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#catbg-${id})"/>
  <rect width="800" height="600" fill="url(#catglow-${id})"/>
  <!-- Grid pattern -->
  ${Array.from({ length: 15 }, (_, r) =>
    Array.from({ length: 20 }, (_, c) =>
      `<circle cx="${c * 42 + 20}" cy="${r * 42 + 20}" r="0.8" fill="white" opacity="0.08"/>`
    ).join("")
  ).join("\n")}
  <!-- Icon -->
  <g transform="translate(300, 180) scale(2.5)" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.2">
    ${iconPaths}
  </g>
  <!-- Decorative shapes -->
  <circle cx="650" cy="150" r="80" fill="white" opacity="0.05"/>
  <circle cx="700" cy="450" r="50" fill="white" opacity="0.04"/>
  <rect x="100" y="420" width="80" height="80" rx="15" fill="white" opacity="0.03" transform="rotate(20 140 460)"/>
</svg>`;
}

// ============================================================
// Upload to Supabase
// ============================================================

async function uploadSvg(path: string, svg: string): Promise<string> {
  const buffer = Buffer.from(svg, "utf-8");
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/svg+xml",
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== 生成 Banner 和分类图片 ===\n");

  const ACCENT = "#e91e76";

  // --- Banner 1: LED Professional ---
  console.log("1. 生成 Banner: LED Professional...");
  const banner1Svg = generateBannerSvg({
    title: "led-pro",
    theme: "dark",
    accentColor: ACCENT,
    iconType: "bulb",
  });
  const banner1Url = await uploadSvg("banners/hero-led.svg", banner1Svg);
  console.log("   上传成功:", banner1Url);

  // --- Banner 2: B2B Program ---
  console.log("2. 生成 Banner: B2B Program...");
  const banner2Svg = generateBannerSvg({
    title: "b2b",
    theme: "warm",
    accentColor: ACCENT,
    iconType: "handshake",
  });
  const banner2Url = await uploadSvg("banners/hero-b2b.svg", banner2Svg);
  console.log("   上传成功:", banner2Url);

  // Update banner records
  console.log("3. 更新 Banner 数据库记录...");
  await prisma.banner.updateMany({
    where: { title: "Main Hero — LED Profesional" },
    data: { imageUrl: banner1Url },
  });
  await prisma.banner.updateMany({
    where: { title: "B2B Program Banner" },
    data: { imageUrl: banner2Url },
  });
  console.log("   Banner DB 已更新\n");

  // --- Category images ---
  const categoryImages: Record<string, { icon: string; c1: string; c2: string }> = {
    "iluminacion-tecnica": {
      // Downlight icon
      icon: `<circle cx="40" cy="20" r="15"/><line x1="40" y1="35" x2="40" y2="60"/><line x1="25" y1="60" x2="55" y2="60"/><line x1="30" y1="20" x2="20" y2="40"/><line x1="50" y1="20" x2="60" y2="40"/>`,
      c1: "#1a1a2e",
      c2: "#16213e",
    },
    "iluminacion-decorativa": {
      // Pendant lamp icon
      icon: `<line x1="40" y1="0" x2="40" y2="20"/><path d="M20,20 Q20,50 40,55 Q60,50 60,20Z"/><line x1="35" y1="55" x2="45" y2="55"/><line x1="37" y1="60" x2="43" y2="60"/>`,
      c1: "#2d1025",
      c2: "#1a0a14",
    },
    "iluminacion-exterior-industrial": {
      // Floodlight icon
      icon: `<rect x="25" y="15" width="30" height="25" rx="3"/><line x1="40" y1="40" x2="40" y2="65"/><line x1="25" y1="65" x2="55" y2="65"/><line x1="15" y1="28" x2="5" y2="20"/><line x1="65" y1="28" x2="75" y2="20"/><line x1="15" y1="22" x2="5" y2="10"/><line x1="65" y1="22" x2="75" y2="10"/>`,
      c1: "#0d1117",
      c2: "#161b22",
    },
    "componentes-accesorios": {
      // LED strip / connector icon
      icon: `<rect x="5" y="25" width="70" height="15" rx="3"/><circle cx="15" cy="32" r="4"/><circle cx="30" cy="32" r="4"/><circle cx="45" cy="32" r="4"/><circle cx="60" cy="32" r="4"/><line x1="0" y1="32" x2="5" y2="32"/><line x1="75" y1="32" x2="80" y2="32"/>`,
      c1: "#1a1a1a",
      c2: "#2a1a22",
    },
    // Sub-categories that also need images
    "downlight-paneles": {
      icon: `<rect x="15" y="10" width="50" height="5" rx="2"/><path d="M20,15 L25,50 L55,50 L60,15"/><line x1="35" y1="25" x2="45" y2="25"/><line x1="30" y1="35" x2="50" y2="35"/>`,
      c1: "#1a2030",
      c2: "#0f1520",
    },
    "focos-de-carril": {
      icon: `<line x1="10" y1="15" x2="70" y2="15"/><rect x="25" y="15" width="15" height="10" rx="2"/><path d="M27,25 L23,50 L42,50 L38,25"/><circle cx="32" cy="38" r="5"/>`,
      c1: "#1a1a28",
      c2: "#12121e",
    },
    "lamparas-de-techo": {
      icon: `<line x1="40" y1="5" x2="40" y2="15"/><ellipse cx="40" cy="25" rx="25" ry="10"/><path d="M15,25 Q15,55 40,60 Q65,55 65,25"/>`,
      c1: "#251020",
      c2: "#180a15",
    },
    "lamparas-pared-mesa": {
      icon: `<line x1="10" y1="10" x2="10" y2="60"/><path d="M10,20 L35,10 L35,30Z"/><rect x="50" y="35" width="20" height="25" rx="3"/><line x1="60" y1="35" x2="60" y2="25"/><path d="M50,25 Q60,15 70,25"/>`,
      c1: "#201520",
      c2: "#150f18",
    },
    exterior: {
      icon: `<line x1="40" y1="5" x2="40" y2="55"/><line x1="30" y1="55" x2="50" y2="55"/><circle cx="40" cy="15" r="10"/><line x1="30" y1="15" x2="15" y2="10"/><line x1="50" y1="15" x2="65" y2="10"/><line x1="30" y1="10" x2="20" y2="0"/><line x1="50" y1="10" x2="60" y2="0"/>`,
      c1: "#0d1520",
      c2: "#141e2a",
    },
    industrial: {
      icon: `<path d="M20,10 L15,45 L65,45 L60,10Z"/><line x1="20" y1="10" x2="60" y2="10"/><circle cx="40" cy="30" r="8"/><line x1="40" y1="45" x2="40" y2="60"/><line x1="30" y1="55" x2="50" y2="55"/>`,
      c1: "#111518",
      c2: "#1a1e22",
    },
    "fuentes-de-luz": {
      icon: `<circle cx="40" cy="25" r="18"/><line x1="40" y1="43" x2="40" y2="55"/><line x1="32" y1="48" x2="48" y2="48"/><line x1="34" y1="53" x2="46" y2="53"/><line x1="25" y1="10" x2="15" y2="0"/><line x1="55" y1="10" x2="65" y2="0"/><line x1="40" y1="7" x2="40" y2="0"/>`,
      c1: "#1a1520",
      c2: "#0f0a15",
    },
    alimentacion: {
      icon: `<rect x="15" y="15" width="50" height="35" rx="4"/><line x1="5" y1="30" x2="15" y2="30"/><line x1="5" y1="38" x2="15" y2="38"/><line x1="65" y1="25" x2="75" y2="25"/><line x1="65" y1="33" x2="75" y2="33"/><line x1="65" y1="41" x2="75" y2="41"/><text x="28" y="38" font-size="12" fill="white" opacity="0.5">DC</text>`,
      c1: "#151520",
      c2: "#0f0f18",
    },
    seguridad: {
      icon: `<path d="M40,10 L20,20 L20,40 Q20,55 40,60 Q60,55 60,40 L60,20Z"/><polyline points="30,35 38,43 52,28"/>`,
      c1: "#1a1520",
      c2: "#10101a",
    },
  };

  console.log("4. 生成并上传分类图片...");
  let catCount = 0;

  for (const [slug, config] of Object.entries(categoryImages)) {
    const svg = generateCategorySvg({
      label: slug,
      iconPaths: config.icon,
      color1: config.c1,
      color2: config.c2,
    });

    const path = `categories/${slug}.svg`;
    const url = await uploadSvg(path, svg);

    // Update category in DB
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (cat) {
      const content = (cat.content as Record<string, any>) || {};
      content.imageUrl = url;
      await prisma.category.update({
        where: { slug },
        data: { content },
      });
      catCount++;
      console.log(`   ✓ ${slug}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`Banner: 2 张已上传并更新`);
  console.log(`分类图片: ${catCount} 张已上传并更新`);

  // Verify
  const remaining = await prisma.category.findMany({
    where: { content: { path: ["imageUrl"], equals: undefined as any } },
  });
  // Alternative: count categories without imageUrl
  const allCats = await prisma.category.findMany({ select: { slug: true, content: true } });
  const noImg = allCats.filter(c => !(c.content as any)?.imageUrl);
  console.log(`\n还有 ${noImg.length} 个分类缺图片:`, noImg.map(c => c.slug).join(", "));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
