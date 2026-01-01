-- Create table for manual label emission with full traceability
CREATE TABLE IF NOT EXISTS public.etiquetas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    op_id UUID REFERENCES public.ordens_producao(id),
    maquina_id UUID REFERENCES public.maquinas(id),
    operador_id UUID REFERENCES public.operadores(id),
    setor_id UUID REFERENCES public.setores(id),
    tipo_etiqueta TEXT CHECK (tipo_etiqueta IN ('CHECKLIST', 'PALLET')) NOT NULL,
    numero_etiqueta INTEGER NOT NULL,
    dados_manualmente_preenchidos JSONB,
    qr_code_data TEXT NOT NULL,
    checklist_snapshot JSONB, -- Status of checklists at emission time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique sequential numbering per OP and type
    UNIQUE(op_id, tipo_etiqueta, numero_etiqueta)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_etiquetas_op_id ON public.etiquetas(op_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_maquina_id ON public.etiquetas(maquina_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_operador_id ON public.etiquetas(operador_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_qr_code ON public.etiquetas(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_etiquetas_created_at ON public.etiquetas(created_at);

-- Enable RLS
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read all labels
CREATE POLICY "Allow authenticated read access on etiquetas"
ON public.etiquetas FOR SELECT
TO authenticated
USING (true);

-- Create policy for authenticated users to insert labels
CREATE POLICY "Allow authenticated insert access on etiquetas"
ON public.etiquetas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create policy for anon users (operators without auth.users account)
CREATE POLICY "Allow anon read access on etiquetas"
ON public.etiquetas FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon insert access on etiquetas"
ON public.etiquetas FOR INSERT
TO anon
WITH CHECK (true);
