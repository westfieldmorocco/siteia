/**
 * Service de gestion des contrats
 * Sauvegarde, récupération et gestion des contrats uploadés
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';

class ContractService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadsDir();
  }

  /**
   * Assure que le dossier uploads existe
   */
  async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log('Dossier uploads créé:', this.uploadsDir);
    }
  }

  /**
   * Sauvegarde un contrat uploadé
   */
  async saveContract(userId, file, analysisResults = null) {
    try {
      // Génération d'un nom de fichier unique
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadsDir, uniqueFilename);

      // Sauvegarde physique du fichier
      await fs.writeFile(filePath, file.buffer);

      // Insertion en base de données
      const { data: contract, error } = await supabaseAdmin
        .from('contracts')
        .insert({
          user_id: userId,
          filename: uniqueFilename,
          original_filename: file.originalname,
          file_size: file.size,
          file_type: file.mimetype,
          file_path: filePath,
          contract_type: analysisResults?.contractType || null,
          analysis_completed: !!analysisResults
        })
        .select()
        .single();

      if (error) {
        // Nettoyage du fichier en cas d'erreur DB
        await fs.unlink(filePath).catch(console.error);
        throw error;
      }

      // Sauvegarde des résultats d'analyse si fournis
      if (analysisResults) {
        await this.saveAnalysisResults(contract.id, analysisResults);
      }

      console.log('Contrat sauvegardé:', contract.id);
      return contract;

    } catch (error) {
      console.error('Erreur sauvegarde contrat:', error);
      throw new Error('Erreur lors de la sauvegarde du contrat');
    }
  }

  /**
   * Sauvegarde les résultats d'analyse
   */
  async saveAnalysisResults(contractId, analysisResults) {
    try {
      const { data, error } = await supabaseAdmin
        .from('analysis_results')
        .insert({
          contract_id: contractId,
          overall_score: analysisResults.overallScore,
          contract_type: analysisResults.contractType,
          risks: analysisResults.risks || [],
          suggestions: analysisResults.suggestions || [],
          compliance: analysisResults.compliance || [],
          summary: analysisResults.summary,
          key_points: analysisResults.keyPoints || [],
          urgent_actions: analysisResults.urgentActions || []
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur sauvegarde analyse:', error);
        throw error;
      }

      // Mise à jour du statut du contrat
      await supabaseAdmin
        .from('contracts')
        .update({ analysis_completed: true })
        .eq('id', contractId);

      return data;
    } catch (error) {
      console.error('Erreur saveAnalysisResults:', error);
      throw error;
    }
  }

  /**
   * Récupération des contrats d'un utilisateur
   */
  async getUserContracts(userId, options = {}) {
    try {
      const { page = 1, limit = 10, includeAnalysis = false } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('contracts')
        .select(`
          *,
          ${includeAnalysis ? 'analysis_results(*)' : ''}
        `)
        .eq('user_id', userId)
        .order('upload_date', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: contracts, error } = await query;

      if (error) {
        throw error;
      }

      // Comptage total pour la pagination
      const { count, error: countError } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw countError;
      }

      return {
        contracts,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      console.error('Erreur getUserContracts:', error);
      throw error;
    }
  }

  /**
   * Récupération d'un contrat spécifique
   */
  async getContract(contractId, userId = null) {
    try {
      let query = supabaseAdmin
        .from('contracts')
        .select(`
          *,
          analysis_results(*),
          users(email, full_name, company)
        `)
        .eq('id', contractId);

      // Filtrage par utilisateur si spécifié (sécurité)
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: contract, error } = await query.single();

      if (error) {
        throw error;
      }

      return contract;
    } catch (error) {
      console.error('Erreur getContract:', error);
      throw error;
    }
  }

  /**
   * Téléchargement d'un fichier contrat
   */
  async downloadContract(contractId, userId = null) {
    try {
      const contract = await this.getContract(contractId, userId);
      
      if (!contract) {
        throw new Error('Contrat non trouvé');
      }

      // Vérification que le fichier existe
      await fs.access(contract.file_path);

      const fileBuffer = await fs.readFile(contract.file_path);
      
      return {
        buffer: fileBuffer,
        filename: contract.original_filename,
        mimetype: contract.file_type
      };

    } catch (error) {
      console.error('Erreur downloadContract:', error);
      throw error;
    }
  }

  /**
   * Suppression d'un contrat
   */
  async deleteContract(contractId, userId) {
    try {
      const contract = await this.getContract(contractId, userId);
      
      if (!contract) {
        throw new Error('Contrat non trouvé');
      }

      // Suppression du fichier physique
      await fs.unlink(contract.file_path).catch(console.error);

      // Suppression en base (cascade sur analysis_results)
      const { error } = await supabaseAdmin
        .from('contracts')
        .delete()
        .eq('id', contractId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('Contrat supprimé:', contractId);
      return { success: true };

    } catch (error) {
      console.error('Erreur deleteContract:', error);
      throw error;
    }
  }

  /**
   * Statistiques des contrats (pour admin)
   */
  async getContractsStats() {
    try {
      // Total des contrats
      const { count: totalContracts } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true });

      // Contrats analysés
      const { count: analyzedContracts } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('analysis_completed', true);

      // Contrats par type
      const { data: contractsByType } = await supabaseAdmin
        .from('contracts')
        .select('contract_type')
        .not('contract_type', 'is', null);

      const typeStats = contractsByType.reduce((acc, contract) => {
        acc[contract.contract_type] = (acc[contract.contract_type] || 0) + 1;
        return acc;
      }, {});

      // Contrats récents (7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentContracts } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .gte('upload_date', sevenDaysAgo.toISOString());

      return {
        total: totalContracts || 0,
        analyzed: analyzedContracts || 0,
        recent: recentContracts || 0,
        byType: typeStats
      };

    } catch (error) {
      console.error('Erreur getContractsStats:', error);
      return {
        total: 0,
        analyzed: 0,
        recent: 0,
        byType: {}
      };
    }
  }

  /**
   * Liste tous les contrats (pour admin)
   */
  async getAllContracts(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const { data: contracts, error } = await supabaseAdmin
        .from('contracts')
        .select(`
          *,
          users(email, full_name, company),
          analysis_results(overall_score, contract_type)
        `)
        .order('upload_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      const { count } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true });

      return {
        contracts,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      console.error('Erreur getAllContracts:', error);
      throw error;
    }
  }
}

export default new ContractService();