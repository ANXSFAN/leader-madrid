/**
 * LEDME Europa → My LED ERP 完整产品迁移脚本
 *
 * 用法:
 *   npx tsx scripts/migrate-ledme.ts --dry-run --limit=5     # 测试
 *   npx tsx scripts/migrate-ledme.ts --limit=20              # 迁移20个
 *   npx tsx scripts/migrate-ledme.ts                         # 全量迁移
 *   npx tsx scripts/migrate-ledme.ts --clean                 # 清空旧数据后迁移
 */

import axios, { AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as path from "path";
import * as crypto from "crypto";

// ==================== 配置 ====================

const CONFIG = {
  baseUrl: "https://ledme-europa.com/es",
  email: "khebang2012@hotmail.com",
  password: "khebang2012",
  supabaseBucket: "public-files",
  imageUploadPath: "products",
  docUploadPath: "product-documents",
  certUploadPath: "certificates",
  requestDelay: 600,
  maxRetries: 3,
  productsPerPage: 50,
};

// ==================== 西班牙语属性 → 英文Key 映射 ====================

const ATTRIBUTE_MAP: Record<string, {
  key: string;
  nameEn: string;
  nameEs: string;
  type: "SELECT" | "TEXT" | "NUMBER";
  unit?: string;
  scope: "PRODUCT" | "VARIANT";
}> = {
  "Vatios": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Potencia": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Potencia Máxima": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Fuente Lumínica": { key: "lightSource", nameEn: "Light Source", nameEs: "Fuente Lumínica", type: "SELECT", scope: "PRODUCT" },
  "Acabado": { key: "finish", nameEn: "Finish", nameEs: "Acabado", type: "SELECT", scope: "PRODUCT" },
  "Luminosidad": { key: "lumens", nameEn: "Luminous Flux", nameEs: "Luminosidad", type: "NUMBER", unit: "lm", scope: "VARIANT" },
  "Eficiencia Lm": { key: "luminousEfficiency", nameEn: "Luminous Efficiency", nameEs: "Eficiencia Luminosa", type: "NUMBER", unit: "lm/W", scope: "VARIANT" },
  "Temperatura De Trabajo": { key: "operatingTemp", nameEn: "Operating Temperature", nameEs: "Temperatura de Trabajo", type: "TEXT", scope: "PRODUCT" },
  "Ángulo": { key: "beamAngle", nameEn: "Beam Angle", nameEs: "Ángulo de Apertura", type: "SELECT", unit: "°", scope: "VARIANT" },
  "Ángulo de apertura": { key: "beamAngle", nameEn: "Beam Angle", nameEs: "Ángulo de Apertura", type: "SELECT", unit: "°", scope: "VARIANT" },
  "Vida Útil": { key: "lifespan", nameEn: "Lifespan", nameEs: "Vida Útil", type: "NUMBER", unit: "h", scope: "PRODUCT" },
  "Protección": { key: "ip", nameEn: "IP Rating", nameEs: "Protección IP", type: "SELECT", scope: "VARIANT" },
  "Clase Aislamiento Eléctrico": { key: "electricClass", nameEn: "Electric Class", nameEs: "Clase Eléctrica", type: "SELECT", scope: "PRODUCT" },
  "Alimentación": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Tensión de Entrada": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Dimensión": { key: "dimensions", nameEn: "Dimensions", nameEs: "Dimensiones", type: "TEXT", scope: "PRODUCT" },
  "Material": { key: "material", nameEn: "Material", nameEs: "Material", type: "SELECT", scope: "PRODUCT" },
  "Cri": { key: "cri", nameEn: "CRI", nameEs: "CRI", type: "SELECT", scope: "VARIANT" },
  "CRI": { key: "cri", nameEn: "CRI", nameEs: "CRI", type: "SELECT", scope: "VARIANT" },
  "Garantía": { key: "warranty", nameEn: "Warranty", nameEs: "Garantía", type: "SELECT", unit: "years", scope: "PRODUCT" },
  "Temperatura De Color": { key: "cct", nameEn: "Color Temperature", nameEs: "Temperatura de Color", type: "SELECT", unit: "K", scope: "VARIANT" },
  "Regulable": { key: "dimmable", nameEn: "Dimmable", nameEs: "Regulable", type: "SELECT", scope: "VARIANT" },
  "Casquillo": { key: "base", nameEn: "Base/Socket", nameEs: "Casquillo", type: "SELECT", scope: "PRODUCT" },
  "Socket": { key: "base", nameEn: "Base/Socket", nameEs: "Casquillo", type: "SELECT", scope: "PRODUCT" },
  "Peso": { key: "weight", nameEn: "Weight", nameEs: "Peso", type: "TEXT", unit: "kg", scope: "PRODUCT" },
  "Factor de Potencia": { key: "powerFactor", nameEn: "Power Factor", nameEs: "Factor de Potencia", type: "TEXT", scope: "PRODUCT" },
  "Frecuencia": { key: "frequency", nameEn: "Frequency", nameEs: "Frecuencia", type: "TEXT", unit: "Hz", scope: "PRODUCT" },
  "Color de la carcasa": { key: "housingColor", nameEn: "Housing Color", nameEs: "Color Carcasa", type: "SELECT", scope: "PRODUCT" },
  "Forma": { key: "shape", nameEn: "Shape", nameEs: "Forma", type: "SELECT", scope: "PRODUCT" },
  "Flujo luminoso": { key: "lumens", nameEn: "Luminous Flux", nameEs: "Luminosidad", type: "NUMBER", unit: "lm", scope: "VARIANT" },
  "Salida": { key: "output", nameEn: "Output", nameEs: "Salida", type: "TEXT", scope: "PRODUCT" },
  "Dimmable": { key: "dimmable", nameEn: "Dimmable", nameEs: "Regulable", type: "SELECT", scope: "VARIANT" },
  "Driver": { key: "driver", nameEn: "Driver", nameEs: "Driver", type: "TEXT", scope: "PRODUCT" },
  "Ik": { key: "ik", nameEn: "Impact Resistance", nameEs: "Resistencia al Impacto", type: "TEXT", scope: "PRODUCT" },
  "Proteccion Contra Sobretensión": { key: "surgeProtection", nameEn: "Surge Protection", nameEs: "Protección contra Sobretensión", type: "TEXT", scope: "PRODUCT" },
  "Incluye": { key: "includes", nameEn: "Includes", nameEs: "Incluye", type: "TEXT", scope: "PRODUCT" },
  "Color": { key: "color", nameEn: "Color", nameEs: "Color", type: "SELECT", scope: "VARIANT" },

  // --- 以下为 migrate-spec-keys.ts 迁移后补充的映射（防止重新爬取产生西班牙语 key）---

  // 合并重复 key 对应的原始西班牙语名
  "Tensión": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Potencia Luminaria": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Eff": { key: "luminousEfficiency", nameEn: "Luminous Efficiency", nameEs: "Eficiencia Luminosa", type: "NUMBER", unit: "lm/W", scope: "VARIANT" },

  // 之前未映射、被 fallback 为 snake_case 的属性
  "Instalación": { key: "installation", nameEn: "Installation", nameEs: "Instalación", type: "SELECT", scope: "PRODUCT" },
  "UGR": { key: "ugr", nameEn: "UGR", nameEs: "UGR", type: "TEXT", scope: "PRODUCT" },
  "Flicker Free": { key: "flickerFree", nameEn: "Flicker Free", nameEs: "Libre de Parpadeo", type: "SELECT", scope: "PRODUCT" },
  "Corte Cada": { key: "cutLength", nameEn: "Cut Length", nameEs: "Corte Cada", type: "TEXT", scope: "VARIANT" },
  "Intensidad De Corriente": { key: "current", nameEn: "Current", nameEs: "Intensidad de Corriente", type: "TEXT", unit: "mA", scope: "VARIANT" },
  "Intensidad de Corriente": { key: "current", nameEn: "Current", nameEs: "Intensidad de Corriente", type: "TEXT", unit: "mA", scope: "VARIANT" },
  "Dimensión De Corte": { key: "cutoutSize", nameEn: "Cutout Size", nameEs: "Dimensión de Corte", type: "TEXT", scope: "VARIANT" },
  "Dimensión de Corte": { key: "cutoutSize", nameEn: "Cutout Size", nameEs: "Dimensión de Corte", type: "TEXT", scope: "VARIANT" },
  "Protección Contra Sobrecalentamiento": { key: "overheatProtection", nameEn: "Overheat Protection", nameEs: "Protección contra Sobrecalentamiento", type: "SELECT", scope: "PRODUCT" },
  "Proteccion Contra Sobrecalentamiento": { key: "overheatProtection", nameEn: "Overheat Protection", nameEs: "Protección contra Sobrecalentamiento", type: "SELECT", scope: "PRODUCT" },
  "LED/m": { key: "ledPerMeter", nameEn: "LED/m", nameEs: "LED/m", type: "NUMBER", scope: "VARIANT" },
  "Led/M": { key: "ledPerMeter", nameEn: "LED/m", nameEs: "LED/m", type: "NUMBER", scope: "VARIANT" },
  "ULR": { key: "ulr", nameEn: "ULR", nameEs: "ULR", type: "TEXT", scope: "PRODUCT" },
  "Protección De Sobrecarga": { key: "overloadProtection", nameEn: "Overload Protection", nameEs: "Protección de Sobrecarga", type: "SELECT", scope: "PRODUCT" },
  "Protección de Sobrecarga": { key: "overloadProtection", nameEn: "Overload Protection", nameEs: "Protección de Sobrecarga", type: "SELECT", scope: "PRODUCT" },
  "Protección Contra Cortocircuito": { key: "shortCircuitProtection", nameEn: "Short Circuit Protection", nameEs: "Protección contra Cortocircuito", type: "SELECT", scope: "PRODUCT" },
  "Proteccion Contra Cortocircuito": { key: "shortCircuitProtection", nameEn: "Short Circuit Protection", nameEs: "Protección contra Cortocircuito", type: "SELECT", scope: "PRODUCT" },
  "Fuente Lumínica Reemplazable": { key: "replaceableLightSource", nameEn: "Replaceable Light Source", nameEs: "Fuente Lumínica Reemplazable", type: "SELECT", scope: "PRODUCT" },
  "Máx. Enlazable": { key: "maxChainable", nameEn: "Max Chainable", nameEs: "Máx. Enlazable", type: "TEXT", scope: "PRODUCT" },
  "Driver Reemplazable": { key: "replaceableDriver", nameEn: "Replaceable Driver", nameEs: "Driver Reemplazable", type: "SELECT", scope: "PRODUCT" },
  "Batería": { key: "battery", nameEn: "Battery", nameEs: "Batería", type: "TEXT", scope: "PRODUCT" },
  "Tiempo De Carga": { key: "chargeTime", nameEn: "Charge Time", nameEs: "Tiempo de Carga", type: "TEXT", scope: "PRODUCT" },
  "Tiempo de Carga": { key: "chargeTime", nameEn: "Charge Time", nameEs: "Tiempo de Carga", type: "TEXT", scope: "PRODUCT" },
  "Tiempo De Uso": { key: "usageTime", nameEn: "Usage Time", nameEs: "Tiempo de Uso", type: "TEXT", scope: "PRODUCT" },
  "Tiempo de Uso": { key: "usageTime", nameEn: "Usage Time", nameEs: "Tiempo de Uso", type: "TEXT", scope: "PRODUCT" },
  "Diámetro De Fijación": { key: "mountingDiameter", nameEn: "Mounting Diameter", nameEs: "Diámetro de Fijación", type: "TEXT", scope: "VARIANT" },
  "Diámetro de Fijación": { key: "mountingDiameter", nameEn: "Mounting Diameter", nameEs: "Diámetro de Fijación", type: "TEXT", scope: "VARIANT" },
  "Distancia De Detección": { key: "detectionRange", nameEn: "Detection Range", nameEs: "Distancia de Detección", type: "TEXT", scope: "PRODUCT" },
  "Distancia de Detección": { key: "detectionRange", nameEn: "Detection Range", nameEs: "Distancia de Detección", type: "TEXT", scope: "PRODUCT" },
  "Sensor": { key: "sensor", nameEn: "Sensor", nameEs: "Sensor", type: "SELECT", scope: "PRODUCT" },
  "Longitud De Onda": { key: "wavelength", nameEn: "Wavelength", nameEs: "Longitud de Onda", type: "TEXT", unit: "nm", scope: "VARIANT" },
  "Longitud de Onda": { key: "wavelength", nameEn: "Wavelength", nameEs: "Longitud de Onda", type: "TEXT", unit: "nm", scope: "VARIANT" },
  "Ángulo De Detección": { key: "detectionAngle", nameEn: "Detection Angle", nameEs: "Ángulo de Detección", type: "TEXT", unit: "°", scope: "PRODUCT" },
  "Ángulo de Detección": { key: "detectionAngle", nameEn: "Detection Angle", nameEs: "Ángulo de Detección", type: "TEXT", unit: "°", scope: "PRODUCT" },
  "Tiempo Mín. - Tiempo Máx.": { key: "timeRange", nameEn: "Time Range", nameEs: "Rango de Tiempo", type: "TEXT", scope: "PRODUCT" },
  "Potencia De Panel Solar": { key: "solarPanelPower", nameEn: "Solar Panel Power", nameEs: "Potencia de Panel Solar", type: "TEXT", unit: "W", scope: "PRODUCT" },
  "Potencia de Panel Solar": { key: "solarPanelPower", nameEn: "Solar Panel Power", nameEs: "Potencia de Panel Solar", type: "TEXT", unit: "W", scope: "PRODUCT" },
  "Regulación De Tiempo": { key: "timeAdjustment", nameEn: "Time Adjustment", nameEs: "Regulación de Tiempo", type: "TEXT", scope: "PRODUCT" },
  "Regulación de Tiempo": { key: "timeAdjustment", nameEn: "Time Adjustment", nameEs: "Regulación de Tiempo", type: "TEXT", scope: "PRODUCT" },
  "Resistente Contra Rayos UV": { key: "uvResistant", nameEn: "UV Resistant", nameEs: "Resistente contra Rayos UV", type: "SELECT", scope: "PRODUCT" },
  "Receptor": { key: "receiver", nameEn: "Receiver", nameEs: "Receptor", type: "TEXT", scope: "PRODUCT" },
  "Ruido": { key: "noise", nameEn: "Noise", nameEs: "Ruido", type: "TEXT", unit: "dB", scope: "PRODUCT" },
  "RPM": { key: "rpm", nameEn: "RPM", nameEs: "RPM", type: "NUMBER", scope: "PRODUCT" },
  "Rpm": { key: "rpm", nameEn: "RPM", nameEs: "RPM", type: "NUMBER", scope: "PRODUCT" },
  "Motor": { key: "motor", nameEn: "Motor", nameEs: "Motor", type: "TEXT", scope: "PRODUCT" },
  "Airflow": { key: "airflow", nameEn: "Airflow", nameEs: "Caudal de Aire", type: "TEXT", scope: "PRODUCT" },
  "Longitud Del Cable": { key: "cableLength", nameEn: "Cable Length", nameEs: "Longitud del Cable", type: "TEXT", scope: "PRODUCT" },
  "Longitud del Cable": { key: "cableLength", nameEn: "Cable Length", nameEs: "Longitud del Cable", type: "TEXT", scope: "PRODUCT" },
  "Control De Aire": { key: "airControl", nameEn: "Air Control", nameEs: "Control de Aire", type: "TEXT", scope: "PRODUCT" },
  "Control de Aire": { key: "airControl", nameEn: "Air Control", nameEs: "Control de Aire", type: "TEXT", scope: "PRODUCT" },
  "Potencia Máx. Motor": { key: "maxMotorPower", nameEn: "Max Motor Power", nameEs: "Potencia Máx. Motor", type: "TEXT", unit: "W", scope: "PRODUCT" },
  "Temporizador": { key: "timer", nameEn: "Timer", nameEs: "Temporizador", type: "SELECT", scope: "PRODUCT" },
  "Nº De Canales": { key: "channels", nameEn: "Channels", nameEs: "Nº de Canales", type: "NUMBER", scope: "PRODUCT" },
  "Nº de Canales": { key: "channels", nameEn: "Channels", nameEs: "Nº de Canales", type: "NUMBER", scope: "PRODUCT" },
  "Nº De Páginas": { key: "pages", nameEn: "Pages", nameEs: "Nº de Páginas", type: "NUMBER", scope: "PRODUCT" },
  "Nº de Páginas": { key: "pages", nameEn: "Pages", nameEs: "Nº de Páginas", type: "NUMBER", scope: "PRODUCT" },
  "Sección Del Cable": { key: "cableSection", nameEn: "Cable Section", nameEs: "Sección del Cable", type: "TEXT", scope: "PRODUCT" },
  "Sección del Cable": { key: "cableSection", nameEn: "Cable Section", nameEs: "Sección del Cable", type: "TEXT", scope: "PRODUCT" },
  "Encendido De Nivel De Luz": { key: "lightLevelActivation", nameEn: "Light Level Activation", nameEs: "Encendido de Nivel de Luz", type: "TEXT", scope: "PRODUCT" },
  "Encendido de Nivel de Luz": { key: "lightLevelActivation", nameEn: "Light Level Activation", nameEs: "Encendido de Nivel de Luz", type: "TEXT", scope: "PRODUCT" },
  "Caudal": { key: "flowRate", nameEn: "Flow Rate", nameEs: "Caudal", type: "TEXT", scope: "PRODUCT" },
  "Cantidad De Luminarias A Conectar": { key: "maxConnectableLuminaires", nameEn: "Max Connectable Luminaires", nameEs: "Cantidad de Luminarias a Conectar", type: "NUMBER", scope: "PRODUCT" },
  "Cantidad de Luminarias a Conectar": { key: "maxConnectableLuminaires", nameEn: "Max Connectable Luminaires", nameEs: "Cantidad de Luminarias a Conectar", type: "NUMBER", scope: "PRODUCT" },
  "Software": { key: "software", nameEn: "Software", nameEs: "Software", type: "TEXT", scope: "PRODUCT" },
  "Memoria": { key: "memory", nameEn: "Memory", nameEs: "Memoria", type: "TEXT", scope: "PRODUCT" },
  "Sistema": { key: "system", nameEn: "System", nameEs: "Sistema", type: "TEXT", scope: "PRODUCT" },
  "Alcance Visual Nocturno": { key: "nightVisionRange", nameEn: "Night Vision Range", nameEs: "Alcance Visual Nocturno", type: "TEXT", scope: "PRODUCT" },
  "Resolución De La Camara": { key: "cameraResolution", nameEn: "Camera Resolution", nameEs: "Resolución de la Cámara", type: "TEXT", scope: "PRODUCT" },
  "Resolución de la Camara": { key: "cameraResolution", nameEn: "Camera Resolution", nameEs: "Resolución de la Cámara", type: "TEXT", scope: "PRODUCT" },
  "Resolución De La Cámara": { key: "cameraResolution", nameEn: "Camera Resolution", nameEs: "Resolución de la Cámara", type: "TEXT", scope: "PRODUCT" },
  "Luminosidad Grow (PPF)": { key: "ppf", nameEn: "PPF", nameEs: "PPF", type: "NUMBER", unit: "µmol/s", scope: "VARIANT" },
  "Autonomia": { key: "autonomy", nameEn: "Autonomy", nameEs: "Autonomía", type: "TEXT", scope: "PRODUCT" },
  "Autonomía": { key: "autonomy", nameEn: "Autonomy", nameEs: "Autonomía", type: "TEXT", scope: "PRODUCT" },
  "Extensión": { key: "extension", nameEn: "Extension", nameEs: "Extensión", type: "TEXT", scope: "PRODUCT" },
  "Extension": { key: "extension", nameEn: "Extension", nameEs: "Extensión", type: "TEXT", scope: "PRODUCT" },
  "Peso Máximo": { key: "maxWeight", nameEn: "Max Weight", nameEs: "Peso Máximo", type: "TEXT", unit: "kg", scope: "PRODUCT" },
  "Corriente De Salida": { key: "outputCurrent", nameEn: "Output Current", nameEs: "Corriente de Salida", type: "TEXT", unit: "mA", scope: "PRODUCT" },
  "Corriente de Salida": { key: "outputCurrent", nameEn: "Output Current", nameEs: "Corriente de Salida", type: "TEXT", unit: "mA", scope: "PRODUCT" },
  "Corriente De Entrada": { key: "inputCurrent", nameEn: "Input Current", nameEs: "Corriente de Entrada", type: "TEXT", unit: "A", scope: "PRODUCT" },
  "Corriente de Entrada": { key: "inputCurrent", nameEn: "Input Current", nameEs: "Corriente de Entrada", type: "TEXT", unit: "A", scope: "PRODUCT" },
  "Señal De Atenuación De Salida": { key: "outputDimmingSignal", nameEn: "Output Dimming Signal", nameEs: "Señal de Atenuación de Salida", type: "TEXT", scope: "PRODUCT" },
  "Señal de Atenuación de Salida": { key: "outputDimmingSignal", nameEn: "Output Dimming Signal", nameEs: "Señal de Atenuación de Salida", type: "TEXT", scope: "PRODUCT" },
  "Corriente De La Fuente De Salida": { key: "outputSourceCurrent", nameEn: "Output Source Current", nameEs: "Corriente de la Fuente de Salida", type: "TEXT", unit: "mA", scope: "PRODUCT" },
  "Corriente de la Fuente de Salida": { key: "outputSourceCurrent", nameEn: "Output Source Current", nameEs: "Corriente de la Fuente de Salida", type: "TEXT", unit: "mA", scope: "PRODUCT" },
  "Señal De Atenuación De Entrada": { key: "inputDimmingSignal", nameEn: "Input Dimming Signal", nameEs: "Señal de Atenuación de Entrada", type: "TEXT", scope: "PRODUCT" },
  "Señal de Atenuación de Entrada": { key: "inputDimmingSignal", nameEn: "Input Dimming Signal", nameEs: "Señal de Atenuación de Entrada", type: "TEXT", scope: "PRODUCT" },
  "Diametro De Salida": { key: "outletDiameter", nameEn: "Outlet Diameter", nameEs: "Diámetro de Salida", type: "TEXT", scope: "PRODUCT" },
  "Diametro de Salida": { key: "outletDiameter", nameEn: "Outlet Diameter", nameEs: "Diámetro de Salida", type: "TEXT", scope: "PRODUCT" },
  "Diámetro De Salida": { key: "outletDiameter", nameEn: "Outlet Diameter", nameEs: "Diámetro de Salida", type: "TEXT", scope: "PRODUCT" },
};

// 构建大小写不敏感查找表（兜底，防止网站属性名大小写变化）
const ATTRIBUTE_MAP_CI = new Map<string, typeof ATTRIBUTE_MAP[string]>();
for (const [key, value] of Object.entries(ATTRIBUTE_MAP)) {
  const lower = key.toLowerCase();
  if (!ATTRIBUTE_MAP_CI.has(lower)) {
    ATTRIBUTE_MAP_CI.set(lower, value);
  }
}

// ==================== 类型 ====================

interface LedmeApiProduct {
  product_id: string;
  sku: string;
  ean?: string;
  name: string;
  manufacturer: string;
  thumb: string;
  image: string;
  price: string | false;
  special: string | false;
  quantity: string;
  href: string;
  garantia: { text: string } | string;
  description?: string;
}

interface ScrapedVariant {
  productId: string;
  sku: string;
  ref: string;
  ean: string;
  price: number;
  specialPrice?: number;
  stock: number;
  image: string;
  name: string;      // e.g. "6000K"
  unitsPerBox?: number;
}

interface ScrapedProduct {
  apiData: LedmeApiProduct;
  name: string;
  sku: string;
  brand: string;
  description: string;
  specs: Record<string, string>;
  images: string[];
  variants: ScrapedVariant[];
  pdfUrl?: string;
  certificates: { name: string; imageUrl: string }[];
  categoryPath: string[];
  price: number;
  specialPrice?: number;
  stock: number;
}

// ==================== 工具函数 ====================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 120);
}

