-- Inserir tipo de parada 'Manutenção' se não existir
-- Usando categoria MANUTENCAO para separação correta das demais paradas
INSERT INTO public.tipos_parada (nome, codigo, ativo, categoria, cor, icone)
SELECT 'Manutenção', 'MAN001', true, 'MANUTENCAO', '#F97316', 'engineering'
WHERE NOT EXISTS (
    SELECT 1 FROM public.tipos_parada WHERE nome = 'Manutenção'
);

-- Atualizar registros existentes que possam ter sido criados com categoria errada
UPDATE public.tipos_parada 
SET categoria = 'MANUTENCAO', 
    cor = '#F97316', 
    icone = 'engineering'
WHERE nome = 'Manutenção' 
  AND (categoria != 'MANUTENCAO' OR cor IS NULL OR icone IS NULL);
