import { mapPacienteToPortalPayload } from "../utils/patientMappers.js";

export const createAdminService = ({ adminRepository }) => {
  const getOverview = () => adminRepository.getOverview();

  const getPacientes = async () => {
    const pacientes = await adminRepository.listPacientes();
    return pacientes.map((paciente) => ({
      ...mapPacienteToPortalPayload(paciente),
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
      pacienteNome: row.paciente?.nomeCompleto ?? row.paciente?.nome ?? null,
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

  const getPacienteDetalhes = async (phone) => {
    const paciente = await adminRepository.getPacienteDetalhes(phone);
    if (!paciente) return null;

    return {
      ...mapPacienteToPortalPayload(paciente),
      assinaturas: paciente.assinaturas,
      historicoPesos: paciente.historicoPesos,
      questionariosConcluidos: paciente.questionariosConcluidos,
      answers: paciente.answers,
    };
  };
  const deletePaciente = (phone) => adminRepository.deletePacienteByPhone(phone);

  return {
    getOverview,
    getPacientes,
    getQuestionariosConcluidos,
    getPontuacoes,
    getPacienteDetalhes,
    deletePaciente,
  };
};
