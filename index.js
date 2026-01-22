import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use(cors());
app.get("/", (req, res) => {
  res.send("API WHIM está rodando!");
});

console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);
console.log("JWT_SECRET exists?", !!process.env.JWT_SECRET);

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res
      .status(401)
      .json({ error: "Acesso negado. Token não fornecido." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, paciente) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }

    req.paciente = paciente;

    next();
  });
}

function authenticateService(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.SERVICE_API_KEY) {
    return res.status(403).json({ error: "Acesso negado (serviço)." });
  }

  next();
}

app.get("/paciente/me", authenticateToken, async (req, res) => {
  const pacienteId = req.paciente.pacienteId;

  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: {
      id: true,
      nomeCompleto: true,
      nomeSocialApelido: true,
      telefone: true,
      sexo: true,
      email: true,
      cidade: true,
      estado: true,
      dataCadastro: true,
    },
  });

  res.json(paciente);
});

app.put("/paciente/me", authenticateToken, async (req, res) => {
  const pacienteId = req.paciente.pacienteId;

  const dadosAtualizaveis = req.body;

  const pacienteAtualizado = await prisma.paciente.update({
    where: { id: pacienteId },
    data: dadosAtualizaveis,
  });

  res.json(pacienteAtualizado);
});

app.get("/integrations/pacientes", authenticateService, async (req, res) => {
  const pacientes = await prisma.paciente.findMany({
    select: {
      id: true,
      nomeSocialApelido: true,
      telefone: true,
      sexo: true,
      dataCadastro: true,
    },
  });

  res.json(pacientes);
});

app.get(
  "/integrations/pacientes/telefone/:telefone",
  authenticateService,
  async (req, res) => {
    const { telefone } = req.params;

    const paciente = await prisma.paciente.findUnique({
      where: { telefone },
      select: {
        id: true,
        nomeSocialApelido: true,
        telefone: true,
        sexo: true,
        dataCadastro: true,
      },
    });

    if (!paciente) {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }

    res.json(paciente);
  },
);

