-- ======================================================
-- Migration: RLS Seguro — Flux Insights
-- Data: 2026-04-21
-- Objetivo: Substituir policies abertas e duplicadas por
--           policies com permissões mínimas necessárias.
-- Regra geral:
--   Tabelas de configuração → anon só lê, authenticated faz tudo
--   Tabelas de produção     → anon lê/insere/atualiza, NUNCA deleta
--   Tabelas de auth         → só authenticated
-- ======================================================

-- ====================================================
-- 1. LIMPAR POLICIES ANTIGAS
-- ====================================================

DROP POLICY IF EXISTS "Admins have full access on setores" ON public.setores;
DROP POLICY IF EXISTS "Enable all access" ON public.setores;
DROP POLICY IF EXISTS "Everyone can view setores" ON public.setores;

DROP POLICY IF EXISTS "Admins have full access on maquinas" ON public.maquinas;
DROP POLICY IF EXISTS "Anon can update maquinas status" ON public.maquinas;
DROP POLICY IF EXISTS "Anon can view maquinas" ON public.maquinas;
DROP POLICY IF EXISTS "Enable all access" ON public.maquinas;

DROP POLICY IF EXISTS "Admins have full access on operadores" ON public.operadores;
DROP POLICY IF EXISTS "Enable all access" ON public.operadores;
DROP POLICY IF EXISTS "Enable all access for admins and supervisors" ON public.operadores;
DROP POLICY IF EXISTS "Public Read Access for Operators" ON public.operadores;

DROP POLICY IF EXISTS "Admins have full access on ordens_producao" ON public.ordens_producao;
DROP POLICY IF EXISTS "Anon can view ordens_producao" ON public.ordens_producao;
DROP POLICY IF EXISTS "Enable all access" ON public.ordens_producao;

DROP POLICY IF EXISTS "Admins have full access on registros_producao" ON public.registros_producao;
DROP POLICY IF EXISTS "Anon can insert registros_producao" ON public.registros_producao;
DROP POLICY IF EXISTS "Anon can view registros_producao" ON public.registros_producao;
DROP POLICY IF EXISTS "Enable all access" ON public.registros_producao;

DROP POLICY IF EXISTS "Admins have full access on paradas" ON public.paradas;
DROP POLICY IF EXISTS "Anon can insert paradas" ON public.paradas;
DROP POLICY IF EXISTS "Anon can update paradas" ON public.paradas;
DROP POLICY IF EXISTS "Anon can view paradas" ON public.paradas;
DROP POLICY IF EXISTS "Enable all access" ON public.paradas;

DROP POLICY IF EXISTS "Admins manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Allow all access to checklist_modelos" ON public.checklists;
DROP POLICY IF EXISTS "Anon can view checklists" ON public.checklists;

DROP POLICY IF EXISTS "Allow all access to checklist_items" ON public.checklist_items;

DROP POLICY IF EXISTS "Enable all access" ON public.checklist_eventos;
DROP POLICY IF EXISTS "Enable all for anon" ON public.checklist_eventos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.checklist_eventos;
DROP POLICY IF EXISTS "allow_all_checklist_eventos" ON public.checklist_eventos;

DROP POLICY IF EXISTS "Enable read/write for authenticated users only" ON public.checklist_respostas;
DROP POLICY IF EXISTS "allow_all_checklist_respostas" ON public.checklist_respostas;

DROP POLICY IF EXISTS "Enable all access" ON public.checklist_fotos;
DROP POLICY IF EXISTS "Enable all for anon" ON public.checklist_fotos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.checklist_fotos;
DROP POLICY IF EXISTS "allow_all_checklist_fotos" ON public.checklist_fotos;

DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access" ON public.profiles;

DROP POLICY IF EXISTS "Enable all access" ON public.op_operadores;
DROP POLICY IF EXISTS "Enable all for anon" ON public.op_operadores;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.op_operadores;

DROP POLICY IF EXISTS "Enable all access" ON public.turnos;
DROP POLICY IF EXISTS "Enable all access for tipos_parada" ON public.tipos_parada;
DROP POLICY IF EXISTS "Enable all access for tipos_refugo" ON public.tipos_refugo;

DROP POLICY IF EXISTS "Enable all access" ON public.lotes_rastreabilidade;
DROP POLICY IF EXISTS "Enable all for anon" ON public.lotes_rastreabilidade;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.lotes_rastreabilidade;

DROP POLICY IF EXISTS "Enable all access" ON public.diario_bordo_eventos;
DROP POLICY IF EXISTS "Enable all for anon" ON public.diario_bordo_eventos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.diario_bordo_eventos;

DROP POLICY IF EXISTS "Enable all access" ON public.diario_bordo_fotos;
DROP POLICY IF EXISTS "Enable all for anon" ON public.diario_bordo_fotos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.diario_bordo_fotos;

DROP POLICY IF EXISTS "Allow anon insert access on etiquetas" ON public.etiquetas;
DROP POLICY IF EXISTS "Allow anon read access on etiquetas" ON public.etiquetas;
DROP POLICY IF EXISTS "Allow authenticated insert access on etiquetas" ON public.etiquetas;
DROP POLICY IF EXISTS "Allow authenticated read access on etiquetas" ON public.etiquetas;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.chamados_manutencao;
DROP POLICY IF EXISTS "Allow insert diario de maquina" ON public.diario_de_maquina_eventos;
DROP POLICY IF EXISTS "Allow read diario de maquina" ON public.diario_de_maquina_eventos;


-- ====================================================
-- 2. HABILITAR RLS NAS TABELAS QUE ESTAVAM SEM
-- ====================================================

