import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { randomUUID } from "crypto";
import { createPacienteRepository } from "./repositories/pacienteRepository.js";
import { createBotRepository } from "./repositories/botRepository.js";
import { createBotService } from "./services/botService.js";
import { createSubscriptionService } from "./services/subscriptionService.js";
import { createAdminRepository } from "./repositories/adminRepository.js";
import { createAdminService } from "./services/adminService.js";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const pacienteRepository = createPacienteRepository(prisma);
const botRepository = createBotRepository(prisma);
const botService = createBotService({ pacienteRepository, botRepository });
const subscriptionService = createSubscriptionService({ pacienteRepository });
const adminRepository = createAdminRepository(prisma);
const adminService = createAdminService({ adminRepository });

app.use(express.json());

const defaultCorsOrigins = [
  "http://localhost:5173",
  "https://mev.clinicawhim.com.br",
  "https://www.mev.clinicawhim.com.br",
  "https://irya-web.vercel.app/",
  "https://www.irya-web.vercel.app/",
  "https://portalirya.clinicawhim.com.br/"

];

const envCorsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsAllowList = [...new Set([...defaultCorsOrigins, ...envCorsOrigins])].map(
  (origin) => origin.replace(/\/$/, ""),
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, "");
    return callback(null, corsAllowList.includes(normalizedOrigin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY", "X-ADMIN-KEY"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

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

function authenticateAdmin(req, res, next) {
  const providedKey = req.headers["x-admin-key"] ?? req.headers["x-api-key"];
  const expectedKey = process.env.ADMIN_ACCESS_KEY ?? process.env.SERVICE_API_KEY;

  if (!providedKey || !expectedKey || providedKey !== expectedKey) {
    return res.status(403).json({ error: "Acesso negado (admin)." });
  }

  next();
}

async function authenticateBotApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const phone = req.params.phone;

  if (!phone) {
    return res.status(400).json({ error: "Telefone não informado na rota." });
  }

  const validation = await botService.validateBotApiKey(phone, apiKey);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }

  req.botPatient = validation.patient;
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
        apiKey: randomUUID(),
        isSubscriber: false,
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
        select: { id: true, pilarId: true, textoPergunta: true },
      })
      .then((perguntas) =>
        perguntas.reduce((acc, p) => {
          acc[p.id] = {
            pilarId: p.pilarId,
            textoPergunta: p.textoPergunta,
          };
          return acc;
        }, {}),
      );

    let pontuacaoTotal = 0;
    const resultadosPorPilar = {};
    const answersToSave = [];
    let totalPerguntas = 0;

    for (const data of submissionData) {
      const { perguntaId, score, ehInvertida } = data;
      const perguntaInfo = perguntasMap[perguntaId];
      const pilarId = perguntaInfo?.pilarId;

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

      answersToSave.push({
        pacienteTelefone,
        questionText: perguntaInfo.textoPergunta,
        answerValue: score,
        pilarCategory: pilarInfo.nomePilar,
      });
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

      if (answersToSave.length > 0) {
        await tx.answer.createMany({
          data: answersToSave.map((answer) => ({
            ...answer,
            questionarioConcluidoId: questionario.id,
          })),
        });
      }

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

app.get("/api/bot/scores/:phone", authenticateBotApiKey, async (req, res) => {
  const { phone } = req.params;

  try {
    const payload = await botService.getScoresByPhone(phone);
    return res.json(payload);
  } catch (e) {
    console.error("Erro ao buscar pontuações para bot:", e);
    return res.status(500).json({ error: "Erro interno ao buscar pontuações." });
  }
});

app.get("/api/bot/answers/:phone", authenticateBotApiKey, async (req, res) => {
  const { phone } = req.params;

  try {
    const payload = await botService.getAnswersByPhone(phone);
    return res.json(payload);
  } catch (e) {
    console.error("Erro ao buscar respostas para bot:", e);
    return res.status(500).json({ error: "Erro interno ao buscar respostas." });
  }
});

app.get(
  "/api/bot/answers/:phone/pilar/:pilar_name",
  authenticateBotApiKey,
  async (req, res) => {
    const { phone, pilar_name: pilarName } = req.params;

    try {
      const payload = await botService.getAnswersByPhoneAndPilar(phone, pilarName);
      return res.json(payload);
    } catch (e) {
      console.error("Erro ao buscar respostas por pilar para bot:", e);
      return res
        .status(500)
        .json({ error: "Erro interno ao buscar respostas por pilar." });
    }
  },
);

app.get(
  "/api/bot/subscription-status/:phone",
  authenticateBotApiKey,
  async (req, res) => {
    const { phone } = req.params;

    try {
      const payload = await botService.getSubscriptionStatusByPhone(phone);
      if (!payload) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }
      return res.json(payload);
    } catch (e) {
      console.error("Erro ao buscar status de assinatura para bot:", e);
      return res
        .status(500)
        .json({ error: "Erro interno ao buscar status de assinatura." });
    }
  },
);

