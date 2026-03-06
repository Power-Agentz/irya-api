export const createAdminRepository = (prisma) => {
  const getOverview = async () => {
    const [totalPacientes, totalQuestionarios, totalRespostas, totalAssinantesAtivos] =
      await Promise.all([
        prisma.paciente.count(),
        prisma.questionarioConcluido.count(),
        prisma.answer.count(),
        prisma.paciente.count({ where: { isSubscriber: true } }),
      ]);

    return {
      totalPacientes,
      totalQuestionarios,
      totalRespostas,
      totalAssinantesAtivos,
    };
  };

  const listPacientes = () =>
    prisma.paciente.findMany({
      orderBy: { dataCadastro: "desc" },
      select: {
        telefone: true,
        nomeCompleto: true,
        dataCadastro: true,
        alturaM: true,
        isSubscriber: true,
        subscriptionStartedAt: true,
        subscriptionCanceledAt: true,
        _count: {
          select: {
            questionariosConcluidos: true,
            answers: true,
            historicoPesos: true,
          },
        },
      },
    });

  const listQuestionariosConcluidos = () =>
    prisma.questionarioConcluido.findMany({
      orderBy: { dataConclusao: "desc" },
      include: {
        paciente: {
          select: {
            telefone: true,
            nomeCompleto: true,
          },
        },
        pontuacoes: {
          include: {
            pilar: {
              select: {
                nomePilar: true,
                pontuacaoMaxima: true,
              },
            },
          },
          orderBy: { pilarId: "asc" },
        },
      },
    });

  const listPontuacoes = () =>
    prisma.pontuacaoPorPilar.findMany({
      orderBy: { id: "desc" },
      include: {
        pilar: {
          select: {
            nomePilar: true,
            pontuacaoMaxima: true,
          },
        },
        questionarioConcluido: {
          select: {
            id: true,
            dataConclusao: true,
            pacienteTelefone: true,
          },
        },
      },
      take: 500,
    });

  const getPacienteDetalhes = (phone) =>
    prisma.paciente.findUnique({
      where: { telefone: phone },
      include: {
        historicoPesos: {
          orderBy: { dataRegistro: "desc" },
          take: 24,
        },
        questionariosConcluidos: {
          orderBy: { dataConclusao: "desc" },
          take: 24,
          include: {
            pontuacoes: {
              include: {
                pilar: {
                  select: {
                    nomePilar: true,
                    pontuacaoMaxima: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          orderBy: { createdAt: "desc" },
          take: 200,
        },
      },
    });

  const deletePacienteByPhone = async (phone) => {
    const paciente = await prisma.paciente.findUnique({
      where: { telefone: phone },
      select: { telefone: true },
    });

    if (!paciente) return null;

    await prisma.$transaction(async (tx) => {
      const questionarios = await tx.questionarioConcluido.findMany({
        where: { pacienteTelefone: phone },
        select: { id: true },
      });

      const questionarioIds = questionarios.map((q) => q.id);

      if (questionarioIds.length > 0) {
        await tx.pontuacaoPorPilar.deleteMany({
          where: {
            questionarioConcluidoId: { in: questionarioIds },
          },
        });
      }

      await tx.answer.deleteMany({
        where: { pacienteTelefone: phone },
      });

      await tx.questionarioConcluido.deleteMany({
        where: { pacienteTelefone: phone },
      });

      await tx.historicoPeso.deleteMany({
        where: { pacienteTelefone: phone },
      });

      await tx.paciente.delete({
        where: { telefone: phone },
      });
    });

    return { telefone: phone };
  };

  return {
    getOverview,
    listPacientes,
    listQuestionariosConcluidos,
    listPontuacoes,
    getPacienteDetalhes,
    deletePacienteByPhone,
  };
};
