/**
 * Service d'authentification
 * Gestion des utilisateurs, login, register
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(userData) {
    try {
      const { email, password, fullName, company } = userData;

      // Validation des données
      if (!email || !password) {
        throw new Error('Email et mot de passe requis');
      }

      if (password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      }

      // Vérification si l'utilisateur existe déjà
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('Un compte existe déjà avec cet email');
      }

      // Hashage du mot de passe
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Création de l'utilisateur
      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName || null,
          company: company || null,
          role: 'user'
        })
        .select('id, email, full_name, company, role, created_at')
        .single();

      if (error) {
        console.error('Erreur création utilisateur:', error);
        throw new Error('Erreur lors de la création du compte');
      }

      // Génération du token JWT
      const token = this.generateToken(newUser);

      return {
        user: newUser,
        token
      };

    } catch (error) {
      console.error('Erreur register:', error);
      throw error;
    }
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email et mot de passe requis');
      }

      // Recherche de l'utilisateur
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !user) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Vérification du mot de passe
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Génération du token JWT
      const token = this.generateToken(user);

      // Retour des données utilisateur (sans le hash du mot de passe)
      const { password_hash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };

    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  }

  /**
   * Génération d'un token JWT
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
  }

  /**
   * Vérification d'un token JWT
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Token invalide');
    }
  }

  /**
   * Récupération des informations utilisateur par ID
   */
  async getUserById(userId) {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, company, role, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('Utilisateur non trouvé');
      }

      return user;
    } catch (error) {
      console.error('Erreur getUserById:', error);
      throw error;
    }
  }

  /**
   * Mise à jour du profil utilisateur
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedFields = ['full_name', 'company'];
      const filteredData = {};

      // Filtrage des champs autorisés
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour');
      }

      const { data: updatedUser, error } = await supabaseAdmin
        .from('users')
        .update(filteredData)
        .eq('id', userId)
        .select('id, email, full_name, company, role, created_at, updated_at')
        .single();

      if (error) {
        console.error('Erreur update profile:', error);
        throw new Error('Erreur lors de la mise à jour du profil');
      }

      return updatedUser;
    } catch (error) {
      console.error('Erreur updateProfile:', error);
      throw error;
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        throw new Error('Mot de passe actuel et nouveau mot de passe requis');
      }

      if (newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      }

      // Récupération de l'utilisateur avec le hash du mot de passe
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Vérification du mot de passe actuel
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Mot de passe actuel incorrect');
      }

      // Hashage du nouveau mot de passe
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Mise à jour du mot de passe
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', userId);

      if (updateError) {
        console.error('Erreur update password:', updateError);
        throw new Error('Erreur lors du changement de mot de passe');
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur changePassword:', error);
      throw error;
    }
  }
}

export default new AuthService();