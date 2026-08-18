-- Create projeto_fotos table
CREATE TABLE public.projeto_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_fotos TO authenticated;
GRANT ALL ON public.projeto_fotos TO service_role;

-- Enable RLS
ALTER TABLE public.projeto_fotos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage photos for their projects"
    ON public.projeto_fotos
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projetos
            WHERE projetos.id = projeto_fotos.projeto_id
            AND projetos.user_id = auth.uid()
        )
    );

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'projeto_fotos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projeto_fotos');
CREATE POLICY "Users can delete their project photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'projeto_fotos');
CREATE POLICY "Users can update their project photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'projeto_fotos');
