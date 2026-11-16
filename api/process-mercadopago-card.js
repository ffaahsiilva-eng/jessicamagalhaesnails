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
  let enabled = true;

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key IN ('mercadopago_access_token', 'mercadopago_enabled')"
    );
    await client.end();

    res.rows.forEach((r) => {
      if (r.key === "mercadopago_access_token" && r.value) accessToken = r.value.trim();
      if (r.key === "mercadopago_enabled") enabled = r.value !== "false";
    });
  } catch (err) {
    console.warn("Aviso ao buscar token do Mercado Pago:", err.message);
  }

  return { accessToken, enabled };
}

function translateStatusDetail(detail) {
  switch (detail) {
    case "cc_rejected_bad_filled_card_number":
      return "Número de cartão incorreto.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança (CVV) inválido.";
    case "cc_rejected_bad_filled_other":
      return "Dados do cartão incorretos.";
    case "cc_rejected_insufficient_amount":
      return "Saldo ou limite insuficiente no cartão.";
    case "cc_rejected_call_for_authorize":
      return "Cartão requer autorização do banco emissor.";
    case "cc_rejected_card_disabled":
      return "Cartão desabilitado pelo banco.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado. Aguarde alguns minutos.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado pela análise antifraude. Recomendamos pagar via Pix.";
    default:
      return "Pagamento não aprovado pela operadora do cartão. Tente outro cartão ou pague via Pix.";
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const {
      appointment_id,
      token,
      installments = 1,
      payment_method_id,
      issuer_id,
      cpf,
      email,
      site_url,
    } = body;

    if (!appointment_id || !token) {
      return res.status(400).json({ error: "appointment_id e token são obrigatórios." });
    }

    const config = await getPaymentConfig();
    if (!config.enabled || !config.accessToken) {
      return res.status(400).json({ error: "Mercado Pago não está configurado ou está desativado." });
    }

    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // 1. Buscar os dados do agendamento pendente
    const pendingRes = await client.query(
      "SELECT * FROM pending_checkouts WHERE id = $1 LIMIT 1",
      [appointment_id]
    );

    if (pendingRes.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: "Agendamento pendente não encontrado." });
    }

    const pendingRow = pendingRes.rows[0];
    const depositAmount = parseFloat(pendingRow.deposit_amount) || 0;

    if (depositAmount <= 0) {
      await client.end();
      return res.status(400).json({ error: "Valor do sinal inválido." });
    }

    const baseUrl = site_url || "https://jessicamagalhaesnail.vercel.app";
    const isLocal = !site_url || site_url.includes("localhost") || site_url.includes("127.0.0.1") || !site_url.startsWith("https://");
    const publicBaseUrl = isLocal ? "https://jessicamagalhaesnail.vercel.app" : baseUrl.replace(/\/$/, "");
    const webhookUrl = `${publicBaseUrl}/api/mercadopago-webhook`;

    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const payerEmail = email && email.includes("@")
      ? email.trim()
      : pendingRow.client_email && pendingRow.client_email.includes("@")
      ? pendingRow.client_email.trim()
      : "cliente@jessicamagalhaesnail.com";

    const nameParts = (pendingRow.client_name || "Cliente").trim().split(" ");
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Cliente";

    const paymentPayload = {
      transaction_amount: depositAmount,
      token,
      description: `Sinal - ${pendingRow.service_type || "JM Nails"}`.slice(0, 100),
      installments: parseInt(installments, 10) || 1,
      payment_method_id: payment_method_id || undefined,
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: cleanCpf
          ? {
              type: "CPF",
              number: cleanCpf,
            }
          : undefined,
      },
      external_reference: String(appointment_id),
      notification_url: webhookUrl,
    };

    if (issuer_id) {
      paymentPayload.issuer_id = String(issuer_id);
    }

    const idempotencyKey = crypto.randomUUID();

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const resData = await mpRes.json();

    if (!mpRes.ok) {
      await client.end();
      console.error("Erro da API Mercado Pago ao processar cartão:", resData);
      const friendlyMessage = translateStatusDetail(resData.cause?.[0]?.code || resData.message);
      return res.status(mpRes.status).json({
        error: friendlyMessage || resData.message || "Falha ao processar pagamento com cartão.",
        details: resData,
      });
    }

    if (resData.status !== "approved") {
      await client.end();
      const friendlyMsg = translateStatusDetail(resData.status_detail);
      return res.status(200).json({
        success: false,
        status: resData.status,
        status_detail: resData.status_detail,
        error: friendlyMsg,
      });
    }

    // Pagamento APROVADO! Confirmar agendamento imediatamente!
    const notesWithDeposit = pendingRow.notes && pendingRow.notes.includes("[Sinal")
      ? (pendingRow.notes.includes("Pago") ? pendingRow.notes : `${pendingRow.notes} [Sinal Pago no Cartão via Mercado Pago]`)
      : `${pendingRow.notes ? pendingRow.notes + " " : ""}[Sinal 50% Pago no Cartão via Mercado Pago]`;

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
        pendingRow.id,
        pendingRow.user_id || null,
        pendingRow.client_name,
        pendingRow.client_phone,
        pendingRow.client_email,
        pendingRow.service_type,
        pendingRow.appointment_date,
        pendingRow.appointment_time,
        notesWithDeposit,
      ]
    );

    await client.query(
      "UPDATE pending_checkouts SET status = 'paid', updated_at = now() WHERE id = $1",
      [pendingRow.id]
    );

    await client.query("DELETE FROM slot_holds WHERE session_id = $1", [pendingRow.id]).catch(() => {});
    const appointmentData = insertRes.rows[0] || pendingRow;

    // Disparar WhatsApp
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
          `✅ O seu pagamento de sinal foi *APROVADO* via Cartão de Crédito!\n` +
          `🎉 Seu agendamento está oficialmente *MARCADO E CONFIRMADO*! 💕\n\n` +
          `💅 *Serviço:* ${appointmentData.service_type}\n` +
          `📅 *Data:* ${formattedDate}\n` +
          `🕐 *Horário:* ${formattedTime}\n` +
          `💰 *Sinal:* Pago no Cartão (restante no atendimento)\n\n` +
          `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
          `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
          `🙏 Te esperamos com muito carinho! 💕`;

        await sendWhatsAppMessage(
          wConfig.instance_id,
          wConfig.instance_token,
          appointmentData.client_phone,
          clientMsg
        );

        // Mensagem para a Jéssica
        const adminMsg =
          `💰 *NOVO AGENDAMENTO CONFIRMADO (Cartão de Crédito)* 💰\n\n` +
          `O pagamento do sinal foi aprovado no cartão de crédito via Mercado Pago!\n\n` +
          `👤 *Cliente:* ${appointmentData.client_name}\n` +
          `📱 *WhatsApp:* ${appointmentData.client_phone}\n` +
          `💅 *Serviço:* ${appointmentData.service_type}\n` +
          `📅 *Data:* ${formattedDate} às ${formattedTime}\n` +
          `💳 *Status:* Confirmado automaticamente no Cartão\n\n` +
          `📋 Painel:\nhttps://jessicamagalhaesnail.vercel.app/admin`;

        await sendWhatsAppMessage(
          wConfig.instance_id,
          wConfig.instance_token,
          wConfig.admin_number,
          adminMsg
        );
      }
    } catch (wErr) {
      console.error("Erro ao enviar WhatsApp pós pagamento de cartão:", wErr.message);
    }

    await client.end();
    return res.status(200).json({
      success: true,
      status: "approved",
      payment_id: resData.id,
      appointment: appointmentData,
    });
  } catch (error) {
    console.error("Erro no processamento de cartão Mercado Pago:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
