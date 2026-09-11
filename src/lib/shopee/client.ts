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
  baseDomain: string;
}

export function getShopeeEnvConfig(): ShopeeEnvConfig {
  // Ambil partner ID dari process.env (dukung berbagai variasi nama env var)
  const rawPartnerId = (
    process.env.SHOPEE_PARTNER_ID ||
    process.env.PARTNER_ID ||
    process.env.SHOPEE_PARTNERID ||
    process.env.NEXT_PUBLIC_SHOPEE_PARTNER_ID ||
    process.env.NEXT_PUBLIC_PARTNER_ID ||
    process.env.NEXT_PUBLIC_SHOPEE_PARTNERID ||
    ""
  )
    .toString()
    .replace(/['"\s]/g, "")
    .trim();

  const partnerId = rawPartnerId ? parseInt(rawPartnerId, 10) : 0;

  // Ambil partner key dari process.env (dukung berbagai variasi nama env var)
  const partnerKey = (
    process.env.SHOPEE_PARTNER_KEY ||
    process.env.PARTNER_KEY ||
    process.env.SHOPEE_PARTNERKEY ||
    process.env.NEXT_PUBLIC_SHOPEE_PARTNER_KEY ||
    process.env.NEXT_PUBLIC_PARTNER_KEY ||
    process.env.NEXT_PUBLIC_SHOPEE_PARTNERKEY ||
    ""
  )
    .toString()
    .replace(/['"\s]/g, "")
    .trim();

  // Deteksi redirect URL dengan fallback ke VERCEL_URL atau NEXTAUTH_URL jika tidak diset
  let redirectUrl = (
    process.env.SHOPEE_REDIRECT_URL ||
    process.env.NEXT_PUBLIC_SHOPEE_REDIRECT_URL ||
    ""
  )
    .toString()
    .replace(/['"\s]/g, "")
    .trim();

  if (!redirectUrl) {
    if (process.env.VERCEL_URL) {
      redirectUrl = `https://${process.env.VERCEL_URL}/api/shopee/auth`;
    } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      redirectUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/shopee/auth`;
    } else if (process.env.NEXTAUTH_URL) {
      redirectUrl = `${process.env.NEXTAUTH_URL}/api/shopee/auth`;
    } else {
      redirectUrl = "http://localhost:3000/api/shopee/auth";
    }
  }

  // Deteksi environment mode dari process.env:
  // VERCEL_ENV: 'production' | 'preview' | 'development'
  // NODE_ENV: 'production' | 'development' | 'test'
  const vercelEnv = (process.env.VERCEL_ENV || "").trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "").trim().toLowerCase();
  const shopeeEnv = (process.env.SHOPEE_ENV || "").trim().toLowerCase();
  const shopeeIsUat = (process.env.SHOPEE_IS_UAT || "").trim().toLowerCase();

  const isExplicitSandbox =
    shopeeIsUat === "true" ||
    shopeeIsUat === "1" ||
    shopeeIsUat === "yes" ||
    shopeeEnv === "sandbox" ||
    shopeeEnv === "uat" ||
    shopeeEnv === "test";

  // Hanya mode production jika:
  // 1. Tidak di-set eksplisit ke sandbox / uat
  // 2. Di Vercel: VERCEL_ENV harus 'production' (jika 'preview' atau 'development', maka BUKAN production)
  // 3. Di luar Vercel: NODE_ENV harus 'production' (dan APP_ENV bukan preview/development/staging)
  // 4. SHOPEE_ENV bukan 'sandbox' atau 'uat'
  const isProduction =
    !isExplicitSandbox &&
    (vercelEnv ? vercelEnv === "production" : (nodeEnv === "production" && appEnv !== "preview" && appEnv !== "staging" && appEnv !== "development")) &&
    shopeeEnv !== "sandbox" &&
    shopeeEnv !== "uat";

  // Jika bukan mode production maka mode UAT / Sandbox
  const isUat = !isProduction;

  // Base domain: jika bukan mode production maka gunakan https://openplatform.sandbox.test-stable.shopee.sg
  const baseDomain =
    process.env.SHOPEE_BASE_DOMAIN?.trim().replace(/\/+$/, "") ||
    (isProduction
      ? "https://partner.shopeemobile.com"
      : "https://openplatform.sandbox.test-stable.shopee.sg");

  return {
    partnerId,
    partnerKey,
    redirectUrl,
    isUat,
    baseDomain,
  };
}

/**
 * Menggenerasi URL otentikasi resmi Shopee Open API v2 (/api/v2/shop/auth_partner)
 * Dilengkapi dengan parameter signature HMAC-SHA256 dan timestamp wajib.
 */
export function generateShopeeAuthUrl(redirectUrl: string): string {
  const env = getShopeeEnvConfig();

  if (!env.partnerId || isNaN(env.partnerId) || env.partnerId <= 0) {
    throw new Error(
      "SHOPEE_PARTNER_ID tidak ditemukan atau tidak valid di environment variables. Pastikan SHOPEE_PARTNER_ID sudah dikonfigurasi di Vercel."
    );
  }

  if (!env.partnerKey) {
    throw new Error(
      "SHOPEE_PARTNER_KEY tidak ditemukan di environment variables. Pastikan SHOPEE_PARTNER_KEY sudah dikonfigurasi di Vercel."
    );
  }

  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  // Gunakan baseDomain sesuai hasil deteksi environment
  const baseDomain = env.baseDomain;

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

  if (!env.partnerId || isNaN(env.partnerId) || env.partnerId <= 0) {
    throw new Error(
      "SHOPEE_PARTNER_ID tidak ditemukan atau tidak valid di environment variables."
    );
  }

  if (!env.partnerKey) {
    throw new Error(
      "SHOPEE_PARTNER_KEY tidak ditemukan di environment variables."
    );
  }

  const config: ShopeeConfig = {
    partner_id: Number(env.partnerId),
    partner_key: String(env.partnerKey),
    region: env.isUat ? ShopeeRegion.TEST_GLOBAL : ShopeeRegion.GLOBAL,
    base_url: `${env.baseDomain}/api/v2`,
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

  if (!env.partnerId || isNaN(env.partnerId) || env.partnerId <= 0) {
    throw new Error(
      "SHOPEE_PARTNER_ID tidak ditemukan atau tidak valid di environment variables."
    );
  }

  if (!env.partnerKey) {
    throw new Error(
      "SHOPEE_PARTNER_KEY tidak ditemukan di environment variables."
    );
  }

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
    partner_id: Number(env.partnerId),
    partner_key: String(env.partnerKey),
    shop_id: shopIdNum,
    region: env.isUat ? ShopeeRegion.TEST_GLOBAL : ShopeeRegion.GLOBAL,
    base_url: `${env.baseDomain}/api/v2`,
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

export interface AppPushConfig {
  callback_url?: string;
  live_push_status?: "Normal" | "Warning" | "Suspended" | string;
  suspended_time?: number;
  blocked_shop_id?: number[];
  push_config_on_list?: number[];
  push_config_off_list?: number[];
}

export interface GetAppPushConfigResponse {
  error?: string;
  message?: string;
  response?: AppPushConfig;
  request_id?: string;
}

export interface SetAppPushConfigParams {
  callback_url?: string;
  set_push_config_on?: number[];
  set_push_config_off?: number[];
  blocked_shop_id_list?: number[];
}

export interface SetAppPushConfigResponse {
  error?: string;
  message?: string;
  response?: {
    result?: string;
  };
  request_id?: string;
}

/**
 * Mengambil konfigurasi push notification (webhook) aplikasi saat ini dari Shopee
 * Menggunakan endpoint /api/v2/push/get_app_push_config (Partner Level API)
 */
export async function getAppPushConfig(): Promise<GetAppPushConfigResponse> {
  const env = getShopeeEnvConfig();

  if (!env.partnerId || isNaN(env.partnerId) || env.partnerId <= 0) {
    throw new Error(
      "SHOPEE_PARTNER_ID tidak ditemukan atau tidak valid di environment variables."
    );
  }

  if (!env.partnerKey) {
    throw new Error(
      "SHOPEE_PARTNER_KEY tidak ditemukan di environment variables."
    );
  }

  const path = "/api/v2/push/get_app_push_config";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${env.partnerId}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", env.partnerKey)
    .update(baseString)
    .digest("hex");

  const url = new URL(`${env.baseDomain}${path}`);
  url.searchParams.append("partner_id", env.partnerId.toString());
  url.searchParams.append("timestamp", timestamp.toString());
  url.searchParams.append("sign", sign);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();
  return data;
}

/**
 * Mengatur atau memperbarui callback URL dan konfigurasi push notification di Shopee
 * Menggunakan endpoint /api/v2/push/set_app_push_config (Partner Level API)
 */
export async function setAppPushConfig(
  params: SetAppPushConfigParams
): Promise<SetAppPushConfigResponse> {
  const env = getShopeeEnvConfig();

  if (!env.partnerId || isNaN(env.partnerId) || env.partnerId <= 0) {
    throw new Error(
      "SHOPEE_PARTNER_ID tidak ditemukan atau tidak valid di environment variables."
    );
  }

  if (!env.partnerKey) {
    throw new Error(
      "SHOPEE_PARTNER_KEY tidak ditemukan di environment variables."
    );
  }

  const path = "/api/v2/push/set_app_push_config";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${env.partnerId}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", env.partnerKey)
    .update(baseString)
    .digest("hex");

  const url = new URL(`${env.baseDomain}${path}`);
  url.searchParams.append("partner_id", env.partnerId.toString());
  url.searchParams.append("timestamp", timestamp.toString());
  url.searchParams.append("sign", sign);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  return data;
}
