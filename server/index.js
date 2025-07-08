import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { extractTextFromFile } from './services/textExtractor.js';
import { analyzeContract } from './services/contractAnalyzer.js';
import promptRoutes from './routes/promptRoutes.js';
import authRoutes from './routes/authRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import ragService from './services/ragService.js';
import { authenticateToken, optionalAuth, requireAdmin } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://contract-analyzer-frontend.vercel.app', 'https://contract-analyzer-frontend-git-main-your-username.vercel.app']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API Contract Analyzer fonctionne!',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Routes pour la gestion des prompts
app.use('/api/prompt', promptRoutes);

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes de gestion des contrats
app.use('/api/contracts', contractRoutes);

// Configuration multer pour l'upload de fichiers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez PDF, DOC, DOCX ou TXT.'));
    }
  }
});

// Route d'analyse de contrat
app.post('/api/analyze-contract', optionalAuth, upload.single('contract'), async (req, res) => {
  console.log('=== NOUVELLE DEMANDE D\'ANALYSE ===');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
    }

    console.log('Fichier reçu:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Extraction du texte
    console.log('Début extraction du texte...');
    const contractText = await extractTextFromFile(req.file);
    console.log('Extraction du texte terminée, longueur:', contractText.length);

    // Analyse avec OpenAI
    const analysis = await analyzeContract(contractText, req.file, req.userId);
    
    console.log('=== ANALYSE TERMINÉE AVEC SUCCÈS ===');
    
    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('=== ERREUR LORS DE L\'ANALYSE ===');
    console.error('Type d\'erreur:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    // Gestion spécifique des erreurs
    if (error.message.includes('Type de fichier non supporté')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('API key')) {
      return res.status(500).json({
        success: false,
        error: 'Erreur de configuration du service d\'analyse'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse du contrat: ' + error.message
    });
  }
});

// Route pour les statistiques RAG (admin)
app.get('/api/rag/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await ragService.getVectorStoreStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur stats RAG:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques RAG'
    });
  }
});

// Route pour tester la recherche RAG (admin)
app.post('/api/rag/search', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Requête de recherche manquante'
      });
    }
    
    const results = await ragService.searchSimilarDocuments(query, options);
    
    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Erreur recherche RAG:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche RAG'
    });
  }
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Fichier trop volumineux (max 10MB)'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📝 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

export default app;