function parsePrice(priceStr: string | false): number {
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[€$\s]/g, "").replace(",", ".").replace(/[A-Z]+/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function log(level: "INFO" | "WARN" | "ERROR" | "OK", msg: string) {
  const icons = { INFO: "ℹ", WARN: "⚠", ERROR: "✗", OK: "✓" };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[level]} ${msg}`);
}

// ==================== 爬虫 ====================

class LedmeScraper {
  private client: AxiosInstance;
  private cookies = "";

  constructor() {
    this.client = axios.create({
      baseURL: CONFIG.baseUrl,
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      maxRedirects: 5,
    });

    this.client.interceptors.response.use(resp => {
      const sc = resp.headers["set-cookie"];
      if (sc) {
        const existing = this.parseCookies(this.cookies);
        const incoming = this.parseCookies(sc.map((c: string) => c.split(";")[0]).join("; "));
        Object.assign(existing, incoming);
        this.cookies = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join("; ");
      }
      return resp;
    });

    this.client.interceptors.request.use(cfg => {
      if (this.cookies) cfg.headers["Cookie"] = this.cookies;
      return cfg;
    });
  }

  private parseCookies(s: string): Record<string, string> {
    const r: Record<string, string> = {};
    if (!s) return r;
    s.split(";").forEach(p => { const [k, ...v] = p.trim().split("="); if (k) r[k.trim()] = v.join("=").trim(); });
    return r;
  }

  async login(): Promise<boolean> {
    log("INFO", "登录 ledme-europa.com ...");
    try {
      // 1. 获取登录页面（拿cookie）
      await this.client.get("/index.php?route=account/login");

      // 2. 提交登录
      const form = new URLSearchParams();
      form.append("email", CONFIG.email);
      form.append("password", CONFIG.password);
      const resp = await this.client.post("/index.php?route=account/login", form.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": `${CONFIG.baseUrl}/index.php?route=account/login`,
        },
        maxRedirects: 5,
      });
      if (resp.data.includes("account/logout") || resp.data.includes("Mi Cuenta")) {
        log("OK", "登录成功");
        return true;
      }

      // 3. 验证登录（访问账户页面）
      const accountResp = await this.client.get("/index.php?route=account/account");
      if (accountResp.data.includes("account/logout")) {
        log("OK", "登录成功");
        return true;
      }
    } catch (e: any) {
      // 302 redirect 说明登录成功
      if (e.response?.status === 302 || e.response?.status === 301) {
        log("OK", "登录成功 (redirect)");
        return true;
      }
    }
    log("WARN", "登录状态不确定，继续执行...");
    return false;
  }

  async fetchProductList(maxProducts: number = 0): Promise<LedmeApiProduct[]> {
    const all: LedmeApiProduct[] = [];
    let page = 1;
    log("INFO", "获取产品列表...");

    while (true) {
      try {
        const resp = await this.client.get(
          `/index.php?route=product/category/getJSONProducts&path=17&limit=${CONFIG.productsPerPage}&page=${page}`,
          { headers: { "X-Requested-With": "XMLHttpRequest" } }
        );
        const data = resp.data;
        if (!data?.products) break;
        if (page === 1) {
          const total = parseInt(data.info?.number_of_items || "0");
          log("INFO", `共 ${total} 个产品${maxProducts > 0 ? `, 将获取 ${maxProducts} 个` : ""}`);
        }
        all.push(...data.products);
        if (maxProducts > 0 && all.length >= maxProducts) { all.length = maxProducts; break; }
        if (data.products.length < CONFIG.productsPerPage) break;
        page++;
        await delay(CONFIG.requestDelay);
      } catch { break; }
    }

    log("OK", `获取 ${all.length} 个产品`);
    return all;
  }

  async scrapeProductDetail(apiProduct: LedmeApiProduct): Promise<ScrapedProduct | null> {
    try {
      const url = apiProduct.href || `${CONFIG.baseUrl}/${slugify(apiProduct.name)}`;
      const resp = await this.client.get(url);
      const $ = cheerio.load(resp.data);
      const html = resp.data as string;

      // 基本信息
      const name = $("h1").first().text().trim() || apiProduct.name;
      const sku = $("#product_sku").text().trim() || apiProduct.sku;

      // 品牌 (从规格表)
      let brand = "";

      // 描述
      const description = $("#tab-description .product-description").html()?.trim()
        || $("#tab-description").html()?.trim() || "";

      // ===== 规格表 =====
      const specs: Record<string, string> = {};
      $("table.tabla_atributos tr, .tabla_atributos tr").each((_, el) => {
        const label = $(el).find("td.darker b").text().trim();
        const value = $(el).find("td").last().text().trim();
        if (label && value && label !== value) {
          specs[label] = value;
        }
      });
      if (specs["Marca"]) { brand = specs["Marca"]; delete specs["Marca"]; }
      if (!brand) brand = apiProduct.manufacturer || "LEDME";

      // ===== 图片 (#gallery img) =====
      const images: string[] = [];
      $("#gallery img").each((_, el) => {
        const src = $(el).attr("src");
        if (src && src.includes("catalogIM")) images.push(src);
      });
      // fallback: API image
      if (images.length === 0 && apiProduct.image) {
        images.push(apiProduct.image.startsWith("http") ? apiProduct.image : `${CONFIG.baseUrl}/${apiProduct.image}`);
      }

      // ===== 变体 (.product_child) =====
      const variants: ScrapedVariant[] = [];
      $(".product_child").each((_, el) => {
        const $el = $(el);
        const vPrice = parsePrice($el.attr("data-price") || "");
        const vSpecial = parsePrice($el.attr("data-special") || "");
        variants.push({
          productId: $el.attr("data-id") || "",
          sku: $el.attr("data-psku") || "",
          ref: $el.attr("data-ref") || "",
          ean: $el.attr("data-pean") || "",
          price: vSpecial > 0 ? vSpecial : vPrice,
          specialPrice: vSpecial > 0 ? vPrice : undefined,
          stock: parseInt($el.attr("data-qty") || "0"),
          image: $el.attr("data-img") || "",
          name: $el.attr("data-nombre-e") || "",
          unitsPerBox: parseInt($el.attr("data-uds_box") || "0") || undefined,
        });
      });

      // ===== PDF 文档 =====
      let pdfUrl: string | undefined;
      const pdfMatch = html.match(/gotoFichaProduct\((\d+)\)/);
      if (pdfMatch) {
        pdfUrl = `${CONFIG.baseUrl}/index.php?route=yub/fichaTecnica&pid=${pdfMatch[1]}`;
      }

      // ===== 证书图片 (#tab-certificados) =====
      const certificates: { name: string; imageUrl: string }[] = [];
      $("#tab-certificados img, .product_certificados img").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        const fullUrl = src.startsWith("http") ? src : `${CONFIG.baseUrl}/${src.replace(/^\/es\//, "")}`;
        const cls = $(el).attr("class") || "";
        let certName = "Certificate";
        if (fullUrl.includes("CE")) certName = "CE";
        else if (fullUrl.includes("RoHS")) certName = "RoHS";
        else if (fullUrl.includes("eprel") || fullUrl.includes("eti-")) certName = "Energy Label";
        else if (fullUrl.includes("garantia")) certName = `Warranty`;
        if (!cls.includes("garantia")) { // 保修徽章单独处理
          certificates.push({ name: certName, imageUrl: fullUrl });
        }
      });

      // ===== 分类 (面包屑) =====
      const categoryPath: string[] = [];
      $(".breadcrumb a, .breadcrumbs a, .breadcrumb li a").each((_, el) => {
        const text = $(el).text().trim();
        if (text && text !== "Home" && text !== "Inicio" && text !== name) {
          categoryPath.push(text);
        }
      });

      // 价格 (API优先)
      const apiPrice = parsePrice(apiProduct.price);
      const apiSpecial = parsePrice(apiProduct.special);

      return {
        apiData: apiProduct,
        name,
        sku,
        brand,
        description,
        specs,
        images,
        variants,
        pdfUrl,
        certificates,
        categoryPath,
        price: apiSpecial > 0 ? apiSpecial : apiPrice,
        specialPrice: apiSpecial > 0 ? apiPrice : undefined,
        stock: parseInt(apiProduct.quantity) || 0,
      };
    } catch (e: any) {
      log("ERROR", `获取详情失败 (${apiProduct.name}): ${e.message}`);
      return null;
    }
  }
}

