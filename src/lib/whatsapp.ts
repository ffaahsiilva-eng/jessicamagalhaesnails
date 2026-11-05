import { supabase } from "@/integrations/supabase/client";

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
  // 1. Tentar Edge Function primeiro
  try {
    const { data, error } = await supabase.functions.invoke("notify-admin-booking", {
      body: params,
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
  const priceText = params.service_price ? ` (${params.service_price})` : "";
  const baseUrl = params.site_url || window.location.origin;

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
      `💅 *Serviço:* ${params.service_type}${priceText}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (params.notes ? `📝 *Obs:* ${params.notes}\n` : "") +
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
      `💅 *Serviço:* ${params.service_type}${priceText}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (params.notes ? `📝 *Obs:* ${params.notes}\n` : "") +
      `\n⏰ *Importante:* Temos uma tolerância de 15 minutos para chegada.\n` +
      `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
      `Estamos ansiosas para te receber! Se precisar de algo, basta responder esta mensagem. 🙏`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientText);

    const adminText =
      `✅ *Agendamento confirmado!*\n\n` +
      `Cliente: *${params.client_name}*\n` +
      `Serviço: ${params.service_type}${priceText}\n` +
      `Data: ${formattedDate} às ${time}\n` +
      `Mensagem de confirmação enviada para o WhatsApp da cliente!`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);
    return { success: true, via: "direct-w-api", to: "client_and_admin" };
  }

  // LEMBRETE DE 1 HORA ANTES -> Notificar Cliente e Admin
  if (params.action === "reminder_1h") {
    const clientText =
      `⏰ *LEMBRETE: SEU HORÁRIO É DAQUI A 1 HORA!* ⏰\n\n` +
      `Olá, *${params.client_name}*! Tudo bem? 💕\n` +
      `Passando para lembrar que seu atendimento com Jéssica Magalhães está marcado para hoje:\n\n` +
      `💅 *Serviço:* ${params.service_type}${priceText}\n` +
      `🕐 *Horário:* ${time}\n` +
      `📅 *Data:* ${formattedDate}\n\n` +
      `⏰ *Lembrete:* Temos 15 minutos de tolerância para chegada.\n` +
      `Te esperamos em breve! ✨`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, params.client_phone, clientText);

    const adminText =
      `⏰ *LEMBRETE - 1H PARA O ATENDIMENTO*\n\n` +
      `👤 *Cliente:* ${params.client_name}\n` +
      `📱 *WhatsApp:* ${params.client_phone}\n` +
      `💅 *Serviço:* ${params.service_type}${priceText}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (params.notes ? `📝 *Obs:* ${params.notes}\n` : "") +
      `\n📋 Painel: ${baseUrl}/admin`;

    await sendDirectWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);
    return { success: true, via: "direct-w-api", to: "client_and_admin_1h" };
  }

  return { success: true };
};
