import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Date exactly 20 days ago in America/Sao_Paulo (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    brt.setUTCDate(brt.getUTCDate() - 20);
    const targetDate = brt.toISOString().split('T')[0];

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('client_name, client_phone, service_type, appointment_time, appointment_date')
      .eq('appointment_date', targetDate)
      .eq('status', 'confirmed')
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

    if (!appts || appts.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, reason: 'Nenhuma cliente de 20 dias atrás' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [y, m, d] = targetDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    let text =
      `💅 *LEMBRETE DE MANUTENÇÃO (20 DIAS)*\n\n` +
      `As clientes abaixo fizeram as unhas em *${formattedDate}* (há 20 dias) e provavelmente precisam de manutenção. ` +
      `Envie uma mensagem lembrando cada uma:\n\n`;

    for (const a of appts) {
      const phoneDigits = (a.client_phone || '').replace(/\D/g, '');
      const waPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
      const waMsg = encodeURIComponent(
        `Olá ${a.client_name}! 💖 Faz 20 dias que fizemos suas unhas — já está na hora da manutenção. Quer agendar um horário comigo? 💅✨`
      );
      const waLink = `https://wa.me/${waPhone}?text=${waMsg}`;

      text +=
        `👤 *${a.client_name}*\n` +
        `   💅 ${a.service_type}\n` +
        `   📱 ${a.client_phone}\n` +
        `   🔗 ${waLink}\n\n`;
    }

    text += `_Mensagem automática enviada às 08:00._`;

    const adminNumber = config.admin_number.replace(/\D/g, '');
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(config.instance_id)}`;

    const sendRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.instance_token}`,
      },
      body: JSON.stringify({ phone: adminNumber, message: text }),
    });

    const sendText = await sendRes.text();
    let sendData: unknown;
    try { sendData = JSON.parse(sendText); } catch { sendData = sendText; }

    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: 'Falha WhatsApp', status: sendRes.status, details: sendData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, count: appts.length, date: targetDate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('maintenance-reminder error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
