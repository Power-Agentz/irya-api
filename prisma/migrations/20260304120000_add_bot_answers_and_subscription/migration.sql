-- Add subscription/auth fields to patients
ALTER TABLE "pacientes"
  ADD COLUMN IF NOT EXISTS "is_subscriber" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subscription_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscription_canceled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "api_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "pacientes_api_key_key" ON "pacientes"("api_key");

-- Store monthly answer history per patient/round
CREATE TABLE IF NOT EXISTS "answers" (
  "id" SERIAL NOT NULL,
  "patient_id" TEXT NOT NULL,
  "questionario_concluido_id" INTEGER,
  "question_text" TEXT NOT NULL,
  "answer_value" INTEGER NOT NULL,
  "pilar_category" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "answers_patient_id_created_at_idx" ON "answers"("patient_id", "created_at");
CREATE INDEX IF NOT EXISTS "answers_pilar_category_idx" ON "answers"("pilar_category");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'answers_patient_id_fkey'
  ) THEN
    ALTER TABLE "answers"
      ADD CONSTRAINT "answers_patient_id_fkey"
      FOREIGN KEY ("patient_id")
      REFERENCES "pacientes"("telefone")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'answers_questionario_concluido_id_fkey'
  ) THEN
    ALTER TABLE "answers"
      ADD CONSTRAINT "answers_questionario_concluido_id_fkey"
      FOREIGN KEY ("questionario_concluido_id")
      REFERENCES "questionarios_concluidos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

