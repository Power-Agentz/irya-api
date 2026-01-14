-- CreateTable
CREATE TABLE "Paciente" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "telefone" TEXT,
    "dataNascimento" DATE NOT NULL,
    "sexo" TEXT NOT NULL,
    "alturaCm" DECIMAL(5,2) NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoPeso" (
    "id" SERIAL NOT NULL,
    "pesoKg" DECIMAL(5,2) NOT NULL,
    "dataRegistro" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pacienteId" INTEGER NOT NULL,

    CONSTRAINT "HistoricoPeso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pilar" (
    "id" SERIAL NOT NULL,
    "nomePilar" TEXT NOT NULL,
    "pontuacaoMaxima" INTEGER NOT NULL,

    CONSTRAINT "Pilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pergunta" (
    "id" SERIAL NOT NULL,
    "textoPergunta" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ehInvertida" BOOLEAN NOT NULL DEFAULT false,
    "pilarId" INTEGER NOT NULL,

    CONSTRAINT "Pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionarioConcluido" (
    "id" SERIAL NOT NULL,
    "dataConclusao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pontuacaoTotal" INTEGER NOT NULL,
    "percentualGlobal" DECIMAL(5,2) NOT NULL,
    "classificacao" TEXT NOT NULL,
    "pacienteId" INTEGER NOT NULL,

    CONSTRAINT "QuestionarioConcluido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontuacaoPorPilar" (
    "id" SERIAL NOT NULL,
    "pontuacaoObtida" INTEGER NOT NULL,
    "questionarioConcluidoId" INTEGER NOT NULL,
    "pilarId" INTEGER NOT NULL,

    CONSTRAINT "PontuacaoPorPilar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_email_key" ON "Paciente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoPeso_pacienteId_dataRegistro_key" ON "HistoricoPeso"("pacienteId", "dataRegistro");

-- CreateIndex
CREATE UNIQUE INDEX "Pilar_nomePilar_key" ON "Pilar"("nomePilar");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionarioConcluido_pacienteId_dataConclusao_key" ON "QuestionarioConcluido"("pacienteId", "dataConclusao");

-- AddForeignKey
ALTER TABLE "HistoricoPeso" ADD CONSTRAINT "HistoricoPeso_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pergunta" ADD CONSTRAINT "Pergunta_pilarId_fkey" FOREIGN KEY ("pilarId") REFERENCES "Pilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionarioConcluido" ADD CONSTRAINT "QuestionarioConcluido_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontuacaoPorPilar" ADD CONSTRAINT "PontuacaoPorPilar_questionarioConcluidoId_fkey" FOREIGN KEY ("questionarioConcluidoId") REFERENCES "QuestionarioConcluido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontuacaoPorPilar" ADD CONSTRAINT "PontuacaoPorPilar_pilarId_fkey" FOREIGN KEY ("pilarId") REFERENCES "Pilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
