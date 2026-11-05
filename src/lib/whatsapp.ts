import { supabase } from "@/integrations/supabase/client";
import { calculateServicesTotal, extractPriceFromNotes, cleanNotesForDisplay } from "@/lib/price";

export interface SendBookingNotificationParams {
  appointment_id?: string | null;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  service_type: string;
  service_price?: string | null;
  appointment_date: string;
  appointment_time: string;
  notes?: string | null;
  action: "new" | "confirmed" | "cancelled" | "reminder_1h";
  site_url?: string;
}

export const getWhatsAppConfig = async () => {
  // 1. Tentar ler de whatsapp_config (quando admin está autenticado)
  try {
    const { data } = await supabase
      .from("whatsapp_config")
      .select("instance_id, instance_token, admin_number, enabled")
      .limit(1)
      .maybeSingle();

    if (data && data.enabled && data.instance_id && data.instance_token) {
      return data;
    }
  } catch {
    // RLS pode bloquear para visitantes
  }

  // 2. Fallback: ler de site_settings (público e acessível para todos os visitantes do site)
  try {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["wapi_instance_id", "wapi_instance_token", "wapi_admin_number", "wapi_enabled", "whatsapp_number"]);

    if (settings && settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.key] = s.value; });

      const instId = map["wapi_instance_id"]?.trim();
      const instToken = map["wapi_instance_token"]?.trim();
      const rawAdmin = map["wapi_admin_number"] || map["whatsapp_number"] || "559191837179";
      const cleanAdmin = rawAdmin.replace(/\D/g, "");
      const formattedAdmin = cleanAdmin.startsWith("55") ? cleanAdmin : `55${cleanAdmin}`;
      const isEnabled = map["wapi_enabled"] !== "false";

      if (instId && instToken) {
        return {
          instance_id: instId,
          instance_token: instToken,
          admin_number: formattedAdmin,
          enabled: isEnabled,
        };
      }
    }
  } catch {
    // Ignora
  }

  return null;
};

export const syncWhatsAppConfigToSiteSettings = async (cfg: {
  instance_id: string;
  instance_token: string;
  admin_number?: string;
  enabled?: boolean;
}) => {
  try {
    const rawAdmin = cfg.admin_number ? cfg.admin_number.replace(/\D/g, "") : "559191837179";
    const cleanAdmin = rawAdmin.startsWith("55") ? rawAdmin : `55${rawAdmin}`;
    const payload = [
      { key: "wapi_instance_id", value: (cfg.instance_id || "").trim(), label: "W-API Instance ID", type: "text", category: "integrations" },
      { key: "wapi_instance_token", value: (cfg.instance_token || "").trim(), label: "W-API Token", type: "text", category: "integrations" },
      { key: "wapi_admin_number", value: cleanAdmin, label: "W-API Admin Number", type: "text", category: "integrations" },
      { key: "wapi_enabled", value: cfg.enabled !== false ? "true" : "false", label: "W-API Enabled", type: "text", category: "integrations" },
    ];
    await supabase.from("site_settings").upsert(payload, { onConflict: "key" });
  } catch (err) {
    console.warn("Erro ao sincronizar whatsapp config para site_settings:", err);
  }
};

