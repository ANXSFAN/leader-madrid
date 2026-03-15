/**
 * Auth guard tests — verifies role-based access control.
 */

const mockGetServerSession = jest.fn();

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireRole } from "../auth-guard";

describe("requireRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return null when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const result = await requireRole(["ADMIN"]);
    expect(result).toBeNull();
  });

  it("should return null when session has no user", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: null });

    const result = await requireRole(["ADMIN"]);
    expect(result).toBeNull();
  });

  it("should return null when user role is not in allowed list", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "user-1", role: "CUSTOMER" },
    });

    const result = await requireRole(["ADMIN", "SALES_REP"]);
    expect(result).toBeNull();
  });

  it("should return session when user has ADMIN role", async () => {
    const session = { user: { id: "user-1", role: "ADMIN" } };
    mockGetServerSession.mockResolvedValueOnce(session);

    const result = await requireRole(["ADMIN"]);
    expect(result).toBe(session);
  });

  it("should return session when user has one of allowed roles", async () => {
    const session = { user: { id: "user-1", role: "WAREHOUSE_MANAGER" } };
    mockGetServerSession.mockResolvedValueOnce(session);

    const result = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
    expect(result).toBe(session);
  });

  it("should use default roles (ADMIN, SALES_REP, WAREHOUSE_MANAGER) when no args", async () => {
    const session = { user: { id: "user-1", role: "SALES_REP" } };
    mockGetServerSession.mockResolvedValueOnce(session);

    const result = await requireRole();
    expect(result).toBe(session);
  });

  it("should reject CUSTOMER from default roles", async () => {
    const session = { user: { id: "user-1", role: "CUSTOMER" } };
    mockGetServerSession.mockResolvedValueOnce(session);

    const result = await requireRole();
    expect(result).toBeNull();
  });
});
