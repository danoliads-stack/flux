-- Inserir tipo de parada 'Manutenção' se não existir
-- Usando apenas as colunas que existem na tabela
INSERT INTO public.tipos_parada (nome, codigo, ativo, categoria)
SELECT 'Manutenção', 'MAN001', true, 'OUTROS'
WHERE NOT EXISTS (
    SELECT 1 FROM public.tipos_parada WHERE nome = 'Manutenção'
);
