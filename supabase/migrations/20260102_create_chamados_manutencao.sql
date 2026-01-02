-- Criar tabela separada para chamados de manutenção
-- Completamente separada da tabela 'paradas' de produção

CREATE TABLE IF NOT EXISTS public.chamados_manutencao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maquina_id UUID REFERENCES public.maquinas(id) NOT NULL,
    operador_id UUID REFERENCES public.operadores(id),
    op_id UUID REFERENCES public.ordens_producao(id),
    descricao TEXT NOT NULL,
    prioridade TEXT DEFAULT 'NORMAL' CHECK (prioridade IN ('BAIXA', 'NORMAL', 'ALTA', 'CRITICA')),
    status TEXT DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')),
    data_abertura TIMESTAMPTZ DEFAULT NOW(),
    data_inicio_atendimento TIMESTAMPTZ,
    data_conclusao TIMESTAMPTZ,
    tecnico_responsavel TEXT,
    observacao_resolucao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.chamados_manutencao ENABLE ROW LEVEL SECURITY;

-- Política: permitir leitura para todos autenticados
CREATE POLICY "Allow read for authenticated users" ON public.chamados_manutencao
    FOR SELECT USING (true);

-- Política: permitir inserção para todos autenticados
CREATE POLICY "Allow insert for authenticated users" ON public.chamados_manutencao
    FOR INSERT WITH CHECK (true);

-- Política: permitir atualização para todos autenticados
CREATE POLICY "Allow update for authenticated users" ON public.chamados_manutencao
    FOR UPDATE USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chamados_manutencao_maquina ON public.chamados_manutencao(maquina_id);
CREATE INDEX IF NOT EXISTS idx_chamados_manutencao_status ON public.chamados_manutencao(status);
CREATE INDEX IF NOT EXISTS idx_chamados_manutencao_data_abertura ON public.chamados_manutencao(data_abertura);

COMMENT ON TABLE public.chamados_manutencao IS 'Chamados de manutenção separados das paradas de produção';
