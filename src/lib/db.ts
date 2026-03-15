import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL;
  const datasourceUrl =
    url && !url.includes("pgbouncer=true")
      ? `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`
      : url;

  return new PrismaClient({
    datasourceUrl,
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const db = globalThis.prisma ?? prismaClientSingleton();

export { db };
export default db;

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
