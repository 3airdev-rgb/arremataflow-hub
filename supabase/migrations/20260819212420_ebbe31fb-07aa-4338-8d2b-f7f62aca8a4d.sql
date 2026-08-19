ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'nao_iniciado';
UPDATE public.projetos SET status = 'nao_iniciado' WHERE status IS NULL;