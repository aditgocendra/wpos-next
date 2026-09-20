import { IconTrendingUp } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function SectionCards() {
  const session = await getServerSession(authOptions)
  const isWarehouseAdmin = session?.user?.role === "WAREHOUSE_ADMIN"
  const warehouseId = session?.user?.warehouseId

  const [totalProducts, totalVariants, totalCategories, totalWarehouses] =
    await Promise.all([
      isWarehouseAdmin && warehouseId
        ? prisma.product.count({
            where: {
              variants: {
                some: {
                  warehouseStocks: {
                    some: { warehouseId },
                  },
                },
              },
            },
          })
        : prisma.product.count(),
      isWarehouseAdmin && warehouseId
        ? prisma.productVariant.count({
            where: {
              warehouseStocks: {
                some: { warehouseId },
              },
            },
          })
        : prisma.productVariant.count(),
      prisma.category.count(),
      isWarehouseAdmin && warehouseId
        ? prisma.warehouse.count({ where: { id: warehouseId } })
        : prisma.warehouse.count(),
    ])

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Product</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalProducts.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Master products registered <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total products in database
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Variant</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalVariants.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Product variants available <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total SKUs across all products
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Category</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalCategories.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Organized categories <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total categories in database
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Warehouse</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalWarehouses.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Storage & logistics hubs <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total warehouses in database
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
