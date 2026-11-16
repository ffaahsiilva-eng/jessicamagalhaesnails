import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function getPaymentConfig() {
  let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
  let percent = parseInt(process.env.MERCADOPAGO_DEPOSIT_PERCENT || "50", 10) || 50;
  let enabled = true;
  let depositMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key IN ('mercadopago_access_token', 'mercadopago_deposit_percent', 'mercadopago_enabled', 'mercadopago_deposit_months')"
    );
    await client.end();

    res.rows.forEach((r) => {
      if (r.key === "mercadopago_access_token" && r.value) accessToken = r.value.trim();
      if (r.key === "mercadopago_deposit_percent" && r.value) percent = parseInt(r.value, 10) || percent;
      if (r.key === "mercadopago_enabled") enabled = r.value !== "false";
      if (r.key === "mercadopago_deposit_months" && r.value) {
        try {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed)) depositMonths = parsed.map(Number);
        } catch {
          const list = r.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
          if (list.length > 0) depositMonths = list;
        }
      }
    });
  } catch (err) {
    console.warn("Aviso ao buscar configurações do Mercado Pago no banco:", err.message);
  }

  return { accessToken, percent, enabled, depositMonths };
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
      client_name,
      client_phone,
      client_email,
      service_type,
      appointment_date,
      appointment_time,
      notes,
      total_amount,
      site_url,
    } = body;

    const checkoutId = appointment_id || crypto.randomUUID();

    const config = await getPaymentConfig();
    if (!config.enabled) {
      return res.status(400).json({ error: "Pagamento online do Mercado Pago está desativado." });
    }

    if (!config.accessToken) {
      return res.status(400).json({
        error: "Access Token do Mercado Pago não configurado. Por favor, acesse o painel Admin.",
      });
    }

    if (appointment_date) {
      const parts = appointment_date.split("-");
      if (parts.length >= 2) {
        const monthNum = parseInt(parts[1], 10);
        if (!isNaN(monthNum) && !config.depositMonths.includes(monthNum)) {
          return res.status(400).json({
            error: `A cobrança de sinal de 50% não está ativada para o mês selecionado (${monthNum}).`,
          });
        }
      }
    }

    const total = parseFloat(total_amount) || 0;
    if (total <= 0) {
      return res.status(400).json({ error: "Valor total inválido para pagamento." });
    }

    const depositPercent = config.percent || 50;
    const depositValue = Math.round((total * (depositPercent / 100)) * 100) / 100;
    const remainingValue = Math.round((total - depositValue) * 100) / 100;

    if (depositValue < 1.0) {
      return res.status(400).json({ error: "Valor do sinal inferior ao mínimo permitido (R$ 1,00)." });
    }

    // 1. Salvar na tabela pending_checkouts
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await client.query(
      `INSERT INTO pending_checkouts (
        id, client_name, client_phone, client_email, service_type,
        appointment_date, appointment_time, notes, total_amount, deposit_amount,
        remaining_amount, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', now(), now())
      ON CONFLICT (id) DO UPDATE SET
        client_name = EXCLUDED.client_name,
        client_phone = EXCLUDED.client_phone,
        client_email = EXCLUDED.client_email,
        service_type = EXCLUDED.service_type,
        appointment_date = EXCLUDED.appointment_date,
        appointment_time = EXCLUDED.appointment_time,
        notes = EXCLUDED.notes,
        total_amount = EXCLUDED.total_amount,
        deposit_amount = EXCLUDED.deposit_amount,
        remaining_amount = EXCLUDED.remaining_amount,
        status = 'pending',
        updated_at = now()`,
      [
        checkoutId,
        client_name || "",
        client_phone || "",
        client_email || null,
        service_type || "",
        appointment_date,
        appointment_time,
        notes || "",
        total,
        depositValue,
        remainingValue,
      ]
    );

    // Hold temporário de 15 minutos para segurar a vaga
    if (appointment_date && appointment_time) {
      try {
        await client.query(
          `INSERT INTO slot_holds (slot_date, slot_time, session_id, created_at)
           VALUES ($1, $2, $3, now())`,
          [appointment_date, appointment_time, checkoutId]
        );
      } catch {
        // ignora se tabela não existir ou duplicata
      }
    }

    const baseUrl = site_url || "https://jessicamagalhaesnail.vercel.app";
    const isLocal = !site_url || site_url.includes("localhost") || site_url.includes("127.0.0.1") || !site_url.startsWith("https://");
    const publicBaseUrl = isLocal ? "https://jessicamagalhaesnail.vercel.app" : baseUrl.replace(/\/$/, "");
    const webhookUrl = `${publicBaseUrl}/api/mercadopago-webhook`;

    const nameParts = (client_name || "Cliente").trim().split(" ");
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Cliente";

    const pixPayload = {
      transaction_amount: depositValue,
      description: `Sinal ${depositPercent}% - ${service_type || "JM Nails"}`.slice(0, 100),
      payment_method_id: "pix",
      payer: {
        email: client_email && client_email.includes("@") ? client_email.trim() : "cliente@jessicamagalhaesnail.com",
        first_name: firstName,
        last_name: lastName,
        phone: {
          number: String(client_phone || "").replace(/\D/g, ""),
        },
      },
      external_reference: String(checkoutId),
      notification_url: webhookUrl,
    };

    const idempotencyKey = crypto.randomUUID();

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(pixPayload),
    });

    const resData = await mpRes.json();

    if (!mpRes.ok) {
      await client.end();
      console.error("Erro da API Mercado Pago (Pix):", resData);
      return res.status(mpRes.status).json({
        error: resData.message || resData.error || "Falha ao gerar Pix no Mercado Pago",
        details: resData,
      });
    }

    const transactionData = resData.point_of_interaction?.transaction_data;
    const qrCode = transactionData?.qr_code;
    const qrCodeBase64 = transactionData?.qr_code_base64;
    const ticketUrl = transactionData?.ticket_url;
    const paymentId = resData.id;

    // Salvar link/código gerado na pending_checkouts
    await client.query(
      "UPDATE pending_checkouts SET payment_url = $1 WHERE id = $2",
      [ticketUrl || qrCode || String(paymentId), checkoutId]
    );
    await client.end();

    return res.status(200).json({
      success: true,
      payment_id: paymentId,
      checkout_id: checkoutId,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
      deposit_amount: depositValue,
      remaining_amount: remainingValue,
      deposit_percent: depositPercent,
    });
  } catch (error) {
    console.error("Erro ao gerar Pix Transparente Mercado Pago:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
