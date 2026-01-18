-- RLS policies for checklists to allow admin management and operator leitura
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklists' AND policyname = 'Admins manage checklists'
    ) THEN
        CREATE POLICY "Admins manage checklists"
        ON public.checklists
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklists' AND policyname = 'Anon can view checklists'
    ) THEN
        CREATE POLICY "Anon can view checklists"
        ON public.checklists FOR SELECT
        TO anon
        USING (true);
    END IF;
END $$;
