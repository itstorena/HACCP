-- ============================================================
-- HACCP Digital Register - Human Error Correction Policies
-- ============================================================
-- Permette correzione e cancellazione controllata dei registri operativi
-- quando l'operatore ha inserito un dato errato.

DO $$
BEGIN
  CREATE POLICY "Aggiornamento temperature" ON temperature_logs
    FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Eliminazione temperature" ON temperature_logs
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Eliminazione abbattitore" ON blast_chiller_logs
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Eliminazione controlli" ON operational_checks
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Eliminazione non conformita" ON non_conformities
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
