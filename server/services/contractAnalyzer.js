import { chunkText } from './textExtractor.js';
import promptManager from './promptManager.js';

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
export async function analyzeContract(contractText) {
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

    // Découpage du texte si nécessaire
    const chunks = chunkText(contractText, 3500);
    console.log(`Texte découpé en ${chunks.length} chunk(s)`);
    
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

    let contractContext = '';

    // Analyse de chaque chunk avec le prompt personnalisé
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Analyse du chunk ${i + 1}/${chunks.length} avec prompt personnalisé`);
      
      try {
        const chunkAnalysis = await analyzeChunkWithCustomPrompt(
          openai, 
          chunks[i], 
          i === 0, 
          contractContext
        );
        console.log(`Chunk ${i + 1} analysé avec succès`);
        
        // Mise à jour du contexte pour les chunks suivants
        if (i === 0) {
          fullAnalysis = { ...fullAnalysis, ...chunkAnalysis };
          contractContext = `Type: ${chunkAnalysis.contractType}, Score: ${chunkAnalysis.overallScore}`;
        } else {
          // Fusion des tableaux pour les chunks suivants
          fullAnalysis.risks = [...fullAnalysis.risks, ...(chunkAnalysis.risks || [])];
          fullAnalysis.suggestions = [...fullAnalysis.suggestions, ...(chunkAnalysis.suggestions || [])];
          fullAnalysis.compliance = [...fullAnalysis.compliance, ...(chunkAnalysis.compliance || [])];
          fullAnalysis.keyPoints = [...fullAnalysis.keyPoints, ...(chunkAnalysis.keyPoints || [])];
          fullAnalysis.urgentActions = [...fullAnalysis.urgentActions, ...(chunkAnalysis.urgentActions || [])];
        }
      } catch (chunkError) {
        console.error(`Erreur chunk ${i + 1}:`, chunkError);
        // Continue avec les autres chunks
      }
    }

    // Nettoyage et finalisation
    fullAnalysis.risks = removeDuplicates(fullAnalysis.risks);
    fullAnalysis.suggestions = removeDuplicates(fullAnalysis.suggestions);
    fullAnalysis.compliance = removeDuplicates(fullAnalysis.compliance);
    fullAnalysis.keyPoints = removeDuplicates(fullAnalysis.keyPoints);
    fullAnalysis.urgentActions = removeDuplicates(fullAnalysis.urgentActions);

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
 * Analyze a single chunk using custom prompt
 */
async function analyzeChunkWithCustomPrompt(openai, text, isFirstChunk = false, contractContext = '') {
  try {
    console.log('Utilisation du prompt personnalisé pour l\'analyse...');
    
    // Récupération des prompts personnalisés
    const systemPrompt = promptManager.getSystemPrompt();
    const userPrompt = promptManager.generateUserPrompt(text, isFirstChunk, contractContext);
    const openaiConfig = promptManager.getOpenAIConfig();

    console.log('Configuration OpenAI:', openaiConfig);
    
    const completion = await openai.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: openaiConfig.temperature,
      max_tokens: openaiConfig.max_tokens,
      top_p: openaiConfig.top_p,
      frequency_penalty: openaiConfig.frequency_penalty,
      presence_penalty: openaiConfig.presence_penalty,
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
 * Remove duplicate items from arrays
 */
function removeDuplicates(array) {
  if (!Array.isArray(array)) return [];
  
  const seen = new Set();
  return array.filter(item => {
    if (!item) return false;
    
    const key = typeof item === 'string' ? item : 
                item.title || item.description || JSON.stringify(item);
    
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}