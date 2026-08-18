CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Investidor','Assessor','Leiloeiro')),
  nome TEXT NOT NULL,
  documento TEXT,
  email TEXT,
  celulares TEXT[] NOT NULL DEFAULT '{}',
  data_nascimento DATE,
  estado_civil TEXT,
  endereco TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  website TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas TO authenticated;
GRANT ALL ON public.pessoas TO service_role;
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pessoas_own" ON public.pessoas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pessoas_user_tipo_idx ON public.pessoas (user_id, tipo);

CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT,
  endereco TEXT,
  cidade TEXT,
  cep TEXT,
  area TEXT,
  matricula TEXT,
  tipo_imovel TEXT,
  iptu TEXT,
  observacoes TEXT,
  fotos TEXT[] NOT NULL DEFAULT '{}',
  foto_principal TEXT,
  origem TEXT,
  valor_aquisicao NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_aquisicao DATE,
  forma_pagamento TEXT,
  leiloeiro_id UUID REFERENCES public.pessoas ON DELETE SET NULL,
  leiloeiro_nome TEXT,
  percentual_comissao NUMERIC(6,3) NOT NULL DEFAULT 0,
  valor_comissao NUMERIC(14,2) NOT NULL DEFAULT 0,
  credor TEXT,
  valor_parcelado NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
  valor_parcela NUMERIC(14,2) NOT NULL DEFAULT 0,
  modalidade TEXT,
  percentual_honorarios NUMERIC(6,3) NOT NULL DEFAULT 0,
  tem_minimo BOOLEAN NOT NULL DEFAULT false,
  valor_minimo NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projetos_own" ON public.projetos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX projetos_user_idx ON public.projetos (user_id, created_at DESC);

CREATE TABLE public.projeto_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos ON DELETE CASCADE,
  pessoa_id UUID REFERENCES public.pessoas ON DELETE SET NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('Investidor','Assessor')),
  percentual NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_participantes TO authenticated;
GRANT ALL ON public.projeto_participantes TO service_role;
ALTER TABLE public.projeto_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participantes_own" ON public.projeto_participantes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.user_id = auth.uid()));
CREATE INDEX participantes_projeto_idx ON public.projeto_participantes (projeto_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pessoas_updated_at BEFORE UPDATE ON public.pessoas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER projetos_updated_at BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();