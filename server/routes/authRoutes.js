/**
 * Routes d'authentification
 * Register, login, profile, etc.
 */

import express from 'express';
import authService from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, company } = req.body;

    const result = await authService.register({
      email,
      password,
      fullName,
      company
    });

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: result
    });

  } catch (error) {
    console.error('Erreur register:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: result
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/profile
 * Récupération du profil utilisateur
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Erreur profile:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du profil'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Mise à jour du profil utilisateur
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, company } = req.body;

    const updatedUser = await authService.updateProfile(req.userId, {
      fullName,
      company
    });

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Erreur update profile:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/change-password
 * Changement de mot de passe
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur change password:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Vérification de la validité d'un token
 */
router.post('/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token valide',
    data: {
      user: req.user
    }
  });
});

export default router;