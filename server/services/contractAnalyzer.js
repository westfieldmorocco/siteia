import { chunkText } from './textExtractor.js';
import promptManager from './promptManager.js';
import ragService from './ragService.js';
import contractService from './contractService.js';
import { optionalAuth } from '../middleware/auth.js';

let OpenAI;

// Import dynamique d'OpenAI
async function getOpenAI() {
  if (!OpenAI) {
    const openaiModule = await import('openai');
    OpenAI = openaiModule.default;
  }
  return OpenAI;
}

/**
 * Analyze contract using OpenAI GPT with custom prompt
 */
export async function analyzeContract(contractText, file = null, userId = null) {
  console.log('=== DÉBUT ANALYSE OPENAI AVEC PROMPT PERSONNALISÉ ===');
  
  try {
    // Vérification de la clé API
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Clé API OpenAI non configurée');
    }

    console.log('Clé API présente, longueur texte:', contractText?.length || 0);
    console.log('Version du prompt:', promptManager.getPromptStats().currentVersion);

    // Validation du texte d'entrée
    if (!contractText || typeof contractText !== 'string' || contractText.trim().length === 0) {
      throw new Error('Texte de contrat invalide ou vide');
    }

    // Initialisation d'OpenAI
    const OpenAIClass = await getOpenAI();
    const openai = new OpenAIClass({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Client OpenAI initialisé');

    // Enrichissement du prompt avec RAG
    console.log('Enrichissement du prompt avec RAG...');
    const systemPrompt = promptManager.getSystemPrompt();
    const enrichedSystemPrompt = await ragService.enrichPromptWithRAG(contractText, systemPrompt);
    
    // OPTIMISATION: Traitement intelligent du texte pour réduire les tokens
    let processedText = contractText;
    let useChunking = false;
    
    // Estimation des tokens (approximation: 1 token ≈ 4 caractères)
    const estimatedTokens = Math.ceil(contractText.length / 4);
    console.log(`Tokens estimés: ${estimatedTokens}`);
    
    if (estimatedTokens > 12000) {
      // Pour les très gros contrats, on résume d'abord le contenu
      console.log('Contrat très volumineux, application d\'une stratégie de résumé intelligent...');
      processedText = await smartTextSummarization(contractText);
      console.log(`Texte réduit de ${contractText.length} à ${processedText.length} caractères`);
    } else if (estimatedTokens > 8000) {
      // Pour les contrats moyens, on utilise un chunking optimisé
      console.log('Contrat de taille moyenne, utilisation du chunking optimisé...');
      useChunking = true;
    }
    // Pour les petits contrats (< 8000 tokens), traitement direct
    
    let fullAnalysis = {
      contractType: '',
      overallScore: 0,
      risks: [],
      suggestions: [],
      compliance: [],
      summary: '',
      keyPoints: [],
      urgentActions: []
    };

    if (useChunking) {
      // Chunking optimisé avec maximum 2 chunks
      const chunks = chunkText(processedText, 6000); // Chunks plus gros
      const maxChunks = Math.min(chunks.length, 2); // Limite à 2 chunks maximum
      console.log(`Traitement de ${maxChunks} chunk(s) sur ${chunks.length} disponibles`);
      
      let contractContext = '';
      
      for (let i = 0; i < maxChunks; i++) {
        console.log(`Analyse du chunk ${i + 1}/${maxChunks} avec prompt personnalisé`);
        
        try {
          const chunkAnalysis = await analyzeChunkWithCustomPrompt(
            openai, 
            chunks[i], 
            i === 0, 
            contractContext,
            enrichedSystemPrompt
          );
          console.log(`Chunk ${i + 1} analysé avec succès`);
          
          // Mise à jour du contexte pour les chunks suivants
          if (i === 0) {
            fullAnalysis = { ...fullAnalysis, ...chunkAnalysis };
            contractContext = `Type: ${chunkAnalysis.contractType}, Score: ${chunkAnalysis.overallScore}`;
          } else {
            // Fusion intelligente des résultats
            fullAnalysis.risks = mergeUniqueItems(fullAnalysis.risks, chunkAnalysis.risks || []);
            fullAnalysis.suggestions = mergeUniqueItems(fullAnalysis.suggestions, chunkAnalysis.suggestions || []);
            fullAnalysis.compliance = mergeUniqueItems(fullAnalysis.compliance, chunkAnalysis.compliance || []);
            fullAnalysis.keyPoints = mergeUniqueItems(fullAnalysis.keyPoints, chunkAnalysis.keyPoints || []);
            fullAnalysis.urgentActions = mergeUniqueItems(fullAnalysis.urgentActions, chunkAnalysis.urgentActions || []);
          }
        } catch (chunkError) {
          console.error(`Erreur chunk ${i + 1}:`, chunkError);
          // Continue avec les autres chunks
        }
      }
    } else {
      // Traitement direct en un seul appel (plus efficace)
      console.log('Traitement direct du contrat en un seul appel API');
      fullAnalysis = await analyzeChunkWithCustomPrompt(
        openai, 
        processedText, 
        true, 
        '',
        enrichedSystemPrompt
      );
    }

    // Nettoyage final et limitation du nombre d'éléments
    fullAnalysis.risks = limitAndCleanArray(fullAnalysis.risks, 8);
    fullAnalysis.suggestions = limitAndCleanArray(fullAnalysis.suggestions, 6);
    fullAnalysis.compliance = limitAndCleanArray(fullAnalysis.compliance, 10);
    fullAnalysis.keyPoints = limitAndCleanArray(fullAnalysis.keyPoints, 5);
    fullAnalysis.urgentActions = limitAndCleanArray(fullAnalysis.urgentActions, 3);

    // Application des vérifications spécifiques au type de contrat
    if (fullAnalysis.contractType) {
      const contractTypeChecks = promptManager.getContractTypeChecks(
        fullAnalysis.contractType.toLowerCase().replace(/\s+/g, '_')
      );
      
      if (contractTypeChecks) {
        console.log('Application des vérifications spécifiques au type de contrat');
        fullAnalysis = await applyContractTypeChecks(fullAnalysis, contractTypeChecks);
      }
    }

    // Validation finale avec valeurs par défaut
    if (!fullAnalysis.contractType) fullAnalysis.contractType = 'Contrat général';
    if (!fullAnalysis.overallScore) fullAnalysis.overallScore = 5;
    if (!fullAnalysis.summary) fullAnalysis.summary = 'Analyse complétée avec le prompt personnalisé.';

    // Sauvegarde du contrat et des résultats si utilisateur connecté
    if (userId && file) {
      try {
        console.log('Sauvegarde du contrat pour l\'utilisateur:', userId);
        await contractService.saveContract(userId, file, fullAnalysis);
        console.log('Contrat sauvegardé avec succès');
      } catch (saveError) {
        console.error('Erreur sauvegarde contrat:', saveError);
        // Continue l'analyse même si la sauvegarde échoue
      }
    }

    console.log('=== ANALYSE TERMINÉE AVEC PROMPT PERSONNALISÉ ===');
    console.log('Type de contrat:', fullAnalysis.contractType);
    console.log('Score:', fullAnalysis.overallScore);
    console.log('Risques:', fullAnalysis.risks.length);
    console.log('Suggestions:', fullAnalysis.suggestions.length);
    console.log('Actions urgentes:', fullAnalysis.urgentActions.length);

    return fullAnalysis;

  } catch (error) {
    console.error('=== ERREUR ANALYSE OPENAI ===');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);

    // Gestion des erreurs spécifiques
    if (error.message.includes('API key')) {
      throw new Error('Clé API OpenAI invalide ou manquante');
    }
    
    if (error.message.includes('quota')) {
      throw new Error('Quota API OpenAI dépassé. Veuillez réessayer plus tard.');
    }
    
    if (error.message.includes('rate limit')) {
      throw new Error('Limite de taux API atteinte. Veuillez patienter quelques secondes.');
    }

    // Erreur générique
    throw new Error(`Erreur lors de l'analyse IA: ${error.message}`);
  }
}

