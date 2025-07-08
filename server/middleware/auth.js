/**
 * Middleware d'authentification
 * Vérification des tokens JWT et protection des routes
 */

import authService from '../services/authService.js';

/**
 * Middleware pour vérifier l'authentification
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    // Vérification du token
    const decoded = authService.verifyToken(token);
    
    // Récupération des informations utilisateur
    const user = await authService.getUserById(decoded.userId);
    
    // Ajout des informations utilisateur à la requête
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    return res.status(403).json({
      success: false,
      error: 'Token invalide ou expiré'
    });
  }
};

/**
 * Middleware pour vérifier les droits admin
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Droits administrateur requis'
    });
  }
  next();
};

/**
 * Middleware optionnel d'authentification
 * Continue même si pas de token (pour les routes publiques avec fonctionnalités bonus si connecté)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = authService.verifyToken(token);
      const user = await authService.getUserById(decoded.userId);
      req.user = user;
      req.userId = user.id;
    }
  } catch (error) {
    // Ignore les erreurs d'authentification pour les routes optionnelles
    console.log('Auth optionnelle échouée:', error.message);
  }
  
  next();
};