export const sendDirectWhatsApp = async (
  instanceId: string,
  instanceToken: string,
  phone: string,
  message: string
) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const payload = {
    instance_id: instanceId.trim(),
    instance_token: instanceToken.trim(),
    phone: formattedPhone,
    number: formattedPhone,
    message,
    text: message,
  };

  // 1. Tentar via Serverless Function (/api/send-whatsapp) do próprio domínio (Sem CORS no navegador!)
  try {
    const apiRes = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      return data;
    }

    const errText = await apiRes.text();
    try {
      const errJson = JSON.parse(errText);
      if (errJson && (errJson.message || errJson.error)) {
        throw new Error(errJson.message || errJson.error);
      }
    } catch (parseE) {
      if (parseE instanceof Error && parseE.message && !parseE.message.includes("JSON")) {
        throw parseE;
      }
    }
  } catch (apiErr: unknown) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    // Se a função serverless retornou um erro específico da API W-API, relança
    if (!msg.includes("404") && !msg.includes("Failed to fetch") && !msg.includes("Method not allowed")) {
      throw apiErr;
    }
  }

  // 2. Tentar via proxy local/Vercel rewrite (/api/wapi)
  try {
    const proxyEndpoint = `/api/wapi/v1/message/send-text?instanceId=${encodeURIComponent(instanceId.trim())}`;
    const proxyRes = await fetch(proxyEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${instanceToken.trim()}`,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        number: formattedPhone,
        message,
        text: message,
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data;
    }
  } catch {
    // Continua para o envio direto
  }

  // 3. Fallback: Envio direto para api.w-api.app (quando suportado)
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(instanceId.trim())}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${instanceToken.trim()}`,
    },
    body: JSON.stringify({
      phone: formattedPhone,
      number: formattedPhone,
      message,
      text: message,
    }),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new Error(typeof json === "object" && json && "message" in json ? String((json as { message: string }).message) : text);
  }

  return json;
};

