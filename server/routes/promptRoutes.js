/**
 * Routes pour la gestion des prompts personnalisés
 * Permet de consulter, modifier et versionner les prompts
 */

import express from 'express';
import promptManager from '../services/promptManager.js';

const router = express.Router();

/**
 * GET /api/prompt/current
 * Récupère le prompt actuel
 */
router.get('/current', (req, res) => {
  try {
    const stats = promptManager.getPromptStats();
    res.json({
      success: true,
      stats,
      message: 'Prompt actuel récupéré avec succès'
    });
  } catch (error) {
    console.error('Erreur récupération prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du prompt'
    });
  }
});

/**
 * GET /api/prompt/full
 * Récupère le prompt complet (pour modification)
 */
router.get('/full', (req, res) => {
  try {
    const currentPrompt = promptManager.currentPrompt;
    res.json({
      success: true,
      prompt: currentPrompt,
      message: 'Prompt complet récupéré avec succès'
    });
  } catch (error) {
    console.error('Erreur récupération prompt complet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du prompt complet'
    });
  }
});

/**
 * PUT /api/prompt/update
 * Met à jour le prompt
 */
router.put('/update', async (req, res) => {
  try {
    const { promptData } = req.body;
    
    if (!promptData) {
      return res.status(400).json({
        success: false,
        error: 'Données de prompt manquantes'
      });
    }

    // Validation
    promptManager.validatePrompt(promptData);
    
    // Mise à jour
    const updatedPrompt = await promptManager.updatePrompt(promptData);
    
    res.json({
      success: true,
      prompt: updatedPrompt,
      message: `Prompt mis à jour vers la version ${updatedPrompt.version}`
    });

  } catch (error) {
    console.error('Erreur mise à jour prompt:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/prompt/history
 * Récupère l'historique des versions
 */
router.get('/history', (req, res) => {
  try {
    const history = promptManager.getPromptHistory();
    res.json({
      success: true,
      history,
      count: history.length,
      message: 'Historique récupéré avec succès'
    });
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

/**
 * POST /api/prompt/restore/:version
 * Restaure une version précédente
 */
router.post('/restore/:version', (req, res) => {
  try {
    const { version } = req.params;
    const restoredPrompt = promptManager.restoreVersion(version);
    
    res.json({
      success: true,
      prompt: restoredPrompt,
      message: `Prompt restauré à la version ${version}`
    });

  } catch (error) {
    console.error('Erreur restauration prompt:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/prompt/test
 * Teste le prompt actuel avec un texte d'exemple
 */
router.post('/test', async (req, res) => {
  try {
    const { testText } = req.body;
    
    if (!testText) {
      return res.status(400).json({
        success: false,
        error: 'Texte de test manquant'
      });
    }

    // Génération des prompts de test
    const systemPrompt = promptManager.getSystemPrompt();
    const userPrompt = promptManager.generateUserPrompt(testText, true);
    const config = promptManager.getOpenAIConfig();

    res.json({
      success: true,
      test: {
        systemPrompt: systemPrompt.substring(0, 500) + '...',
        userPrompt: userPrompt.substring(0, 500) + '...',
        config,
        fullLength: {
          system: systemPrompt.length,
          user: userPrompt.length
        }
      },
      message: 'Test du prompt généré avec succès'
    });

  } catch (error) {
    console.error('Erreur test prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test du prompt'
    });
  }
});

export default router;