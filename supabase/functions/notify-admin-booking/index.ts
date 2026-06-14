import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface BookingPayload {
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string | null;
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

    const apiUrl = Deno.env.get('ORBSOFTY_API_URL') ?? 'https://nova.orbsofty.com';

    const [y, m, d] = body.appointment_date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const time = body.appointment_time.slice(0, 5);

    const text =
      `🔔 *NOVO AGENDAMENTO*\n\n` +
      `👤 *Cliente:* ${body.client_name}\n` +
      `📱 *Telefone:* ${body.client_phone}\n` +
      (body.client_email ? `✉️ *Email:* ${body.client_email}\n` : '') +
      `💅 *Serviço:* ${body.service_type}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${time}\n` +
      (body.notes ? `📝 *Obs:* ${body.notes}\n` : '') +
      `\n❓ *Confirma este agendamento?*\n` +
      `Responda *SIM* para confirmar ou *NÃO* para cancelar.\n\n` +
      `📋 Painel: https://jessicamagalhaes.lovable.app/admin`;

    const endpoint = `${apiUrl.replace(/\/$/, '')}/send/text`;
    const adminNumber = config.admin_number.replace(/\D/g, '');

    const sendRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: config.instance_token,
      },
      body: JSON.stringify({
        instance: config.instance_id,
        number: adminNumber,
        text,
      }),
    });

    const sendText = await sendRes.text();
    let sendData: unknown;
    try { sendData = JSON.parse(sendText); } catch { sendData = sendText; }

    if (!sendRes.ok) {
      console.error('WhatsApp API error', sendRes.status, sendData);
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar WhatsApp', status: sendRes.status, details: sendData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true, result: sendData }), {
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
