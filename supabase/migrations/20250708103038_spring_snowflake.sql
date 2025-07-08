/*
  # Schema initial pour AI LOVE CONTRACTS

  1. Tables principales
    - `users` - Utilisateurs authentifiés
    - `contracts` - Contrats uploadés par les utilisateurs
    - `document_embeddings` - Base vectorielle pour le RAG
    - `analysis_results` - Résultats d'analyse des contrats

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques d'accès appropriées
*/

-- Extension pour les vecteurs (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  company text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des contrats uploadés
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_filename text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  file_path text NOT NULL,
  contract_type text,
  upload_date timestamptz DEFAULT now(),
  analysis_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table des résultats d'analyse
CREATE TABLE IF NOT EXISTS analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  overall_score integer CHECK (overall_score >= 1 AND overall_score <= 10),
  contract_type text,
  risks jsonb DEFAULT '[]',
  suggestions jsonb DEFAULT '[]',
  compliance jsonb DEFAULT '[]',
  summary text,
  key_points jsonb DEFAULT '[]',
  urgent_actions jsonb DEFAULT '[]',
  analysis_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table des embeddings pour le RAG
CREATE TABLE IF NOT EXISTS document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_hash text UNIQUE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('contract_template', 'law', 'regulation')),
  title text,
  content text NOT NULL,
  chunk_index integer DEFAULT 0,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index pour la recherche vectorielle
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS contracts_user_id_idx ON contracts(user_id);
CREATE INDEX IF NOT EXISTS contracts_upload_date_idx ON contracts(upload_date DESC);
CREATE INDEX IF NOT EXISTS analysis_results_contract_id_idx ON analysis_results(contract_id);
CREATE INDEX IF NOT EXISTS document_embeddings_type_idx ON document_embeddings(document_type);
CREATE INDEX IF NOT EXISTS document_embeddings_hash_idx ON document_embeddings(file_hash);

-- Activation RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour users
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Politiques RLS pour contracts
CREATE POLICY "Users can read own contracts"
  ON contracts
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own contracts"
  ON contracts
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can read all contracts"
  ON contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

-- Politiques RLS pour analysis_results
CREATE POLICY "Users can read own analysis results"
  ON analysis_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts 
      WHERE contracts.id = analysis_results.contract_id 
      AND contracts.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own analysis results"
  ON analysis_results
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts 
      WHERE contracts.id = analysis_results.contract_id 
      AND contracts.user_id::text = auth.uid()::text
    )
  );

-- Politiques RLS pour document_embeddings (lecture publique pour le RAG)
CREATE POLICY "Public read access for embeddings"
  ON document_embeddings
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage embeddings"
  ON document_embeddings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour users
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer la similarité cosinus
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  filename text,
  title text,
  content text,
  document_type text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    document_embeddings.id,
    document_embeddings.filename,
    document_embeddings.title,
    document_embeddings.content,
    document_embeddings.document_type,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;