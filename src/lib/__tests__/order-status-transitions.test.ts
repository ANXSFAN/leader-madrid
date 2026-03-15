/**
 * Tests for order status transition validation logic.
 * This mirrors the transition rules defined in updateOrderStatus.
 */

describe("Order Status Transitions", () => {
  // Extracted from src/lib/actions/order.ts updateOrderStatus
  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ["PENDING", "CONFIRMED", "CANCELLED"],
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "RETURNED"],
    DELIVERED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
  };

  function isTransitionAllowed(from: string, to: string): boolean {
    const allowed = allowedTransitions[from];
    return allowed ? allowed.includes(to) : false;
  }

  describe("valid transitions", () => {
    const validCases: [string, string][] = [
      ["DRAFT", "PENDING"],
      ["DRAFT", "CONFIRMED"],
      ["DRAFT", "CANCELLED"],
      ["PENDING", "CONFIRMED"],
      ["PENDING", "CANCELLED"],
      ["CONFIRMED", "PROCESSING"],
      ["CONFIRMED", "SHIPPED"],
      ["CONFIRMED", "CANCELLED"],
      ["PROCESSING", "SHIPPED"],
      ["PROCESSING", "CANCELLED"],
      ["SHIPPED", "DELIVERED"],
      ["SHIPPED", "RETURNED"],
      ["DELIVERED", "RETURNED"],
    ];

    validCases.forEach(([from, to]) => {
      it(`should allow ${from} → ${to}`, () => {
        expect(isTransitionAllowed(from, to)).toBe(true);
      });
    });
  });

  describe("invalid transitions", () => {
    const invalidCases: [string, string][] = [
      ["CANCELLED", "PENDING"],
      ["CANCELLED", "CONFIRMED"],
      ["RETURNED", "DELIVERED"],
      ["RETURNED", "SHIPPED"],
      ["DELIVERED", "PROCESSING"],
      ["DELIVERED", "CONFIRMED"],
      ["SHIPPED", "PROCESSING"],
      ["SHIPPED", "CONFIRMED"],
      ["PROCESSING", "PENDING"],
      ["PROCESSING", "DRAFT"],
      ["PENDING", "DRAFT"],
      // Can't skip ahead
      ["DRAFT", "SHIPPED"],
      ["DRAFT", "DELIVERED"],
      ["PENDING", "SHIPPED"],
      ["PENDING", "DELIVERED"],
    ];

    invalidCases.forEach(([from, to]) => {
      it(`should NOT allow ${from} → ${to}`, () => {
        expect(isTransitionAllowed(from, to)).toBe(false);
      });
    });
  });

  describe("terminal states", () => {
    it("CANCELLED should have no outgoing transitions", () => {
      expect(allowedTransitions["CANCELLED"]).toEqual([]);
    });

    it("RETURNED should have no outgoing transitions", () => {
      expect(allowedTransitions["RETURNED"]).toEqual([]);
    });
  });

  describe("completeness", () => {
    it("should define transitions for all order statuses", () => {
      const allStatuses = [
        "DRAFT",
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
      ];

      allStatuses.forEach((status) => {
        expect(allowedTransitions).toHaveProperty(status);
      });
    });

    it("all target statuses should also be defined as source statuses", () => {
      const allSources = new Set(Object.keys(allowedTransitions));

      Object.values(allowedTransitions).forEach((targets) => {
        targets.forEach((target) => {
          expect(allSources.has(target)).toBe(true);
        });
      });
    });
  });
});
