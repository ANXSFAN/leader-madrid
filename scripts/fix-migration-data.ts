/**
 * Fix migration data completeness:
 * 1. Add SEO to the 1 product missing it
 * 2. Add descriptions to 28 categories missing them (all 9 languages)
 * 3. Add 7 missing language translations to all 41 category names
 * 4. Add 7 missing language translations to all 61 attribute definitions
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// Category translations: slug -> { name, description } per lang
// ============================================================
const categoryTranslations: Record<
  string,
  Record<string, { name: string; description: string }>
> = {
  // === TOP-LEVEL CATEGORIES ===
  "iluminacion-tecnica": {
    es: { name: "Iluminación Técnica", description: "Soluciones de iluminación técnica LED: downlights, paneles, focos de carril y lineales" },
    en: { name: "Technical Lighting", description: "Technical LED lighting solutions: downlights, panels, track lights and linear" },
    de: { name: "Technische Beleuchtung", description: "Technische LED-Beleuchtungslösungen: Downlights, Panels, Schienenleuchten und Linearleuchten" },
    fr: { name: "Éclairage Technique", description: "Solutions d'éclairage technique LED : downlights, panneaux, spots sur rail et linéaires" },
    it: { name: "Illuminazione Tecnica", description: "Soluzioni di illuminazione tecnica LED: downlight, pannelli, faretti su binario e lineari" },
    nl: { name: "Technische Verlichting", description: "Technische LED-verlichtingsoplossingen: downlights, panelen, railspots en lineaire verlichting" },
    pl: { name: "Oświetlenie Techniczne", description: "Techniczne rozwiązania oświetleniowe LED: downlighty, panele, reflektory szynowe i liniowe" },
    pt: { name: "Iluminação Técnica", description: "Soluções de iluminação técnica LED: downlights, painéis, focos de calha e lineares" },
    zh: { name: "技术照明", description: "技术LED照明解决方案：筒灯、面板灯、轨道灯和线性灯" },
  },
  "iluminacion-decorativa": {
    es: { name: "Iluminación Decorativa", description: "Iluminación decorativa LED: lámparas colgantes, plafones, apliques y lámparas de mesa" },
    en: { name: "Decorative Lighting", description: "Decorative LED lighting: pendant lamps, ceiling lights, wall sconces and table lamps" },
    de: { name: "Dekorative Beleuchtung", description: "Dekorative LED-Beleuchtung: Pendelleuchten, Deckenleuchten, Wandleuchten und Tischlampen" },
    fr: { name: "Éclairage Décoratif", description: "Éclairage décoratif LED : suspensions, plafonniers, appliques murales et lampes de table" },
    it: { name: "Illuminazione Decorativa", description: "Illuminazione decorativa LED: lampade a sospensione, plafoniere, applique e lampade da tavolo" },
    nl: { name: "Decoratieve Verlichting", description: "Decoratieve LED-verlichting: hanglampen, plafondlampen, wandlampen en tafellampen" },
    pl: { name: "Oświetlenie Dekoracyjne", description: "Dekoracyjne oświetlenie LED: lampy wiszące, plafony, kinkiety i lampki stołowe" },
    pt: { name: "Iluminação Decorativa", description: "Iluminação decorativa LED: candeeiros suspensos, plafons, apliques e candeeiros de mesa" },
    zh: { name: "装饰照明", description: "装饰性LED照明：吊灯、吸顶灯、壁灯和台灯" },
  },
  "iluminacion-exterior-industrial": {
    es: { name: "Iluminación Exterior e Industrial", description: "Iluminación LED para exterior e industrial: proyectores, campanas, farolas y luminarias solares" },
    en: { name: "Outdoor & Industrial Lighting", description: "Outdoor and industrial LED lighting: floodlights, high bays, street lights and solar luminaires" },
    de: { name: "Außen- & Industriebeleuchtung", description: "LED-Außen- und Industriebeleuchtung: Fluter, Hallenstrahler, Straßenleuchten und Solarleuchten" },
    fr: { name: "Éclairage Extérieur & Industriel", description: "Éclairage LED extérieur et industriel : projecteurs, cloches, lampadaires et luminaires solaires" },
    it: { name: "Illuminazione Esterna e Industriale", description: "Illuminazione LED per esterni e industriale: proiettori, campane, lampioni e apparecchi solari" },
    nl: { name: "Buiten- & Industriële Verlichting", description: "LED buiten- en industriële verlichting: schijnwerpers, highbays, straatverlichting en zonne-armaturen" },
    pl: { name: "Oświetlenie Zewnętrzne i Przemysłowe", description: "Oświetlenie LED zewnętrzne i przemysłowe: naświetlacze, lampy przemysłowe, latarnie i oprawy solarne" },
    pt: { name: "Iluminação Exterior e Industrial", description: "Iluminação LED exterior e industrial: projetores, campânulas, postes e luminarias solares" },
    zh: { name: "户外与工业照明", description: "户外和工业LED照明：泛光灯、工矿灯、路灯和太阳能灯具" },
  },
  "componentes-accesorios": {
    es: { name: "Componentes y Accesorios", description: "Componentes y accesorios LED: fuentes de alimentación, transformadores, tiras LED y accesorios" },
    en: { name: "Components & Accessories", description: "LED components and accessories: power supplies, transformers, LED strips and accessories" },
    de: { name: "Komponenten & Zubehör", description: "LED-Komponenten und Zubehör: Netzteile, Transformatoren, LED-Streifen und Zubehör" },
    fr: { name: "Composants & Accessoires", description: "Composants et accessoires LED : alimentations, transformateurs, rubans LED et accessoires" },
    it: { name: "Componenti e Accessori", description: "Componenti e accessori LED: alimentatori, trasformatori, strisce LED e accessori" },
    nl: { name: "Componenten & Accessoires", description: "LED-componenten en accessoires: voedingen, transformatoren, LED-strips en accessoires" },
    pl: { name: "Komponenty i Akcesoria", description: "Komponenty i akcesoria LED: zasilacze, transformatory, taśmy LED i akcesoria" },
    pt: { name: "Componentes e Acessórios", description: "Componentes e acessórios LED: fontes de alimentação, transformadores, fitas LED e acessórios" },
    zh: { name: "组件与配件", description: "LED组件与配件：电源、变压器、LED灯带和配件" },
  },

  // === SUB-CATEGORIES (grouped by parent) ===

  // -- Iluminación Técnica children --
  "downlight-paneles": {
    es: { name: "Downlight y Paneles", description: "Downlights y paneles LED empotrados y de superficie para iluminación técnica" },
    en: { name: "Downlights & Panels", description: "Recessed and surface-mounted LED downlights and panels for technical lighting" },
    de: { name: "Downlights & Panels", description: "Einbau- und Aufbau-LED-Downlights und Panels für technische Beleuchtung" },
    fr: { name: "Downlights & Panneaux", description: "Downlights et panneaux LED encastrés et en saillie pour l'éclairage technique" },
    it: { name: "Downlight e Pannelli", description: "Downlight e pannelli LED da incasso e a plafone per illuminazione tecnica" },
    nl: { name: "Downlights & Panelen", description: "Inbouw- en opbouw LED-downlights en panelen voor technische verlichting" },
    pl: { name: "Downlighty i Panele", description: "Wbudowane i natynkowe downlighty i panele LED do oświetlenia technicznego" },
    pt: { name: "Downlights e Painéis", description: "Downlights e painéis LED de encastrar e de superfície para iluminação técnica" },
    zh: { name: "筒灯和面板灯", description: "嵌入式和明装LED筒灯和面板灯，用于技术照明" },
  },
  downlight: {
    es: { name: "Downlight LED", description: "Downlights LED empotrados para iluminación técnica de interiores" },
    en: { name: "LED Downlights", description: "Recessed LED downlights for interior technical lighting" },
    de: { name: "LED Downlights", description: "Einbau-LED-Downlights für technische Innenbeleuchtung" },
    fr: { name: "Downlights LED", description: "Downlights LED encastrés pour l'éclairage technique intérieur" },
    it: { name: "Downlight LED", description: "Downlight LED da incasso per illuminazione tecnica d'interni" },
    nl: { name: "LED Downlights", description: "Inbouw LED-downlights voor technische binnenverlichting" },
    pl: { name: "Downlighty LED", description: "Wbudowane downlighty LED do technicznego oświetlenia wnętrz" },
    pt: { name: "Downlights LED", description: "Downlights LED de encastrar para iluminação técnica de interiores" },
    zh: { name: "LED筒灯", description: "嵌入式LED筒灯，适用于室内技术照明" },
  },
  "panel-led": {
    es: { name: "Panel LED", description: "Paneles LED de superficie y empotrados para oficinas y espacios comerciales" },
    en: { name: "LED Panels", description: "Surface and recessed LED panels for offices and commercial spaces" },
    de: { name: "LED Panels", description: "Aufbau- und Einbau-LED-Panels für Büros und Gewerbeflächen" },
    fr: { name: "Panneaux LED", description: "Panneaux LED en saillie et encastrés pour bureaux et espaces commerciaux" },
    it: { name: "Pannelli LED", description: "Pannelli LED da superficie e da incasso per uffici e spazi commerciali" },
    nl: { name: "LED Panelen", description: "Opbouw- en inbouw LED-panelen voor kantoren en commerciële ruimtes" },
    pl: { name: "Panele LED", description: "Natynkowe i wbudowane panele LED do biur i przestrzeni komercyjnych" },
    pt: { name: "Painéis LED", description: "Painéis LED de superfície e de encastrar para escritórios e espaços comerciais" },
    zh: { name: "LED面板灯", description: "明装和嵌入式LED面板灯，适用于办公室和商业空间" },
  },
  "focos-led": {
    es: { name: "Focos LED", description: "Focos LED empotrables y de superficie para iluminación de acento y general" },
    en: { name: "LED Spotlights", description: "Recessed and surface LED spotlights for accent and general lighting" },
    de: { name: "LED Spots", description: "Einbau- und Aufbau-LED-Spots für Akzent- und Allgemeinbeleuchtung" },
    fr: { name: "Spots LED", description: "Spots LED encastrés et en saillie pour l'éclairage d'accentuation et général" },
    it: { name: "Faretti LED", description: "Faretti LED da incasso e a plafone per illuminazione d'accento e generale" },
    nl: { name: "LED Spots", description: "Inbouw- en opbouw LED-spots voor accent- en algemene verlichting" },
    pl: { name: "Reflektory LED", description: "Wbudowane i natynkowe reflektory LED do oświetlenia akcentowego i ogólnego" },
    pt: { name: "Focos LED", description: "Focos LED de encastrar e de superfície para iluminação de destaque e geral" },
    zh: { name: "LED射灯", description: "嵌入式和明装LED射灯，适用于重点照明和一般照明" },
  },
  "focos-de-carril": {
    es: { name: "Focos de Carril", description: "Sistemas de focos LED sobre carril para iluminación comercial y de exposición" },
    en: { name: "Track Lights", description: "LED track light systems for commercial and exhibition lighting" },
    de: { name: "Schienenleuchten", description: "LED-Schienensysteme für Gewerbe- und Ausstellungsbeleuchtung" },
    fr: { name: "Spots sur Rail", description: "Systèmes de spots LED sur rail pour l'éclairage commercial et d'exposition" },
    it: { name: "Faretti su Binario", description: "Sistemi di faretti LED su binario per illuminazione commerciale e espositiva" },
    nl: { name: "Railspots", description: "LED railspot-systemen voor commerciële en tentoonstellingsverlichting" },
    pl: { name: "Reflektory Szynowe", description: "Systemy reflektorów LED na szynach do oświetlenia komercyjnego i wystawowego" },
    pt: { name: "Focos de Calha", description: "Sistemas de focos LED em calha para iluminação comercial e de exposição" },
    zh: { name: "轨道灯", description: "LED轨道灯系统，适用于商业和展览照明" },
  },
  "focos-carril-led": {
    es: { name: "Focos Carril LED", description: "Focos LED para carril trifásico y monofásico, ideales para tiendas y showrooms" },
    en: { name: "LED Track Spotlights", description: "LED spotlights for three-phase and single-phase track, ideal for shops and showrooms" },
    de: { name: "LED Schienenspots", description: "LED-Spots für Drei- und Einphasen-Schienen, ideal für Geschäfte und Showrooms" },
    fr: { name: "Spots Rail LED", description: "Spots LED pour rail triphasé et monophasé, idéaux pour magasins et showrooms" },
    it: { name: "Faretti Binario LED", description: "Faretti LED per binario trifase e monofase, ideali per negozi e showroom" },
    nl: { name: "LED Railspots", description: "LED-spots voor driefasen- en eenfasenrails, ideaal voor winkels en showrooms" },
    pl: { name: "Reflektory Szynowe LED", description: "Reflektory LED na szyny trójfazowe i jednofazowe, idealne do sklepów i salonów" },
    pt: { name: "Focos de Calha LED", description: "Focos LED para calha trifásica e monofásica, ideais para lojas e showrooms" },
    zh: { name: "LED轨道射灯", description: "适用于三相和单相轨道的LED射灯，适合商店和展厅" },
  },
  "focos-carril-led-magnetico": {
    es: { name: "Focos Carril LED Magnético", description: "Focos LED para carril magnético ultra-slim, diseño moderno y fácil instalación" },
    en: { name: "Magnetic LED Track Spotlights", description: "LED spotlights for ultra-slim magnetic track, modern design and easy installation" },
    de: { name: "Magnetische LED Schienenspots", description: "LED-Spots für ultra-schmale Magnetschienen, modernes Design und einfache Installation" },
    fr: { name: "Spots Rail Magnétique LED", description: "Spots LED pour rail magnétique ultra-mince, design moderne et installation facile" },
    it: { name: "Faretti Binario Magnetico LED", description: "Faretti LED per binario magnetico ultra-slim, design moderno e facile installazione" },
    nl: { name: "Magnetische LED Railspots", description: "LED-spots voor ultra-slanke magnetische rails, modern design en eenvoudige installatie" },
    pl: { name: "Magnetyczne Reflektory Szynowe LED", description: "Reflektory LED na ultra-cienkie szyny magnetyczne, nowoczesny design i łatwy montaż" },
    pt: { name: "Focos Calha Magnética LED", description: "Focos LED para calha magnética ultra-fina, design moderno e instalação fácil" },
    zh: { name: "磁吸轨道LED射灯", description: "超薄磁吸轨道LED射灯，现代设计，安装简便" },
  },
  "carril-ultrafino": {
    es: { name: "Carril Ultrafino", description: "Sistemas de carril ultrafino y perfiles para iluminación de carril moderno" },
    en: { name: "Ultra-thin Track", description: "Ultra-thin track systems and profiles for modern track lighting" },
    de: { name: "Ultra-dünne Schiene", description: "Ultra-dünne Schienensysteme und Profile für moderne Schienenbeleuchtung" },
    fr: { name: "Rail Ultra-mince", description: "Systèmes de rail ultra-mince et profilés pour l'éclairage sur rail moderne" },
    it: { name: "Binario Ultra-sottile", description: "Sistemi di binario ultra-sottile e profili per illuminazione su binario moderna" },
    nl: { name: "Ultra-dunne Rail", description: "Ultra-dunne railsystemen en profielen voor moderne railverlichting" },
    pl: { name: "Ultra-cienka Szyna", description: "Ultra-cienkie systemy szynowe i profile do nowoczesnego oświetlenia szynowego" },
    pt: { name: "Calha Ultra-fina", description: "Sistemas de calha ultra-fina e perfis para iluminação de calha moderna" },
    zh: { name: "超薄轨道", description: "超薄轨道系统和型材，适用于现代轨道照明" },
  },

  // -- Iluminación Decorativa children --
  "lamparas-de-techo": {
    es: { name: "Lámparas de Techo", description: "Lámparas de techo LED decorativas: colgantes, plafones y diseño contemporáneo" },
    en: { name: "Ceiling Lamps", description: "Decorative LED ceiling lamps: pendants, flush mounts and contemporary design" },
    de: { name: "Deckenleuchten", description: "Dekorative LED-Deckenleuchten: Pendelleuchten, Deckenleuchten und zeitgenössisches Design" },
    fr: { name: "Plafonniers", description: "Plafonniers LED décoratifs : suspensions, plafonniers et design contemporain" },
    it: { name: "Lampade da Soffitto", description: "Lampade da soffitto LED decorative: sospensioni, plafoniere e design contemporaneo" },
    nl: { name: "Plafondlampen", description: "Decoratieve LED-plafondlampen: hanglampen, plafonnières en hedendaags design" },
    pl: { name: "Lampy Sufitowe", description: "Dekoracyjne lampy sufitowe LED: lampy wiszące, plafony i współczesny design" },
    pt: { name: "Candeeiros de Teto", description: "Candeeiros de teto LED decorativos: pendentes, plafons e design contemporâneo" },
    zh: { name: "吸顶灯", description: "装饰性LED吸顶灯：吊灯、吸顶灯和现代设计" },
  },
  "lamparas-colgante": {
    es: { name: "Lámparas Colgantes", description: "Lámparas colgantes LED decorativas para salones, comedores y espacios comerciales" },
    en: { name: "Pendant Lamps", description: "Decorative LED pendant lamps for living rooms, dining rooms and commercial spaces" },
    de: { name: "Pendelleuchten", description: "Dekorative LED-Pendelleuchten für Wohnzimmer, Esszimmer und Gewerbeflächen" },
    fr: { name: "Suspensions", description: "Suspensions LED décoratives pour salons, salles à manger et espaces commerciaux" },
    it: { name: "Lampade a Sospensione", description: "Lampade a sospensione LED decorative per soggiorni, sale da pranzo e spazi commerciali" },
    nl: { name: "Hanglampen", description: "Decoratieve LED-hanglampen voor woonkamers, eetkamers en commerciële ruimtes" },
    pl: { name: "Lampy Wiszące", description: "Dekoracyjne lampy wiszące LED do salonów, jadalni i przestrzeni komercyjnych" },
    pt: { name: "Candeeiros Suspensos", description: "Candeeiros suspensos LED decorativos para salas, salas de jantar e espaços comerciais" },
    zh: { name: "吊灯", description: "装饰性LED吊灯，适用于客厅、餐厅和商业空间" },
  },
  "lamparas-de-techo-plafon": {
    es: { name: "Plafones LED", description: "Plafones LED de techo para iluminación general y decorativa" },
    en: { name: "LED Flush Mounts", description: "LED ceiling flush mounts for general and decorative lighting" },
    de: { name: "LED Deckenleuchten", description: "LED-Deckenleuchten für allgemeine und dekorative Beleuchtung" },
    fr: { name: "Plafonniers LED", description: "Plafonniers LED pour l'éclairage général et décoratif" },
    it: { name: "Plafoniere LED", description: "Plafoniere LED per illuminazione generale e decorativa" },
    nl: { name: "LED Plafonnières", description: "LED plafonnières voor algemene en decoratieve verlichting" },
    pl: { name: "Plafony LED", description: "Plafony LED do oświetlenia ogólnego i dekoracyjnego" },
    pt: { name: "Plafons LED", description: "Plafons LED de teto para iluminação geral e decorativa" },
    zh: { name: "LED吸顶灯", description: "LED吸顶灯，适用于一般和装饰照明" },
  },
  ventiladores: {
    es: { name: "Ventiladores", description: "Ventiladores de techo LED con luz integrada, control remoto y diseño moderno" },
    en: { name: "Ceiling Fans", description: "LED ceiling fans with integrated light, remote control and modern design" },
    de: { name: "Deckenventilatoren", description: "LED-Deckenventilatoren mit integriertem Licht, Fernbedienung und modernem Design" },
    fr: { name: "Ventilateurs", description: "Ventilateurs de plafond LED avec lumière intégrée, télécommande et design moderne" },
    it: { name: "Ventilatori", description: "Ventilatori da soffitto LED con luce integrata, telecomando e design moderno" },
    nl: { name: "Plafondventilatoren", description: "LED plafondventilatoren met geïntegreerd licht, afstandsbediening en modern design" },
    pl: { name: "Wentylatory", description: "Wentylatory sufitowe LED ze zintegrowanym światłem, pilotem i nowoczesnym designem" },
    pt: { name: "Ventiladores", description: "Ventiladores de teto LED com luz integrada, controlo remoto e design moderno" },
    zh: { name: "吊扇灯", description: "LED吊扇灯，带集成灯光、遥控器和现代设计" },
  },
  "lamparas-pared-mesa": {
    es: { name: "Lámparas de Pared y Mesa", description: "Apliques de pared y lámparas de mesa LED decorativas para interiores" },
    en: { name: "Wall & Table Lamps", description: "Decorative LED wall sconces and table lamps for interiors" },
    de: { name: "Wand- & Tischlampen", description: "Dekorative LED-Wandleuchten und Tischlampen für Innenräume" },
    fr: { name: "Appliques & Lampes de Table", description: "Appliques murales et lampes de table LED décoratives pour intérieurs" },
    it: { name: "Lampade da Parete e Tavolo", description: "Applique e lampade da tavolo LED decorative per interni" },
    nl: { name: "Wand- & Tafellampen", description: "Decoratieve LED-wandlampen en tafellampen voor interieurs" },
    pl: { name: "Lampy Ścienne i Stołowe", description: "Dekoracyjne kinkiety LED i lampki stołowe do wnętrz" },
    pt: { name: "Candeeiros de Parede e Mesa", description: "Apliques de parede e candeeiros de mesa LED decorativos para interiores" },
    zh: { name: "壁灯和台灯", description: "装饰性LED壁灯和台灯，适用于室内" },
  },
  "apliques-de-pared-decoracion-e-iluminacion": {
    es: { name: "Apliques de Pared", description: "Apliques de pared LED decorativos para pasillos, salones y espacios de diseño" },
    en: { name: "Wall Sconces", description: "Decorative LED wall sconces for hallways, living rooms and design spaces" },
    de: { name: "Wandleuchten", description: "Dekorative LED-Wandleuchten für Flure, Wohnzimmer und Designräume" },
    fr: { name: "Appliques Murales", description: "Appliques murales LED décoratives pour couloirs, salons et espaces design" },
    it: { name: "Applique da Parete", description: "Applique a parete LED decorative per corridoi, soggiorni e spazi di design" },
    nl: { name: "Wandlampen", description: "Decoratieve LED-wandlampen voor gangen, woonkamers en designruimtes" },
    pl: { name: "Kinkiety", description: "Dekoracyjne kinkiety LED do korytarzy, salonów i przestrzeni designerskich" },
    pt: { name: "Apliques de Parede", description: "Apliques de parede LED decorativos para corredores, salas e espaços de design" },
    zh: { name: "壁灯", description: "装饰性LED壁灯，适用于走廊、客厅和设计空间" },
  },
  "lamparas-de-mesa": {
    es: { name: "Lámparas de Mesa", description: "Lámparas de mesa LED decorativas y funcionales para escritorios y mesitas de noche" },
    en: { name: "Table Lamps", description: "Decorative and functional LED table lamps for desks and bedside tables" },
    de: { name: "Tischlampen", description: "Dekorative und funktionale LED-Tischlampen für Schreibtische und Nachttische" },
    fr: { name: "Lampes de Table", description: "Lampes de table LED décoratives et fonctionnelles pour bureaux et tables de chevet" },
    it: { name: "Lampade da Tavolo", description: "Lampade da tavolo LED decorative e funzionali per scrivanie e comodini" },
    nl: { name: "Tafellampen", description: "Decoratieve en functionele LED-tafellampen voor bureaus en nachtkastjes" },
    pl: { name: "Lampki Stołowe", description: "Dekoracyjne i funkcjonalne lampki stołowe LED na biurka i stoliki nocne" },
    pt: { name: "Candeeiros de Mesa", description: "Candeeiros de mesa LED decorativos e funcionais para secretárias e mesas de cabeceira" },
    zh: { name: "台灯", description: "装饰性和功能性LED台灯，适用于书桌和床头柜" },
  },
  "lamparas-de-suelo": {
    es: { name: "Lámparas de Suelo", description: "Lámparas de pie LED para iluminación de ambiente en salones y espacios de lectura" },
    en: { name: "Floor Lamps", description: "LED floor lamps for ambient lighting in living rooms and reading spaces" },
    de: { name: "Stehlampen", description: "LED-Stehlampen für Ambientebeleuchtung in Wohnzimmern und Leseecken" },
    fr: { name: "Lampadaires", description: "Lampadaires LED pour l'éclairage d'ambiance dans les salons et espaces de lecture" },
    it: { name: "Lampade da Terra", description: "Lampade da terra LED per illuminazione d'ambiente in soggiorni e angoli lettura" },
    nl: { name: "Vloerlampen", description: "LED-vloerlampen voor sfeerverlichting in woonkamers en leeshoeken" },
    pl: { name: "Lampy Podłogowe", description: "Lampy podłogowe LED do oświetlenia nastrojowego w salonach i kącikach do czytania" },
    pt: { name: "Candeeiros de Pé", description: "Candeeiros de pé LED para iluminação ambiente em salas e espaços de leitura" },
    zh: { name: "落地灯", description: "LED落地灯，适用于客厅和阅读空间的氛围照明" },
  },
  "lamparas-decoracion": {
    es: { name: "Lámparas de Decoración", description: "Lámparas LED de diseño y decorativas para crear ambientes únicos" },
    en: { name: "Decorative Lamps", description: "Designer and decorative LED lamps to create unique atmospheres" },
    de: { name: "Dekorationsleuchten", description: "Designer- und dekorative LED-Leuchten für einzigartige Atmosphären" },
    fr: { name: "Lampes Décoratives", description: "Lampes LED design et décoratives pour créer des ambiances uniques" },
    it: { name: "Lampade Decorative", description: "Lampade LED di design e decorative per creare atmosfere uniche" },
    nl: { name: "Decoratieve Lampen", description: "Designer en decoratieve LED-lampen voor unieke sferen" },
    pl: { name: "Lampy Dekoracyjne", description: "Designerskie i dekoracyjne lampy LED do tworzenia wyjątkowych atmosfer" },
    pt: { name: "Candeeiros Decorativos", description: "Candeeiros LED de design e decorativos para criar ambientes únicos" },
    zh: { name: "装饰灯", description: "设计师和装饰性LED灯具，营造独特氛围" },
  },
  "lamparas-decoracion-all": {
    es: { name: "Lámparas de Decoración", description: "Colección completa de lámparas LED decorativas para todos los estilos" },
    en: { name: "Decorative Lamps", description: "Complete collection of decorative LED lamps for all styles" },
    de: { name: "Dekorationsleuchten", description: "Vollständige Kollektion dekorativer LED-Leuchten für alle Stilrichtungen" },
    fr: { name: "Lampes Décoratives", description: "Collection complète de lampes LED décoratives pour tous les styles" },
    it: { name: "Lampade Decorative", description: "Collezione completa di lampade LED decorative per tutti gli stili" },
    nl: { name: "Decoratieve Lampen", description: "Complete collectie decoratieve LED-lampen voor alle stijlen" },
    pl: { name: "Lampy Dekoracyjne", description: "Pełna kolekcja dekoracyjnych lamp LED na każdy styl" },
    pt: { name: "Candeeiros Decorativos", description: "Coleção completa de candeeiros LED decorativos para todos os estilos" },
    zh: { name: "装饰灯", description: "全系列装饰性LED灯具，适合各种风格" },
  },
  "espejos-led": {
    es: { name: "Espejos LED", description: "Espejos con iluminación LED integrada para baños y espacios de diseño" },
    en: { name: "LED Mirrors", description: "Mirrors with integrated LED lighting for bathrooms and design spaces" },
    de: { name: "LED Spiegel", description: "Spiegel mit integrierter LED-Beleuchtung für Badezimmer und Designräume" },
    fr: { name: "Miroirs LED", description: "Miroirs avec éclairage LED intégré pour salles de bain et espaces design" },
    it: { name: "Specchi LED", description: "Specchi con illuminazione LED integrata per bagni e spazi di design" },
    nl: { name: "LED Spiegels", description: "Spiegels met geïntegreerde LED-verlichting voor badkamers en designruimtes" },
    pl: { name: "Lustra LED", description: "Lustra z zintegrowanym oświetleniem LED do łazienek i przestrzeni designerskich" },
    pt: { name: "Espelhos LED", description: "Espelhos com iluminação LED integrada para casas de banho e espaços de design" },
    zh: { name: "LED镜子", description: "带集成LED照明的镜子，适用于浴室和设计空间" },
  },

  // -- Exterior & Industrial children --
  exterior: {
    es: { name: "Exterior", description: "Iluminación LED de exterior: proyectores, farolas, balizas y apliques de pared" },
    en: { name: "Outdoor", description: "Outdoor LED lighting: floodlights, street lights, bollards and wall sconces" },
    de: { name: "Außenbereich", description: "LED-Außenbeleuchtung: Fluter, Straßenleuchten, Poller und Wandleuchten" },
    fr: { name: "Extérieur", description: "Éclairage LED extérieur : projecteurs, lampadaires, bornes et appliques murales" },
    it: { name: "Esterno", description: "Illuminazione LED per esterni: proiettori, lampioni, paletti e applique" },
    nl: { name: "Buiten", description: "Buitenverlichting LED: schijnwerpers, straatverlichting, paaltjes en wandlampen" },
    pl: { name: "Zewnętrzne", description: "Oświetlenie LED zewnętrzne: naświetlacze, latarnie, słupki i kinkiety" },
    pt: { name: "Exterior", description: "Iluminação LED exterior: projetores, postes, balizas e apliques de parede" },
    zh: { name: "户外照明", description: "户外LED照明：泛光灯、路灯、草坪灯和壁灯" },
  },
  "foco-proyector-ufo": {
    es: { name: "Proyectores LED", description: "Proyectores LED de alta potencia para exteriores, fachadas y áreas deportivas" },
    en: { name: "LED Floodlights", description: "High-power LED floodlights for outdoors, facades and sports areas" },
    de: { name: "LED Fluter", description: "Hochleistungs-LED-Fluter für Außenbereiche, Fassaden und Sportanlagen" },
    fr: { name: "Projecteurs LED", description: "Projecteurs LED haute puissance pour extérieurs, façades et zones sportives" },
    it: { name: "Proiettori LED", description: "Proiettori LED ad alta potenza per esterni, facciate e aree sportive" },
    nl: { name: "LED Schijnwerpers", description: "Krachtige LED-schijnwerpers voor buitenruimtes, gevels en sportterreinen" },
    pl: { name: "Projektory LED", description: "Wysokomocowe projektory LED na zewnątrz, fasady i obiekty sportowe" },
    pt: { name: "Projetores LED", description: "Projetores LED de alta potência para exteriores, fachadas e áreas desportivas" },
    zh: { name: "LED投光灯", description: "大功率LED投光灯，适用于户外、建筑立面和运动场" },
  },
  solar: {
    es: { name: "Solar", description: "Iluminación solar LED autónoma para jardines, caminos y áreas exteriores" },
    en: { name: "Solar", description: "Autonomous solar LED lighting for gardens, pathways and outdoor areas" },
    de: { name: "Solar", description: "Autonome Solar-LED-Beleuchtung für Gärten, Wege und Außenbereiche" },
    fr: { name: "Solaire", description: "Éclairage solaire LED autonome pour jardins, allées et espaces extérieurs" },
    it: { name: "Solare", description: "Illuminazione solare LED autonoma per giardini, sentieri e aree esterne" },
    nl: { name: "Zonne-energie", description: "Autonome LED-zonneverlichting voor tuinen, paden en buitenruimtes" },
    pl: { name: "Solarne", description: "Autonomiczne oświetlenie solarne LED do ogrodów, ścieżek i terenów zewnętrznych" },
    pt: { name: "Solar", description: "Iluminação solar LED autónoma para jardins, caminhos e áreas exteriores" },
    zh: { name: "太阳能灯", description: "自主太阳能LED照明，适用于花园、小路和户外区域" },
  },
  industrial: {
    es: { name: "Industrial", description: "Iluminación LED industrial: campanas, tubos lineales y luminarias para naves y almacenes" },
    en: { name: "Industrial", description: "Industrial LED lighting: high bays, linear tubes and luminaires for warehouses" },
    de: { name: "Industrie", description: "Industrielle LED-Beleuchtung: Hallenstrahler, Linearleuchten und Leuchten für Lagerhallen" },
    fr: { name: "Industriel", description: "Éclairage LED industriel : cloches, tubes linéaires et luminaires pour entrepôts" },
    it: { name: "Industriale", description: "Illuminazione LED industriale: campane, tubi lineari e apparecchi per magazzini" },
    nl: { name: "Industrieel", description: "Industriële LED-verlichting: highbays, lineaire buizen en armaturen voor magazijnen" },
    pl: { name: "Przemysłowe", description: "Przemysłowe oświetlenie LED: lampy przemysłowe, tuby liniowe i oprawy do hal i magazynów" },
    pt: { name: "Industrial", description: "Iluminação LED industrial: campânulas, tubos lineares e luminarias para armazéns" },
    zh: { name: "工业照明", description: "工业LED照明：工矿灯、线性灯管和仓库灯具" },
  },
  "iluminacion-industrial": {
    es: { name: "Iluminación Industrial", description: "Soluciones de iluminación LED industrial para fábricas, talleres y naves industriales" },
    en: { name: "Industrial Lighting", description: "Industrial LED lighting solutions for factories, workshops and industrial buildings" },
    de: { name: "Industriebeleuchtung", description: "Industrielle LED-Beleuchtungslösungen für Fabriken, Werkstätten und Industriegebäude" },
    fr: { name: "Éclairage Industriel", description: "Solutions d'éclairage LED industriel pour usines, ateliers et bâtiments industriels" },
    it: { name: "Illuminazione Industriale", description: "Soluzioni di illuminazione LED industriale per fabbriche, officine e edifici industriali" },
    nl: { name: "Industriële Verlichting", description: "Industriële LED-verlichtingsoplossingen voor fabrieken, werkplaatsen en industriële gebouwen" },
    pl: { name: "Oświetlenie Przemysłowe", description: "Przemysłowe rozwiązania oświetleniowe LED do fabryk, warsztatów i budynków przemysłowych" },
    pt: { name: "Iluminação Industrial", description: "Soluções de iluminação LED industrial para fábricas, oficinas e edifícios industriais" },
    zh: { name: "工业照明", description: "工业LED照明解决方案，适用于工厂、车间和工业建筑" },
  },
  "campana-led": {
    es: { name: "Campanas LED", description: "Campanas LED industriales de alta eficiencia para naves, almacenes y talleres" },
    en: { name: "LED High Bays", description: "High-efficiency industrial LED high bays for warehouses, storage and workshops" },
    de: { name: "LED Hallenstrahler", description: "Hocheffiziente industrielle LED-Hallenstrahler für Lagerhallen und Werkstätten" },
    fr: { name: "Cloches LED", description: "Cloches LED industrielles haute efficacité pour entrepôts et ateliers" },
    it: { name: "Campane LED", description: "Campane LED industriali ad alta efficienza per capannoni, magazzini e officine" },
    nl: { name: "LED Highbays", description: "Hoogefficiënte industriële LED-highbays voor magazijnen en werkplaatsen" },
    pl: { name: "Lampy Przemysłowe LED", description: "Wysokowydajne przemysłowe lampy LED do hal, magazynów i warsztatów" },
    pt: { name: "Campânulas LED", description: "Campânulas LED industriais de alta eficiência para armazéns e oficinas" },
    zh: { name: "LED工矿灯", description: "高效工业LED工矿灯，适用于仓库、厂房和车间" },
  },
  seguridad: {
    es: { name: "Seguridad", description: "Iluminación LED de seguridad y emergencia: luces de emergencia y señalización" },
    en: { name: "Safety", description: "Safety and emergency LED lighting: emergency lights and signage" },
    de: { name: "Sicherheit", description: "Sicherheits- und Notfall-LED-Beleuchtung: Notbeleuchtung und Beschilderung" },
    fr: { name: "Sécurité", description: "Éclairage LED de sécurité et d'urgence : éclairage de secours et signalisation" },
    it: { name: "Sicurezza", description: "Illuminazione LED di sicurezza ed emergenza: luci di emergenza e segnaletica" },
    nl: { name: "Veiligheid", description: "Veiligheids- en nood-LED-verlichting: noodverlichting en bewegwijzering" },
    pl: { name: "Bezpieczeństwo", description: "Oświetlenie LED bezpieczeństwa i awaryjne: oświetlenie awaryjne i oznakowanie" },
    pt: { name: "Segurança", description: "Iluminação LED de segurança e emergência: luzes de emergência e sinalização" },
    zh: { name: "安全照明", description: "安全和应急LED照明：应急灯和标识" },
  },
  "luz-emergencia": {
    es: { name: "Luz de Emergencia", description: "Luces de emergencia LED con batería integrada y señalización normativa" },
    en: { name: "Emergency Lights", description: "LED emergency lights with integrated battery and regulatory signage" },
    de: { name: "Notbeleuchtung", description: "LED-Notbeleuchtung mit integriertem Akku und normativer Beschilderung" },
    fr: { name: "Éclairage de Secours", description: "Éclairage de secours LED avec batterie intégrée et signalisation réglementaire" },
    it: { name: "Luci di Emergenza", description: "Luci di emergenza LED con batteria integrata e segnaletica normativa" },
    nl: { name: "Noodverlichting", description: "LED-noodverlichting met geïntegreerde batterij en wettelijke bewegwijzering" },
    pl: { name: "Oświetlenie Awaryjne", description: "Awaryjne oświetlenie LED z wbudowaną baterią i oznakowaniem normatywnym" },
    pt: { name: "Iluminação de Emergência", description: "Iluminação de emergência LED com bateria integrada e sinalização normativa" },
    zh: { name: "应急灯", description: "LED应急灯，带内置电池和规范标识" },
  },

  // -- Components & Accessories children --
  "fuentes-de-luz": {
    es: { name: "Fuentes de Luz", description: "Bombillas y fuentes de luz LED: E27, E14, GU10, G9 y más casquillos" },
    en: { name: "Light Sources", description: "LED bulbs and light sources: E27, E14, GU10, G9 and more sockets" },
    de: { name: "Leuchtmittel", description: "LED-Leuchtmittel: E27, E14, GU10, G9 und weitere Sockel" },
    fr: { name: "Sources Lumineuses", description: "Ampoules et sources lumineuses LED : E27, E14, GU10, G9 et plus" },
    it: { name: "Sorgenti Luminose", description: "Lampadine e sorgenti luminose LED: E27, E14, GU10, G9 e altri attacchi" },
    nl: { name: "Lichtbronnen", description: "LED-lampen en lichtbronnen: E27, E14, GU10, G9 en meer fittingen" },
    pl: { name: "Źródła Światła", description: "Żarówki i źródła światła LED: E27, E14, GU10, G9 i więcej gwinty" },
    pt: { name: "Fontes de Luz", description: "Lâmpadas e fontes de luz LED: E27, E14, GU10, G9 e mais casquilhos" },
    zh: { name: "光源", description: "LED灯泡和光源：E27、E14、GU10、G9等灯头" },
  },
  bombillas: {
    es: { name: "Bombillas LED", description: "Bombillas LED de bajo consumo para todo tipo de casquillos y aplicaciones" },
    en: { name: "LED Bulbs", description: "Energy-efficient LED bulbs for all socket types and applications" },
    de: { name: "LED Leuchtmittel", description: "Energieeffiziente LED-Leuchtmittel für alle Sockeltypen und Anwendungen" },
    fr: { name: "Ampoules LED", description: "Ampoules LED basse consommation pour tous types de culots et applications" },
    it: { name: "Lampadine LED", description: "Lampadine LED a basso consumo per tutti i tipi di attacco e applicazioni" },
    nl: { name: "LED Lampen", description: "Energiezuinige LED-lampen voor alle fittingtypen en toepassingen" },
    pl: { name: "Żarówki LED", description: "Energooszczędne żarówki LED do wszystkich typów gwintu i zastosowań" },
    pt: { name: "Lâmpadas LED", description: "Lâmpadas LED de baixo consumo para todos os tipos de casquilho e aplicações" },
    zh: { name: "LED灯泡", description: "节能LED灯泡，适用于所有灯头类型和应用" },
  },
  "tubos-led": {
    es: { name: "Tubos LED", description: "Tubos LED T8 y T5 para reemplazo de fluorescentes en oficinas y comercios" },
    en: { name: "LED Tubes", description: "T8 and T5 LED tubes for fluorescent replacement in offices and shops" },
    de: { name: "LED Röhren", description: "T8- und T5-LED-Röhren als Ersatz für Leuchtstoffröhren in Büros und Geschäften" },
    fr: { name: "Tubes LED", description: "Tubes LED T8 et T5 pour remplacement de fluorescents dans bureaux et commerces" },
    it: { name: "Tubi LED", description: "Tubi LED T8 e T5 per sostituzione fluorescenti in uffici e negozi" },
    nl: { name: "LED Buizen", description: "T8 en T5 LED-buizen als vervanging voor TL-buizen in kantoren en winkels" },
    pl: { name: "Świetlówki LED", description: "Świetlówki LED T8 i T5 jako zamiennik jarzeniówek w biurach i sklepach" },
    pt: { name: "Tubos LED", description: "Tubos LED T8 e T5 para substituição de fluorescentes em escritórios e comércios" },
    zh: { name: "LED灯管", description: "T8和T5 LED灯管，替代办公室和商店的荧光灯管" },
  },
  "tubos-led-all": {
    es: { name: "Tubos LED", description: "Catálogo completo de tubos LED para instalaciones nuevas y retrofit" },
    en: { name: "LED Tubes", description: "Complete catalog of LED tubes for new installations and retrofit" },
    de: { name: "LED Röhren", description: "Vollständiger Katalog von LED-Röhren für Neuinstallationen und Nachrüstung" },
    fr: { name: "Tubes LED", description: "Catalogue complet de tubes LED pour nouvelles installations et rétrofit" },
    it: { name: "Tubi LED", description: "Catalogo completo di tubi LED per nuove installazioni e retrofit" },
    nl: { name: "LED Buizen", description: "Volledig assortiment LED-buizen voor nieuwe installaties en retrofit" },
    pl: { name: "Świetlówki LED", description: "Pełny katalog świetlówek LED do nowych instalacji i retrofitu" },
    pt: { name: "Tubos LED", description: "Catálogo completo de tubos LED para novas instalações e retrofit" },
    zh: { name: "LED灯管", description: "LED灯管全系列，适用于新安装和改造" },
  },
  "tiras-led": {
    es: { name: "Tiras LED", description: "Tiras LED flexibles: SMD, COB, RGB y RGBW para decoración e iluminación indirecta" },
    en: { name: "LED Strips", description: "Flexible LED strips: SMD, COB, RGB and RGBW for decoration and indirect lighting" },
    de: { name: "LED Streifen", description: "Flexible LED-Streifen: SMD, COB, RGB und RGBW für Dekoration und indirekte Beleuchtung" },
    fr: { name: "Rubans LED", description: "Rubans LED flexibles : SMD, COB, RGB et RGBW pour décoration et éclairage indirect" },
    it: { name: "Strisce LED", description: "Strisce LED flessibili: SMD, COB, RGB e RGBW per decorazione e illuminazione indiretta" },
    nl: { name: "LED Strips", description: "Flexibele LED-strips: SMD, COB, RGB en RGBW voor decoratie en indirecte verlichting" },
    pl: { name: "Taśmy LED", description: "Elastyczne taśmy LED: SMD, COB, RGB i RGBW do dekoracji i oświetlenia pośredniego" },
    pt: { name: "Fitas LED", description: "Fitas LED flexíveis: SMD, COB, RGB e RGBW para decoração e iluminação indireta" },
    zh: { name: "LED灯带", description: "柔性LED灯带：SMD、COB、RGB和RGBW，用于装饰和间接照明" },
  },
  alimentacion: {
    es: { name: "Alimentación", description: "Fuentes de alimentación y drivers LED para instalaciones de iluminación" },
    en: { name: "Power Supply", description: "LED power supplies and drivers for lighting installations" },
    de: { name: "Stromversorgung", description: "LED-Netzteile und Treiber für Beleuchtungsinstallationen" },
    fr: { name: "Alimentation", description: "Alimentations et drivers LED pour installations d'éclairage" },
    it: { name: "Alimentazione", description: "Alimentatori e driver LED per installazioni di illuminazione" },
    nl: { name: "Voeding", description: "LED-voedingen en drivers voor verlichtingsinstallaties" },
    pl: { name: "Zasilanie", description: "Zasilacze i sterowniki LED do instalacji oświetleniowych" },
    pt: { name: "Alimentação", description: "Fontes de alimentação e drivers LED para instalações de iluminação" },
    zh: { name: "电源", description: "LED电源和驱动器，适用于照明安装" },
  },
  "fuente-alimentacion": {
    es: { name: "Fuentes de Alimentación", description: "Fuentes de alimentación LED de 12V y 24V para tiras LED y luminarias" },
    en: { name: "Power Supplies", description: "12V and 24V LED power supplies for LED strips and luminaires" },
    de: { name: "Netzteile", description: "12V- und 24V-LED-Netzteile für LED-Streifen und Leuchten" },
    fr: { name: "Alimentations", description: "Alimentations LED 12V et 24V pour rubans LED et luminaires" },
    it: { name: "Alimentatori", description: "Alimentatori LED 12V e 24V per strisce LED e apparecchi" },
    nl: { name: "Voedingen", description: "12V en 24V LED-voedingen voor LED-strips en armaturen" },
    pl: { name: "Zasilacze", description: "Zasilacze LED 12V i 24V do taśm LED i opraw oświetleniowych" },
    pt: { name: "Fontes de Alimentação", description: "Fontes de alimentação LED 12V e 24V para fitas LED e luminarias" },
    zh: { name: "LED电源", description: "12V和24V LED电源，适用于LED灯带和灯具" },
  },
  transformador: {
    es: { name: "Transformadores", description: "Transformadores y drivers LED regulables y no regulables" },
    en: { name: "Transformers", description: "Dimmable and non-dimmable LED transformers and drivers" },
    de: { name: "Transformatoren", description: "Dimmbare und nicht dimmbare LED-Transformatoren und Treiber" },
    fr: { name: "Transformateurs", description: "Transformateurs et drivers LED dimmables et non dimmables" },
    it: { name: "Trasformatori", description: "Trasformatori e driver LED dimmerabili e non dimmerabili" },
    nl: { name: "Transformatoren", description: "Dimbare en niet-dimbare LED-transformatoren en drivers" },
    pl: { name: "Transformatory", description: "Ściemniane i nieściemniane transformatory i sterowniki LED" },
    pt: { name: "Transformadores", description: "Transformadores e drivers LED reguláveis e não reguláveis" },
    zh: { name: "变压器", description: "可调光和不可调光LED变压器和驱动器" },
  },
  accesorios: {
    es: { name: "Accesorios", description: "Accesorios para iluminación LED: conectores, perfiles, soportes y controladores" },
    en: { name: "Accessories", description: "LED lighting accessories: connectors, profiles, brackets and controllers" },
    de: { name: "Zubehör", description: "LED-Beleuchtungszubehör: Verbinder, Profile, Halterungen und Controller" },
    fr: { name: "Accessoires", description: "Accessoires d'éclairage LED : connecteurs, profilés, supports et contrôleurs" },
    it: { name: "Accessori", description: "Accessori per illuminazione LED: connettori, profili, staffe e controller" },
    nl: { name: "Accessoires", description: "LED-verlichtingsaccessoires: connectoren, profielen, beugels en controllers" },
    pl: { name: "Akcesoria", description: "Akcesoria do oświetlenia LED: złącza, profile, uchwyty i kontrolery" },
    pt: { name: "Acessórios", description: "Acessórios de iluminação LED: conectores, perfis, suportes e controladores" },
    zh: { name: "配件", description: "LED照明配件：连接器、型材、支架和控制器" },
  },
  "accesorios-all": {
    es: { name: "Accesorios", description: "Todos los accesorios para instalaciones de iluminación LED" },
    en: { name: "Accessories", description: "All accessories for LED lighting installations" },
    de: { name: "Zubehör", description: "Sämtliches Zubehör für LED-Beleuchtungsinstallationen" },
    fr: { name: "Accessoires", description: "Tous les accessoires pour installations d'éclairage LED" },
    it: { name: "Accessori", description: "Tutti gli accessori per installazioni di illuminazione LED" },
    nl: { name: "Accessoires", description: "Alle accessoires voor LED-verlichtingsinstallaties" },
    pl: { name: "Akcesoria", description: "Wszystkie akcesoria do instalacji oświetlenia LED" },
    pt: { name: "Acessórios", description: "Todos os acessórios para instalações de iluminação LED" },
    zh: { name: "配件", description: "LED照明安装的所有配件" },
  },
};

// ============================================================
// Attribute name translations: key -> { lang: name }
// ============================================================
const attributeTranslations: Record<string, Record<string, string>> = {
  application: { en: "Application", es: "Uso", de: "Anwendung", fr: "Application", it: "Applicazione", nl: "Toepassing", pl: "Zastosowanie", pt: "Aplicação", zh: "应用" },
  base: { en: "Base/Socket", es: "Casquillo", de: "Sockel", fr: "Culot", it: "Attacco", nl: "Fitting", pl: "Gwint", pt: "Casquilho", zh: "灯头" },
  battery: { en: "Battery", es: "Batería", de: "Batterie", fr: "Batterie", it: "Batteria", nl: "Batterij", pl: "Bateria", pt: "Bateria", zh: "电池" },
  beam_angle: { en: "Beam Angle", es: "Ángulo de Apertura", de: "Abstrahlwinkel", fr: "Angle de Faisceau", it: "Angolo di Apertura", nl: "Stralingshoek", pl: "Kąt Świecenia", pt: "Ângulo de Abertura", zh: "光束角" },
  brightness: { en: "Brightness", es: "Brillo", de: "Helligkeit", fr: "Luminosité", it: "Luminosità", nl: "Helderheid", pl: "Jasność", pt: "Brilho", zh: "亮度" },
  bulb_count: { en: "Bulb Count", es: "Número de Bombillas", de: "Anzahl Leuchtmittel", fr: "Nombre d'Ampoules", it: "Numero di Lampadine", nl: "Aantal Lampen", pl: "Liczba Żarówek", pt: "Número de Lâmpadas", zh: "灯泡数量" },
  bulb_type: { en: "Bulb Type", es: "Tipo de Bombilla", de: "Leuchtmitteltyp", fr: "Type d'Ampoule", it: "Tipo di Lampadina", nl: "Lamptype", pl: "Typ Żarówki", pt: "Tipo de Lâmpada", zh: "灯泡类型" },
  cct: { en: "Color Temperature", es: "Temperatura de Color", de: "Farbtemperatur", fr: "Température de Couleur", it: "Temperatura di Colore", nl: "Kleurtemperatuur", pl: "Temperatura Barwowa", pt: "Temperatura de Cor", zh: "色温" },
  charging_time: { en: "Charging Time", es: "Tiempo de Carga", de: "Ladezeit", fr: "Temps de Charge", it: "Tempo di Ricarica", nl: "Oplaadtijd", pl: "Czas Ładowania", pt: "Tempo de Carregamento", zh: "充电时间" },
  chargingType: { en: "Charging Type", es: "Tipo de Carga", de: "Ladeart", fr: "Type de Charge", it: "Tipo di Ricarica", nl: "Oplaadtype", pl: "Typ Ładowania", pt: "Tipo de Carregamento", zh: "充电类型" },
  color: { en: "Color", es: "Color", de: "Farbe", fr: "Couleur", it: "Colore", nl: "Kleur", pl: "Kolor", pt: "Cor", zh: "颜色" },
  compatibilidad: { en: "Compatibility", es: "Compatibilidad", de: "Kompatibilität", fr: "Compatibilité", it: "Compatibilità", nl: "Compatibiliteit", pl: "Kompatybilność", pt: "Compatibilidade", zh: "兼容性" },
  connection: { en: "Connection", es: "Conexión", de: "Anschluss", fr: "Connexion", it: "Connessione", nl: "Aansluiting", pl: "Połączenie", pt: "Conexão", zh: "连接" },
  coverage_area: { en: "Coverage Area", es: "Área de Trabajo", de: "Abdeckungsbereich", fr: "Surface Couverte", it: "Area di Copertura", nl: "Dekkingsgebied", pl: "Obszar Pokrycia", pt: "Área de Cobertura", zh: "覆盖面积" },
  cpu: { en: "CPU", es: "CPU", de: "CPU", fr: "CPU", it: "CPU", nl: "CPU", pl: "CPU", pt: "CPU", zh: "CPU" },
  cri: { en: "CRI", es: "CRI", de: "CRI", fr: "IRC", it: "CRI", nl: "CRI", pl: "CRI", pt: "IRC", zh: "显色指数" },
  current: { en: "Current", es: "Intensidad de Corriente", de: "Stromstärke", fr: "Intensité", it: "Corrente", nl: "Stroomsterkte", pl: "Natężenie Prądu", pt: "Corrente", zh: "电流" },
  cut_size: { en: "Cutout Size", es: "Dimensión de Corte", de: "Einbauöffnung", fr: "Dimension de Découpe", it: "Dimensione del Foro", nl: "Inbouwopening", pl: "Wymiar Otworu", pt: "Dimensão de Corte", zh: "开孔尺寸" },
  cutLength: { en: "Cut Length", es: "Corte Cada", de: "Schnittlänge", fr: "Longueur de Coupe", it: "Lunghezza di Taglio", nl: "Snijlengte", pl: "Długość Cięcia", pt: "Comprimento de Corte", zh: "裁剪长度" },
  dimensions: { en: "Dimensions", es: "Dimensiones", de: "Abmessungen", fr: "Dimensions", it: "Dimensioni", nl: "Afmetingen", pl: "Wymiary", pt: "Dimensões", zh: "尺寸" },
  dimmable: { en: "Dimmable", es: "Regulable", de: "Dimmbar", fr: "Dimmable", it: "Dimmerabile", nl: "Dimbaar", pl: "Ściemnianie", pt: "Regulável", zh: "可调光" },
  driver: { en: "Driver", es: "Driver", de: "Treiber", fr: "Driver", it: "Driver", nl: "Driver", pl: "Sterownik", pt: "Driver", zh: "驱动器" },
  fan_speed: { en: "Fan Speed", es: "Velocidades", de: "Lüftergeschwindigkeit", fr: "Vitesse du Ventilateur", it: "Velocità Ventilatore", nl: "Ventilatorsnelheid", pl: "Prędkość Wentylatora", pt: "Velocidade do Ventilador", zh: "风扇速度" },
  finish: { en: "Finish", es: "Acabado", de: "Oberfläche", fr: "Finition", it: "Finitura", nl: "Afwerking", pl: "Wykończenie", pt: "Acabamento", zh: "表面处理" },
  frequency: { en: "Frequency", es: "Frecuencia", de: "Frequenz", fr: "Fréquence", it: "Frequenza", nl: "Frequentie", pl: "Częstotliwość", pt: "Frequência", zh: "频率" },
  frequencyRange: { en: "Frequency Range", es: "Rango de Frecuencia", de: "Frequenzbereich", fr: "Plage de Fréquence", it: "Gamma di Frequenza", nl: "Frequentiebereik", pl: "Zakres Częstotliwości", pt: "Faixa de Frequência", zh: "频率范围" },
  frequencyResponse: { en: "Frequency Response", es: "Respuesta de Frecuencia", de: "Frequenzgang", fr: "Réponse en Fréquence", it: "Risposta in Frequenza", nl: "Frequentierespons", pl: "Odpowiedź Częstotliwościowa", pt: "Resposta em Frequência", zh: "频率响应" },
  funcion: { en: "Function", es: "Función", de: "Funktion", fr: "Fonction", it: "Funzione", nl: "Functie", pl: "Funkcja", pt: "Função", zh: "功能" },
  ik: { en: "Impact Resistance", es: "Resistencia al Impacto", de: "Stoßfestigkeit", fr: "Résistance aux Chocs", it: "Resistenza agli Urti", nl: "Slagvastheid", pl: "Odporność na Uderzenia", pt: "Resistência ao Impacto", zh: "抗冲击等级" },
  impedance: { en: "Impedance", es: "Impedancia", de: "Impedanz", fr: "Impédance", it: "Impedenza", nl: "Impedantie", pl: "Impedancja", pt: "Impedância", zh: "阻抗" },
  input: { en: "Input", es: "Entrada", de: "Eingang", fr: "Entrée", it: "Ingresso", nl: "Ingang", pl: "Wejście", pt: "Entrada", zh: "输入" },
  ip: { en: "IP Rating", es: "Protección IP", de: "IP-Schutzart", fr: "Indice IP", it: "Grado IP", nl: "IP-classificatie", pl: "Stopień IP", pt: "Proteção IP", zh: "IP防护等级" },
  ledPerMeter: { en: "LED/m", es: "LED/m", de: "LED/m", fr: "LED/m", it: "LED/m", nl: "LED/m", pl: "LED/m", pt: "LED/m", zh: "LED/m" },
  lifespan: { en: "Lifespan", es: "Vida Útil", de: "Lebensdauer", fr: "Durée de Vie", it: "Durata", nl: "Levensduur", pl: "Żywotność", pt: "Vida Útil", zh: "使用寿命" },
  lightSource: { en: "Light Source", es: "Fuente Lumínica", de: "Lichtquelle", fr: "Source Lumineuse", it: "Sorgente Luminosa", nl: "Lichtbron", pl: "Źródło Światła", pt: "Fonte Luminosa", zh: "光源" },
  lumen: { en: "Luminous Flux", es: "Lúmenes", de: "Lichtstrom", fr: "Flux Lumineux", it: "Flusso Luminoso", nl: "Lichtstroom", pl: "Strumień Świetlny", pt: "Fluxo Luminoso", zh: "光通量" },
  luminousEfficiency: { en: "Luminous Efficiency", es: "Eficiencia Luminosa", de: "Lichtausbeute", fr: "Efficacité Lumineuse", it: "Efficienza Luminosa", nl: "Lichtopbrengst", pl: "Wydajność Świetlna", pt: "Eficiência Luminosa", zh: "光效" },
  material: { en: "Material", es: "Material", de: "Material", fr: "Matériau", it: "Materiale", nl: "Materiaal", pl: "Materiał", pt: "Material", zh: "材料" },
  maxInstallLength: { en: "Max Install Length", es: "Longitud Máxima de Instalación", de: "Maximale Installationslänge", fr: "Longueur Maximale d'Installation", it: "Lunghezza Massima di Installazione", nl: "Maximale Installatielengte", pl: "Maksymalna Długość Instalacji", pt: "Comprimento Máximo de Instalação", zh: "最大安装长度" },
  maxLength: { en: "Max Length", es: "Longitud Máxima", de: "Maximale Länge", fr: "Longueur Maximale", it: "Lunghezza Massima", nl: "Maximale Lengte", pl: "Maksymalna Długość", pt: "Comprimento Máximo", zh: "最大长度" },
  memoria: { en: "Storage", es: "Memoria", de: "Speicher", fr: "Mémoire", it: "Memoria", nl: "Geheugen", pl: "Pamięć", pt: "Memória", zh: "存储" },
  microphone: { en: "Microphone", es: "Micrófono", de: "Mikrofon", fr: "Microphone", it: "Microfono", nl: "Microfoon", pl: "Mikrofon", pt: "Microfone", zh: "麦克风" },
  modelo: { en: "Model", es: "Modelo", de: "Modell", fr: "Modèle", it: "Modello", nl: "Model", pl: "Model", pt: "Modelo", zh: "型号" },
  noise: { en: "Noise Level", es: "Nivel de Ruido", de: "Geräuschpegel", fr: "Niveau de Bruit", it: "Livello di Rumore", nl: "Geluidsniveau", pl: "Poziom Hałasu", pt: "Nível de Ruído", zh: "噪音等级" },
  operating_temp: { en: "Operating Temperature", es: "Temperatura de Funcionamiento", de: "Betriebstemperatur", fr: "Température de Fonctionnement", it: "Temperatura di Funzionamento", nl: "Bedrijfstemperatuur", pl: "Temperatura Pracy", pt: "Temperatura de Funcionamento", zh: "工作温度" },
  output: { en: "Output", es: "Salida", de: "Ausgang", fr: "Sortie", it: "Uscita", nl: "Uitgang", pl: "Wyjście", pt: "Saída", zh: "输出" },
  panelType: { en: "Panel Type", es: "Tipo de Panel", de: "Paneltyp", fr: "Type de Panneau", it: "Tipo di Pannello", nl: "Paneeltype", pl: "Typ Panelu", pt: "Tipo de Painel", zh: "面板类型" },
  pixelPitch: { en: "Pixel Pitch", es: "Pixel Pitch", de: "Pixelabstand", fr: "Pas de Pixel", it: "Passo Pixel", nl: "Pixelafstand", pl: "Rozstaw Pikseli", pt: "Pitch de Pixel", zh: "像素间距" },
  power: { en: "Power", es: "Potencia", de: "Leistung", fr: "Puissance", it: "Potenza", nl: "Vermogen", pl: "Moc", pt: "Potência", zh: "功率" },
  protection: { en: "Protection", es: "Protección", de: "Schutz", fr: "Protection", it: "Protezione", nl: "Bescherming", pl: "Ochrona", pt: "Proteção", zh: "防护" },
  refreshRate: { en: "Refresh Rate", es: "Frecuencia de Refresco", de: "Bildwiederholrate", fr: "Taux de Rafraîchissement", it: "Frequenza di Aggiornamento", nl: "Verversingsfrequentie", pl: "Częstotliwość Odświeżania", pt: "Taxa de Atualização", zh: "刷新率" },
  remote: { en: "Remote Control", es: "Control Remoto", de: "Fernbedienung", fr: "Télécommande", it: "Telecomando", nl: "Afstandsbediening", pl: "Pilot", pt: "Controlo Remoto", zh: "遥控器" },
  resolution: { en: "Resolution", es: "Resolución", de: "Auflösung", fr: "Résolution", it: "Risoluzione", nl: "Resolutie", pl: "Rozdzielczość", pt: "Resolução", zh: "分辨率" },
  sensitivity: { en: "Sensitivity", es: "Sensibilidad", de: "Empfindlichkeit", fr: "Sensibilité", it: "Sensibilità", nl: "Gevoeligheid", pl: "Czułość", pt: "Sensibilidade", zh: "灵敏度" },
  size: { en: "Size", es: "Tamaño", de: "Größe", fr: "Taille", it: "Dimensione", nl: "Maat", pl: "Rozmiar", pt: "Tamanho", zh: "尺寸" },
  speed: { en: "Speed", es: "Velocidad", de: "Geschwindigkeit", fr: "Vitesse", it: "Velocità", nl: "Snelheid", pl: "Prędkość", pt: "Velocidade", zh: "速度" },
  voltage: { en: "Voltage", es: "Voltaje", de: "Spannung", fr: "Tension", it: "Tensione", nl: "Spanning", pl: "Napięcie", pt: "Voltagem", zh: "电压" },
  warranty: { en: "Warranty", es: "Garantía", de: "Garantie", fr: "Garantie", it: "Garanzia", nl: "Garantie", pl: "Gwarancja", pt: "Garantia", zh: "保修" },
  weight: { en: "Weight", es: "Peso", de: "Gewicht", fr: "Poids", it: "Peso", nl: "Gewicht", pl: "Waga", pt: "Peso", zh: "重量" },
  width: { en: "Width", es: "Ancho", de: "Breite", fr: "Largeur", it: "Larghezza", nl: "Breedte", pl: "Szerokość", pt: "Largura", zh: "宽度" },
};

async function main() {
  console.log("=== 开始修复迁移数据 ===\n");

  // 1. Fix the product missing SEO
  console.log("1. 修复缺少SEO的产品...");
  const prodMissingSeo = await prisma.product.findFirst({
    where: { slug: "lampara-colgante-61059-500cu" },
    select: { id: true, content: true },
  });
  if (prodMissingSeo) {
    const content = prodMissingSeo.content as any;
    const langs = ["es", "en", "de", "fr", "it", "nl", "pl", "pt", "zh"];
    const seoData: Record<string, { title: string; desc: string }> = {
      es: { title: "Lámpara Colgante 61059-500CU | 120W LED CCT", desc: "Lámpara colgante LED 61059-500CU de 120W con temperatura de color ajustable CCT. 2 años de garantía." },
      en: { title: "Pendant Lamp 61059-500CU | 120W LED CCT", desc: "120W LED pendant lamp 61059-500CU with adjustable CCT color temperature. 2-year warranty." },
      de: { title: "Pendelleuchte 61059-500CU | 120W LED CCT", desc: "120W LED Pendelleuchte 61059-500CU mit einstellbarer CCT Farbtemperatur. 2 Jahre Garantie." },
      fr: { title: "Suspension 61059-500CU | 120W LED CCT", desc: "Suspension LED 61059-500CU de 120W avec température de couleur CCT réglable. Garantie 2 ans." },
      it: { title: "Lampada a Sospensione 61059-500CU | 120W LED CCT", desc: "Lampada a sospensione LED 61059-500CU da 120W con temperatura colore CCT regolabile. Garanzia 2 anni." },
      nl: { title: "Hanglamp 61059-500CU | 120W LED CCT", desc: "120W LED hanglamp 61059-500CU met instelbare CCT kleurtemperatuur. 2 jaar garantie." },
      pl: { title: "Lampa Wisząca 61059-500CU | 120W LED CCT", desc: "Lampa wisząca LED 61059-500CU 120W z regulowaną temperaturą barwową CCT. 2 lata gwarancji." },
      pt: { title: "Candeeiro Suspenso 61059-500CU | 120W LED CCT", desc: "Candeeiro suspenso LED 61059-500CU de 120W com temperatura de cor CCT ajustável. Garantia de 2 anos." },
      zh: { title: "吊灯 61059-500CU | 120W LED CCT", desc: "120W LED吊灯 61059-500CU，可调色温CCT。2年质保。" },
    };
    for (const lang of langs) {
      if (content[lang]) {
        content[lang].seoTitle = seoData[lang].title;
        content[lang].seoDescription = seoData[lang].desc;
      }
    }
    await prisma.product.update({
      where: { id: prodMissingSeo.id },
      data: { content },
    });
    console.log("  ✓ SEO已添加到 lampara-colgante-61059-500cu");
  }

  // 2. Update all category content with full 9-language translations
  console.log("\n2. 更新分类翻译和描述...");
  const allCats = await prisma.category.findMany({
    select: { id: true, slug: true, content: true },
  });

  let catUpdated = 0;
  for (const cat of allCats) {
    const trans = categoryTranslations[cat.slug];
    if (!trans) continue;

    const content = (cat.content as any) || {};
    const imageUrl = content.imageUrl;
    let changed = false;

    for (const [lang, data] of Object.entries(trans)) {
      if (!content[lang]) {
        content[lang] = {};
        changed = true;
      }
      if (content[lang].name !== data.name) {
        content[lang].name = data.name;
        changed = true;
      }
      if (content[lang].description !== data.description) {
        content[lang].description = data.description;
        changed = true;
      }
    }

    // Preserve imageUrl at top level
    if (imageUrl) {
      content.imageUrl = imageUrl;
    }

    if (changed) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { content },
      });
      catUpdated++;
    }
  }
  console.log(`  ✓ 更新了 ${catUpdated} 个分类`);

  // 3. Update attribute definitions with 9-language names
  console.log("\n3. 更新属性定义翻译...");
  const allAttrs = await prisma.attributeDefinition.findMany({
    select: { id: true, key: true, name: true },
  });

  let attrUpdated = 0;
  for (const attr of allAttrs) {
    const trans = attributeTranslations[attr.key];
    if (!trans) {
      console.log(`  ⚠ 未找到属性翻译: ${attr.key}`);
      continue;
    }

    const currentName = (attr.name as any) || {};
    let changed = false;

    for (const [lang, name] of Object.entries(trans)) {
      if (currentName[lang] !== name) {
        currentName[lang] = name;
        changed = true;
      }
    }

    if (changed) {
      await prisma.attributeDefinition.update({
        where: { id: attr.id },
        data: { name: currentName },
      });
      attrUpdated++;
    }
  }
  console.log(`  ✓ 更新了 ${attrUpdated} 个属性定义`);

  // 4. Summary
  console.log("\n=== 修复完成 ===");
  console.log("- 1 个产品SEO已修复");
  console.log(`- ${catUpdated} 个分类已更新（名称+描述 x 9语言）`);
  console.log(`- ${attrUpdated} 个属性定义已更新（名称 x 9语言）`);
  console.log("- 2 个零价格变体保留（pantallas LED 为报价类产品）");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