app.post("/auth/register", async (req, res) => {
  const { nomeSocialApelido, telefone, sexo, senha } = req.body;
  if (!telefone || !senha || !nomeSocialApelido || !sexo) {
    return res.status(400).json({
      error: "Ooops... Todos os campos devem ser preenchidos.",
    });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novaPaciente = await prisma.paciente.create({
      data: {
        telefone,
        senhaHash,
        nomeSocialApelido,
        sexo,

        nomeCompleto: null,
        dataNascimento: null,
        alturaCm: null,
        email: null,
        cidade: null,
        estado: null,
        objetivoCorporalPrincipal: null,
        estadoCivil: null,
        moraComAlguem: null,
        temFilhos: null,
        temPets: null,
        profissao: null,
        cargaHorariaTrabalho: null,
        maiorDesafioHoje: null,
        oQueEsperaConquistar: null,
        informacoesGerais: null,
      },
    });

    res.status(201).json({
      message: "Cadastro realizado com sucesso!",
      paciente: {
        id: novaPaciente.id,
        telefone: novaPaciente.telefone,
        nomeSocialApelido: novaPaciente.nomeSocialApelido,
      },
    });
  } catch (e) {
    if (e.code === "P2002" && e.meta?.target.includes("telefone")) {
      return res
        .status(409)
        .json({ error: "Este Telefone/Whatsapp já está cadastrado." });
    }

    console.error("Erro no cadastro:", e);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

app.post("/auth/login", async (req, res) => {
  console.log("Requisição de login recebida.");
  console.log("Corpo da requisição:", req.body);
  const { telefone, senha } = req.body;

  if (!telefone || !senha) {
    return res
      .status(400)
      .json({ error: "Telefone e senha são obrigatórios." });
  }

  try {
    const paciente = await prisma.paciente.findUnique({
      where: { telefone },
    });

    if (!paciente) {
      return res
        .status(401)
        .json({ error: "Credenciais inválidas. Telefone não encontrado." });
    }

    const senhaValida = await bcrypt.compare(senha, paciente.senhaHash);

    if (!senhaValida) {
      return res
        .status(401)
        .json({ error: "Credenciais inválidas. Senha incorreta." });
    }

    const token = jwt.sign(
      { pacienteId: paciente.id, telefone: paciente.telefone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login bem-sucedido!",
      token,
      paciente: {
        id: paciente.id,
        nome: paciente.nomeSocialApelido,
        telefone: paciente.telefone,
      },
    });
  } catch (e) {
    console.error("Erro no login:", e);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

app.get("/questionario/estrutura", authenticateToken, async (req, res) => {
  try {
    const estrutura = await prisma.pilar.findMany({
      include: {
        perguntas: {
          orderBy: { ordem: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });

    res.json(estrutura);
  } catch (e) {
    console.error("Erro ao buscar a estrutura:", e);
    res.status(500).json({
      error: "Não foi possível carregar a estrutura do questionário.",
    });
  }
});

app.get("/questionario/status", authenticateToken, async (req, res) => {
  const pacienteId = req.paciente.pacienteId;

  try {
    const ultimoQuestionario = await prisma.questionarioConcluido.findFirst({
      where: { pacienteId: pacienteId },
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
        },
      },
    });

    if (!ultimoQuestionario) {
      return res.json({ podeResponder: true, resultadoAnterior: null });
    }

    const dataUltimaResposta = ultimoQuestionario.dataConclusao;
    const dataLimite = new Date(dataUltimaResposta);
    dataLimite.setDate(dataUltimaResposta.getDate() + 30);

    const hoje = new Date();
    const podeResponder = hoje >= dataLimite;

    const resultadoAnteriorFormatado = {
      questionarioId: ultimoQuestionario.id,
      dataConclusao: ultimoQuestionario.dataConclusao,
      pontuacaoTotal: ultimoQuestionario.pontuacaoTotal,
      percentualGlobal: ultimoQuestionario.percentualGlobal,
      classificacao: ultimoQuestionario.classificacao,
      dataLimite: dataLimite, // Envia a data limite para o frontend calcular os dias
      detalhesPilares: ultimoQuestionario.pontuacoes.map((p) => ({
        nome: p.pilar.nomePilar,
        pontuacaoObtida: p.pontuacaoObtida,
        pontuacaoMaxima: p.pilar.pontuacaoMaxima,
        percentualPilar: parseFloat(
          ((p.pontuacaoObtida / p.pilar.pontuacaoMaxima) * 100).toFixed(2),
        ),
      })),
    };

    res.json({
      podeResponder: podeResponder,
      resultadoAnterior: resultadoAnteriorFormatado,
    });
  } catch (e) {
    console.error("Erro ao verificar status do questionário:", e);
    res
      .status(500)
      .json({ error: "Erro interno ao verificar o status da submissão." });
  }
});

app.post("/questionario/submeter", authenticateToken, async (req, res) => {
  const pacienteId = req.paciente.pacienteId;
  const submissionData = req.body;

  if (!Array.isArray(submissionData) || submissionData.length === 0) {
    return res.status(400).json({
      error:
        "Dados de submissão inválidos ou ausentes. Esperado um array de respostas.",
    });
  }

  try {
    const ultimoQuestionario = await prisma.questionarioConcluido.findFirst({
      where: { pacienteId: pacienteId },
      orderBy: { dataConclusao: "desc" },
    });

    if (ultimoQuestionario) {
      const dataUltimaResposta = ultimoQuestionario.dataConclusao;
      const dataLimite = new Date(dataUltimaResposta);
      dataLimite.setDate(dataUltimaResposta.getDate() + 30);

      const hoje = new Date();

      if (hoje < dataLimite) {
        const diasRestantes = Math.ceil(
          (dataLimite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
        );

        return res.status(409).json({
          error: `Você já enviou um questionário recentemente. Aguarde ${diasRestantes} dias para enviar novamente.`,
          diasRestantes: diasRestantes,
        });
      }
    }

    const pilaresMeta = await prisma.pilar.findMany({
      select: { id: true, nomePilar: true, pontuacaoMaxima: true },
    });

    const pilaresMap = pilaresMeta.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const perguntasMap = await prisma.pergunta
      .findMany({
        select: { id: true, pilarId: true },
      })
      .then((perguntas) =>
        perguntas.reduce((acc, p) => {
          acc[p.id] = p.pilarId;
          return acc;
        }, {}),
      );

    let pontuacaoTotal = 0;
    const resultadosPorPilar = {};
    let totalPerguntas = 0;
    for (const data of submissionData) {
      const { perguntaId, score, ehInvertida } = data;
      const pilarId = perguntasMap[perguntaId];

      if (!pilarId || !pilaresMap[pilarId]) {
        console.warn(
          `Pilar ou Pergunta ID ${perguntaId} não encontrado no BD.`,
        );
        continue;
      }

      let pontuacaoFinal = score;

      if (ehInvertida) {
        pontuacaoFinal = 4 - score;
      }

      pontuacaoTotal += pontuacaoFinal;
      totalPerguntas++;

      const pilarInfo = pilaresMap[pilarId];

      if (!resultadosPorPilar[pilarId]) {
        resultadosPorPilar[pilarId] = {
          nome: pilarInfo.nomePilar,
          pontuacaoObtida: 0,
          pontuacaoMaximaPilar: pilarInfo.pontuacaoMaxima,
        };
      }

      resultadosPorPilar[pilarId].pontuacaoObtida += pontuacaoFinal;
    }

    if (totalPerguntas === 0) {
      return res
        .status(400)
        .json({ error: "Nenhuma resposta válida para cálculo encontrada." });
    }

    const pontuacaoMaximaGlobal = totalPerguntas * 3;
    const percentualGlobal = (pontuacaoTotal / pontuacaoMaximaGlobal) * 100;

    let classificacao = "REQUER ATENÇÃO";
    if (percentualGlobal >= 80) {
      classificacao = "VITALIDADE PLENA";
    } else if (percentualGlobal >= 50) {
      classificacao = "EM EQUILÍBRIO";
    }

    const novoQuestionario = await prisma.questionarioConcluido.create({
      data: {
        pacienteId: pacienteId,
        pontuacaoTotal: pontuacaoTotal,
        percentualGlobal: parseFloat(percentualGlobal.toFixed(2)),
        classificacao: classificacao,
      },
    });

    const pontuacoesParaCriar = [];

    for (const pilarIdStr in resultadosPorPilar) {
      const pilarId = parseInt(pilarIdStr);
      const pontuacaoData = resultadosPorPilar[pilarId];

      pontuacoesParaCriar.push({
        questionarioConcluidoId: novoQuestionario.id,
        pilarId: pilarId,
        pontuacaoObtida: pontuacaoData.pontuacaoObtida,
      });
    }

    await prisma.pontuacaoPorPilar.createMany({
      data: pontuacoesParaCriar,
    });

    const resultadosFrontend = {
      questionarioId: novoQuestionario.id,
      dataConclusao: novoQuestionario.dataConclusao,
      pontuacaoTotal,
      percentualGlobal: parseFloat(percentualGlobal.toFixed(2)),
      classificacao,
      detalhesPilares: Object.values(resultadosPorPilar).map((p) => ({
        nome: p.nome,
        pontuacaoObtida: p.pontuacaoObtida,
        pontuacaoMaxima: p.pontuacaoMaximaPilar,
        percentualPilar: parseFloat(
          ((p.pontuacaoObtida / p.pontuacaoMaximaPilar) * 100).toFixed(2),
        ),
      })),
    };

    res.status(201).json({
      message: "Questionário submetido e resultados calculados com sucesso.",
      resultado: resultadosFrontend,
    });
  } catch (e) {
    console.error("Erro ao submeter questionário:", e);
    res.status(500).json({ error: "Erro interno ao processar submissão." });
  }
});

app.get("/admin/pacientes", authenticateService, async (req, res) => {
  try {
    const pacientes = await prisma.paciente.findMany({
      select: {
        id: true,
        nomeCompleto: true,
        nomeSocialApelido: true,
        telefone: true,
        email: true,
        dataNascimento: true,
        sexo: true,
        alturaCm: true,
        cidade: true,
        estado: true,
        objetivoCorporalPrincipal: true,
        estadoCivil: true,
        moraComAlguem: true,
        temFilhos: true,
        temPets: true,
        profissao: true,
        cargaHorariaTrabalho: true,
        maiorDesafioHoje: true,
        oQueEsperaConquistar: true,
        informacoesGerais: true,
        dataCadastro: true,
      },
      orderBy: { dataCadastro: "desc" },
    });

    res.json(pacientes);
  } catch (e) {
    console.error("Erro ao buscar lista de pacientes:", e);
    res.status(500).json({
      error: "Não foi possível carregar a lista de pacientes.",
    });
  }
});
app.put(
  "/integrations/pacientes/telefone/:telefone",
  authenticateService,
  async (req, res) => {
    const { telefone } = req.params;
    const dadosAtualizaveis = req.body;

    try {
      const paciente = await prisma.paciente.update({
        where: { telefone },
        data: dadosAtualizaveis,
      });

      res.json({
        message: "Paciente atualizado com sucesso.",
        paciente: {
          id: paciente.id,
          telefone: paciente.telefone,
          nomeSocialApelido: paciente.nomeSocialApelido,
        },
      });
    } catch (e) {
      if (e.code === "P2025") {
        return res.status(404).json({
          error: "Paciente não encontrado para este telefone.",
        });
      }

      console.error("Erro ao atualizar paciente via integração:", e);
      res.status(500).json({
        error: "Erro interno ao atualizar paciente.",
      });
    }
  }
);


async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso.");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (e) {
    console.error(
      "❌ Falha ao iniciar o servidor ou conectar ao banco de dados:",
      e,
    );
    process.exit(1);
  }
}

startServer();
