/**
 * Service RAG (Retrieval-Augmented Generation)
 * Recherche de documents pertinents dans la base vectorielle
 */

import { supabaseAdmin } from '../config/supabase.js';

let OpenAI;

// Import dynamique d'OpenAI
async function getOpenAI() {
  if (!OpenAI) {
    const openaiModule = await import('openai');
    OpenAI = openaiModule.default;
  }
  return OpenAI;
}

class RAGService {
  constructor() {
    this.openaiClient = null;
  }

  async initOpenAI() {
    if (!this.openaiClient) {
      const OpenAIClass = await getOpenAI();
      this.openaiClient = new OpenAIClass({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openaiClient;
  }

  /**
   * Génère un embedding pour un texte donné
   */
  async generateEmbedding(text) {
    try {
      const openai = await this.initOpenAI();
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limite de tokens
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Erreur génération embedding:', error);
      throw new Error('Impossible de générer l\'embedding');
    }
  }

  /**
   * Recherche des documents similaires dans la base vectorielle
   */
  async searchSimilarDocuments(queryText, options = {}) {
    try {
      const {
        matchThreshold = 0.7,
        matchCount = 5,
        documentTypes = ['contract_template', 'law', 'regulation']
      } = options;

      console.log('Recherche RAG pour:', queryText.substring(0, 100) + '...');

      // Génération de l'embedding pour la requête
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Recherche dans Supabase avec la fonction match_documents
      const { data, error } = await supabaseAdmin.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      });

      if (error) {
        console.error('Erreur recherche Supabase:', error);
        throw error;
      }

      // Filtrage par type de document si spécifié
      const filteredResults = data.filter(doc => 
        documentTypes.includes(doc.document_type)
      );

      console.log(`Trouvé ${filteredResults.length} documents similaires`);

      return filteredResults.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        title: doc.title,
        content: doc.content,
        documentType: doc.document_type,
        similarity: doc.similarity
      }));

    } catch (error) {
      console.error('Erreur recherche RAG:', error);
      return []; // Retourne un tableau vide en cas d'erreur
    }
  }

  /**
   * Enrichit le prompt avec le contexte RAG
   */
  async enrichPromptWithRAG(contractText, originalPrompt) {
    try {
      // Recherche de documents pertinents
      const similarDocs = await this.searchSimilarDocuments(contractText, {
        matchThreshold: 0.6,
        matchCount: 3
      });

      if (similarDocs.length === 0) {
        console.log('Aucun document RAG trouvé, utilisation du prompt original');
        return originalPrompt;
      }

      // Construction du contexte RAG
      const ragContext = this.buildRAGContext(similarDocs);

      // Enrichissement du prompt
      const enrichedPrompt = this.injectRAGContext(originalPrompt, ragContext);

      console.log('Prompt enrichi avec', similarDocs.length, 'documents RAG');
      return enrichedPrompt;

    } catch (error) {
      console.error('Erreur enrichissement RAG:', error);
      return originalPrompt; // Fallback vers le prompt original
    }
  }

  /**
   * Construit le contexte RAG à partir des documents trouvés
   */
  buildRAGContext(documents) {
    const contextSections = documents.map((doc, index) => {
      const typeLabel = {
        'contract_template': 'Modèle de contrat',
        'law': 'Loi marocaine',
        'regulation': 'Réglementation'
      }[doc.documentType] || 'Document';

      return `
DOCUMENT ${index + 1} - ${typeLabel} (Similarité: ${(doc.similarity * 100).toFixed(1)}%)
Titre: ${doc.title || doc.filename}
Contenu pertinent:
${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}
`;
    });

    return `
CONTEXTE JURIDIQUE MAROCAIN PERTINENT:
${contextSections.join('\n---\n')}

INSTRUCTIONS POUR UTILISER CE CONTEXTE:
- Utilisez ces références pour enrichir votre analyse
- Citez les articles ou clauses pertinents quand applicable
- Comparez le contrat analysé avec les bonnes pratiques identifiées
- Identifiez les écarts par rapport aux modèles standards
`;
  }

  /**
   * Injecte le contexte RAG dans le prompt système
   */
  injectRAGContext(originalPrompt, ragContext) {
    // Insertion du contexte RAG après les instructions principales
    const insertionPoint = originalPrompt.indexOf('RÈGLES STRICTES:');
    
    if (insertionPoint !== -1) {
      return originalPrompt.slice(0, insertionPoint) + 
             ragContext + '\n\n' + 
             originalPrompt.slice(insertionPoint);
    } else {
      // Si le point d'insertion n'est pas trouvé, ajouter à la fin
      return originalPrompt + '\n\n' + ragContext;
    }
  }

  /**
   * Statistiques de la base vectorielle
   */
  async getVectorStoreStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('document_embeddings')
        .select('document_type')
        .not('embedding', 'is', null);

      if (error) throw error;

      const stats = data.reduce((acc, doc) => {
        acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
        return acc;
      }, {});

      return {
        total: data.length,
        byType: stats
      };
    } catch (error) {
      console.error('Erreur stats vector store:', error);
      return { total: 0, byType: {} };
    }
  }
}

export default new RAGService();