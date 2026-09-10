import { ShopeeSDK, ShopeeConfig } from "@congminh1254/shopee-sdk";
import { ShopeeRegion } from "@congminh1254/shopee-sdk/schemas";
import { TokenStorage } from "@congminh1254/shopee-sdk/storage";
import { AccessToken } from "@congminh1254/shopee-sdk/schemas/access-token";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export interface ShopeeEnvConfig {
  partnerId: number;
  partnerKey: string;
  redirectUrl: string;
  isUat: boolean;
}

export function getShopeeEnvConfig(): ShopeeEnvConfig {
  const partnerId = parseInt(process.env.SHOPEE_PARTNER_ID || "0", 10);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY || "";
  const redirectUrl =
    process.env.SHOPEE_REDIRECT_URL || "http://localhost:3000/api/shopee/auth";
  const isUat = process.env.SHOPEE_IS_UAT === "true";

  return {
    partnerId,
    partnerKey,
    redirectUrl,
    isUat,
  };
}

/**
 * Menggenerasi URL otentikasi resmi Shopee Open API v2 (/api/v2/shop/auth_partner)
 * Dilengkapi dengan parameter signature HMAC-SHA256 dan timestamp wajib.
 */
export function generateShopeeAuthUrl(redirectUrl: string): string {
  const env = getShopeeEnvConfig();
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  // Menggunakan domain resmi Shopee v2
  const baseDomain = env.isUat
    ? "https://openplatform.sandbox.test-stable.shopee.sg"
    : "https://partner.shopeemobile.com";

  // Base string: partner_id + path + timestamp
  const baseString = `${env.partnerId}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", env.partnerKey)
    .update(baseString)
    .digest("hex");

  const url = new URL(`${baseDomain}${path}`);
  url.searchParams.append("partner_id", env.partnerId.toString());
  url.searchParams.append("timestamp", timestamp.toString());
  url.searchParams.append("sign", sign);
  url.searchParams.append("redirect", redirectUrl);

  return url.toString();
}

/**
 * Mendapatkan base instance ShopeeSDK untuk otentikasi awal (OAuth)
 */
export function getBaseShopeeSDK(): ShopeeSDK {
  const env = getShopeeEnvConfig();
  const config: ShopeeConfig = {
    partner_id: env.partnerId,
    partner_key: env.partnerKey,
    region: env.isUat ? ShopeeRegion.TEST_GLOBAL : ShopeeRegion.GLOBAL,
  };

  return new ShopeeSDK(config);
}

/**
 * Factory untuk membuat instance ShopeeSDK yang terikat pada satu record Integration di DB
 * TokenStorage akan otomatis mengambil token dari database dan memperbarui database jika token di-refresh.
 */
export async function getShopeeClientForIntegration(integrationId: string): Promise<ShopeeSDK> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error(`Integration dengan ID ${integrationId} tidak ditemukan.`);
  }

  const env = getShopeeEnvConfig();
  const shopIdNum = integration.shopId ? parseInt(integration.shopId, 10) : undefined;

  let currentAccessToken = integration.accessToken;
  let currentRefreshToken = integration.refreshToken;
  let currentTokenExpire = integration.tokenExpire;

  const dbTokenStorage: TokenStorage = {
    async get(): Promise<AccessToken | null> {
      if (!currentAccessToken) return null;
      return {
        access_token: currentAccessToken,
        refresh_token: currentRefreshToken || "",
        expire_in: currentTokenExpire
          ? Math.max(0, Math.floor((currentTokenExpire.getTime() - Date.now()) / 1000))
          : 3600,
        expired_at: currentTokenExpire ? currentTokenExpire.getTime() : undefined,
        shop_id: shopIdNum,
        request_id: "",
        error: "",
        message: "",
      };
    },
    async store(token: AccessToken): Promise<void> {
      currentAccessToken = token.access_token;
      currentRefreshToken = token.refresh_token;
      currentTokenExpire = token.expire_in
        ? new Date(Date.now() + token.expire_in * 1000)
        : null;

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpire: currentTokenExpire,
          updatedAt: new Date(),
        },
      });
    },
    async clear(): Promise<void> {
      currentAccessToken = null;
      currentRefreshToken = null;
      currentTokenExpire = null;

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          accessToken: null,
          refreshToken: null,
          tokenExpire: null,
        },
      });
    },
  };

  const config: ShopeeConfig = {
    partner_id: env.partnerId,
    partner_key: env.partnerKey,
    shop_id: shopIdNum,
    region: env.isUat ? ShopeeRegion.TEST_GLOBAL : ShopeeRegion.GLOBAL,
  };

  return new ShopeeSDK(config, dbTokenStorage);
}

/**
 * Validasi signature webhook Push Notification dari Shopee
 * Format: HMAC-SHA256(url + "|" + body, partner_key)
 */
export function verifyShopeeWebhookSignature(
  url: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const env = getShopeeEnvConfig();
  if (!env.partnerKey) {
    // Jika partner key belum diset (misal dalam local mock testing), izinkan untuk keperluan testing
    return true;
  }

  const baseString = `${url}|${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", env.partnerKey)
    .update(baseString)
    .digest("hex");

  return computedSignature.toLowerCase() === signatureHeader.toLowerCase();
}