ALTER TABLE public.op_operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_de_maquina_eventos ENABLE ROW LEVEL SECURITY;


-- ====================================================
-- 3. CRIAR NOVAS POLICIES LIMPAS
-- ====================================================

CREATE POLICY "flux_setores_admin_all" ON public.setores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_setores_anon_select" ON public.setores FOR SELECT TO anon USING (true);

CREATE POLICY "flux_maquinas_admin_all" ON public.maquinas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_maquinas_anon_select" ON public.maquinas FOR SELECT TO anon USING (true);
CREATE POLICY "flux_maquinas_anon_update" ON public.maquinas FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_operadores_admin_all" ON public.operadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_operadores_anon_select" ON public.operadores FOR SELECT TO anon USING (true);

CREATE POLICY "flux_op_admin_all" ON public.ordens_producao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_op_anon_select" ON public.ordens_producao FOR SELECT TO anon USING (true);

CREATE POLICY "flux_turnos_admin_all" ON public.turnos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_turnos_anon_select" ON public.turnos FOR SELECT TO anon USING (true);

CREATE POLICY "flux_tipos_parada_admin_all" ON public.tipos_parada FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_tipos_parada_anon_select" ON public.tipos_parada FOR SELECT TO anon USING (true);

CREATE POLICY "flux_tipos_refugo_admin_all" ON public.tipos_refugo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_tipos_refugo_anon_select" ON public.tipos_refugo FOR SELECT TO anon USING (true);

CREATE POLICY "flux_checklists_admin_all" ON public.checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_checklists_anon_select" ON public.checklists FOR SELECT TO anon USING (true);

CREATE POLICY "flux_checklist_items_admin_all" ON public.checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_checklist_items_anon_select" ON public.checklist_items FOR SELECT TO anon USING (true);

CREATE POLICY "flux_profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "flux_profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "flux_profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "flux_regprod_admin_all" ON public.registros_producao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_regprod_anon_select" ON public.registros_producao FOR SELECT TO anon USING (true);
CREATE POLICY "flux_regprod_anon_insert" ON public.registros_producao FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_regprod_anon_update" ON public.registros_producao FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_paradas_admin_all" ON public.paradas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_paradas_anon_select" ON public.paradas FOR SELECT TO anon USING (true);
CREATE POLICY "flux_paradas_anon_insert" ON public.paradas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_paradas_anon_update" ON public.paradas FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_ckev_admin_all" ON public.checklist_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_ckev_anon_select" ON public.checklist_eventos FOR SELECT TO anon USING (true);
CREATE POLICY "flux_ckev_anon_insert" ON public.checklist_eventos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_ckev_anon_update" ON public.checklist_eventos FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_ckres_admin_all" ON public.checklist_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_ckres_anon_select" ON public.checklist_respostas FOR SELECT TO anon USING (true);
CREATE POLICY "flux_ckres_anon_insert" ON public.checklist_respostas FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_ckfoto_admin_all" ON public.checklist_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_ckfoto_anon_select" ON public.checklist_fotos FOR SELECT TO anon USING (true);
CREATE POLICY "flux_ckfoto_anon_insert" ON public.checklist_fotos FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_opopr_admin_all" ON public.op_operadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_opopr_anon_select" ON public.op_operadores FOR SELECT TO anon USING (true);
CREATE POLICY "flux_opopr_anon_insert" ON public.op_operadores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_opopr_anon_update" ON public.op_operadores FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_sessions_admin_all" ON public.op_operator_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_sessions_anon_select" ON public.op_operator_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "flux_sessions_anon_insert" ON public.op_operator_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_sessions_anon_update" ON public.op_operator_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_opsummary_admin_all" ON public.op_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_opsummary_anon_select" ON public.op_summary FOR SELECT TO anon USING (true);

CREATE POLICY "flux_diariomaq_admin_all" ON public.diario_de_maquina_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_diariomaq_anon_select" ON public.diario_de_maquina_eventos FOR SELECT TO anon USING (true);
CREATE POLICY "flux_diariomaq_anon_insert" ON public.diario_de_maquina_eventos FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_lotes_admin_all" ON public.lotes_rastreabilidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_lotes_anon_select" ON public.lotes_rastreabilidade FOR SELECT TO anon USING (true);
CREATE POLICY "flux_lotes_anon_insert" ON public.lotes_rastreabilidade FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_diariobordo_admin_all" ON public.diario_bordo_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_diariobordo_anon_select" ON public.diario_bordo_eventos FOR SELECT TO anon USING (true);
CREATE POLICY "flux_diariobordo_anon_insert" ON public.diario_bordo_eventos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_diariobordo_anon_update" ON public.diario_bordo_eventos FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "flux_diariobordofoto_admin_all" ON public.diario_bordo_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_diariobordofoto_anon_select" ON public.diario_bordo_fotos FOR SELECT TO anon USING (true);
CREATE POLICY "flux_diariobordofoto_anon_insert" ON public.diario_bordo_fotos FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_etiquetas_admin_all" ON public.etiquetas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_etiquetas_anon_select" ON public.etiquetas FOR SELECT TO anon USING (true);
CREATE POLICY "flux_etiquetas_anon_insert" ON public.etiquetas FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "flux_chamados_admin_all" ON public.chamados_manutencao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "flux_chamados_anon_select" ON public.chamados_manutencao FOR SELECT TO anon USING (true);
CREATE POLICY "flux_chamados_anon_insert" ON public.chamados_manutencao FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "flux_chamados_anon_update" ON public.chamados_manutencao FOR UPDATE TO anon USING (true) WITH CHECK (true);
