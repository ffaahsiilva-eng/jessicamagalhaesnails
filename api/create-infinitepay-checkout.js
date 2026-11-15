import { Client } from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://postgres.nhsbtfilpxsvylqsrbsa:@Filhodorei123@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function getPaymentConfig() {
  let handle = process.env.INFINITEPAY_HANDLE || "paifilhoespirito";
  let apiKey = process.env.INFINITEPAY_API_KEY || "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA";
  let percent = parseInt(process.env.INFINITEPAY_DEPOSIT_PERCENT || "50", 10) || 50;
  let enabled = true;

  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const res = await client.query(
      "SELECT key, value FROM site_settings WHERE key IN ('infinitepay_handle', 'infinitepay_api_key', 'infinitepay_deposit_percent', 'infinitepay_enabled')"
    );
    await client.end();

    res.rows.forEach((r) => {
      if (r.key === "infinitepay_handle" && r.value) handle = r.value.trim();
      if (r.key === "infinitepay_api_key" && r.value) apiKey = r.value.trim();
      if (r.key === "infinitepay_deposit_percent" && r.value) percent = parseInt(r.value, 10) || percent;
      if (r.key === "infinitepay_enabled") enabled = r.value !== "false";
    });
  } catch (err) {
    console.warn("Aviso ao buscar configurações de pagamento do banco:", err.message);
  }

  return { handle, apiKey, percent, enabled };
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
    const { appointment_id, client_name, service_type, total_amount, site_url } = body;

    if (!appointment_id) {
      return res.status(400).json({ error: "appointment_id é obrigatório." });
    }

    const config = await getPaymentConfig();
    if (!config.enabled) {
      return res.status(400).json({ error: "Pagamento online da InfinitePay está desativado." });
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

    const baseUrl = site_url || "https://jessicamagalhaesnail.vercel.app";
    const redirectUrl = `${baseUrl.replace(/\/$/, "")}?payment=success&appointment_id=${encodeURIComponent(appointment_id)}`;
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/infinitepay-webhook`;

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
      order_nsu: String(appointment_id),
      redirect_url: redirectUrl,
      webhook: {
        url: webhookUrl,
        events: ["paid", "refunded", "canceled"],
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
      console.error("Erro da API InfinitePay:", resData);
      return res.status(infiniteRes.status).json({
        error: resData.message || resData.error || "Falha ao gerar link na InfinitePay",
        details: resData,
      });
    }

    return res.status(200).json({
      success: true,
      url: resData.url,
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