// ==================== 数据库操作 ====================

class ProductMigrator {
  private prisma: PrismaClient;
  private supabase: SupabaseClient;
  private categoryCache = new Map<string, string>();
  private attributeCache = new Map<string, string>(); // key -> id
  private optionCache = new Map<string, string>();     // key:value -> optionId

  constructor() {
    this.prisma = new PrismaClient({
      datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
    });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async cleanup() { await this.prisma.$disconnect(); }

  // ===== 清空 Supabase Storage 文件夹 =====
  async cleanStorageFolder(folder: string) {
    log("INFO", `清空 Storage: ${folder}/...`);
    let total = 0;
    while (true) {
      const { data: files, error } = await this.supabase.storage
        .from(CONFIG.supabaseBucket)
        .list(folder, { limit: 1000 });
      if (error) { log("WARN", `列出 ${folder} 失败: ${error.message}`); break; }
      if (!files || files.length === 0) break;
      const paths = files.map(f => `${folder}/${f.name}`);
      const { error: delErr } = await this.supabase.storage
        .from(CONFIG.supabaseBucket)
        .remove(paths);
      if (delErr) { log("WARN", `删除 ${folder} 失败: ${delErr.message}`); break; }
      total += paths.length;
      log("INFO", `  已删除 ${total} 个文件...`);
    }
    log("OK", `Storage ${folder}/ 清空完毕 (${total} 个文件)`);
  }

  // ===== 清空旧数据 =====
  async cleanOldData() {
    log("INFO", "清空旧的产品和分类数据...");
    // 清空 Storage 文件
    await this.cleanStorageFolder(CONFIG.imageUploadPath);
    await this.cleanStorageFolder(CONFIG.docUploadPath);
    await this.cleanStorageFolder(CONFIG.certUploadPath);
    // 按依赖顺序删除 (所有引用 productVariant 的表必须先删)
    await this.prisma.productDocument.deleteMany();
    await this.prisma.cartItem.deleteMany();
    await this.prisma.returnItem.deleteMany();
    await this.prisma.orderItem.deleteMany();
    await this.prisma.salesOrderItem.deleteMany();
    await this.prisma.purchaseOrderItem.deleteMany();
    await this.prisma.bundleItem.deleteMany();
    await this.prisma.priceListRule.deleteMany();
    await this.prisma.wishlistItem.deleteMany();
    await this.prisma.productSupplier.deleteMany();
    await this.prisma.inventoryTransaction.deleteMany();
    await this.prisma.productVariant.deleteMany();
    await this.prisma.product.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.attributeOption.deleteMany();
    await this.prisma.attributeDefinition.deleteMany();
    log("OK", "旧数据已清空");
  }

  // ===== 根据源URL生成稳定的文件名 =====
  private stableFileName(fileUrl: string, uploadPath: string): string {
    const hash = crypto.createHash("md5").update(fileUrl).digest("hex").slice(0, 12);
    const ext = path.extname(new URL(fileUrl).pathname) || ".jpg";
    return `${uploadPath}/${hash}${ext}`;
  }

  // ===== 上传文件到Supabase（已存在则跳过） =====
  async uploadFile(fileUrl: string, uploadPath: string): Promise<string | null> {
    // 先用稳定文件名检查是否已存在
    const stableName = this.stableFileName(fileUrl, uploadPath);
    const { data: existing } = await this.supabase.storage
      .from(CONFIG.supabaseBucket)
      .list(uploadPath, { search: stableName.split("/").pop()! });

    if (existing && existing.length > 0) {
      const { data: urlData } = this.supabase.storage.from(CONFIG.supabaseBucket).getPublicUrl(stableName);
      log("INFO", `跳过已存在: ${stableName.split("/").pop()}`);
      return urlData.publicUrl;
    }

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const response = await axios.get(fileUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const buffer = Buffer.from(response.data);
        const contentType = response.headers["content-type"] || "application/octet-stream";

        const { data, error } = await this.supabase.storage
          .from(CONFIG.supabaseBucket)
          .upload(stableName, buffer, { contentType, upsert: false });

        if (error) throw new Error(error.message);
        const { data: urlData } = this.supabase.storage.from(CONFIG.supabaseBucket).getPublicUrl(data.path);
        return urlData.publicUrl;
      } catch (e: any) {
        if (attempt === CONFIG.maxRetries) { log("WARN", `上传失败: ${fileUrl.substring(0, 80)}`); return null; }
        await delay(2000 * attempt);
      }
    }
    return null;
  }

