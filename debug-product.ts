import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: {
      sku: "DEMO-00164",
    },
    include: {
      variants: true,
    },
  });

  console.log(JSON.stringify(product, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