export const notifyWhatsAppBooking = async (params: SendBookingNotificationParams) => {
  // Resolver preço de forma robusta se não foi passado diretamente
  let priceDisplay = params.service_price?.trim() || "";

  if (!priceDisplay) {
    // 1. Tentar extrair de anotações internas [Valor: ...]
    priceDisplay = extractPriceFromNotes(params.notes);
  }

  if (!priceDisplay && params.service_type) {
    // 2. Tentar buscar da tabela de serviços e calcular soma (mesmo para múltiplos com '+')
    try {
      const { data: dbServices } = await supabase
        .from("services")
        .select("name, price")
        .eq("is_active", true);

      if (dbServices && dbServices.length > 0) {
        const { totalFormatted } = calculateServicesTotal(params.service_type, dbServices);
        if (totalFormatted) {
          priceDisplay = totalFormatted;
        }
      }
    } catch {
      // Ignora erro de query
    }
  }

  const isMulti = params.service_type.includes("+") || params.service_type.includes(",");
  const serviceLabel = isMulti ? "Serviços" : "Serviço";
  const priceLabel = isMulti ? "Valor Total" : "Valor";
  const priceLine = priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : "";
  const cleanNotes = cleanNotesForDisplay(params.notes);

  // 1. Tentar Edge Function primeiro passando o price já resolvido
  try {
    const { data, error } = await supabase.functions.invoke("notify-admin-booking", {
      body: {
        ...params,
        service_price: priceDisplay || params.service_price,
      },
    });
    if (!error && data && !data.error) {
      return { success: true, via: "edge-function", data };
    }
  } catch {
    // Edge function indisponível ou não deployada, fallback para envio direto via API
  }

  // 2. Fallback envio direto via W-API usando as credenciais do banco
  const config = await getWhatsAppConfig();
  if (!config || !config.enabled || !config.instance_id || !config.instance_token || !config.admin_number) {
    return { skipped: true, reason: "WhatsApp desativado ou incompleto" };
  }

  const [y, m, d] = params.appointment_date.split("-");
  const formattedDate = `${d}/${m}/${y}`;
  const time = params.appointment_time.slice(0, 5);
  const baseUrl = params.site_url || (typeof window !== "undefined" ? window.location.origin : "https://jessicamagalhaesnail.vercel.app");

  const confirmLink = params.appointment_id
    ? `${baseUrl}/admin?confirm_id=${params.appointment_id}`
    : `${baseUrl}/admin`;

  // NOVO AGENDAMENTO -> Notificar Admin com link para confirmar
  if (params.action === "new") {
    const adminText =
      `🔔 *NOVO AGENDAMENTO RECEBIDO!*\n\n` +
      `👤 *Cliente:* ${params.client_name}\n` +
      `📱 *WhatsApp:* ${params.client_phone}\n` +
      (params.client_email ? `✉️ *Email:* ${params.client_email}\n` : "") +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      priceLine +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : "") +
      `\n❓ *Confirma este agendamento?*\n` +
      `👉 Clique no link para confirmar no painel:\n` +
      `${confirmLink}`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);
    return { success: true, via: "direct-w-api", to: "admin" };
  }

  // AGENDAMENTO CONFIRMADO -> Notificar Cliente e Admin
  if (params.action === "confirmed") {
    const clientText =
      `✨ *AGENDAMENTO CONFIRMADO!* ✨\n\n` +
      `Olá, *${params.client_name}*! Seu horário com Jéssica Magalhães foi confirmado com sucesso! 💕\n\n` +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      priceLine +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : "") +
      `\n⏰ *Importante:* Temos uma tolerância de 15 minutos para chegada.\n` +
      `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
      `Estamos ansiosas para te receber! Se precisar de algo, basta responder esta mensagem. 🙏`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientText);

    const adminText =
      `✅ *Agendamento confirmado com sucesso!*\n\n` +
      `👤 Cliente: *${params.client_name}*\n` +
      `💅 ${serviceLabel}: ${params.service_type}\n` +
      (priceDisplay ? `💰 ${priceLabel}: ${priceDisplay}\n` : "") +
      `📅 Data: ${formattedDate} às ${time}\n` +
      `📱 Mensagem de confirmação enviada para o WhatsApp da cliente!`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);
    return { success: true, via: "direct-w-api", to: "client_and_admin" };
  }

  // LEMBRETE DE 1 HORA ANTES -> Notificar Cliente e Admin
  if (params.action === "reminder_1h") {
    const clientText =
      `⏰ *LEMBRETE: SEU HORÁRIO É DAQUI A 1 HORA!* ⏰\n\n` +
      `Olá, *${params.client_name}*! Tudo bem? 💕\n` +
      `Passando para lembrar que seu atendimento com Jéssica Magalhães está marcado para hoje:\n\n` +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      priceLine +
      `🕐 *Horário:* ${time}\n` +
      `📅 *Data:* ${formattedDate}\n\n` +
      `⏰ *Lembrete:* Temos 15 minutos de tolerância para chegada.\n` +
      `Te esperamos em breve! ✨`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientText);

    const adminText =
      `⏰ *LEMBRETE - 1H PARA O ATENDIMENTO*\n\n` +
      `👤 *Cliente:* ${params.client_name}\n` +
      `📱 *WhatsApp:* ${params.client_phone}\n` +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      (priceDisplay ? `💰 ${priceLabel}: ${priceDisplay}\n` : "") +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : "") +
      `\n📋 Painel: ${baseUrl}/admin`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);
    return { success: true, via: "direct-w-api", to: "client_and_admin_1h" };
  }

  // CANCELADO -> Notificar Cliente E Admin
  if (params.action === "cancelled") {
    // 1. Mensagem para o CLIENTE
    const clientCancelText =
      `❌ *AGENDAMENTO CANCELADO* ❌\n\n` +
      `Olá, *${params.client_name}*! Informamos que o seu agendamento com Jéssica Magalhães foi cancelado:\n\n` +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : "") +
      `\nCaso deseje remarcar para outro dia ou horário disponível, acesse nosso site:\n` +
      `👉 ${baseUrl}\n\n` +
      `Se tiver dúvidas, basta responder esta mensagem. Te esperamos em breve! 💕`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientCancelText);

    // 2. Mensagem para o ADMIN
    const adminCancelText =
      `❌ *AGENDAMENTO CANCELADO NO PAINEL* ❌\n\n` +
      `O agendamento a seguir foi cancelado:\n\n` +
      `👤 *Cliente:* ${params.client_name}\n` +
      `📱 *WhatsApp:* ${params.client_phone}\n` +
      `💅 *${serviceLabel}:* ${params.service_type}\n` +
      (priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : "") +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : "") +
      `\n📱 Notificação de cancelamento enviada para o WhatsApp da cliente!\n` +
      `📋 Painel: ${baseUrl}/admin`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminCancelText);
    return { success: true, via: "direct-w-api", to: "client_and_admin_cancel" };
  }
};
