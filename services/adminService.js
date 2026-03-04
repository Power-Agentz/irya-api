export const createAdminService = ({ adminRepository }) => {
  const getOverview = () => adminRepository.getOverview();

  const getPacientes = async () => {
    const pacientes = await adminRepository.listPacientes();
    return pacientes.map((paciente) => ({
      ...paciente,
      metricas: {
        questionariosConcluidos: paciente._count.questionariosConcluidos,
        respostasRegistradas: paciente._count.answers,
        registrosDePeso: paciente._count.historicoPesos,
      },
    }));
  };

  const getQuestionariosConcluidos = async () => {
    const rows = await adminRepository.listQuestionariosConcluidos();
    return rows.map((row) => ({
      id: row.id,
      dataConclusao: row.dataConclusao,
      pacienteTelefone: row.pacienteTelefone,
      pacienteNome: row.paciente?.nomeCompleto ?? null,
      pontuacaoTotal: row.pontuacaoTotal,
      percentualGlobal: row.percentualGlobal,
      classificacao: row.classificacao,
      pontuacoesPorPilar: row.pontuacoes.map((p) => ({
        pilar: p.pilar.nomePilar,
        pontuacaoObtida: p.pontuacaoObtida,
        pontuacaoMaxima: p.pilar.pontuacaoMaxima,
      })),
    }));
  };

  const getPontuacoes = async () => {
    const rows = await adminRepository.listPontuacoes();
    return rows.map((row) => ({
      id: row.id,
      pilar: row.pilar.nomePilar,
      pontuacaoObtida: row.pontuacaoObtida,
      pontuacaoMaxima: row.pilar.pontuacaoMaxima,
      questionarioId: row.questionarioConcluido.id,
      dataConclusao: row.questionarioConcluido.dataConclusao,
      pacienteTelefone: row.questionarioConcluido.pacienteTelefone,
    }));
  };

  const getPacienteDetalhes = (phone) => adminRepository.getPacienteDetalhes(phone);

  return {
    getOverview,
    getPacientes,
    getQuestionariosConcluidos,
    getPontuacoes,
    getPacienteDetalhes,
  };
};

