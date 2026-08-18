CREATE TABLE public.project_managers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    assessor_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_managers TO authenticated;
GRANT ALL ON public.project_managers TO service_role;

ALTER TABLE public.project_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage managers for their own projects"
ON public.project_managers
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projetos 
        WHERE id = project_managers.project_id 
        AND user_id = auth.uid()
    )
);