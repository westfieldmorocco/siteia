/**
 * Routes de gestion des contrats
 * CRUD des contrats uploadés par les utilisateurs
 */

import express from 'express';
import contractService from '../services/contractService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/contracts
 * Liste des contrats de l'utilisateur connecté
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, includeAnalysis = false } = req.query;

    const result = await contractService.getUserContracts(req.userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      includeAnalysis: includeAnalysis === 'true'
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erreur get contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des contrats'
    });
  }
});

/**
 * GET /api/contracts/:id
 * Détails d'un contrat spécifique
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await contractService.getContract(id, req.userId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contrat non trouvé'
      });
    }

    res.json({
      success: true,
      data: contract
    });

  } catch (error) {
    console.error('Erreur get contract:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du contrat'
    });
  }
});

/**
 * GET /api/contracts/:id/download
 * Téléchargement d'un fichier contrat
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const fileData = await contractService.downloadContract(id, req.userId);

    res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
    res.setHeader('Content-Type', fileData.mimetype);
    res.send(fileData.buffer);

  } catch (error) {
    console.error('Erreur download contract:', error);
    res.status(404).json({
      success: false,
      error: 'Fichier non trouvé'
    });
  }
});

/**
 * DELETE /api/contracts/:id
 * Suppression d'un contrat
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await contractService.deleteContract(id, req.userId);

    res.json({
      success: true,
      message: 'Contrat supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur delete contract:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du contrat'
    });
  }
});

/**
 * GET /api/contracts/admin/all
 * Liste de tous les contrats (admin seulement)
 */
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await contractService.getAllContracts({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erreur admin get all contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des contrats'
    });
  }
});

/**
 * GET /api/contracts/admin/stats
 * Statistiques des contrats (admin seulement)
 */
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await contractService.getContractsStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erreur admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

export default router;