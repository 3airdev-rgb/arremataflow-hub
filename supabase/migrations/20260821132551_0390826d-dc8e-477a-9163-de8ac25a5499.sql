CREATE TABLE public.movimentacoes_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    descricao TEXT NOT NULL,
    document_holder_name TEXT,
    document_holder_type TEXT CHECK (document_holder_type IN ('Origem', 'Destinatário')),
    document_holder_document TEXT,
    document_type TEXT CHECK (document_type IN ('CPF', 'CNPJ')),
    categoria TEXT NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pendente',
    comprovante_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO authenticated;
GRANT ALL ON public.movimentacoes_financeiras TO service_role;

ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own project movements"
    ON public.movimentacoes_financeiras
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projetos
            WHERE id = movimentacoes_financeiras.projeto_id
            AND (user_id = auth.uid())
        )
    );
