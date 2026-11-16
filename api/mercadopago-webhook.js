import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function sendWhatsAppMessage(instanceId, token, phone, message) {
  if (!instanceId || !token || !phone || !message) return;
  const cleanPhone = String(phone).replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${encodeURIComponent(instanceId.trim())}`;

  try {
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
    console.log(`WhatsApp enviado para ${formattedPhone}: status ${res.status}`);
  } catch (err) {
    console.error("Erro ao enviar mensagem WhatsApp:", err);
  }
}

async function getPaymentConfig() {
  let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key = 'mercadopago_access_token'"
    );
    await client.end();

    if (res.rows.length > 0 && res.rows[0].value) {
      accessToken = res.rows[0].value.trim();
    }
  } catch (err) {
    console.warn("Aviso ao buscar token do Mercado Pago:", err.message);
  }

  return { accessToken };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Mercado Pago pode enviar GET ou POST no webhook
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const query = req.query || {};

    console.log("Recebido Webhook Mercado Pago:", JSON.stringify({ body, query }));

    const paymentId =
      body.data?.id ||
      body.id ||
      query["data.id"] ||
      query.id;

    const topic = body.type || body.topic || query.topic || query.type;

    // Se a notificação não for de pagamento ou não tiver ID, apenas confirma o recebimento
    if (!paymentId || (topic && !topic.includes("payment"))) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const config = await getPaymentConfig();
    if (!config.accessToken) {
      console.warn("Mercado Pago Webhook recebido mas Access Token não configurado.");
      return res.status(200).json({ received: true, error: "Token not configured" });
    }

    // Consultar detalhes do pagamento na API do Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!mpRes.ok) {
      console.warn(`Erro ao consultar pagamento ${paymentId} no Mercado Pago: status ${mpRes.status}`);
      return res.status(200).json({ received: true, error: "Payment not found" });
    }

    const paymentData = await mpRes.json();
    console.log("Detalhes do pagamento Mercado Pago:", JSON.stringify({
      id: paymentData.id,
      status: paymentData.status,
      external_reference: paymentData.external_reference,
      amount: paymentData.transaction_amount,
    }));

    if (paymentData.status !== "approved") {
      return res.status(200).json({ received: true, status: paymentData.status });
    }

    const orderNsu = paymentData.external_reference;
    if (!orderNsu) {
      console.warn("Pagamento aprovado no Mercado Pago mas sem external_reference:", paymentId);
      return res.status(200).json({ received: true, warning: "No external_reference" });
    }

    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 1. Procurar em pending_checkouts
    const pendingRes = await client.query(
      "SELECT * FROM pending_checkouts WHERE id = $1 LIMIT 1",
      [orderNsu]
    );

    let appointmentData = null;
    let shouldSendNotification = true;

    if (pendingRes.rows.length > 0) {
      const p = pendingRes.rows[0];

      const existingApt = await client.query(
        "SELECT id, status FROM appointments WHERE id = $1 LIMIT 1",
        [p.id]
      );
      if (existingApt.rows.length > 0 && existingApt.rows[0].status === "confirmed") {
        shouldSendNotification = false;
      }

      const notesWithDeposit = p.notes && p.notes.includes("[Sinal")
        ? (p.notes.includes("Pago") ? p.notes : `${p.notes} [Sinal Pago via Mercado Pago]`)
        : `${p.notes ? p.notes + " " : ""}[Sinal 50% Pago via Mercado Pago]`;

      const insertRes = await client.query(
        `INSERT INTO appointments (
          id, user_id, client_name, client_phone, client_email, service_type,
          appointment_date, appointment_time, notes, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', now(), now()
        ) ON CONFLICT (id) DO UPDATE SET
          status = 'confirmed',
          notes = EXCLUDED.notes,
          updated_at = now()
        RETURNING *`,
        [
          p.id,
          p.user_id || null,
          p.client_name,
          p.client_phone,
          p.client_email,
          p.service_type,
          p.appointment_date,
          p.appointment_time,
          notesWithDeposit,
        ]
      );

      await client.query(
        "UPDATE pending_checkouts SET status = 'paid', updated_at = now() WHERE id = $1",
        [p.id]
      );

      await client.query("DELETE FROM slot_holds WHERE session_id = $1", [p.id]).catch(() => {});
      appointmentData = insertRes.rows[0] || p;
    } else {
      const aptRes = await client.query(
        "SELECT * FROM appointments WHERE id = $1 LIMIT 1",
        [orderNsu]
      );
      if (aptRes.rows.length > 0) {
        const apt = aptRes.rows[0];
        if (apt.status === "confirmed") {
          shouldSendNotification = false;
        }

        const updatedNotes = apt.notes && apt.notes.includes("[Sinal")
          ? (apt.notes.includes("Pago") ? apt.notes : `${apt.notes} [Sinal Pago via Mercado Pago]`)
          : `${apt.notes ? apt.notes + " " : ""}[Sinal 50% Pago via Mercado Pago]`;

        await client.query(
          "UPDATE appointments SET status = 'confirmed', notes = $1, updated_at = now() WHERE id = $2",
          [updatedNotes, apt.id]
        );
        appointmentData = apt;
      }
    }

    if (!appointmentData) {
      await client.end();
      console.warn(`Registro ${orderNsu} não encontrado para criação do agendamento.`);
      return res.status(200).json({ received: true, not_found: true });
    }

    // 2. Notificações WhatsApp
    if (shouldSendNotification) {
      try {
        const cfgRes = await client.query(
          "SELECT instance_id, instance_token, admin_number, enabled FROM whatsapp_config LIMIT 1"
        );

        let wConfig = cfgRes.rows[0];
        if (!wConfig || !wConfig.enabled) {
          const setRes = await client.query(
            "SELECT key, value FROM site_settings WHERE key IN ('wapi_instance_id', 'wapi_instance_token', 'wapi_admin_number', 'wapi_enabled')"
          );
          const map = {};
          setRes.rows.forEach((r) => { map[r.key] = r.value; });
          if (map.wapi_instance_id && map.wapi_instance_token && map.wapi_enabled !== "false") {
            wConfig = {
              instance_id: map.wapi_instance_id,
              instance_token: map.wapi_instance_token,
              admin_number: map.wapi_admin_number || "559191837179",
              enabled: true,
            };
          }
        }

        if (wConfig && wConfig.enabled && wConfig.instance_id && wConfig.instance_token) {
          const rawDate = appointmentData.appointment_date;
          let formattedDate = "";
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toLocaleDateString("pt-BR");
          } else {
            const [y, m, d] = String(rawDate).split("T")[0].split("-");
            formattedDate = `${d}/${m}/${y}`;
          }
          const formattedTime = String(appointmentData.appointment_time).slice(0, 5);

          // Mensagem para a Cliente
          const clientMsg =
            `✨ Olá, *${appointmentData.client_name}*! ✨\n\n` +
            `✅ O seu pagamento de sinal foi *APROVADO* via Mercado Pago!\n` +
            `🎉 Seu agendamento está oficialmente *MARCADO E CONFIRMADO*! 💕\n\n` +
            `💅 *Serviço:* ${appointmentData.service_type}\n` +
            `📅 *Data:* ${formattedDate}\n` +
            `🕐 *Horário:* ${formattedTime}\n` +
            `💰 *Sinal:* 50% pago online (restante de 50% a acertar no atendimento)\n\n` +
            `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
            `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
            `🙏 Te esperamos com muito carinho! 💕`;

          await sendWhatsAppMessage(
            wConfig.instance_id,
            wConfig.instance_token,
            appointmentData.client_phone,
            clientMsg
          );

          // Mensagem para a Administradora (Jéssica)
          const adminMsg =
            `💰 *NOVO AGENDAMENTO CONFIRMADO (Mercado Pago)* 💰\n\n` +
            `O pagamento do sinal de 50% foi aprovado e o horário foi marcado com sucesso!\n\n` +
            `👤 *Cliente:* ${appointmentData.client_name}\n` +
            `📱 *WhatsApp:* ${appointmentData.client_phone}\n` +
            `💅 *Serviço:* ${appointmentData.service_type}\n` +
            `📅 *Data:* ${formattedDate} às ${formattedTime}\n` +
            `💳 *Status:* Confirmado automaticamente via Mercado Pago\n\n` +
            `📋 Painel:\nhttps://jessicamagalhaesnail.vercel.app/admin`;

          await sendWhatsAppMessage(
            wConfig.instance_id,
            wConfig.instance_token,
            wConfig.admin_number,
            adminMsg
          );
        }
      } catch (wErr) {
        console.error("Erro ao enviar WhatsApp pós-webhook Mercado Pago:", wErr.message);
      }
    }

    await client.end();
    return res.status(200).json({ success: true, message: "Agendamento confirmado com sucesso." });
  } catch (error) {
    console.error("Erro no processamento do webhook Mercado Pago:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
