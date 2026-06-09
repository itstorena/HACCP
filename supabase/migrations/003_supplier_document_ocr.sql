-- ============================================================
-- HACCP Digital Register - Supplier Document OCR
-- ============================================================
-- Gestione acquisizione ottica fatture/DDT e trasformazione in
-- righe fornitura/lotti fornitore confermati dall'operatore.

CREATE TABLE IF NOT EXISTS supplier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(20) CHECK (document_type IN ('invoice', 'ddt', 'receipt', 'other')) DEFAULT 'ddt',
    supplier_name VARCHAR(120),
    document_number VARCHAR(80),
    document_date DATE,
    image_url TEXT,
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,2),
    parsed_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_document_id UUID REFERENCES supplier_documents(id) ON DELETE CASCADE,
    supplier_batch_id UUID REFERENCES supplier_batches(id) ON DELETE SET NULL,
    product_name VARCHAR(160) NOT NULL,
    original_lot_code VARCHAR(80),
    expiry_date DATE,
    quantity DECIMAL(10,2),
    unit VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE supplier_batches
  ADD COLUMN IF NOT EXISTS supplier_document_id UUID REFERENCES supplier_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ocr_source_text TEXT;

ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lettura pubblica documenti fornitore" ON supplier_documents FOR SELECT USING (true);
CREATE POLICY "Scrittura documenti fornitore" ON supplier_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Lettura pubblica righe documenti fornitore" ON supplier_document_items FOR SELECT USING (true);
CREATE POLICY "Scrittura righe documenti fornitore" ON supplier_document_items FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE supplier_documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE supplier_document_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
