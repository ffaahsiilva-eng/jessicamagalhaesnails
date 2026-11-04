import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Now in America/Sao_Paulo (UTC-3)
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = brtNow.toISOString().split('T')[0];

    // Target window: appointments starting between 55 and 65 minutes from now (BRT)
    const target = new Date(brtNow.getTime() + 55 * 60 * 1000);
    const targetEnd = new Date(brtNow.getTime() + 65 * 60 * 1000);
    const targetTime = target.toISOString().substring(11, 16); // HH:MM
    const targetEndTime = targetEnd.toISOString().substring(11, 16);

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('id, client_name, client_phone, client_email, service_type, appointment_date, appointment_time, notes, status')
      .eq('appointment_date', todayStr)
      .eq('status', 'confirmed') // Apenas agendamentos confirmados
      .gte('appointment_time', targetTime)
      .lt('appointment_time', targetEndTime);

    if (error) throw error;

    if (!appts || appts.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Nenhum agendamento confirmado na janela de 1 hora' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('instance_id, instance_token, admin_number, enabled')
      .limit(1)
      .maybeSingle();

    if (!config?.enabled || !config.instance_id || !config.instance_token || !config.admin_number) {
      return new Response(JSON.stringify({ skipped: true, reason: 'WhatsApp API não configurada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminNumber = config.admin_number.replace(/\D/g, '');
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

    const results: unknown[] = [];

    for (const a of appts) {
      const [y, m, d] = a.appointment_date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const time = a.appointment_time.slice(0, 5);

      // 1. Mensagem de lembrete para a CLIENTE
      const clientReminderText =
        `⏰ *LEMBRETE: SEU HORÁRIO É DAQUI A 1 HORA!* ⏰\n\n` +
        `Olá, *${a.client_name}*! Tudo bem? 💕\n` +
        `Passando para lembrar que seu atendimento com Jéssica Magalhães está marcado para hoje:\n\n` +
        `💅 *Serviço:* ${a.service_type}\n` +
        `🕐 *Horário:* ${time}\n` +
        `📅 *Data:* ${formattedDate}\n\n` +
        `⏰ *Lembrete:* Temos 15 minutos de tolerância para chegada.\n` +
        `Te esperamos em breve! ✨`;

      const clientPhone = a.client_phone.replace(/\D/g, '');
      const resClient = await sendWhatsApp(clientPhone, clientReminderText);

      // 2. Mensagem de lembrete para a ADMIN
      const adminReminderText =
        `⏰ *LEMBRETE - 1H PARA O ATENDIMENTO*\n\n` +
        `👤 *Cliente:* ${a.client_name}\n` +
        `📱 *WhatsApp:* ${a.client_phone}\n` +
        `💅 *Serviço:* ${a.service_type}\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (a.notes ? `📝 *Obs:* ${a.notes}\n` : '') +
        `\n📋 Painel: https://jessicamagalhaesnail.vercel.app/admin`;

      const resAdmin = await sendWhatsApp(adminNumber, adminReminderText);

      results.push({
        id: a.id,
        client_sent: resClient.ok,
        admin_sent: resAdmin.ok,
      });
    }

    return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('appointment-hour-reminder error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
