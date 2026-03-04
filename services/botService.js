const formatRoundScores = (round) => ({
  roundDate: round.dataConclusao,
  classificacao: round.classificacao,
  pontuacaoTotal: round.pontuacaoTotal,
  percentualGlobal: round.percentualGlobal,
  scores: round.pontuacoes.map((score) => ({
    pilar: score.pilar.nomePilar,
    pontuacaoObtida: score.pontuacaoObtida,
    pontuacaoMaxima: score.pilar.pontuacaoMaxima,
    percentualPilar:
      score.pilar.pontuacaoMaxima > 0
        ? parseFloat(
            ((score.pontuacaoObtida / score.pilar.pontuacaoMaxima) * 100).toFixed(2),
          )
        : 0,
  })),
});

export const createBotService = ({ pacienteRepository, botRepository }) => {
  const validateBotApiKey = async (phone, apiKey) => {
    const patient = await pacienteRepository.findByTelefoneWithApiKey(phone);
    if (!patient) {
      return { ok: false, status: 404, error: "Paciente não encontrado." };
    }

    if (!apiKey || !patient.apiKey || apiKey !== patient.apiKey) {
      return { ok: false, status: 403, error: "API key inválida para este paciente." };
    }

    return { ok: true, patient };
  };

  const getScoresByPhone = async (phone) => {
    const rounds = await botRepository.findScoreRoundsByPhone(phone);
    if (!rounds.length) {
      return {
        patientId: phone,
        current: null,
        history: [],
      };
    }

    const formattedRounds = rounds.map(formatRoundScores);

    return {
      patientId: phone,
      current: formattedRounds[0],
      history: formattedRounds,
    };
  };

  const getAnswersByPhone = async (phone) => {
    const answers = await botRepository.findAnswersByPhone(phone);
    return {
      patientId: phone,
      totalAnswers: answers.length,
      answers,
    };
  };

  const getAnswersByPhoneAndPilar = async (phone, pilarName) => {
    const answers = await botRepository.findAnswersByPhoneAndPilar(phone, pilarName);
    return {
      patientId: phone,
      pilar: pilarName,
      totalAnswers: answers.length,
      answers,
    };
  };

  const getSubscriptionStatusByPhone = async (phone) => {
    const patient = await pacienteRepository.findByTelefoneWithApiKey(phone);
    if (!patient) {
      return null;
    }

    return {
      patientId: patient.telefone,
      isSubscriber: patient.isSubscriber,
      subscriptionStartedAt: patient.subscriptionStartedAt,
      subscriptionCanceledAt: patient.subscriptionCanceledAt,
    };
  };

  return {
    validateBotApiKey,
    getScoresByPhone,
    getAnswersByPhone,
    getAnswersByPhoneAndPilar,
    getSubscriptionStatusByPhone,
  };
};

