const ACTIVE_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "INVOICE_PAID",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_ACTIVATED",
]);

const CANCELED_EVENTS = new Set([
  "SUBSCRIPTION_CANCELED",
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

export const createSubscriptionService = ({ pacienteRepository }) => {
  const syncSubscriptionFromAsaasWebhook = async (payload) => {
    const event = payload?.event;
    const phone = pickPhoneFromWebhook(payload);

    if (!event || !phone) {
      return { updated: false, reason: "payload_invalido" };
    }

    const patient = await pacienteRepository.findByTelefone(phone);
    if (!patient) {
      return { updated: false, reason: "paciente_nao_encontrado", phone };
    }

    if (ACTIVE_EVENTS.has(event)) {
      const now = new Date();
      const updated = await pacienteRepository.updateSubscriptionByTelefone(phone, {
        isSubscriber: true,
        subscriptionStartedAt: patient.subscriptionStartedAt ?? now,
        subscriptionCanceledAt: null,
      });

      return { updated: true, phone, event, subscription: updated };
    }

    if (CANCELED_EVENTS.has(event)) {
      const updated = await pacienteRepository.updateSubscriptionByTelefone(phone, {
        isSubscriber: false,
        subscriptionCanceledAt: new Date(),
      });

      return { updated: true, phone, event, subscription: updated };
    }

    return { updated: false, reason: "evento_ignorado", phone, event };
  };

  return { syncSubscriptionFromAsaasWebhook };
};