/**
 * Résumé intelligent du texte pour les gros contrats
 */
async function smartTextSummarization(text) {
  try {
    // Extraction des sections importantes (en-têtes, clauses numérotées, etc.)
    const importantSections = extractImportantSections(text);
    
    // Si les sections importantes sont suffisamment courtes, on les utilise
    if (importantSections.length < 15000) {
      return importantSections;
    }
    
    // Sinon, on prend les premiers et derniers paragraphes + sections clés
    const paragraphs = text.split('\n').filter(p => p.trim().length > 50);
    const firstPart = paragraphs.slice(0, 20).join('\n');
    const lastPart = paragraphs.slice(-10).join('\n');
    const middleKeywords = extractKeywordSections(text);
    
    return `${firstPart}\n\n[SECTIONS CLÉS]\n${middleKeywords}\n\n[FIN DU CONTRAT]\n${lastPart}`;
  } catch (error) {
    console.error('Erreur résumé intelligent:', error);
    // Fallback: prendre simplement le début et la fin
    return text.substring(0, 10000) + '\n\n[...CONTENU TRONQUÉ...]\n\n' + text.substring(text.length - 5000);
  }
}

/**
 * Extraction des sections importantes du contrat
 */
function extractImportantSections(text) {
  const lines = text.split('\n');
  const importantLines = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Garder les lignes qui semblent importantes
    if (
      trimmedLine.length > 20 && (
        /^(ARTICLE|Article|Clause|CLAUSE|Chapitre|CHAPITRE|\d+\.|\d+\))/i.test(trimmedLine) ||
        /(obligation|responsabilité|garantie|résiliation|paiement|durée|prix|montant)/i.test(trimmedLine) ||
        trimmedLine.length > 100
      )
    ) {
      importantLines.push(line);
    }
  }
  
  return importantLines.join('\n');
}

