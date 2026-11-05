import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Today in America/Sao_Paulo (UTC-3, no DST)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = brt.toISOString().split('T')[0];

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('client_name, client_phone, service_type, appointment_time, status, notes')
      .eq('appointment_date', todayStr)
      .neq('status', 'cancelled') // Não lista cancelados no resumo matinal
      .order('appointment_time', { ascending: true });

    if (error) throw error;

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

    const [y, m, d] = todayStr.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      confirmed: '✅',
    };
    const statusLabel: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
    };

    let text = `📅 *AGENDA DE HOJE (${formattedDate})* 💅✨\n\n`;

    if (!appts || appts.length === 0) {
      text += `Nenhum agendamento marcado para hoje.\nTenha um excelente e abençoado dia! 🌸`;
    } else {
      const confirmedCount = appts.filter((a) => a.status === 'confirmed').length;
      const pendingCount = appts.filter((a) => a.status === 'pending').length;

      text += `Total: *${appts.length}* cliente(s) agendada(s) para hoje\n`;
      if (confirmedCount > 0) text += `✅ *${confirmedCount}* confirmado(s)\n`;
      if (pendingCount > 0) text += `⏳ *${pendingCount}* pendente(s)\n`;
      text += `\n─────────────────────\n\n`;

      for (const a of appts) {
        const emoji = statusEmoji[a.status] ?? '•';
        const label = statusLabel[a.status] ?? a.status;
        text +=
          `${emoji} *${a.appointment_time.slice(0, 5)}* - *${a.client_name}*\n` +
          `   💅 *Serviço:* ${a.service_type}\n` +
          `   📱 *WhatsApp:* ${a.client_phone}\n` +
          `   📌 *Status:* ${label}\n` +
          (a.notes ? `   📝 *Obs:* ${a.notes}\n` : '') +
          `\n`;
      }

      text += `📋 *Painel:* https://jessicamagalhaesnail.vercel.app/admin\n`;
      text += `✨ Desejamos um dia muito produtivo e abençoado! 💕`;
    }

    const adminNumber = config.admin_number.replace(/\D/g, '');
    const cleanPhone = adminNumber.startsWith('55') ? adminNumber : `55${adminNumber}`;
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(config.instance_id)}`;

    const sendRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.instance_token}`,
      },
      body: JSON.stringify({ phone: cleanPhone, message: text }),
    });

    const sendText = await sendRes.text();
    let sendData: unknown;
    try { sendData = JSON.parse(sendText); } catch { sendData = sendText; }

    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: 'Falha WhatsApp', status: sendRes.status, details: sendData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, count: appts?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('daily-appointments-summary error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
