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

    // Dedup: skip appointments that already received 1h reminder
    const apptIds = (appts ?? []).map((a) => a.id).filter(Boolean);
    let alreadySent = new Set<string>();
    if (apptIds.length > 0) {
      try {
        const { data: sentRows } = await supabase
          .from('hour_reminders_sent')
          .select('appointment_id')
          .in('appointment_id', apptIds);
        alreadySent = new Set((sentRows ?? []).map((r) => r.appointment_id as string));
      } catch {
        // Tabela ainda opcional, continua sem travar
      }
    }
    const filteredAppts = (appts ?? []).filter((a) => !alreadySent.has(a.id));

    if (filteredAppts.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Todos os agendamentos da janela já foram lembrados' }), {
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

    // Buscar lista de serviços para resolver preços
    const { data: servicesList } = await supabase
      .from('services')
      .select('name, price')
      .eq('is_active', true);

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

    for (const a of filteredAppts) {
      const [y, m, d] = a.appointment_date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const time = a.appointment_time.slice(0, 5);

      // Preço
      let priceDisplay = '';
      if (a.notes) {
        const match = a.notes.match(/\[Valor:\s*([^\]]+)\]/i);
        if (match) priceDisplay = match[1].trim();
      }
      if (!priceDisplay && servicesList && a.service_type) {
        const names = a.service_type.split(/\s*\+\s*/).map((s: string) => s.trim().toLowerCase());
        let sum = 0;
        for (const n of names) {
          const match = servicesList.find((s: { name: string; price: string }) => s.name.trim().toLowerCase() === n);
          if (match?.price) sum += parsePriceNum(match.price);
        }
        if (sum > 0) priceDisplay = formatBRL(sum);
      }

      const isMulti = a.service_type.includes('+') || a.service_type.includes(',');
      const serviceLabel = isMulti ? 'Serviços' : 'Serviço';
      const priceLabel = isMulti ? 'Valor Total' : 'Valor';
      const priceLine = priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : '';
      const cleanNotes = a.notes ? a.notes.replace(/\s*\[Valor:[^\]]*\]/gi, '').trim() : '';

      // 1. Mensagem de lembrete para a CLIENTE
      const clientReminderText =
        `⏰ *LEMBRETE: SEU HORÁRIO É DAQUI A 1 HORA!* ⏰\n\n` +
        `Olá, *${a.client_name}*! Tudo bem? 💕\n` +
        `Passando para lembrar que seu atendimento com Jéssica Magalhães está marcado para hoje:\n\n` +
        `💅 *${serviceLabel}:* ${a.service_type}\n` +
        priceLine +
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
        `💅 *${serviceLabel}:* ${a.service_type}\n` +
        (priceDisplay ? `💰 *${priceLabel}:* ${priceDisplay}\n` : '') +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${time}\n` +
        (cleanNotes ? `📝 *Obs:* ${cleanNotes}\n` : '') +
        `\n📋 Painel: https://jessicamagalhaesnail.vercel.app/admin`;

      const resAdmin = await sendWhatsApp(adminNumber, adminReminderText);

      if (resClient.ok && a.id) {
        try {
          await supabase.from('hour_reminders_sent').insert({ appointment_id: a.id });
        } catch {
          // Ignore
        }
      }

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
