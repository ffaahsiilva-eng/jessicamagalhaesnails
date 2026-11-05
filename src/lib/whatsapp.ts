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
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("instance_id, instance_token, admin_number, enabled")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
};

export const sendDirectWhatsApp = async (
  instanceId: string,
  instanceToken: string,
  phone: string,
  message: string
) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(instanceId.trim())}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${instanceToken.trim()}`,
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message,
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

  // CANCELADO
  if (params.action === "cancelled") {
    const clientCancelText =
      `❌ *Agendamento Cancelado*\n\n` +
      `Olá, *${params.client_name}*. Informamos que seu agendamento para o dia ${formattedDate} às ${time} foi cancelado.\n` +
      `Caso deseje remarcar, acesse nosso site:\n${baseUrl}`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientCancelText);
    return { success: true, via: "direct-w-api", to: "client_cancel" };
  }
};