  // ===== 创建属性定义（只创建key，不创建option value，走自定义值） =====
  async ensureAttributes() {
    log("INFO", "创建属性定义...");
    const processedKeys = new Set<string>();
    for (const [rawKey, mapping] of Object.entries(ATTRIBUTE_MAP)) {
      if (processedKeys.has(mapping.key)) continue;
      processedKeys.add(mapping.key);

      let attrDef = await this.prisma.attributeDefinition.findUnique({
        where: { key: mapping.key },
      });

      if (!attrDef) {
        attrDef = await this.prisma.attributeDefinition.create({
          data: {
            key: mapping.key,
            name: { en: mapping.nameEn, es: mapping.nameEs },
            type: mapping.type,
            unit: mapping.unit || null,
            scope: mapping.scope,
          },
        });
      }
      this.attributeCache.set(mapping.key, attrDef.id);
    }

    log("OK", `创建了 ${processedKeys.size} 个属性定义`);
  }

  // ===== 获取或创建分类 =====
  async getOrCreateCategory(name: string, parentId?: string): Promise<string> {
    const cacheKey = `${parentId || "root"}:${name}`;
    if (this.categoryCache.has(cacheKey)) return this.categoryCache.get(cacheKey)!;

    const slug = slugify(name);

    // 先按slug查找
    let cat = await this.prisma.category.findUnique({ where: { slug } });
    if (!cat) {
      cat = await this.prisma.category.create({
        data: {
          slug,
          content: {
            es: { name, description: "" },
            en: { name, description: "" },
          },
          parentId: parentId || null,
        },
      });
    }

    this.categoryCache.set(cacheKey, cat.id);
    return cat.id;
  }

