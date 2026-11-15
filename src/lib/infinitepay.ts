import { supabase } from "@/integrations/supabase/client";

export interface CreateCheckoutParams {
  appointment_id?: string;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string | null;
  total_amount: number;
  site_url?: string;
}

export interface CheckoutResult {
  success: boolean;
  url?: string;
  checkout_id?: string;
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
  depositMonths: number[];
}

export const MONTHS_LIST = [
  { value: 1, name: "Janeiro", short: "Jan" },
  { value: 2, name: "Fevereiro", short: "Fev" },
  { value: 3, name: "Março", short: "Mar" },
  { value: 4, name: "Abril", short: "Abr" },
  { value: 5, name: "Maio", short: "Mai" },
  { value: 6, name: "Junho", short: "Jun" },
  { value: 7, name: "Julho", short: "Jul" },
  { value: 8, name: "Agosto", short: "Ago" },
  { value: 9, name: "Setembro", short: "Set" },
  { value: 10, name: "Outubro", short: "Out" },
  { value: 11, name: "Novembro", short: "Nov" },
  { value: 12, name: "Dezembro", short: "Dez" },
];

export const parseDepositMonths = (raw: string | number[] | null | undefined): number[] => {
  if (Array.isArray(raw)) return raw.map(Number);
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    // Padrão: todos os meses ativados se não houver configuração explícita
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(Number);
  } catch {
    const list = raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    if (list.length > 0) return list;
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
};

export const isMonthDepositEnabled = (
  date: Date | string | null | undefined,
  depositMonthsRaw: string | number[] | null | undefined,
  isPaymentEnabled = true
): boolean => {
  if (!isPaymentEnabled || !date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  const month = d.getMonth() + 1;
  const activeMonths = parseDepositMonths(depositMonthsRaw);
  return activeMonths.includes(month);
};

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
        "infinitepay_deposit_months",
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
      depositMonths: parseDepositMonths(map["infinitepay_deposit_months"]),
    };
  } catch (error) {
    console.warn("Erro ao buscar configurações InfinitePay:", error);
    return {
      enabled: true,
      handle: "paifilhoespirito",
      apiKey: "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
      depositPercent: 50,
      depositMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
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
        client_email: params.client_email,
        service_type: params.service_type,
        appointment_date: params.appointment_date,
        appointment_time: params.appointment_time,
        notes: params.notes,
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
      checkout_id: data.checkout_id,
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
