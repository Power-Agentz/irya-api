export const createPacienteRepository = (prisma) => {
  const findByTelefone = (telefone) =>
    prisma.paciente.findUnique({
      where: { telefone },
    });

  const findByTelefoneWithApiKey = (telefone) =>
    prisma.paciente.findUnique({
      where: { telefone },
      select: {
        telefone: true,
        apiKey: true,
        isSubscriber: true,
        subscriptionStartedAt: true,
        subscriptionCanceledAt: true,
      },
    });

  const updateSubscriptionByTelefone = (telefone, data) =>
    prisma.paciente.update({
      where: { telefone },
      data,
      select: {
        telefone: true,
        isSubscriber: true,
        subscriptionStartedAt: true,
        subscriptionCanceledAt: true,
      },
    });

  return {
    findByTelefone,
    findByTelefoneWithApiKey,
    updateSubscriptionByTelefone,
  };
};

