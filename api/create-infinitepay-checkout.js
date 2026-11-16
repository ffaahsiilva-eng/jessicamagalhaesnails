import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function getPaymentConfig() {
  let handle = process.env.INFINITEPAY_HANDLE || "paifilhoespirito";
  let apiKey = process.env.INFINITEPAY_API_KEY || "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA";
  let percent = parseInt(process.env.INFINITEPAY_DEPOSIT_PERCENT || "50", 10) || 50;
  let enabled = true;
  let depositMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key IN ('infinitepay_handle', 'infinitepay_api_key', 'infinitepay_deposit_percent', 'infinitepay_enabled', 'infinitepay_deposit_months')"
    );
    await client.end();

    res.rows.forEach((r) => {
      if (r.key === "infinitepay_handle" && r.value) handle = r.value.trim();
      if (r.key === "infinitepay_api_key" && r.value) apiKey = r.value.trim();
      if (r.key === "infinitepay_deposit_percent" && r.value) percent = parseInt(r.value, 10) || percent;
      if (r.key === "infinitepay_enabled") enabled = r.value !== "false";
      if (r.key === "infinitepay_deposit_months" && r.value) {
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
    console.warn("Aviso ao buscar configurações de pagamento do banco:", err.message);
  }

  return { handle, apiKey, percent, enabled, depositMonths };
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
      return res.status(400).json({ error: "Pagamento online da InfinitePay está desativado." });
    }

    if (appointment_date) {
      const parts = appointment_date.split("-");
      if (parts.length >= 2) {
        const monthNum = parseInt(parts[1], 10);
        if (!isNaN(monthNum) && !config.depositMonths.includes(monthNum)) {
          return res.status(400).json({
            error: `A cobrança de sinal de 50% não está ativada para o mês selecionado (${monthNum}). Este agendamento pode ser confirmado diretamente sem sinal.`,
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
    const depositInCents = Math.round(depositValue * 100);
    const remainingValue = Math.round((total - depositValue) * 100) / 100;

    if (depositInCents < 100) {
      return res.status(400).json({ error: "Valor do sinal inferior ao mínimo permitido (R$ 1,00)." });
    }

    // 1. Salvar na tabela pending_checkouts (NÃO cria agendamento ainda!)
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

    // Hold temporário de 15 minutos para ninguém pegar o horário durante o pagamento
    if (appointment_date && appointment_time) {
      try {
        await client.query(
          `INSERT INTO slot_holds (slot_date, slot_time, session_id, created_at)
           VALUES ($1, $2, $3, now())`,
          [appointment_date, appointment_time, checkoutId]
        );
      } catch {
        // Ignora se tabela slot_holds não existir ou erro de chave
      }
    }

    const baseUrl = site_url || "https://jessicamagalhaesnail.vercel.app";
    const redirectUrl = `${baseUrl.replace(/\/$/, "")}?payment=success&order_nsu=${encodeURIComponent(checkoutId)}`;
    
    // Se estiver em ambiente local, o webhook precisa apontar para a URL pública em produção
    const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
    const webhookBaseUrl = isLocal ? "https://jessicamagalhaesnail.vercel.app" : baseUrl;
    const webhookUrl = `${webhookBaseUrl.replace(/\/$/, "")}/api/infinitepay-webhook`;

    const description = `Sinal ${depositPercent}% - ${service_type || "Agendamento JM Nails"}`.slice(0, 100);

    const payload = {
      handle: config.handle,
      items: [
        {
          description,
          quantity: 1,
          price: depositInCents,
        },
      ],
      order_nsu: String(checkoutId),
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      webhook: {
        url: webhookUrl,
        events: ["paid", "refunded", "canceled"],
      },
      options: {
        single_payment: true,
        payment_methods_enabled: ["pix", "credit_card"],
      },
      payment_methods_enabled: ["pix", "credit_card"],
      single_payment: true,
    };

    const infiniteRes = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const resData = await infiniteRes.json();

    if (!infiniteRes.ok) {
      await client.end();
      console.error("Erro da API InfinitePay:", resData);
      return res.status(infiniteRes.status).json({
        error: resData.message || resData.error || "Falha ao gerar link na InfinitePay",
        details: resData,
      });
    }

    // Salvar link gerado
    await client.query(
      "UPDATE pending_checkouts SET payment_url = $1 WHERE id = $2",
      [resData.url, checkoutId]
    );
    await client.end();

    return res.status(200).json({
      success: true,
      url: resData.url,
      checkout_id: checkoutId,
      deposit_amount: depositValue,
      deposit_cents: depositInCents,
      remaining_amount: remainingValue,
      deposit_percent: depositPercent,
    });
  } catch (error) {
    console.error("Erro no checkout InfinitePay:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : String(error),
    });
  }
}
