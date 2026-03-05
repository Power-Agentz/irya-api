const ACTIVE_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "INVOICE_PAID",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_ACTIVATED",
]);

const CANCELED_EVENTS = new Set([
  "SUBSCRIPTION_CANCELED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
  "PAYMENT_REFUNDED",
]);

const pickPhoneFromWebhook = (payload) => {
  return (
    payload?.phone ??
    payload?.customer?.phone ??
    payload?.customerPhone ??
    payload?.payment?.customer?.phone ??
    payload?.payment?.externalReference ??
    payload?.subscription?.externalReference ??
    null
  );
};

const normalizeDigitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const getAsaasConfig = () => {
  const baseUrl = (process.env.ASAAS_BASE_URL ?? "https://api.asaas.com").replace(
    /\/$/,
    "",
  );

  return {
    baseUrl,
    apiKey: process.env.ASAAS_API_KEY ?? "",
    monthlyValue: Number(process.env.ASAAS_MONTHLY_VALUE ?? "79.9"),
    billingType: process.env.ASAAS_BILLING_TYPE ?? "UNDEFINED",
    description:
      process.env.ASAAS_SUBSCRIPTION_DESCRIPTION ?? "Assinatura mensal Portal Irya",
  };
};

const createAsaasClient = () => {
  const config = getAsaasConfig();

  const request = async (path, init = {}) => {
    if (!config.apiKey) {
      throw new Error("ASAAS_API_KEY nao configurada.");
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: config.apiKey,
        ...(init.headers ?? {}),
      },
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const firstError = data?.errors?.[0];
      const asaasError = new Error(
        `Erro Asaas (${response.status}): ${firstError?.description ?? response.statusText}`,
      );
      asaasError.statusCode = response.status;
      asaasError.details = data;
      throw asaasError;
    }

    return data;
  };

  return { request, config };
};

const getCheckoutUrlFromPayment = (payment) =>
  payment?.invoiceUrl ??
  payment?.bankSlipUrl ??
  payment?.checkoutUrl ??
  payment?.pixQrCodeUrl ??
  null;

export const createSubscriptionService = ({ pacienteRepository }) => {
  const syncSubscriptionFromAsaasWebhook = async (payload) => {
    const event = payload?.event;
    const phone = pickPhoneFromWebhook(payload);

    if (!event || !phone) {
      return { updated: false, reason: "payload_invalido" };
    }

    const normalizedPhone = normalizeDigitsOnly(phone);
    const patient = await pacienteRepository.findByTelefone(normalizedPhone);
    if (!patient) {
      return {
        updated: false,
        reason: "paciente_nao_encontrado",
        phone: normalizedPhone,
      };
    }

    if (ACTIVE_EVENTS.has(event)) {
      const now = new Date();
      const updated = await pacienteRepository.updateSubscriptionByTelefone(
        normalizedPhone,
        {
          isSubscriber: true,
          subscriptionStartedAt: patient.subscriptionStartedAt ?? now,
          subscriptionCanceledAt: null,
        },
      );

      return { updated: true, phone: normalizedPhone, event, subscription: updated };
    }

    if (CANCELED_EVENTS.has(event)) {
      const updated = await pacienteRepository.updateSubscriptionByTelefone(
        normalizedPhone,
        {
          isSubscriber: false,
          subscriptionCanceledAt: new Date(),
        },
      );

      return { updated: true, phone: normalizedPhone, event, subscription: updated };
    }

    return { updated: false, reason: "evento_ignorado", phone: normalizedPhone, event };
  };

  const getSubscriptionStatus = async (phone) => {
    const normalizedPhone = normalizeDigitsOnly(phone);
    const profile = await pacienteRepository.findProfileByTelefone(normalizedPhone);
    if (!profile) return null;

    return {
      telefone: profile.telefone,
      isSubscriber: profile.isSubscriber,
      subscriptionStartedAt: profile.subscriptionStartedAt,
      subscriptionCanceledAt: profile.subscriptionCanceledAt,
    };
  };

  const ensureCustomer = async ({ phone, nomeCompleto }) => {
    const { request } = createAsaasClient();

    const existing = await request(
      `/v3/customers?externalReference=${encodeURIComponent(phone)}&limit=1&offset=0`,
      { method: "GET" },
    );

    if (existing?.data?.length > 0) {
      return existing.data[0];
    }

    return request("/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: nomeCompleto,
        mobilePhone: phone,
        externalReference: phone,
      }),
    });
  };

  const getFirstSubscriptionPayment = async (subscriptionId) => {
    const { request } = createAsaasClient();
    const payments = await request(
      `/v3/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1&offset=0`,
      { method: "GET" },
    );

    return payments?.data?.[0] ?? null;
  };

  const createMonthlyCheckout = async (phone) => {
    const normalizedPhone = normalizeDigitsOnly(phone);
    const profile = await pacienteRepository.findByTelefone(normalizedPhone);

    if (!profile) {
      return { ok: false, status: 404, error: "Paciente nao encontrado." };
    }

    if (profile.isSubscriber) {
      return {
        ok: false,
        status: 409,
        error: "Paciente ja possui assinatura ativa.",
      };
    }

    try {
      const asaas = createAsaasClient();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const customer = await ensureCustomer({
        phone: normalizedPhone,
        nomeCompleto: profile.nomeCompleto,
      });

      const subscription = await asaas.request("/v3/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customer.id,
          billingType: asaas.config.billingType,
          value: asaas.config.monthlyValue,
          nextDueDate: toIsoDate(dueDate),
          cycle: "MONTHLY",
          description: asaas.config.description,
          externalReference: normalizedPhone,
        }),
      });

      const firstPayment = await getFirstSubscriptionPayment(subscription.id);
      const checkoutUrl = getCheckoutUrlFromPayment(firstPayment);

      const now = new Date();
      const updated = await pacienteRepository.updateSubscriptionByTelefone(
        normalizedPhone,
        {
          isSubscriber: true,
          subscriptionStartedAt: profile.subscriptionStartedAt ?? now,
          subscriptionCanceledAt: null,
        },
      );

      return {
        ok: true,
        status: 201,
        data: {
          message: "Assinatura mensal criada com sucesso.",
          checkoutUrl,
          customerId: customer.id,
          subscriptionId: subscription.id,
          billingType: asaas.config.billingType,
          value: asaas.config.monthlyValue,
          nextDueDate: toIsoDate(dueDate),
          subscription: updated,
        },
      };
    } catch (error) {
      const message = error?.message ?? "Erro ao integrar com Asaas.";
      const details = error?.details ?? null;
      const statusCode = error?.statusCode ?? 502;

      return {
        ok: false,
        status: statusCode >= 400 && statusCode < 600 ? statusCode : 502,
        error: message,
        details,
      };
    }
  };

  return {
    syncSubscriptionFromAsaasWebhook,
    getSubscriptionStatus,
    createMonthlyCheckout,
  };
};
