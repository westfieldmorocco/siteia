# AI LOVE CONTRACTS - Analyse de Contrats Juridiques Marocains

## 🚀 Nouvelles Fonctionnalités Ajoutées

### ✅ RAG (Retrieval-Augmented Generation)
- **Base vectorielle** : Stockage des documents juridiques marocains dans Supabase
- **Recherche sémantique** : Récupération automatique de documents pertinents
- **Enrichissement des prompts** : Contexte juridique ajouté automatiquement aux analyses

### ✅ Authentification Utilisateurs
- **Inscription/Connexion** : Système complet avec email/mot de passe
- **Gestion des sessions** : Tokens JWT avec persistance localStorage
- **Profils utilisateurs** : Nom, entreprise, rôle (user/admin)

### ✅ Sauvegarde des Contrats
- **Stockage automatique** : Tous les contrats analysés sont sauvegardés
- **Historique utilisateur** : Chaque utilisateur peut voir ses analyses
- **Résultats persistants** : Scores, risques, suggestions conservés

### ✅ Interface Admin
- **Statistiques globales** : Vue d'ensemble des contrats et utilisateurs
- **Gestion des documents** : Téléchargement et consultation
- **Monitoring RAG** : Statistiques de la base vectorielle

## 🛠️ Installation et Configuration

### 1. Prérequis
```bash
# Node.js 18+ et npm
node --version
npm --version

# Python 3.8+ pour le script d'embedding
python --version
pip --version
```

### 2. Configuration Supabase

