import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface BookingPayload {
  appointment_id?: string | null;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  service_type: string;
  service_price?: string | null;
  appointment_date: string;
  appointment_time: string;
  notes?: string | null;
  action?: 'new' | 'confirmed' | 'cancelled';
  site_url?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as BookingPayload;

    if (!body?.client_name || !body?.client_phone || !body?.appointment_date || !body?.appointment_time) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: config, error: cfgErr } = await supabase
      .from('whatsapp_config')
      .select('instance_id, instance_token, admin_number, enabled')
      .limit(1)
      .maybeSingle();

    if (cfgErr) throw cfgErr;

    if (!config || !config.enabled || !config.instance_id || !config.instance_token || !config.admin_number) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'WhatsApp API não configurada ou desativada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [y, m, d] = body.appointment_date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const time = body.appointment_time.slice(0, 5);
    const action = body.action ?? 'new';
    const priceText = body.service_price ? ` (${body.service_price})` : '';

    const baseUrl = body.site_url || 'https://jessicamagalhaesnail.vercel.app';
    const confirmLink = body.appointment_id
      ? `${baseUrl}/admin?confirm_id=${body.appointment_id}`
      : `${baseUrl}/admin`;

    const adminNumber = config.admin_number.replace(/\D/g, '');
    const clientNumber = body.client_phone.replace(/\D/g, '');
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(config.instance_id)}`;

    const sendWhatsApp = async (phone: string, message: string) => {
      const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.instance_token}`,
        },
        body: JSON.stringify({ phone: cleanPhone, message }),
      });
    };

    const results: Record<string, unknown> = {};

    // 1. Mensagem quando é NOVO agendamento -> Envia para a ADMIN com link de confirmação
    if (action === 'new') {
      const adminText =
        `🔔 *NOVO AGENDAMENTO RECEBIDO!*\n\n` +
        `👤 *Cliente:* ${body.client_name}\n` +
        `📱 *WhatsApp:* ${body.client_phone}\n` +
        (body.client_email ? `✉️ *Email:* ${body.client_email}\n` : '') +
        `💅 *Serviço:* ${body.service_type}${priceText}\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (body.notes ? `📝 *Obs:* ${body.notes}\n` : '') +
        `\n❓ *Confirma este agendamento?*\n` +
        `👉 Clique no link para confirmar no painel:\n` +
        `${confirmLink}`;

      const resAdmin = await sendWhatsApp(adminNumber, adminText);
      results.admin = { ok: resAdmin.ok, status: resAdmin.status };
    }

    // 2. Mensagem quando é CONFIRMADO -> Envia para o CLIENTE com todos os detalhes e para a ADMIN
    if (action === 'confirmed') {
      const clientText =
        `✨ *AGENDAMENTO CONFIRMADO!* ✨\n\n` +
        `Olá, *${body.client_name}*! Seu horário com Jéssica Magalhães foi confirmado com sucesso! 💕\n\n` +
        `💅 *Serviço:* ${body.service_type}${priceText}\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (body.notes ? `📝 *Obs:* ${body.notes}\n` : '') +
        `\n⏰ *Importante:* Temos uma tolerância de 15 minutos para chegada.\n` +
        `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
        `Estamos ansiosas para te receber! Se precisar de algo, basta responder esta mensagem. 🙏`;

      const resClient = await sendWhatsApp(clientNumber, clientText);
      results.client = { ok: resClient.ok, status: resClient.status };

      const adminConfirmText =
        `✅ *Agendamento confirmado com sucesso!*\n\n` +
        `Cliente: *${body.client_name}*\n` +
        `Serviço: ${body.service_type}${priceText}\n` +
        `Data: ${formattedDate} às ${time}\n` +
        `Mensagem de confirmação enviada para a cliente!`;

      await sendWhatsApp(adminNumber, adminConfirmText);
    }

    // 3. Mensagem quando é CANCELADO
    if (action === 'cancelled') {
      const clientCancelText =
        `❌ *Agendamento Cancelado*\n\n` +
        `Olá, *${body.client_name}*. Informamos que seu agendamento para o dia ${formattedDate} às ${time} foi cancelado.\n` +
        `Caso deseje remarcar, acesse nosso site: ${baseUrl}`;

      await sendWhatsApp(clientNumber, clientCancelText);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-admin-booking error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
