import { getLocalized } from "../content";

describe("getLocalized", () => {
  const mockContent = {
    en: { name: "LED Panel Light", description: "High quality LED panel" },
    es: { name: "Panel LED", description: "Panel LED de alta calidad" },
    de: { name: "LED Panel", description: "Hochwertiges LED-Panel" },
    images: [
      { url: "https://example.com/img1.jpg" },
      { url: "https://example.com/img2.jpg" },
    ],
  };

  it("should return English content by default", () => {
    const result = getLocalized(mockContent);
    expect(result.name).toBe("LED Panel Light");
    expect(result.description).toBe("High quality LED panel");
  });

  it("should return requested locale content", () => {
    const result = getLocalized(mockContent, "es");
    expect(result.name).toBe("Panel LED");
    expect(result.description).toBe("Panel LED de alta calidad");
  });

  it("should fallback to English when locale not available", () => {
    const result = getLocalized(mockContent, "fr");
    expect(result.name).toBe("LED Panel Light");
  });

  it("should return images array", () => {
    const result = getLocalized(mockContent);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].url).toBe("https://example.com/img1.jpg");
  });

  it("should handle null/undefined content", () => {
    const result = getLocalized(null);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
    expect(result.images).toEqual([]);
  });

  it("should handle content with no images", () => {
    const result = getLocalized({ en: { name: "Test", description: "" } });
    expect(result.images).toEqual([]);
  });

  it("should fallback when locale has empty name", () => {
    const content = {
      en: { name: "English Name", description: "" },
      fr: { name: "", description: "Description en francais" },
    };
    const result = getLocalized(content, "fr");
    // Empty name should trigger fallback to English
    expect(result.name).toBe("English Name");
  });

  it('should return "Untitled" when no name is available in any locale', () => {
    const content = { images: [] };
    const result = getLocalized(content, "en");
    expect(result.name).toBe("Untitled");
  });
});
