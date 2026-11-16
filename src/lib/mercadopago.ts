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
  preference_id?: string;
  checkout_id?: string;
  deposit_amount?: number;
  remaining_amount?: number;
  deposit_percent?: number;
  error?: string;
}

export interface MercadoPagoConfig {
  enabled: boolean;
  accessToken: string;
  publicKey: string;
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

export const getMercadoPagoConfig = async (): Promise<MercadoPagoConfig> => {
  try {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "mercadopago_enabled",
        "mercadopago_access_token",
        "mercadopago_public_key",
        "mercadopago_deposit_percent",
        "mercadopago_deposit_months",
      ]);

    const map: Record<string, string> = {};
    settings?.forEach((s) => {
      map[s.key] = s.value;
    });

    return {
      enabled: map["mercadopago_enabled"] !== "false",
      accessToken: map["mercadopago_access_token"] || "",
      publicKey: map["mercadopago_public_key"] || "",
      depositPercent: parseInt(map["mercadopago_deposit_percent"] || "50", 10) || 50,
      depositMonths: parseDepositMonths(map["mercadopago_deposit_months"]),
    };
  } catch (err) {
    console.warn("Erro ao buscar configurações do Mercado Pago:", err);
    return {
      enabled: true,
      accessToken: "",
      publicKey: "",
      depositPercent: 50,
      depositMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    };
  }
};

export interface PixCheckoutResult {
  success: boolean;
  payment_id?: number | string;
  checkout_id?: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  deposit_amount?: number;
  remaining_amount?: number;
  deposit_percent?: number;
  error?: string;
}

export const createMercadoPagoPix = async (
  params: CreateCheckoutParams
): Promise<PixCheckoutResult> => {
  try {
    const res = await fetch("/api/create-mercadopago-pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Não foi possível gerar a chave Pix no Mercado Pago.",
      };
    }

    return {
      success: true,
      payment_id: data.payment_id,
      checkout_id: data.checkout_id,
      qr_code: data.qr_code,
      qr_code_base64: data.qr_code_base64,
      ticket_url: data.ticket_url,
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

export const createMercadoPagoCheckout = async (
  params: CreateCheckoutParams
): Promise<CheckoutResult> => {
  try {
    const res = await fetch("/api/create-mercadopago-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Não foi possível gerar a preferência de pagamento no Mercado Pago.",
      };
    }

    return {
      success: true,
      url: data.url,
      preference_id: data.preference_id,
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

export interface CheckPaymentParams {
  orderNsu?: string;
  paymentId?: string;
  preferenceId?: string;
  status?: string;
}

export const checkMercadoPagoPayment = async (
  paramsOrOrderNsu: string | CheckPaymentParams
) => {
  try {
    const params: CheckPaymentParams =
      typeof paramsOrOrderNsu === "string"
        ? { orderNsu: paramsOrOrderNsu }
        : paramsOrOrderNsu || {};

    const query = new URLSearchParams();
    if (params.orderNsu) query.set("order_nsu", params.orderNsu);
    if (params.paymentId) query.set("payment_id", params.paymentId);
    if (params.preferenceId) query.set("preference_id", params.preferenceId);
    if (params.status) query.set("status", params.status);

    const res = await fetch(`/api/check-mercadopago-payment?${query.toString()}`);
    if (!res.ok) return { paid: false };
    const json = await res.json();
    return { paid: !!json.paid, data: json.data, appointment: json.appointment };
  } catch {
    return { paid: false };
  }
};
