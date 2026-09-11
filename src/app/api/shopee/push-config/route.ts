import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAppPushConfig,
  setAppPushConfig,
  getShopeeEnvConfig,
} from "@/lib/shopee/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const env = getShopeeEnvConfig();
    const result = await getAppPushConfig();

    if (result.error) {
      return NextResponse.json(
        {
          error: result.message || result.error,
          details: result,
          env: {
            isUat: env.isUat,
            baseDomain: env.baseDomain,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.response,
      env: {
        isUat: env.isUat,
        baseDomain: env.baseDomain,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      callback_url,
      set_push_config_on,
      set_push_config_off,
      blocked_shop_id_list,
    } = body;

    if (!callback_url && (!set_push_config_on || set_push_config_on.length === 0)) {
      return NextResponse.json(
        { error: "callback_url atau konfigurasi push diperlukan." },
        { status: 400 }
      );
    }

    if (callback_url) {
      const trimmedUrl = String(callback_url).trim();
      if (!trimmedUrl.startsWith("https://") && !trimmedUrl.startsWith("http://localhost")) {
        return NextResponse.json(
          { error: "Callback URL harus menggunakan protokol HTTPS sesuai ketentuan Shopee Open Platform." },
          { status: 400 }
        );
      }
    }

    const result = await setAppPushConfig({
      callback_url: callback_url ? String(callback_url).trim() : undefined,
      set_push_config_on: Array.isArray(set_push_config_on) ? set_push_config_on : undefined,
      set_push_config_off: Array.isArray(set_push_config_off) ? set_push_config_off : undefined,
      blocked_shop_id_list: Array.isArray(blocked_shop_id_list) ? blocked_shop_id_list : undefined,
    });

    if (result.error) {
      return NextResponse.json(
        {
          error: result.message || result.error,
          details: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Konfigurasi push mechanism Shopee berhasil disimpan.",
      data: result.response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
