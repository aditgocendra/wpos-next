import { prisma } from "@/lib/prisma";

export async function sendFonnteMessage(target: string, message: string) {
  try {
    const isEnabledSetting = await prisma.systemSetting.findUnique({
      where: { key: "FONNTE_ENABLED" },
    });
    
    if (isEnabledSetting?.value !== "true") {
      return false;
    }

    const tokenSetting = await prisma.systemSetting.findUnique({
      where: { key: "FONNTE_TOKEN" },
    });

    const token = tokenSetting?.value;
    if (!token) {
      return false;
    }

    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: new URLSearchParams({
        target,
        message,
      }),
    });

    const data = await response.json();
    if (data.status) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

export async function notifyPriceChange(productName: string, variantName: string, oldPrice: number, newPrice: number) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "WAREHOUSE_ADMIN", phoneNumber: { not: null } },
    });

    if (admins.length === 0) return;

    const formatPrice = (p: number) =>
      new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(p);

    const message = `WPOS (PERUBAHAN HARGA JUAL)\n\nNama Produk : ${productName}\nVariant : ${variantName}\nHarga : ${formatPrice(oldPrice)} -> ${formatPrice(newPrice)}\n\nMOHON UNTUK TIDAK MEMBALAS PESAN INI`;

    for (const admin of admins) {
      if (admin.phoneNumber) {
        await sendFonnteMessage(admin.phoneNumber, message);
      }
    }
  } catch (error) {
    // silently fail
  }
}