/**
 * Extraction des sections avec mots-clés importants
 */
function extractKeywordSections(text) {
  const keywords = [
    'obligation', 'responsabilité', 'garantie', 'résiliation', 'rupture',
    'paiement', 'prix', 'montant', 'durée', 'délai', 'pénalité',
    'force majeure', 'litige', 'juridiction', 'droit applicable'
  ];
  
  const sentences = text.split(/[.!?]+/);
  const keywordSentences = [];
  
  for (const sentence of sentences) {
    if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
      keywordSentences.push(sentence.trim());
    }
  }
  
  return keywordSentences.slice(0, 15).join('. ') + '.';
}

/**
 * Fusion intelligente d'éléments uniques
 */
function mergeUniqueItems(existing, newItems) {
  const merged = [...existing];
  
  for (const newItem of newItems) {
    const isDuplicate = existing.some(existingItem => 
      (typeof newItem === 'string' ? newItem : newItem.title || newItem.description) ===
      (typeof existingItem === 'string' ? existingItem : existingItem.title || existingItem.description)
    );
    
    if (!isDuplicate) {
      merged.push(newItem);
    }
  }
  
  return merged;
}

/**
 * Analyze a single chunk using custom prompt
 */
async function analyzeChunkWithCustomPrompt(openai, text, isFirstChunk = false, contractContext = '', customSystemPrompt = null) {
  try {
    console.log('Utilisation du prompt personnalisé pour l\'analyse...');
    
    // Récupération des prompts personnalisés
    const systemPrompt = customSystemPrompt || promptManager.getSystemPrompt();
    const userPrompt = promptManager.generateUserPrompt(text, isFirstChunk, contractContext);
    const openaiConfig = promptManager.getOpenAIConfig();

    console.log('Configuration OpenAI:', openaiConfig);
    
    // Configuration optimisée pour réduire les tokens
    const optimizedConfig = {
      ...openaiConfig,
      max_tokens: Math.min(openaiConfig.max_tokens, 2000), // Réduction des tokens de sortie
      temperature: 0.1, // Plus déterministe = moins de tokens "inutiles"
    };
    
    const completion = await openai.chat.completions.create({
      model: optimizedConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: optimizedConfig.temperature,
      max_tokens: optimizedConfig.max_tokens,
      top_p: optimizedConfig.top_p,
      frequency_penalty: optimizedConfig.frequency_penalty,
      presence_penalty: optimizedConfig.presence_penalty,
    });

    console.log('Réponse OpenAI reçue avec prompt personnalisé');

    const response = completion.choices[0].message.content;
    
    if (!response) {
      throw new Error('Réponse vide d\'OpenAI');
    }

    console.log('Parsing JSON de la réponse personnalisée...');
    
    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError);
      console.error('Réponse brute:', response);
      throw new Error('Réponse OpenAI invalide (JSON malformé)');
    }
    
    // Validation et nettoyage des champs avec le nouveau format
    const cleanAnalysis = {
      contractType: analysis.contractType || (isFirstChunk ? 'Non identifié' : ''),
      overallScore: typeof analysis.overallScore === 'number' ? analysis.overallScore : (isFirstChunk ? 5 : 0),
      risks: Array.isArray(analysis.risks) ? analysis.risks : [],
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      compliance: Array.isArray(analysis.compliance) ? analysis.compliance : [],
      summary: analysis.summary || (isFirstChunk ? 'Analyse en cours...' : ''),
      keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [],
      urgentActions: Array.isArray(analysis.urgentActions) ? analysis.urgentActions : []
    };

    console.log('Analyse chunk validée avec prompt personnalisé');
    return cleanAnalysis;

  } catch (error) {
    console.error('Erreur analyse chunk avec prompt personnalisé:', error);
    
    // Retour d'analyse de secours
    return {
      contractType: isFirstChunk ? 'Analyse partielle' : '',
      overallScore: isFirstChunk ? 5 : 0,
      risks: [{
        level: 'moyen',
        title: 'Analyse incomplète',
        description: 'L\'analyse automatique n\'a pas pu être complétée entièrement. Une révision manuelle est recommandée.',
        recommendation: 'Consulter un juriste spécialisé',
        legalReference: 'Vérification manuelle requise'
      }],
      suggestions: [],
      compliance: [],
      summary: isFirstChunk ? 'Analyse automatique partiellement disponible' : '',
      keyPoints: ['Révision manuelle recommandée'],
      urgentActions: []
    };
  }
}

/**
 * Apply contract type specific checks
 */
async function applyContractTypeChecks(analysis, contractTypeChecks) {
  // Ajouter des vérifications spécifiques selon le type de contrat
  const specificSuggestions = contractTypeChecks.specificChecks.map(check => ({
    priority: 'moyenne',
    title: `Vérification spécialisée: ${check}`,
    description: `Point de contrôle spécifique à ce type de contrat selon la réglementation marocaine.`,
    impact: 'Conformité renforcée',
    implementation: 'Vérifier la présence et la conformité de cette clause'
  }));

  analysis.suggestions = [...analysis.suggestions, ...specificSuggestions];
  
  return analysis;
}

/**
 * Limite et nettoie un tableau
 */
function limitAndCleanArray(array, maxItems = 10) {
  if (!Array.isArray(array)) return [];
  
  const seen = new Set();
  const filtered = array.filter(item => {
    if (!item) return false;
    
    const key = typeof item === 'string' ? item : 
                item.title || item.description || JSON.stringify(item);
    
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, maxItems); // Limite le nombre d'éléments
  
  return filtered;
}