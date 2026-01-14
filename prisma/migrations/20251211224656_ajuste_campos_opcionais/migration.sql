/*
  Warnings:

  - You are about to drop the `HistoricoPeso` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Paciente` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pergunta` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pilar` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PontuacaoPorPilar` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionarioConcluido` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "HistoricoPeso" DROP CONSTRAINT "HistoricoPeso_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "Pergunta" DROP CONSTRAINT "Pergunta_pilarId_fkey";

-- DropForeignKey
ALTER TABLE "PontuacaoPorPilar" DROP CONSTRAINT "PontuacaoPorPilar_pilarId_fkey";

-- DropForeignKey
ALTER TABLE "PontuacaoPorPilar" DROP CONSTRAINT "PontuacaoPorPilar_questionarioConcluidoId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionarioConcluido" DROP CONSTRAINT "QuestionarioConcluido_pacienteId_fkey";

-- DropTable
DROP TABLE "HistoricoPeso";

-- DropTable
DROP TABLE "Paciente";

-- DropTable
DROP TABLE "Pergunta";

-- DropTable
DROP TABLE "Pilar";

-- DropTable
DROP TABLE "PontuacaoPorPilar";

-- DropTable
DROP TABLE "QuestionarioConcluido";

-- CreateTable
CREATE TABLE "pacientes" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nomeCompleto" TEXT,
    "nomeSocialApelido" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "sexo" TEXT NOT NULL,
    "email" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "alturaCm" DOUBLE PRECISION,
    "objetivo_corporal_principal" TEXT,
    "estado_civil" TEXT,
    "mora_com_alguem" TEXT,
    "tem_filhos" BOOLEAN,
    "tem_pets" BOOLEAN,
    "profissao" TEXT,
    "carga_horaria_trabalho" TEXT,
    "maior_desafio_hoje" TEXT,
    "o_que_espera_conquistar" TEXT,
    "informacoes_gerais" TEXT,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_pesos" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "dataRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_pesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilares" (
    "id" SERIAL NOT NULL,
    "nome_pilar" TEXT NOT NULL,
    "descricao" TEXT,
    "pontuacao_maxima" INTEGER NOT NULL,

    CONSTRAINT "pilares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas" (
    "id" SERIAL NOT NULL,
    "pilarId" INTEGER NOT NULL,
    "texto_pergunta" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "eh_invertida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionarios_concluidos" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "pontuacao_total" INTEGER NOT NULL,
    "percentual_global" DOUBLE PRECISION NOT NULL,
    "classificacao" TEXT NOT NULL,
    "data_conclusao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionarios_concluidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontuacoes_por_pilar" (
    "id" SERIAL NOT NULL,
    "questionario_concluido_id" INTEGER NOT NULL,
    "pilarId" INTEGER NOT NULL,
    "pontuacao_obtida" INTEGER NOT NULL,

    CONSTRAINT "pontuacoes_por_pilar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_telefone_key" ON "pacientes"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "pilares_nome_pilar_key" ON "pilares"("nome_pilar");

-- CreateIndex
CREATE UNIQUE INDEX "questionarios_concluidos_pacienteId_data_conclusao_key" ON "questionarios_concluidos"("pacienteId", "data_conclusao");

-- AddForeignKey
ALTER TABLE "historico_pesos" ADD CONSTRAINT "historico_pesos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_pilarId_fkey" FOREIGN KEY ("pilarId") REFERENCES "pilares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionarios_concluidos" ADD CONSTRAINT "questionarios_concluidos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontuacoes_por_pilar" ADD CONSTRAINT "pontuacoes_por_pilar_questionario_concluido_id_fkey" FOREIGN KEY ("questionario_concluido_id") REFERENCES "questionarios_concluidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontuacoes_por_pilar" ADD CONSTRAINT "pontuacoes_por_pilar_pilarId_fkey" FOREIGN KEY ("pilarId") REFERENCES "pilares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
