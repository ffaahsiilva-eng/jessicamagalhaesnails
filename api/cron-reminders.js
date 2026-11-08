import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

function getBrtInfo() {
  const now = new Date();
  const brtString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const brtDate = new Date(brtString);

  const yyyy = brtDate.getFullYear();
  const mm = String(brtDate.getMonth() + 1).padStart(2, "0");
  const dd = String(brtDate.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const tomorrow = new Date(brtDate.getTime() + 24 * 60 * 60 * 1000);
  const tyyyy = tomorrow.getFullYear();
  const tmm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const tdd = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowStr = `${tyyyy}-${tmm}-${tdd}`;

  // Data de 20 dias atrás (manutenção / retorno)
  const twentyDaysAgo = new Date(brtDate.getTime() - 20 * 24 * 60 * 60 * 1000);
  const pYyyy = twentyDaysAgo.getFullYear();
  const pMm = String(twentyDaysAgo.getMonth() + 1).padStart(2, "0");
  const pDd = String(twentyDaysAgo.getDate()).padStart(2, "0");
  const target20DaysAgoStr = `${pYyyy}-${pMm}-${pDd}`;

  const currentMinutes = brtDate.getHours() * 60 + brtDate.getMinutes();
  const currentFormatted = `${String(brtDate.getHours()).padStart(2, "0")}:${String(
    brtDate.getMinutes()
  ).padStart(2, "0")}`;

  return {
    todayStr,
    tomorrowStr,
    target20DaysAgoStr,
    currentMinutes,
    currentFormatted,
  };
}

async function sendWhatsApp(instanceId, token, phone, message) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(
    instanceId.trim()
  )}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify({
      phone: formattedPhone,
      number: formattedPhone,
      message,
      text: message,
    }),
  });

  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const client = new Client({ connectionString: CONNECTION_STRING });

  try {
    await client.connect();

    // 1. Obter configurações do WhatsApp
    const cfgRes = await client.query(
      "SELECT instance_id, instance_token, admin_number, enabled FROM whatsapp_config LIMIT 1"
    );
    const config = cfgRes.rows[0];

    if (!config || !config.enabled || !config.instance_id || !config.instance_token) {
      await client.end();
      return res.status(200).json({
        skipped: true,
        reason: "WhatsApp API não configurada ou desativada.",
      });
    }

    const { todayStr, tomorrowStr, currentMinutes, currentFormatted } = getBrtInfo();
    const results = {
      timestamp_brt: `${todayStr} ${currentFormatted}`,
      reminders_24h_sent: 0,
      reminders_2h_sent: 0,
      details: [],
    };

    // 2. LEMBRETES DE 1 DIA ANTES (24 HORAS ANTES)
    // Busca agendamentos de amanhã confirmados
    const appts24h = await client.query(
      `SELECT a.id, a.client_name, a.client_phone, a.service_type, a.appointment_date, a.appointment_time, a.notes
       FROM appointments a
       WHERE a.appointment_date = $1
         AND a.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM appointment_reminders_sent r
           WHERE r.appointment_id = a.id AND r.reminder_type = '24h'
         )`,
      [tomorrowStr]
    );

    for (const appt of appts24h.rows) {
      const timeStr = String(appt.appointment_time).slice(0, 5);
      const [h, m] = timeStr.split(":").map(Number);
      const apptMinutes = h * 60 + m;
      const diff = apptMinutes - currentMinutes;

      // Dispara se estiver na janela do mesmo horário (entre -45min e +30min)
      if (diff <= 30 && diff >= -45) {
        const [y, mm, d] = String(appt.appointment_date).split("T")[0].split("-");
        const formattedDate = `${d}/${mm}/${y}`;

        const clientText =
          `📅 *LEMBRETE: SEU HORÁRIO É AMANHÃ!* 💕\n\n` +
          `Olá, *${appt.client_name}*! Tudo bem? Passando para lembrar do seu atendimento com Jéssica Magalhães amanhã:\n\n` +
          `💅 *Serviço:* ${appt.service_type}\n` +
          `📅 *Data:* Amanhã (${formattedDate})\n` +
          `🕐 *Horário:* ${timeStr}\n` +
          `\n⏰ *Importante:* Temos uma tolerância de 15 minutos para chegada.\n` +
          `Caso precise de alguma alteração ou tenha imprevistos, por favor nos avise com antecedência!\n\n` +
          `Te esperamos com muito carinho! ✨💖`;

        const adminText =
          `📅 *LEMBRETE AUTOMÁTICO - ATENDIMENTO AMANHÃ*\n\n` +
          `Lembrete de 1 dia antes enviado para a cliente:\n` +
          `👤 *Cliente:* ${appt.client_name}\n` +
          `📱 *WhatsApp:* ${appt.client_phone}\n` +
          `💅 *Serviço:* ${appt.service_type}\n` +
          `📅 *Data:* Amanhã (${formattedDate}) às ${timeStr}\n\n` +
          `📋 Painel: https://jessicamagalhaesnail.vercel.app/admin`;

        await sendWhatsApp(config.instance_id, config.instance_token, appt.client_phone, clientText);
        await sendWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);

        await client.query(
          `INSERT INTO appointment_reminders_sent (appointment_id, reminder_type, recipient_phone)
           VALUES ($1, '24h', $2)
           ON CONFLICT (appointment_id, reminder_type) DO NOTHING`,
          [appt.id, appt.client_phone]
        );

        results.reminders_24h_sent++;
        results.details.push(`24h reminder sent to ${appt.client_name} (${timeStr})`);
      }
    }

    // 3. LEMBRETES DE 2 HORAS ANTES NO DIA DO ATENDIMENTO
    // Busca agendamentos de hoje confirmados
    const appts2h = await client.query(
      `SELECT a.id, a.client_name, a.client_phone, a.service_type, a.appointment_date, a.appointment_time, a.notes
       FROM appointments a
       WHERE a.appointment_date = $1
         AND a.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM appointment_reminders_sent r
           WHERE r.appointment_id = a.id AND r.reminder_type = '2h'
         )`,
      [todayStr]
    );

    for (const appt of appts2h.rows) {
      const timeStr = String(appt.appointment_time).slice(0, 5);
      const [h, m] = timeStr.split(":").map(Number);
      const apptMinutes = h * 60 + m;
      const diff = apptMinutes - currentMinutes;

      // Dispara quando faltar entre 90 minutos (1h30) e 140 minutos (2h20)
      if (diff <= 140 && diff >= 90) {
        const [y, mm, d] = String(appt.appointment_date).split("T")[0].split("-");
        const formattedDate = `${d}/${mm}/${y}`;

        const clientText =
          `⏰ *LEMBRETE: SEU HORÁRIO É HOJE DAQUI A 2 HORAS!* ⏰\n\n` +
          `Olá, *${appt.client_name}*! Tudo bem? 💕\n` +
          `Passando para lembrar que seu atendimento com Jéssica Magalhães está chegando:\n\n` +
          `💅 *Serviço:* ${appt.service_type}\n` +
          `🕐 *Horário:* Hoje às ${timeStr}\n` +
          `📅 *Data:* ${formattedDate}\n` +
          `\n⏰ *Lembrete:* Temos 15 minutos de tolerância para chegada.\n` +
          `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
          `Já estamos preparando tudo para receber você! Te esperamos em breve! 💅✨`;

        const adminText =
          `⏰ *LEMBRETE AUTOMÁTICO - 2H PARA O ATENDIMENTO*\n\n` +
          `Lembrete de 2 horas antes enviado para a cliente:\n` +
          `👤 *Cliente:* ${appt.client_name}\n` +
          `📱 *WhatsApp:* ${appt.client_phone}\n` +
          `💅 *Serviço:* ${appt.service_type}\n` +
          `📅 *Data:* Hoje (${formattedDate}) às ${timeStr}\n\n` +
          `📋 Painel: https://jessicamagalhaesnail.vercel.app/admin`;

        await sendWhatsApp(config.instance_id, config.instance_token, appt.client_phone, clientText);
        await sendWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);

        await client.query(
          `INSERT INTO appointment_reminders_sent (appointment_id, reminder_type, recipient_phone)
           VALUES ($1, '2h', $2)
           ON CONFLICT (appointment_id, reminder_type) DO NOTHING`,
          [appt.id, appt.client_phone]
        );

        results.reminders_2h_sent++;
        results.details.push(`2h reminder sent to ${appt.client_name} (${timeStr})`);
      }
    }

    // 4. LEMBRETES DE MANUTENÇÃO (20 DIAS DEPOIS DO SERVIÇO)
    // Envia durante o horário comercial (entre 09:00 e 20:00 no fuso de Brasília)
    results.reminders_20d_sent = 0;
    if (currentMinutes >= 9 * 60 && currentMinutes <= 20 * 60) {
      const appts20d = await client.query(
        `SELECT a.id, a.client_name, a.client_phone, a.service_type, a.appointment_date, a.appointment_time
         FROM appointments a
         WHERE a.appointment_date = $1
           AND a.status = 'confirmed'
           AND NOT EXISTS (
             SELECT 1 FROM appointment_reminders_sent r
             WHERE r.appointment_id = a.id AND r.reminder_type = '20d'
           )`,
        [target20DaysAgoStr]
      );

      for (const appt of appts20d.rows) {
        const [y, mm, d] = String(appt.appointment_date).split("T")[0].split("-");
        const formattedDate = `${d}/${mm}/${y}`;

        const clientText =
          `💅✨ *Oiii, ${appt.client_name}! Que saudade de você!* 💕\n\n` +
          `Já se passaram *20 dias* desde que fizemos as suas unhas (${appt.service_type})! O tempo voa, né? 🌸\n\n` +
          `Para manter suas unhas sempre perfeitas, impecáveis, fortes e com aquele acabamento maravilhoso que você ama, já está na hora da sua *manutenção*! 💖\n\n` +
          `✨ Suas unhas merecem esse cuidado e carinho especial!\n\n` +
          `Que tal garantir o seu horário para essa semana antes que a agenda lote?\n\n` +
          `👉 *Agende seu horário no site:* https://jessicamagalhaesnail.vercel.app\n\n` +
          `Será um prazer enorme cuidar de você novamente! Com todo carinho, *Jéssica Magalhães Nail* 💅✨💕`;

        const adminText =
          `💅 *LEMBRETE AUTOMÁTICO DE RETORNO (20 DIAS)*\n\n` +
          `Lembrete de manutenção enviado com sucesso para a cliente:\n` +
          `👤 *Cliente:* ${appt.client_name}\n` +
          `📱 *WhatsApp:* ${appt.client_phone}\n` +
          `💅 *Último Serviço:* ${appt.service_type}\n` +
          `📅 *Atendimento em:* ${formattedDate} (há 20 dias)\n\n` +
          `📋 Painel: https://jessicamagalhaesnail.vercel.app/admin`;

        await sendWhatsApp(config.instance_id, config.instance_token, appt.client_phone, clientText);
        await sendWhatsApp(config.instance_id, config.instance_token, config.admin_number, adminText);

        await client.query(
          `INSERT INTO appointment_reminders_sent (appointment_id, reminder_type, recipient_phone)
           VALUES ($1, '20d', $2)
           ON CONFLICT (appointment_id, reminder_type) DO NOTHING`,
          [appt.id, appt.client_phone]
        );

        results.reminders_20d_sent++;
        results.details.push(`20d maintenance reminder sent to ${appt.client_name}`);
      }
    }

    await client.end();
    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}

