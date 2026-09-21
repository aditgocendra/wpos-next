import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Starting HPP migration...');

  // Get all product variants with their stocks
  const variants = await prisma.productVariant.findMany({
    include: {
      warehouseStocks: true,
    }
  });

  console.log(`Found ${variants.length} variants to process.`);
  let updatedCount = 0;

  for (const variant of variants) {
    const globalHpp = variant.priceCost;
    
    for (const stock of variant.warehouseStocks) {
      if (stock.priceCost !== globalHpp) {
        await prisma.productVariantStock.update({
          where: { id: stock.id },
          data: { priceCost: globalHpp }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully migrated HPP for ${updatedCount} warehouse stock records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
