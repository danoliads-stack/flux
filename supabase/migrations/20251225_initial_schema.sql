-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sectors
CREATE TABLE IF NOT EXISTS public.setores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Orders
CREATE TABLE IF NOT EXISTS public.ordens_producao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    nome_produto TEXT NOT NULL,
    prioridade TEXT CHECK (prioridade IN ('ALTA', 'NORMAL', 'BAIXA')) DEFAULT 'NORMAL',
    quantidade_meta INTEGER NOT NULL,
    ciclo_estimado TEXT,
    material TEXT,
    status TEXT CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'SUSPENSA', 'FINALIZADA')) DEFAULT 'PENDENTE',
    data_emissao DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operators
CREATE TABLE IF NOT EXISTS public.operadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    setor_id UUID REFERENCES public.setores(id),
    avatar TEXT,
    pin TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Machines
CREATE TABLE IF NOT EXISTS public.maquinas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    setor_id UUID REFERENCES public.setores(id),
    status_atual TEXT DEFAULT 'AVAILABLE',
    operador_atual_id UUID REFERENCES public.operadores(id),
    op_atual_id UUID REFERENCES public.ordens_producao(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Logs
CREATE TABLE IF NOT EXISTS public.registros_producao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    op_id UUID REFERENCES public.ordens_producao(id),
    maquina_id UUID REFERENCES public.maquinas(id),
    operador_id UUID REFERENCES public.operadores(id),
    quantidade_boa INTEGER DEFAULT 0,
    quantidade_refugo INTEGER DEFAULT 0,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ,
    turno TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Downtime Events
CREATE TABLE IF NOT EXISTS public.paradas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maquina_id UUID REFERENCES public.maquinas(id),
    operador_id UUID REFERENCES public.operadores(id),
    op_id UUID REFERENCES public.ordens_producao(id),
    motivo TEXT NOT NULL,
    notas TEXT,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklists
CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maquina_id UUID REFERENCES public.maquinas(id),
    operador_id UUID REFERENCES public.operadores(id),
    op_id UUID REFERENCES public.ordens_producao(id),
    categoria TEXT,
    itens JSONB NOT NULL,
    aprovado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (for Admin/Supervisor Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('ADMIN', 'SUPERVISOR')) NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
