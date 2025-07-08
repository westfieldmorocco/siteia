import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analyzeContract } from './services/contractAnalyzer.js';
import { extractTextFromFile } from './services/textExtractor.js';
import promptRoutes from './routes/promptRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de requêtes, veuillez réessayer plus tard.'
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/', limiter);

app.use('/api/prompt', promptRoutes);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Fichier non supporté. PDF, DOC, DOCX uniquement.'));
  }
});

// ?? Endpoint d'analyse de contrat
app.post('/api/analyze-contract', upload.single('contract'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni', success: false });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Clé API manquante', success: false });
    }

    const extractedText = await extractTextFromFile(req.file); // Utilise bien req.file.buffer
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Texte vide ou corrompu', success: false });
    }

    const analysis = await analyzeContract(extractedText);
    if (!analysis) {
      return res.status(500).json({ error: 'Analyse échouée', success: false });
    }

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      analysis,
      timestamp: new Date().toISOString(),
      promptVersion: analysis.promptVersion || 'custom'
    });

  } catch (error) {
    console.error('Erreur analyse:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    promptSystem: 'active'
  });
});

// Test OpenAI
app.get('/api/test-openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: 'Clé API OpenAI non configurée', configured: false });

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "Réponds 'OK'." }],
      max_tokens: 10
    });

    res.json({
      status: 'OpenAI connecté',
      configured: true,
      response: completion.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur OpenAI', details: error.message });
  }
});

// Gestion des erreurs
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux. Max 10MB', success: false });
    }
  }
  res.status(500).json({ error: error.message || 'Erreur serveur', success: false });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée', success: false });
});

// ?? Démarrage serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`? Serveur lancé sur http://localhost:${PORT}`);
});
