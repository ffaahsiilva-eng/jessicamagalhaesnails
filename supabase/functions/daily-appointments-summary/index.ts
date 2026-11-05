import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

    // Buscar lista de serviços para resolver preços
    const { data: servicesList } = await supabase
      .from('services')
      .select('name, price')
      .eq('is_active', true);

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

      let dayTotalNumber = 0;

      // Calcular preços individuais e total do dia
      const itemsWithPrice = appts.map((a) => {
        let priceDisplay = '';
        let priceNum = 0;

        if (a.notes) {
          const match = a.notes.match(/\[Valor:\s*([^\]]+)\]/i);
          if (match) {
            priceDisplay = match[1].trim();
            priceNum = parsePriceNum(priceDisplay);
          }
        }

        if (!priceDisplay && servicesList && a.service_type) {
          const names = a.service_type.split(/\s*\+\s*/).map((s: string) => s.trim().toLowerCase());
          for (const n of names) {
            const match = servicesList.find((s: { name: string; price: string }) => s.name.trim().toLowerCase() === n);
            if (match?.price) {
              priceNum += parsePriceNum(match.price);
            }
          }
          if (priceNum > 0) priceDisplay = formatBRL(priceNum);
        }

        dayTotalNumber += priceNum;

        const isMulti = a.service_type.includes('+') || a.service_type.includes(',');
        const serviceLabel = isMulti ? 'Serviços' : 'Serviço';
        const priceLabel = isMulti ? 'Valor Total' : 'Valor';
        const cleanNotes = a.notes ? a.notes.replace(/\s*\[Valor:[^\]]*\]/gi, '').trim() : '';

        return {
          ...a,
          serviceLabel,
          priceLabel,
          priceDisplay,
          cleanNotes,
        };
      });

      text += `Total: *${appts.length}* cliente(s) agendada(s) para hoje\n`;
      if (confirmedCount > 0) text += `✅ *${confirmedCount}* confirmado(s)\n`;
      if (pendingCount > 0) text += `⏳ *${pendingCount}* pendente(s)\n`;
      if (dayTotalNumber > 0) text += `💰 Faturamento Previsto: *${formatBRL(dayTotalNumber)}*\n`;
      text += `\n─────────────────────\n\n`;

      for (const a of itemsWithPrice) {
        const emoji = statusEmoji[a.status] ?? '•';
        const label = statusLabel[a.status] ?? a.status;
        text +=
          `${emoji} *${a.appointment_time.slice(0, 5)}* - *${a.client_name}*\n` +
          `   💅 *${a.serviceLabel}:* ${a.service_type}\n` +
          (a.priceDisplay ? `   💰 *${a.priceLabel}:* ${a.priceDisplay}\n` : '') +
          `   📱 *WhatsApp:* ${a.client_phone}\n` +
          `   📌 *Status:* ${label}\n` +
          (a.cleanNotes ? `   📝 *Obs:* ${a.cleanNotes}\n` : '') +
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

    return new Response(JSON.stringify({ success: true, count: appts.length, sentTo: cleanPhone }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('daily-appointments-summary error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
