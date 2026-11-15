import { supabase } from "@/integrations/supabase/client";

export interface CreateCheckoutParams {
  appointment_id: string;
  client_name: string;
  client_phone: string;
  service_type: string;
  total_amount: number;
  site_url?: string;
}

export interface CheckoutResult {
  success: boolean;
  url?: string;
  deposit_amount?: number;
  remaining_amount?: number;
  deposit_percent?: number;
  error?: string;
}

export interface InfinitePayConfig {
  enabled: boolean;
  handle: string;
  apiKey: string;
  depositPercent: number;
}

export const getInfinitePayConfig = async (): Promise<InfinitePayConfig> => {
  try {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "infinitepay_enabled",
        "infinitepay_handle",
        "infinitepay_api_key",
        "infinitepay_deposit_percent",
      ]);

    const map: Record<string, string> = {};
    settings?.forEach((s) => {
      map[s.key] = s.value;
    });

    return {
      enabled: map["infinitepay_enabled"] !== "false",
      handle: map["infinitepay_handle"] || "paifilhoespirito",
      apiKey: map["infinitepay_api_key"] || "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
      depositPercent: parseInt(map["infinitepay_deposit_percent"] || "50", 10) || 50,
    };
  } catch (error) {
    console.warn("Erro ao buscar configurações InfinitePay:", error);
    return {
      enabled: true,
      handle: "paifilhoespirito",
      apiKey: "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
      depositPercent: 50,
    };
  }
};

export const createInfinitePayCheckout = async (
  params: CreateCheckoutParams
): Promise<CheckoutResult> => {
  try {
    const siteUrl = params.site_url || window.location.origin;

    const res = await fetch("/api/create-infinitepay-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: params.appointment_id,
        client_name: params.client_name,
        client_phone: params.client_phone,
        service_type: params.service_type,
        total_amount: params.total_amount,
        site_url: siteUrl,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Falha ao gerar checkout da InfinitePay",
      };
    }

    return {
      success: true,
      url: data.url,
      deposit_amount: data.deposit_amount,
      remaining_amount: data.remaining_amount,
      deposit_percent: data.deposit_percent,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
    };
  }
};

export const checkInfinitePayPayment = async (orderNsu: string) => {
  try {
    const res = await fetch(`/api/check-infinitepay-payment?order_nsu=${encodeURIComponent(orderNsu)}`);
    if (!res.ok) return { paid: false };
    const json = await res.json();
    return { paid: !!json.paid, data: json.data };
  } catch {
    return { paid: false };
  }
};
