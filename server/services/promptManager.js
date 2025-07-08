/**
 * Gestionnaire de prompts personnalisés
 * Permet de charger, modifier et versionner les prompts d'analyse
 */

import LEGAL_ANALYSIS_PROMPT from '../prompts/legal-analysis-prompt.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptManager {
  constructor() {
    this.currentPrompt = LEGAL_ANALYSIS_PROMPT;
    this.promptHistory = [];
  }

  /**
   * Obtient le prompt système actuel
   */
  getSystemPrompt() {
    return this.currentPrompt.systemPrompt;
  }

  /**
   * Génère le prompt utilisateur avec le template
   */
  generateUserPrompt(contractText, isFirstChunk = false, contractContext = '') {
    return this.currentPrompt.userPromptTemplate(contractText, isFirstChunk, contractContext);
  }

  /**
   * Obtient la configuration OpenAI
   */
  getOpenAIConfig() {
    return this.currentPrompt.openaiConfig;
  }

  /**
   * Obtient les vérifications spécifiques par type de contrat
   */
  getContractTypeChecks(contractType) {
    return this.currentPrompt.contractTypes[contractType] || null;
  }

  /**
   * Met à jour le prompt (pour modifications futures)
   */
  async updatePrompt(newPromptData) {
    try {
      // Sauvegarde de l'ancien prompt
      this.promptHistory.push({
        ...this.currentPrompt,
        archivedAt: new Date().toISOString()
      });

      // Mise à jour
      this.currentPrompt = {
        ...this.currentPrompt,
        ...newPromptData,
        version: this.incrementVersion(this.currentPrompt.version),
        lastModified: new Date().toISOString()
      };

      // Sauvegarde sur disque (optionnel)
      await this.savePromptToDisk();

      console.log(`Prompt mis à jour vers la version ${this.currentPrompt.version}`);
      return this.currentPrompt;

    } catch (error) {
      console.error('Erreur lors de la mise à jour du prompt:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde le prompt actuel sur disque
   */
  async savePromptToDisk() {
    try {
      const promptPath = path.join(__dirname, '../prompts/legal-analysis-prompt.js');
      const promptContent = `/**
 * Prompt personnalisé pour l'analyse juridique de contrats marocains
 * Version: ${this.currentPrompt.version}
 * Dernière modification: ${this.currentPrompt.lastModified}
 */

export const LEGAL_ANALYSIS_PROMPT = ${JSON.stringify(this.currentPrompt, null, 2)};

export default LEGAL_ANALYSIS_PROMPT;`;

      await fs.writeFile(promptPath, promptContent, 'utf8');
      console.log('Prompt sauvegardé sur disque');

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  }

  /**
   * Incrémente la version (format semver simple)
   */
  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Obtient l'historique des versions
   */
  getPromptHistory() {
    return this.promptHistory;
  }

  /**
   * Restaure une version précédente
   */
  restoreVersion(version) {
    const historicalPrompt = this.promptHistory.find(p => p.version === version);
    if (historicalPrompt) {
      this.currentPrompt = { ...historicalPrompt };
      delete this.currentPrompt.archivedAt;
      console.log(`Prompt restauré à la version ${version}`);
      return this.currentPrompt;
    }
    throw new Error(`Version ${version} non trouvée dans l'historique`);
  }

  /**
   * Valide la structure du prompt
   */
  validatePrompt(promptData) {
    const requiredFields = ['systemPrompt', 'userPromptTemplate', 'openaiConfig'];
    const missingFields = requiredFields.filter(field => !promptData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Champs manquants dans le prompt: ${missingFields.join(', ')}`);
    }

    return true;
  }

  /**
   * Obtient les statistiques d'utilisation du prompt
   */
  getPromptStats() {
    return {
      currentVersion: this.currentPrompt.version,
      lastModified: this.currentPrompt.lastModified,
      historyCount: this.promptHistory.length,
      contractTypesSupported: Object.keys(this.currentPrompt.contractTypes).length
    };
  }
}

// Instance singleton
const promptManager = new PromptManager();

export default promptManager;