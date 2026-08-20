-- Check if tarefas table exists and create it if not
CREATE TABLE IF NOT EXISTS public.tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    responsavel TEXT,
    prazo TEXT,
    status TEXT DEFAULT 'nao_iniciado',
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID DEFAULT auth.uid()
);

-- Add new columns to tarefas
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Geral';
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS is_online_meeting BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS meeting_time TEXT;

-- Create participants table
CREATE TABLE IF NOT EXISTS public.task_meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.pessoas(id) ON DELETE CASCADE,
    participant_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_meeting_participants ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_meeting_participants TO authenticated;
GRANT ALL ON public.task_meeting_participants TO service_role;

-- Policies for tarefas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own tasks' AND tablename = 'tarefas') THEN
        CREATE POLICY "Users can manage their own tasks" ON public.tarefas
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Policies for participants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage task participants' AND tablename = 'task_meeting_participants') THEN
        CREATE POLICY "Users can manage task participants" ON public.task_meeting_participants
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