1. **Créer un projet Supabase** sur [supabase.com](https://supabase.com)

2. **Activer l'extension pgvector** :
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Exécuter les migrations** :
   - Copier le contenu de `supabase/migrations/001_initial_schema.sql`
   - L'exécuter dans l'éditeur SQL de Supabase

4. **Récupérer les clés** :
   - URL du projet
   - Clé anonyme (anon key)
   - Clé service role

### 3. Configuration des Variables d'Environnement

Copier `.env.example` vers `.env` et remplir :

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT Secret (générer une clé aléatoire)
JWT_SECRET=votre_secret_jwt_tres_long_et_aleatoire

# Server
PORT=3001
```

### 4. Installation des Dépendances

```bash
# Backend
npm install

# Script d'embedding Python
cd scripts
pip install -r requirements.txt
cd ..
```

### 5. Préparation des Documents pour le RAG

1. **Créer le dossier de données** :
   ```bash
   mkdir -p data/contracts_laws
   ```

2. **Organiser vos documents** :
   ```
   data/contracts_laws/
   ├── contrats/
   │   ├── contrat_travail_type.pdf
   │   ├── contrat_commercial_modele.docx
   │   └── ...
   ├── lois/
   │   ├── code_obligations_contrats.pdf
   │   ├── code_travail_maroc.pdf
   │   └── ...
   └── reglements/
       ├── decret_xyz.pdf
       └── ...
   ```

3. **Lancer l'embedding initial** :
   ```bash
   cd scripts
   python embed_documents.py --directory ../data/contracts_laws --verbose
   ```

## 🚀 Démarrage

### Mode Développement

```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run dev
```

### Mode Production

```bash
# Build du frontend
npm run build

# Démarrage du serveur
npm run server
```

## 📊 Utilisation

### Pour les Utilisateurs

1. **Créer un compte** via le bouton "Connexion"
2. **Uploader un contrat** (PDF, DOC, DOCX)
3. **Recevoir l'analyse enrichie** avec le contexte RAG
4. **Consulter l'historique** de ses analyses

### Pour les Administrateurs

1. **Se connecter** avec un compte admin
2. **Accéder aux statistiques** via `/api/contracts/admin/stats`
3. **Voir tous les contrats** via `/api/contracts/admin/all`
4. **Monitorer le RAG** via `/api/rag/stats`

## 🔧 Gestion des Documents RAG

### Script d'Embedding

```bash
# Embedding de nouveaux documents
python scripts/embed_documents.py --directory ./data/contracts_laws

# Affichage des statistiques
python scripts/embed_documents.py --stats

# Mode verbose pour debug
python scripts/embed_documents.py --verbose
```

### API de Gestion RAG

```bash
# Statistiques de la base vectorielle (admin)
GET /api/rag/stats

# Test de recherche (admin)
POST /api/rag/search
{
  "query": "clause de résiliation",
  "options": {
    "matchThreshold": 0.7,
    "matchCount": 5
  }
}
```

## 🗂️ Structure du Projet

```
├── server/
│   ├── config/
│   │   └── supabase.js          # Configuration Supabase
│   ├── middleware/
│   │   └── auth.js              # Middleware d'authentification
│   ├── routes/
│   │   ├── authRoutes.js        # Routes auth (login/register)
│   │   ├── contractRoutes.js    # Routes contrats
│   │   └── promptRoutes.js      # Routes prompts (existant)
│   ├── services/
│   │   ├── authService.js       # Service authentification
│   │   ├── contractService.js   # Service gestion contrats
│   │   ├── ragService.js        # Service RAG
│   │   └── contractAnalyzer.js  # Analyseur (modifié)
│   └── index.js                 # Serveur principal (modifié)
├── scripts/
│   ├── embed_documents.py       # Script d'embedding
│   └── requirements.txt         # Dépendances Python
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx      # Context React auth
│   ├── components/
│   │   ├── auth/                # Composants authentification
│   │   └── ...                  # Composants existants
│   └── ...
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── data/
    └── contracts_laws/          # Documents à embedder
```

## 🔐 Sécurité

- **Authentification JWT** avec expiration 7 jours
- **Row Level Security (RLS)** activé sur toutes les tables
- **Validation des entrées** côté serveur
- **Hashage bcrypt** des mots de passe (12 rounds)
- **Isolation des données** par utilisateur

## 📈 Monitoring et Logs

### Logs du Serveur
```bash
# Logs en temps réel
tail -f server.log
```

### Logs d'Embedding
```bash
# Logs du script Python
tail -f scripts/embedding.log
```

### Métriques Disponibles
- Nombre total de contrats analysés
- Contrats par utilisateur
- Performance de la base vectorielle
- Erreurs d'analyse

## 🆘 Dépannage

### Problèmes Courants

1. **Erreur "Variables d'environnement manquantes"**
   - Vérifier que `.env` est bien configuré
   - Redémarrer le serveur après modification

2. **Erreur d'embedding Python**
   - Vérifier l'installation des dépendances : `pip install -r requirements.txt`
   - Vérifier la clé OpenAI dans `.env`

3. **Erreur de connexion Supabase**
   - Vérifier les URLs et clés dans `.env`
   - Vérifier que les migrations sont appliquées

4. **Problème d'authentification**
   - Vérifier le JWT_SECRET dans `.env`
   - Vider le localStorage du navigateur

### Commandes de Debug

```bash
# Test de la connexion Supabase
node -e "
import('./server/config/supabase.js').then(({supabase}) => {
  supabase.from('users').select('count').then(console.log);
});
"

# Test de l'API OpenAI
python -c "
import openai
import os
from dotenv import load_dotenv
load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')
print('OpenAI OK')
"
```

## 🔄 Maintenance

### Sauvegarde Régulière
- **Base de données** : Sauvegarde automatique Supabase
- **Fichiers uploadés** : Dossier `uploads/` à sauvegarder
- **Documents RAG** : Dossier `data/` à versionner

### Mise à Jour des Documents RAG
```bash
# Ajout de nouveaux documents
cp nouveaux_documents/* data/contracts_laws/
python scripts/embed_documents.py --directory ./data/contracts_laws
```

### Nettoyage Périodique
```bash
# Suppression des anciens logs (optionnel)
find . -name "*.log" -mtime +30 -delete
```

## 📞 Support

Pour toute question ou problème :
1. Vérifier cette documentation
2. Consulter les logs d'erreur
3. Tester les endpoints API individuellement
4. Vérifier la configuration Supabase

---

**Note** : Cette version conserve intégralement le système d'analyse existant tout en ajoutant les nouvelles fonctionnalités demandées. Le RAG enrichit automatiquement les analyses sans modifier le comportement de base.