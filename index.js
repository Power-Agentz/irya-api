import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.register(cors, {
  origin: ["http://localhost:5173", "https://irya-web.vercel.app"],
});

app.get("/", (req, res) => {
  res.send("API Irya está rodando!");
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
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
  const pacienteTelefone = req.paciente.telefone;

  const paciente = await prisma.paciente.findUnique({
    where: { telefone: pacienteTelefone },
    select: {
      telefone: true,
      nomeCompleto: true,
      dataCadastro: true,
    },
  });

  res.json(paciente);
});

app.put("/paciente/me", authenticateToken, async (req, res) => {
  const pacienteTelefone = req.paciente.telefone;
  const { nomeCompleto } = req.body;

  if (!nomeCompleto || typeof nomeCompleto !== "string") {
    return res.status(400).json({ error: "Nome completo inválido." });
  }

  const pacienteAtualizado = await prisma.paciente.update({
    where: { telefone: pacienteTelefone },
    data: { nomeCompleto },
    select: {
      telefone: true,
      nomeCompleto: true,
      dataCadastro: true,
    },
  });

  res.json(pacienteAtualizado);
});

app.get("/integrations/pacientes", authenticateService, async (req, res) => {
  const pacientes = await prisma.paciente.findMany({
    select: {
      telefone: true,
      nomeCompleto: true,
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
        telefone: true,
        nomeCompleto: true,
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
  const { nomeCompleto, telefone, senha } = req.body;

  if (!telefone || !senha || !nomeCompleto) {
    return res.status(400).json({
      error: "Ooops... Nome completo, telefone e senha são obrigatórios.",
    });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novaPaciente = await prisma.paciente.create({
      data: {
        telefone,
        nomeCompleto,
        senhaHash,
      },
    });

    res.status(201).json({
      message: "Cadastro realizado com sucesso!",
      paciente: {
        telefone: novaPaciente.telefone,
        nomeCompleto: novaPaciente.nomeCompleto,
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Este telefone já está cadastrado." });
    }

    console.error("Erro no cadastro:", e);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

app.get("/auth/telefone-disponivel/:telefone", async (req, res) => {
  const { telefone } = req.params;

  if (!telefone) {
    return res.status(400).json({ error: "Telefone não informado." });
  }

  try {
    const paciente = await prisma.paciente.findUnique({
      where: { telefone },
      select: { telefone: true },
    });

    return res.json({ disponivel: !paciente });
  } catch (e) {
    console.error("Erro ao validar disponibilidade de telefone:", e);
    return res.status(500).json({ error: "Erro ao validar telefone." });
  }
});

app.post("/auth/login", async (req, res) => {
  const { telefone, senha } = req.body;

  if (!telefone || !senha) {
    return res
      .status(400)
      .json({ error: "Telefone e senha são obrigatórios." });
  }

  try {
    const paciente = await prisma.paciente.findUnique({ where: { telefone } });

    if (!paciente) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const senhaValida = await bcrypt.compare(senha, paciente.senhaHash);

    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = jwt.sign(
      { telefone: paciente.telefone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login bem-sucedido!",
      token,
      paciente: {
        telefone: paciente.telefone,
        nomeCompleto: paciente.nomeCompleto,
        nome: paciente.nomeCompleto,
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
  const pacienteTelefone = req.paciente.telefone;

  try {
    const ultimosPesos = await prisma.historicoPeso.findMany({
      where: { pacienteTelefone },
      orderBy: { dataRegistro: "desc" },
      take: 2,
    });

    const pesoAtualKg = ultimosPesos[0]?.pesoKg ?? null;
    const variacaoPesoKg =
      ultimosPesos.length > 1
        ? parseFloat(
            (ultimosPesos[0].pesoKg - ultimosPesos[1].pesoKg).toFixed(2),
          )
        : null;

    const ultimoQuestionario = await prisma.questionarioConcluido.findFirst({
      where: { pacienteTelefone },
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
      return res.json({
        podeResponder: true,
        resultadoAnterior: null,
        pesoAtualKg,
        variacaoPesoKg,
      });
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
      dataLimite,
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
      podeResponder,
      resultadoAnterior: resultadoAnteriorFormatado,
      pesoAtualKg,
      variacaoPesoKg,
    });
  } catch (e) {
    console.error("Erro ao verificar status do questionário:", e);
    res
      .status(500)
      .json({ error: "Erro interno ao verificar o status da submissão." });
  }
});

app.post("/questionario/submeter", authenticateToken, async (req, res) => {
  const pacienteTelefone = req.paciente.telefone;
  const payload = req.body;
  const submissionData = Array.isArray(payload) ? payload : payload?.respostas;
  const pesoAtualKgRaw = Array.isArray(payload) ? null : payload?.pesoAtualKg;

  const pesoAtualKg = Number(pesoAtualKgRaw);

  if (!Array.isArray(submissionData) || submissionData.length === 0) {
    return res.status(400).json({
      error:
        "Dados de submissão inválidos ou ausentes. Esperado um array de respostas.",
    });
  }

  if (!Number.isFinite(pesoAtualKg) || pesoAtualKg <= 0) {
    return res.status(400).json({
      error: "Informe um peso atual válido em quilogramas.",
    });
  }

  try {
    const ultimoQuestionario = await prisma.questionarioConcluido.findFirst({
      where: { pacienteTelefone },
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
          diasRestantes,
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

    const novoQuestionario = await prisma.$transaction(async (tx) => {
      const questionario = await tx.questionarioConcluido.create({
        data: {
          pacienteTelefone,
          pontuacaoTotal,
          percentualGlobal: parseFloat(percentualGlobal.toFixed(2)),
          classificacao,
        },
      });

      const pontuacoesParaCriar = [];

      for (const pilarIdStr in resultadosPorPilar) {
        const pilarId = parseInt(pilarIdStr, 10);
        const pontuacaoData = resultadosPorPilar[pilarId];

        pontuacoesParaCriar.push({
          questionarioConcluidoId: questionario.id,
          pilarId,
          pontuacaoObtida: pontuacaoData.pontuacaoObtida,
        });
      }

      await tx.pontuacaoPorPilar.createMany({
        data: pontuacoesParaCriar,
      });

      await tx.historicoPeso.create({
        data: {
          pacienteTelefone,
          pesoKg: parseFloat(pesoAtualKg.toFixed(2)),
        },
      });

      return questionario;
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
        telefone: true,
        nomeCompleto: true,
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
    const { nomeCompleto } = req.body;

    if (!nomeCompleto || typeof nomeCompleto !== "string") {
      return res.status(400).json({ error: "Nome completo inválido." });
    }

    try {
      const paciente = await prisma.paciente.update({
        where: { telefone },
        data: { nomeCompleto },
      });

      res.json({
        message: "Paciente atualizado com sucesso.",
        paciente: {
          telefone: paciente.telefone,
          nomeCompleto: paciente.nomeCompleto,
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
  },
);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (e) {
    console.error(
      "Falha ao iniciar o servidor ou conectar ao banco de dados:",
      e,
    );
    process.exit(1);
  }
}

startServer();
