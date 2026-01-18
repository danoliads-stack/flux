-- Ensure MES checklist/session RPCs are exposed to the API roles
GRANT EXECUTE ON FUNCTION public.mes_switch_operator(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_insert_checklist(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID) TO anon, authenticated;