app.post("/webhooks/asaas", async (req, res) => {
  try {
    const result = await subscriptionService.syncSubscriptionFromAsaasWebhook(
      req.body,
    );
    return res.status(200).json(result);
  } catch (e) {
    console.error("Erro ao processar webhook Asaas:", e);
    return res.status(500).json({ error: "Erro interno ao processar webhook." });
  }
});

app.get("/admin/overview", authenticateAdmin, async (req, res) => {
  try {
    const overview = await adminService.getOverview();
    return res.json(overview);
  } catch (e) {
    console.error("Erro ao buscar overview admin:", e);
    return res.status(500).json({ error: "Não foi possível carregar o overview." });
  }
});

app.get("/admin/pacientes", authenticateAdmin, async (req, res) => {
  try {
    const pacientes = await adminService.getPacientes();

    res.json(pacientes);
  } catch (e) {
    console.error("Erro ao buscar lista de pacientes:", e);
    res.status(500).json({
      error: "Não foi possível carregar a lista de pacientes.",
    });
  }
});

app.get("/admin/questionarios-concluidos", authenticateAdmin, async (req, res) => {
  try {
    const questionarios = await adminService.getQuestionariosConcluidos();
    return res.json(questionarios);
  } catch (e) {
    console.error("Erro ao buscar questionários concluídos:", e);
    return res.status(500).json({
      error: "Não foi possível carregar os questionários concluídos.",
    });
  }
});

app.get("/admin/pontuacoes", authenticateAdmin, async (req, res) => {
  try {
    const pontuacoes = await adminService.getPontuacoes();
    return res.json(pontuacoes);
  } catch (e) {
    console.error("Erro ao buscar pontuações admin:", e);
    return res.status(500).json({ error: "Não foi possível carregar pontuações." });
  }
});

app.get("/admin/pacientes/:phone", authenticateAdmin, async (req, res) => {
  const { phone } = req.params;

  try {
    const paciente = await adminService.getPacienteDetalhes(phone);
    if (!paciente) {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }
    return res.json(paciente);
  } catch (e) {
    console.error("Erro ao buscar detalhes do paciente:", e);
    return res.status(500).json({ error: "Não foi possível carregar os detalhes." });
  }
});

app.delete("/admin/pacientes/:phone", authenticateAdmin, async (req, res) => {
  const { phone } = req.params;

  try {
    const deleted = await adminService.deletePaciente(phone);
    if (!deleted) {
      return res.status(404).json({ error: "Paciente não encontrado." });
    }

    return res.json({
      message: "Cadastro excluído com sucesso.",
      telefone: phone,
    });
  } catch (e) {
    console.error("Erro ao excluir paciente:", e);
    return res.status(500).json({ error: "Não foi possível excluir o cadastro." });
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
