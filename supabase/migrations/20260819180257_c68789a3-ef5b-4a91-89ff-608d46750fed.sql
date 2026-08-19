-- Add new columns to public.projetos for Regularização
ALTER TABLE public.projetos
ADD COLUMN IF NOT EXISTS carta_arrematacao_status TEXT,
ADD COLUMN IF NOT EXISTS averbacao_status TEXT,
ADD COLUMN IF NOT EXISTS protocolo_cartorio TEXT,
ADD COLUMN IF NOT EXISTS iptu_status TEXT,
ADD COLUMN IF NOT EXISTS iptu_responsabilidade TEXT,
ADD COLUMN IF NOT EXISTS iptu_valor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS transferencia_cadastral_status TEXT,
ADD COLUMN IF NOT EXISTS itbi_valor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tem_condominio BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS condominio_debitos_anteriores NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS condominio_debitos_status TEXT,
ADD COLUMN IF NOT EXISTS condominio_responsabilidade TEXT,
ADD COLUMN IF NOT EXISTS condominio_taxa_mensal NUMERIC DEFAULT 0;

-- Create judicial_actions table
CREATE TABLE IF NOT EXISTS public.judicial_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    tipo_acao TEXT NOT NULL,
    vara TEXT,
    ultima_movimentacao DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.judicial_actions TO authenticated;
GRANT ALL ON public.judicial_actions TO service_role;

-- Enable RLS
ALTER TABLE public.judicial_actions ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage judicial actions for their own projects"
ON public.judicial_actions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projetos
        WHERE projetos.id = judicial_actions.projeto_id
    )
);

-- Create update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for judicial_actions
DROP TRIGGER IF EXISTS update_judicial_actions_updated_at ON public.judicial_actions;
CREATE TRIGGER update_judicial_actions_updated_at
    BEFORE UPDATE ON public.judicial_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
