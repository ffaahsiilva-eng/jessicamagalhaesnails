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

    // Target window: appointments starting between 60 and 65 minutes from now (BRT)
    const target = new Date(brtNow.getTime() + 60 * 60 * 1000);
    const targetEnd = new Date(brtNow.getTime() + 65 * 60 * 1000);
    const targetTime = target.toISOString().substring(11, 16); // HH:MM
    const targetEndTime = targetEnd.toISOString().substring(11, 16);

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('id, client_name, client_phone, client_email, service_type, appointment_date, appointment_time, notes, status')
      .eq('appointment_date', todayStr)
      .neq('status', 'cancelled')
      .gte('appointment_time', targetTime)
      .lt('appointment_time', targetEndTime);

    if (error) throw error;

    if (!appts || appts.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Nenhum agendamento na janela' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('instance_id, instance_token, admin_number, enabled')
      .limit(1)
      .maybeSingle();

    if (!config?.enabled || !config.instance_id || !config.instance_token || !config.admin_number) {
      return new Response(JSON.stringify({ skipped: true, reason: 'WhatsApp não configurado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminNumber = config.admin_number.replace(/\D/g, '');
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(config.instance_id)}`;

    const results: unknown[] = [];

    for (const a of appts) {
      const [y, m, d] = a.appointment_date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const time = a.appointment_time.slice(0, 5);

      const text =
        `⏰ *LEMBRETE - 1H PARA O AGENDAMENTO*\n\n` +
        `👤 *Cliente:* ${a.client_name}\n` +
        `📱 *Telefone:* ${a.client_phone}\n` +
        (a.client_email ? `✉️ *Email:* ${a.client_email}\n` : '') +
        `💅 *Serviço:* ${a.service_type}\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (a.notes ? `📝 *Obs:* ${a.notes}\n` : '') +
        `📌 *Status:* ${a.status}\n\n` +
        `📋 Painel: https://jessicamagalhaes.lovable.app/admin`;

      const sendRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.instance_token}`,
        },
        body: JSON.stringify({ phone: adminNumber, message: text }),
      });
      results.push({ id: a.id, ok: sendRes.ok, status: sendRes.status });
    }

    return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('appointment-hour-reminder error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
