ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS land_area numeric(15,2),
ADD COLUMN IF NOT EXISTS built_area numeric(15,2),
ADD COLUMN IF NOT EXISTS total_area numeric(15,2);

COMMENT ON COLUMN public.projetos.land_area IS 'Área do Terreno em m²';
COMMENT ON COLUMN public.projetos.built_area IS 'Área Construída em m²';
COMMENT ON COLUMN public.projetos.total_area IS 'Área Total em m²';
