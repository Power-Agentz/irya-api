-- Limpeza do schema de pacientes:
-- Mantém somente telefone (PK), nomeCompleto e senhaHash
-- Preserva histórico de pesos e questionários através de FK por telefone

ALTER TABLE "historico_pesos" DROP CONSTRAINT IF EXISTS "historico_pesos_pacienteId_fkey";
ALTER TABLE "questionarios_concluidos" DROP CONSTRAINT IF EXISTS "questionarios_concluidos_pacienteId_fkey";

DROP INDEX IF EXISTS "questionarios_concluidos_pacienteId_data_conclusao_key";
DROP INDEX IF EXISTS "pacientes_telefone_key";

ALTER TABLE "historico_pesos" ADD COLUMN IF NOT EXISTS "paciente_telefone" TEXT;
ALTER TABLE "questionarios_concluidos" ADD COLUMN IF NOT EXISTS "paciente_telefone" TEXT;

UPDATE "historico_pesos" hp
SET "paciente_telefone" = p."telefone"
FROM "pacientes" p
WHERE hp."pacienteId" = p."id";

UPDATE "questionarios_concluidos" qc
SET "paciente_telefone" = p."telefone"
FROM "pacientes" p
WHERE qc."pacienteId" = p."id";

UPDATE "pacientes"
SET "nomeCompleto" = COALESCE(NULLIF("nomeCompleto", ''), 'Sem nome')
WHERE "nomeCompleto" IS NULL OR "nomeCompleto" = '';

ALTER TABLE "pacientes" ALTER COLUMN "telefone" SET NOT NULL;
ALTER TABLE "pacientes" ALTER COLUMN "nomeCompleto" SET NOT NULL;

ALTER TABLE "historico_pesos" ALTER COLUMN "paciente_telefone" SET NOT NULL;
ALTER TABLE "questionarios_concluidos" ALTER COLUMN "paciente_telefone" SET NOT NULL;

ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "pacientes_pkey";
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("telefone");

ALTER TABLE "historico_pesos"
  DROP COLUMN IF EXISTS "pacienteId";

ALTER TABLE "questionarios_concluidos"
  DROP COLUMN IF EXISTS "pacienteId";

ALTER TABLE "pacientes"
  DROP COLUMN IF EXISTS "id",
  DROP COLUMN IF EXISTS "nomeSocialApelido",
  DROP COLUMN IF EXISTS "dataNascimento",
  DROP COLUMN IF EXISTS "sexo",
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "cidade",
  DROP COLUMN IF EXISTS "estado",
  DROP COLUMN IF EXISTS "alturaCm",
  DROP COLUMN IF EXISTS "objetivo_corporal_principal",
  DROP COLUMN IF EXISTS "estado_civil",
  DROP COLUMN IF EXISTS "mora_com_alguem",
  DROP COLUMN IF EXISTS "tem_filhos",
  DROP COLUMN IF EXISTS "tem_pets",
  DROP COLUMN IF EXISTS "profissao",
  DROP COLUMN IF EXISTS "carga_horaria_trabalho",
  DROP COLUMN IF EXISTS "maior_desafio_hoje",
  DROP COLUMN IF EXISTS "o_que_espera_conquistar",
  DROP COLUMN IF EXISTS "informacoes_gerais";

ALTER TABLE "historico_pesos"
  ADD CONSTRAINT "historico_pesos_paciente_telefone_fkey"
  FOREIGN KEY ("paciente_telefone") REFERENCES "pacientes"("telefone")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "questionarios_concluidos"
  ADD CONSTRAINT "questionarios_concluidos_paciente_telefone_fkey"
  FOREIGN KEY ("paciente_telefone") REFERENCES "pacientes"("telefone")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "questionarios_concluidos_paciente_telefone_data_conclusao_key"
ON "questionarios_concluidos"("paciente_telefone", "data_conclusao");
