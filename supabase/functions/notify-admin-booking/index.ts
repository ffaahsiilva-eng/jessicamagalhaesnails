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
  action?: 'new' | 'confirmed' | 'cancelled' | 'reminder_1h';
  site_url?: string | null;
}

const parsePriceNum = (str?: string | null): number => {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',')) {
    const val = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    return isNaN(val) ? 0 : val;
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

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

    // Resolver preço de forma robusta
    let priceDisplay = body.service_price?.trim() || '';
    if (!priceDisplay && body.notes) {
      const match = body.notes.match(/\[Valor:\s*([^\]]+)\]/i);
      if (match) priceDisplay = match[1].trim();
    }

    if (!priceDisplay && body.service_type) {
      try {
        const { data: svcList } = await supabase.from('services').select('name, price').eq('is_active', true);
        if (svcList && svcList.length > 0) {
          const names = body.service_type.split(/\s*\+\s*/).map((s) => s.trim().toLowerCase());
          let sum = 0;
          for (const n of names) {
            const found = svcList.find((s) => s.name.trim().toLowerCase() === n);
            if (found?.price) sum += parsePriceNum(found.price);
          }
          if (sum > 0) priceDisplay = formatBRL(sum);
        }
      } catch {
        // Ignora
      }
    }

    const isMulti = body.service_type.includes('+') || body.service_type.includes(',');
    const serviceLabel = isMulti ? 'Serviços' : 'Serviço';
    const priceLabel = isMulti ? 'Valor Total' : 'Valor';
    const priceLine = priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : '';
    const cleanNotes = body.notes ? body.notes.replace(/\s*\[Valor:[^\]]*\]/gi, '').trim() : '';

    const [y, m, d] = body.appointment_date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const time = body.appointment_time.slice(0, 5);
    const action = body.action ?? 'new';

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

    // 1. NOVO agendamento -> Envia para a ADMIN com link de confirmação
    if (action === 'new') {
      const adminText =
        `🔔 *NOVO AGENDAMENTO RECEBIDO!*\n\n` +
        `👤 *Cliente:* ${body.client_name}\n` +
        `📱 *WhatsApp:* ${body.client_phone}\n` +
        (body.client_email ? `✉️ *Email:* ${body.client_email}\n` : '') +
        `💅 *${serviceLabel}:* ${body.service_type}\n` +
        priceLine +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : '') +
        `\n❓ *Confirma este agendamento?*\n` +
        `👉 Clique no link para confirmar no painel:\n` +
        `${confirmLink}`;

      const resAdmin = await sendWhatsApp(adminNumber, adminText);
      results.admin = { ok: resAdmin.ok, status: resAdmin.status };
    }

    // 2. CONFIRMADO -> Envia para o CLIENTE com preço e para a ADMIN
    if (action === 'confirmed') {
      const clientText =
        `✨ *AGENDAMENTO CONFIRMADO!* ✨\n\n` +
        `Olá, *${body.client_name}*! Seu horário com Jéssica Magalhães foi confirmado com sucesso! 💕\n\n` +
        `💅 *${serviceLabel}:* ${body.service_type}\n` +
        priceLine +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : '') +
        `\n⏰ *Importante:* Temos uma tolerância de 15 minutos para chegada.\n` +
        `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
        `Estamos ansiosas para te receber! Se precisar de algo, basta responder esta mensagem. 🙏`;

      const resClient = await sendWhatsApp(clientNumber, clientText);
      results.client = { ok: resClient.ok, status: resClient.status };

      const adminConfirmText =
        `✅ *Agendamento confirmado com sucesso!*\n\n` +
        `👤 Cliente: *${body.client_name}*\n` +
        `💅 ${serviceLabel}: ${body.service_type}\n` +
        (priceDisplay ? `💰 ${priceLabel}: ${priceDisplay}\n` : '') +
        `📅 Data: ${formattedDate} às ${time}\n` +
        `📱 Mensagem de confirmação enviada para a cliente!`;

      await sendWhatsApp(adminNumber, adminConfirmText);
    }

    // 3. CANCELADO
    if (action === 'cancelled') {
      const clientCancelText =
        `❌ *Agendamento Cancelado*\n\n` +
        `Olá, *${body.client_name}*. Informamos que seu agendamento para o dia ${formattedDate} às ${time} foi cancelado.\n` +
        `Caso deseje remarcar, acesse nosso site:\n${baseUrl}`;

      await sendWhatsApp(clientNumber, clientCancelText);
    }

    // 4. LEMBRETE DE 1 HORA
    if (action === 'reminder_1h') {
      const clientReminderText =
        `⏰ *LEMBRETE: SEU HORÁRIO É DAQUI A 1 HORA!* ⏰\n\n` +
        `Olá, *${body.client_name}*! Tudo bem? 💕\n` +
        `Passando para lembrar que seu atendimento com Jéssica Magalhães está marcado para hoje:\n\n` +
        `💅 *${serviceLabel}:* ${body.service_type}\n` +
        priceLine +
        `🕐 *Horário:* ${time}\n` +
        `📅 *Data:* ${formattedDate}\n\n` +
        `⏰ *Lembrete:* Temos 15 minutos de tolerância para chegada.\n` +
        `Te esperamos em breve! ✨`;

      const resClient = await sendWhatsApp(clientNumber, clientReminderText);
      results.client = { ok: resClient.ok, status: resClient.status };

      const adminReminderText =
        `⏰ *LEMBRETE - 1H PARA O ATENDIMENTO*\n\n` +
        `👤 *Cliente:* ${body.client_name}\n` +
        `📱 *WhatsApp:* ${body.client_phone}\n` +
        `💅 *${serviceLabel}:* ${body.service_type}\n` +
        (priceDisplay ? `💰 ${priceLabel}: ${priceDisplay}\n` : '') +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : '') +
        `\n📋 Painel: ${baseUrl}/admin`;

      const resAdmin = await sendWhatsApp(adminNumber, adminReminderText);
      results.admin = { ok: resAdmin.ok, status: resAdmin.status };
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
