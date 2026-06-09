-- ============================================================
-- HACCP Digital Register - Operating System Extension
-- ============================================================
-- Estende lo schema iniziale con piano HACCP, registri operativi,
-- non conformita, audit trail e profili configurabili abbattitore.

-- ------------------------------------------------------------
-- Existing table extensions
-- ------------------------------------------------------------
ALTER TABLE supplier_batches
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS received_temp DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS packaging_ok BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS label_ok BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE internal_batches
  ADD COLUMN IF NOT EXISTS source_supplier_batch_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergen_notes TEXT,
  ADD COLUMN IF NOT EXISTS shelf_life_hours INT,
  ADD COLUMN IF NOT EXISTS batch_status VARCHAR(20) DEFAULT 'valid'
    CHECK (batch_status IN ('valid', 'blocked', 'used', 'discarded')),
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20);

-- ------------------------------------------------------------
-- HACCP PLAN ITEMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS haccp_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    area VARCHAR(60) NOT NULL,
    process_step VARCHAR(120) NOT NULL,
    hazard TEXT NOT NULL,
    control_measure TEXT NOT NULL,
    critical_limit TEXT NOT NULL,
    monitoring_frequency VARCHAR(120) NOT NULL,
    corrective_action TEXT NOT NULL,
    owner_role VARCHAR(20) CHECK (owner_role IN ('chef', 'cook', 'cleaner', 'manager')) DEFAULT 'chef',
    is_ccp BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- BLAST CHILLER PROFILES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blast_chiller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    label VARCHAR(120) NOT NULL,
    cycle_type VARCHAR(20) CHECK (cycle_type IN ('positive_3c', 'negative_18c')) NOT NULL,
    product_category VARCHAR(80) DEFAULT 'standard',
    target_temp DECIMAL(4,1) NOT NULL,
    target_time_minutes INT NOT NULL,
    min_start_temp DECIMAL(4,1),
    legal_reference TEXT,
    notes TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blast_chiller_logs
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES blast_chiller_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(80),
  ADD COLUMN IF NOT EXISTS probe_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES staff_members(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- EQUIPMENT AND OPERATIONAL CHECKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    equipment_type VARCHAR(30) CHECK (equipment_type IN ('fridge', 'freezer', 'blast_chiller', 'hot_holding', 'probe', 'other')) NOT NULL,
    location VARCHAR(120),
    min_temp DECIMAL(4,1),
    max_temp DECIMAL(4,1),
    check_frequency_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE temperature_logs
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrective_action TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS operational_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(40) CHECK (check_type IN ('cleaning', 'oil_quality', 'pest_control', 'allergen_control', 'maintenance', 'training', 'generic')) NOT NULL,
    area VARCHAR(120) NOT NULL,
    item VARCHAR(160) NOT NULL,
    expected_result TEXT,
    actual_result TEXT,
    is_compliant BOOLEAN DEFAULT true,
    corrective_action TEXT,
    checked_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TRACEABILITY LINKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_batch_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_batch_id UUID REFERENCES internal_batches(id) ON DELETE CASCADE,
    supplier_batch_id UUID REFERENCES supplier_batches(id) ON DELETE SET NULL,
    ingredient_name VARCHAR(120) NOT NULL,
    quantity DECIMAL(8,2),
    unit VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- NON CONFORMITIES AND AUDIT TRAIL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS non_conformities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(40) CHECK (source_type IN ('receiving', 'blast_chiller', 'temperature', 'cleaning', 'lot', 'allergen', 'pest', 'maintenance', 'other')) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status VARCHAR(20) CHECK (status IN ('open', 'in_progress', 'closed', 'void')) DEFAULT 'open',
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    detected_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    related_table VARCHAR(80),
    related_id UUID,
    immediate_action TEXT,
    corrective_action TEXT,
    preventive_action TEXT,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    manager_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(80) NOT NULL,
    record_id UUID,
    action VARCHAR(20) CHECK (action IN ('insert', 'update', 'delete', 'login', 'report', 'print')) NOT NULL,
    actor_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    actor_label VARCHAR(160),
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE haccp_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE blast_chiller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_batch_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lettura pubblica piano haccp" ON haccp_plan_items FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica profili abbattitore" ON blast_chiller_profiles FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica attrezzature" ON equipment FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica controlli" ON operational_checks FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica ingredienti lotti" ON internal_batch_ingredients FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica non conformita" ON non_conformities FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica audit" ON audit_logs FOR SELECT USING (true);

CREATE POLICY "Scrittura piano haccp" ON haccp_plan_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura profili abbattitore" ON blast_chiller_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura attrezzature" ON equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura controlli" ON operational_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura ingredienti lotti" ON internal_batch_ingredients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura non conformita" ON non_conformities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Scrittura audit" ON audit_logs FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE operational_checks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE non_conformities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE temperature_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- SEED DATA
-- ------------------------------------------------------------
INSERT INTO haccp_plan_items
  (code, area, process_step, hazard, control_measure, critical_limit, monitoring_frequency, corrective_action, owner_role, is_ccp)
VALUES
  ('RIC-001', 'Ricevimento merci', 'Controllo fornitura in ingresso', 'Materia prima contaminata, temperatura non idonea, imballo danneggiato', 'Verifica temperatura, etichetta, lotto, scadenza, integrita imballo e DDT', 'Prodotto conforme al piano HACCP aziendale; freddo mantenuto; imballo integro; lotto leggibile', 'A ogni consegna', 'Rifiutare o isolare il prodotto, registrare non conformita e avvisare responsabile', 'chef', true),
  ('FRE-001', 'Catena del freddo', 'Conservazione refrigerata e congelata', 'Crescita microbica per temperatura fuori range', 'Registrazione temperature e verifica soglie attrezzatura', 'Range impostato per singola attrezzatura nel registro', 'Almeno giornaliera o secondo piano', 'Trasferire alimenti, segnalare guasto, valutare scarto, registrare azione', 'chef', true),
  ('ABB-001', 'Abbattimento', 'Raffreddamento rapido preparazioni', 'Permanenza prolungata in fascia di rischio termico', 'Uso profilo abbattitore approvato e registrazione sonda al cuore', 'Limite configurato per profilo prodotto/ciclo', 'A ogni ciclo', 'Prolungare/riavviare ciclo se consentito dal piano, isolare lotto, validazione responsabile', 'chef', true),
  ('LOT-001', 'Tracciabilita', 'Creazione lotto interno', 'Perdita collegamento ingredienti-preparazione', 'QR lotto interno e collegamento a lotti fornitore usati', 'Ogni preparazione deve avere data, scadenza, responsabile e origine ingredienti', 'A ogni preparazione', 'Bloccare lotto finche la tracciabilita non e completa', 'cook', false),
  ('ALL-001', 'Allergeni', 'Gestione allergeni preparazioni', 'Contaminazione crociata o informazione allergeni incompleta', 'Indicazione allergeni su lotto e separazione utensili/aree secondo piano', 'Allergeni dichiarati e coerenti con ricetta/schede prodotto', 'A ogni preparazione rilevante', 'Bloccare lotto, correggere etichetta, informare responsabile', 'chef', true),
  ('SAN-001', 'Sanificazione', 'Pulizia superfici e attrezzature', 'Contaminazione ambientale', 'Checklist pulizia per area e turno', 'Esito conforme e prodotto chimico/procedura corretti', 'Secondo piano pulizie', 'Ripetere pulizia, formare operatore, registrare non conformita', 'cleaner', false),
  ('INF-001', 'Infestanti', 'Controllo tracce infestanti', 'Contaminazione da infestanti', 'Ispezione visiva e registro interventi', 'Assenza tracce o intervento immediato se presenti', 'Settimanale o secondo piano', 'Isolare alimenti, contattare ditta, sanificare, registrare non conformita', 'manager', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO blast_chiller_profiles
  (code, label, cycle_type, product_category, target_temp, target_time_minutes, min_start_temp, legal_reference, notes, is_default)
VALUES
  ('ABB-POS-STD', 'Positivo standard +3C', 'positive_3c', 'standard', 3.0, 90, 60.0, 'Piano HACCP aziendale basato su Reg. CE 852/2004', 'Profilo da validare con consulente HACCP in base a prodotto e pezzatura', true),
  ('ABB-NEG-STD', 'Negativo standard -18C', 'negative_18c', 'standard', -18.0, 240, 60.0, 'Piano HACCP aziendale basato su Reg. CE 852/2004', 'Profilo da validare con consulente HACCP in base a prodotto e pezzatura', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO equipment
  (name, equipment_type, location, min_temp, max_temp, check_frequency_hours)
VALUES
  ('Frigorifero cucina', 'fridge', 'Cucina', 0.0, 4.0, 24),
  ('Freezer principale', 'freezer', 'Magazzino', -24.0, -18.0, 24),
  ('Abbattitore', 'blast_chiller', 'Cucina', NULL, NULL, 24)
ON CONFLICT DO NOTHING;