  async buildCategoryHierarchy(parts: string[]): Promise<string | null> {
    if (parts.length === 0) return null;
    let parentId: string | undefined;
    for (const part of parts) {
      parentId = await this.getOrCreateCategory(part, parentId);
    }
    return parentId || null;
  }

  // ===== 映射规格到 variant specs =====
  mapSpecsToVariant(rawSpecs: Record<string, string>): Record<string, string> {
    const mapped: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(rawSpecs)) {
      // 精确匹配优先，再尝试大小写不敏感查找
      const mapping = ATTRIBUTE_MAP[rawKey] || ATTRIBUTE_MAP_CI.get(rawKey.toLowerCase());
      if (mapping) {
        mapped[mapping.key] = rawValue;
      } else {
        // 未映射的保留原始key（camelCase 化）
        log("WARN", `未映射属性: "${rawKey}" = "${rawValue}" — 请补充 ATTRIBUTE_MAP`);
        mapped[rawKey.toLowerCase().replace(/\s+/g, "_")] = rawValue;
      }
    }
    return mapped;
  }

  // ===== 快速检查产品是否已存在 =====
  async checkExists(sku: string, slug: string): Promise<boolean> {
    const existing = await this.prisma.product.findFirst({
      where: { OR: [{ sku }, { slug }] },
      select: { id: true },
    });
    return !!existing;
  }

  // ===== 迁移单个产品 =====
  async migrateProduct(product: ScrapedProduct, dryRun: boolean): Promise<boolean> {
    const slug = slugify(product.name);
    const sku = product.sku;

    if (!sku) { log("WARN", `无SKU，跳过: ${product.name}`); return false; }

    // 检查重复
    const existing = await this.prisma.product.findFirst({
      where: { OR: [{ sku }, { slug }] },
    });
    if (existing) { log("WARN", `已存在: ${sku}`); return false; }

    if (dryRun) {
      log("INFO", `[DRY] ${sku} - ${product.name}`);
      log("INFO", `  品牌:${product.brand} 价格:€${product.price} 库存:${product.stock} 图片:${product.images.length} 变体:${product.variants.length}`);
      log("INFO", `  规格: ${Object.entries(product.specs).map(([k,v]) => `${k}=${v}`).join(", ").substring(0, 120)}`);
      if (product.variants.length > 0) log("INFO", `  变体: ${product.variants.map(v => `${v.name}(${v.ref})`).join(", ")}`);
      if (product.pdfUrl) log("INFO", `  PDF: 有`);
      if (product.certificates.length > 0) log("INFO", `  证书: ${product.certificates.map(c => c.name).join(", ")}`);
      if (product.categoryPath.length > 0) log("INFO", `  分类: ${product.categoryPath.join(" > ")}`);
      return true;
    }

    try {
      // --- 上传图片 ---
      const uploadedImages: string[] = [];
      for (const imgUrl of product.images) {
        const uploaded = await this.uploadFile(imgUrl, CONFIG.imageUploadPath);
        if (uploaded) uploadedImages.push(uploaded);
        await delay(200);
      }

      // --- 上传PDF ---
      let pdfPublicUrl: string | null = null;
      if (product.pdfUrl) {
        pdfPublicUrl = await this.uploadFile(product.pdfUrl, CONFIG.docUploadPath);
      }

      // --- 上传证书图片 ---
      const uploadedCerts: { name: string; imageUrl: string }[] = [];
      for (const cert of product.certificates) {
        const uploaded = await this.uploadFile(cert.imageUrl, CONFIG.certUploadPath);
        if (uploaded) uploadedCerts.push({ name: cert.name, imageUrl: uploaded });
        await delay(200);
      }

      // --- 分类 ---
      const categoryId = await this.buildCategoryHierarchy(product.categoryPath);

      // --- 规格映射 ---
      const variantSpecs = this.mapSpecsToVariant(product.specs);

      // --- Product content.specs (供后台 SpecsConfigurator 读取) ---
      const contentSpecs: Record<string, string | string[]> = {};
      for (const [key, val] of Object.entries(variantSpecs)) {
        contentSpecs[key] = val;
      }

      // 有变体时，收集变体名称作为变体轴（通常是色温cct）
      if (product.variants.length > 0) {
        const variantNames = [...new Set(product.variants.map(v => v.name).filter(Boolean))];
        if (variantNames.length > 1) {
          contentSpecs["cct"] = variantNames;
        } else if (variantNames.length === 1) {
          contentSpecs["cct"] = variantNames[0];
        }
      }

      // --- Product content ---
      const content: any = {
        es: { name: product.name, description: product.description },
        en: { name: product.name, description: product.description },
        images: uploadedImages,
        specs: contentSpecs,
      };

      // --- 构建变体 ---
      let variantsData: any[];

      if (product.variants.length > 0) {
        // 有色温/型号变体
        variantsData = product.variants.map((v) => {
          const vSku = v.ref || v.sku || `${sku}-${slugify(v.name)}`;
          const rawCost = v.price || product.price || 0;
          return {
            sku: vSku,
            ean: v.ean || null,
            costPrice: rawCost,
            price: Math.round(rawCost * 1.8 * 100) / 100,
            compareAtPrice: v.specialPrice || product.specialPrice || null,
            physicalStock: v.stock || 0,
            specs: {
              ...variantSpecs,
              cct: v.name, // 色温作为变体区分属性
            },
            content: {
              es: { name: `${product.name} ${v.name}` },
              en: { name: `${product.name} ${v.name}` },
            },
          };
        });
      } else {
        // 无变体，创建默认变体
        const defaultCost = product.price || 0;
        variantsData = [{
          sku,
          ean: product.apiData.ean || null,
          costPrice: defaultCost,
          price: Math.round(defaultCost * 1.8 * 100) / 100,
          compareAtPrice: product.specialPrice || null,
          physicalStock: product.stock || 0,
          specs: variantSpecs,
          content: null,
        }];
      }

      // 检查SKU唯一性，避免冲突
      for (const vd of variantsData) {
        const existingVariant = await this.prisma.productVariant.findUnique({
          where: { sku: vd.sku },
        });
        if (existingVariant) {
          vd.sku = `${vd.sku}-${Math.random().toString(36).slice(2, 6)}`;
        }
      }

      // --- 构建文档数据 ---
      const documentsData: any[] = [];

      // PDF 数据手册
      if (pdfPublicUrl) {
        documentsData.push({
          type: "DATASHEET" as const,
          name: "Ficha Técnica",
          url: pdfPublicUrl,
          sortOrder: 0,
        });
      }

      // 证书（带图片）
      for (let i = 0; i < uploadedCerts.length; i++) {
        documentsData.push({
          type: "CERTIFICATE" as const,
          name: uploadedCerts[i].name,
          url: "", // 证书没有PDF，只有图片
          imageUrl: uploadedCerts[i].imageUrl,
          sortOrder: i + 1,
        });
      }

      // --- 创建产品 ---
      const created = await this.prisma.product.create({
        data: {
          slug,
          sku,
          content,
          type: "SIMPLE",
          isActive: true,
          brand: product.brand,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          variants: { create: variantsData },
        },
        include: { variants: true },
      });

      // --- 创建文档（单独创建，避免 Prisma client 缓存问题） ---
      let docCount = 0;
      for (const doc of documentsData) {
        await this.prisma.productDocument.create({
          data: {
            productId: created.id,
            ...doc,
          },
        });
        docCount++;
      }

      log("OK", `${sku} - ${product.name} (${created.variants.length}变体, ${docCount}文档, ${uploadedImages.length}图)`);
      return true;
    } catch (e: any) {
      log("ERROR", `创建失败 ${sku}: ${e.message}`);
      return false;
    }
  }
}

