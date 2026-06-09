-- ============================================================
-- HACCP Digital Register — Schema Iniziale
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- STAFF MEMBERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(255),
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('chef', 'cook', 'cleaner', 'manager')) DEFAULT 'cook',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- SUPPLIER BATCHES (Lotti Fornitori)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    original_lot_code VARCHAR(50),
    delivery_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    risk_level VARCHAR(10) CHECK (risk_level IN ('high', 'medium', 'low')) DEFAULT 'medium',
    is_compliant BOOLEAN DEFAULT true,
    registered_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INTERNAL BATCHES (Lotti Interni)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    prepared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    qr_code_token VARCHAR(100) UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
    prepared_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- BLAST CHILLER LOGS (Registri Abbattitore)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blast_chiller_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_batch_id UUID REFERENCES internal_batches(id) ON DELETE CASCADE,
    cycle_type VARCHAR(20) CHECK (cycle_type IN ('positive_3c', 'negative_18c')) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    start_temp DECIMAL(4,1) NOT NULL,
    end_temp DECIMAL(4,1),
    target_time_minutes INT NOT NULL,
    is_compliant BOOLEAN DEFAULT true,
    corrective_action TEXT,
    operator_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TEMPERATURE LOGS (Opzionale — log periodici)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temperature_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_name VARCHAR(100) NOT NULL,
    temperature DECIMAL(4,1) NOT NULL,
    min_threshold DECIMAL(4,1),
    max_threshold DECIMAL(4,1),
    is_compliant BOOLEAN DEFAULT true,
    recorded_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE blast_chiller_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;

-- Policy: lettura pubblica (anon può leggere — la vera auth è il PIN)
CREATE POLICY "Lettura pubblica staff" ON staff_members FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica fornitori" ON supplier_batches FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica lotti" ON internal_batches FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica abbattitore" ON blast_chiller_logs FOR SELECT USING (true);
CREATE POLICY "Lettura pubblica temperature" ON temperature_logs FOR SELECT USING (true);

-- Policy: scrittura solo con service_role o anon (PIN già verificato lato server)
CREATE POLICY "Scrittura staff" ON staff_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Aggiornamento staff" ON staff_members FOR UPDATE USING (true);
CREATE POLICY "Scrittura fornitori" ON supplier_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Aggiornamento fornitori" ON supplier_batches FOR UPDATE USING (true);
CREATE POLICY "Eliminazione fornitori" ON supplier_batches FOR DELETE USING (true);
CREATE POLICY "Scrittura lotti" ON internal_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Aggiornamento lotti" ON internal_batches FOR UPDATE USING (true);
CREATE POLICY "Scrittura abbattitore" ON blast_chiller_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Aggiornamento abbattitore" ON blast_chiller_logs FOR UPDATE USING (true);
CREATE POLICY "Scrittura temperature" ON temperature_logs FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE blast_chiller_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE temperature_logs;

-- ------------------------------------------------------------
-- SEED DATA — Staff di esempio (PIN: 1234 per tutti)
-- pin_hash = bcrypt('1234', 10)
-- ------------------------------------------------------------
INSERT INTO staff_members (first_name, last_name, role, pin_hash, avatar_url) VALUES
  ('Marco', 'Rossi', 'chef', '$2b$10$w5mviDQta2L21YUbRyhrf.jH.DN2HCeNAxILkEJ5XLcWlqFWsXhCS', NULL),
  ('Giulia', 'Bianchi', 'cook', '$2b$10$w5mviDQta2L21YUbRyhrf.jH.DN2HCeNAxILkEJ5XLcWlqFWsXhCS', NULL),
  ('Luca', 'Ferrari', 'cook', '$2b$10$w5mviDQta2L21YUbRyhrf.jH.DN2HCeNAxILkEJ5XLcWlqFWsXhCS', NULL),
  ('Sara', 'Conti', 'cleaner', '$2b$10$w5mviDQta2L21YUbRyhrf.jH.DN2HCeNAxILkEJ5XLcWlqFWsXhCS', NULL),
  ('Admin', 'Manager', 'manager', '$2b$10$w5mviDQta2L21YUbRyhrf.jH.DN2HCeNAxILkEJ5XLcWlqFWsXhCS', NULL)
ON CONFLICT DO NOTHING;
