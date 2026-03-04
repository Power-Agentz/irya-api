export const createBotRepository = (prisma) => {
  const findScoreRoundsByPhone = (phone) =>
    prisma.questionarioConcluido.findMany({
      where: { pacienteTelefone: phone },
      orderBy: { dataConclusao: "desc" },
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
          orderBy: {
            pilarId: "asc",
          },
        },
      },
    });

  const findAnswersByPhone = (phone) =>
    prisma.answer.findMany({
      where: { pacienteTelefone: phone },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pacienteTelefone: true,
        questionText: true,
        answerValue: true,
        pilarCategory: true,
        createdAt: true,
      },
    });

  const findAnswersByPhoneAndPilar = (phone, pilarName) =>
    prisma.answer.findMany({
      where: {
        pacienteTelefone: phone,
        pilarCategory: {
          equals: pilarName,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pacienteTelefone: true,
        questionText: true,
        answerValue: true,
        pilarCategory: true,
        createdAt: true,
      },
    });

  return {
    findScoreRoundsByPhone,
    findAnswersByPhone,
    findAnswersByPhoneAndPilar,
  };
};