// ==================== 主流程 ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const clean = args.includes("--clean");
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "0") || 0;

  console.log("\n============================================");
  console.log("  LEDME Europa → My LED ERP 产品迁移");
  console.log("============================================\n");
  if (dryRun) console.log("  模式: DRY RUN (不写入数据库)\n");

  const scraper = new LedmeScraper();
  const migrator = new ProductMigrator();

  try {
    await scraper.login();

    // 清空旧数据
    if (clean && !dryRun) {
      await migrator.cleanOldData();
    }

    // 获取产品列表
    const apiProducts = await scraper.fetchProductList(limit);
    if (apiProducts.length === 0) { log("WARN", "无产品"); return; }

    // 创建属性定义 (非dry-run)
    if (!dryRun) {
      await migrator.ensureAttributes();
    }

    // 逐个爬取+迁移（爬一个写一个，崩溃可恢复）
    log("INFO", `开始逐个迁移 ${apiProducts.length} 个产品...`);
    let ok = 0, skip = 0, fail = 0;

    for (let i = 0; i < apiProducts.length; i++) {
      const item = apiProducts[i];
      if (!item || !item.name) {
        log("WARN", `[${i + 1}/${apiProducts.length}] 跳过: 产品数据无效`);
        skip++;
        continue;
      }

      const itemSlug = slugify(item.name);
      const itemSku = item.sku;

      // 先检查是否已存在（快速跳过，不用爬取）
      if (!dryRun && itemSku) {
        const existing = await migrator.checkExists(itemSku, itemSlug);
        if (existing) {
          skip++;
          if (skip <= 5 || skip % 100 === 0) {
            log("WARN", `[${i + 1}/${apiProducts.length}] 已存在，跳过: ${item.name.substring(0, 50)}`);
          }
          continue;
        }
      }

      log("INFO", `[${i + 1}/${apiProducts.length}] 爬取: ${item.name.substring(0, 60)}`);
      try {
        const detail = await scraper.scrapeProductDetail(item);
        if (!detail) {
          fail++;
          continue;
        }

        const result = await migrator.migrateProduct(detail, dryRun);
        if (result) ok++; else skip++;
      } catch (err: any) {
        log("WARN", `[${i + 1}/${apiProducts.length}] 失败: ${err.message}`);
        fail++;
      }
      await delay(CONFIG.requestDelay);
    }

    console.log("\n============================================");
    console.log("  迁移完成！");
    console.log(`  成功: ${ok} | 跳过/已存在: ${skip} | 失败: ${fail}`);
    console.log(`  总计: ${apiProducts.length}`);
    console.log("============================================\n");

  } catch (e: any) {
    log("ERROR", `迁移出错: ${e.message}`);
    console.error(e);
  } finally {
    await migrator.cleanup();
  }
}

main().catch(console.error);
