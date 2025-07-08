#!/usr/bin/env python3
"""
Script d'embedding automatique des documents
Analyse le dossier /data/contracts_laws/ et embed les nouveaux fichiers
"""

import os
import sys
import hashlib
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional
import argparse
from datetime import datetime

# Imports pour le traitement des documents
import openai
from supabase import create_client, Client
import PyPDF2
from docx import Document
import tiktoken

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('embedding.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class DocumentEmbedder:
    def __init__(self):
        """Initialise le service d'embedding"""
        self.load_config()
        self.setup_clients()
        self.encoding = tiktoken.get_encoding("cl100k_base")
        
    def load_config(self):
        """Charge la configuration depuis les variables d'environnement"""
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            logger.warning("python-dotenv non installé, utilisation des variables d'environnement système")
        
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not all([self.openai_api_key, self.supabase_url, self.supabase_service_key]):
            raise ValueError("Variables d'environnement manquantes: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    
    def setup_clients(self):
        """Configure les clients OpenAI et Supabase"""
        openai.api_key = self.openai_api_key
        self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)
        logger.info("Clients OpenAI et Supabase configurés")
    
    def calculate_file_hash(self, file_path: Path) -> str:
        """Calcule le hash SHA256 d'un fichier"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def is_file_already_embedded(self, file_hash: str) -> bool:
        """Vérifie si un fichier a déjà été embedé"""
        try:
            result = self.supabase.table('document_embeddings').select('id').eq('file_hash', file_hash).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Erreur vérification hash: {e}")
            return False
    
    def extract_text_from_pdf(self, file_path: Path) -> str:
        """Extrait le texte d'un fichier PDF"""
        try:
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Erreur extraction PDF {file_path}: {e}")
            return ""
    
    def extract_text_from_docx(self, file_path: Path) -> str:
        """Extrait le texte d'un fichier DOCX"""
        try:
            doc = Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Erreur extraction DOCX {file_path}: {e}")
            return ""
    
    def extract_text_from_txt(self, file_path: Path) -> str:
        """Extrait le texte d'un fichier TXT"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read().strip()
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as file:
                    return file.read().strip()
            except Exception as e:
                logger.error(f"Erreur extraction TXT {file_path}: {e}")
                return ""
        except Exception as e:
            logger.error(f"Erreur extraction TXT {file_path}: {e}")
            return ""
    
    def extract_text_from_file(self, file_path: Path) -> str:
        """Extrait le texte selon le type de fichier"""
        extension = file_path.suffix.lower()
        
        if extension == '.pdf':
            return self.extract_text_from_pdf(file_path)
        elif extension == '.docx':
            return self.extract_text_from_docx(file_path)
        elif extension in ['.txt', '.md']:
            return self.extract_text_from_txt(file_path)
        else:
            logger.warning(f"Type de fichier non supporté: {extension}")
            return ""
    
    def chunk_text(self, text: str, max_tokens: int = 1000, overlap: int = 100) -> List[str]:
        """Découpe le texte en chunks avec chevauchement"""
        if not text.strip():
            return []
        
        tokens = self.encoding.encode(text)
        chunks = []
        
        start = 0
        while start < len(tokens):
            end = min(start + max_tokens, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = self.encoding.decode(chunk_tokens)
            chunks.append(chunk_text)
            
            if end >= len(tokens):
                break
            
            start = end - overlap
        
        return chunks
    
    def generate_embedding(self, text: str) -> List[float]:
        """Génère un embedding pour un texte"""
        try:
            response = openai.embeddings.create(
                model="text-embedding-3-small",
                input=text[:8000]  # Limite de tokens
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Erreur génération embedding: {e}")
            raise
    
    def determine_document_type(self, file_path: Path) -> str:
        """Détermine le type de document basé sur le chemin"""
        path_str = str(file_path).lower()
        
        if 'contrat' in path_str or 'contract' in path_str or 'template' in path_str:
            return 'contract_template'
        elif 'loi' in path_str or 'law' in path_str or 'code' in path_str:
            return 'law'
        elif 'reglement' in path_str or 'regulation' in path_str or 'decret' in path_str:
            return 'regulation'
        else:
            return 'contract_template'  # Par défaut
    
    def extract_title_from_content(self, content: str, filename: str) -> str:
        """Extrait un titre du contenu ou utilise le nom de fichier"""
        lines = content.split('\n')[:10]  # Premières lignes
        
        for line in lines:
            line = line.strip()
            if len(line) > 10 and len(line) < 200:
                # Probable titre
                return line
        
        # Fallback sur le nom de fichier
        return filename.replace('_', ' ').replace('-', ' ').title()
    
    def save_embeddings(self, file_path: Path, file_hash: str, chunks: List[str], 
                       document_type: str, title: str) -> int:
        """Sauvegarde les embeddings en base"""
        saved_count = 0
        
        for i, chunk in enumerate(chunks):
            try:
                # Génération de l'embedding
                embedding = self.generate_embedding(chunk)
                
                # Préparation des métadonnées
                metadata = {
                    'file_path': str(file_path),
                    'chunk_size': len(chunk),
                    'total_chunks': len(chunks),
                    'processed_at': datetime.now().isoformat()
                }
                
                # Insertion en base
                data = {
                    'filename': file_path.name,
                    'file_hash': file_hash,
                    'document_type': document_type,
                    'title': title if i == 0 else f"{title} (partie {i+1})",
                    'content': chunk,
                    'chunk_index': i,
                    'embedding': embedding,
                    'metadata': metadata
                }
                
                result = self.supabase.table('document_embeddings').insert(data).execute()
                
                if result.data:
                    saved_count += 1
                    logger.debug(f"Chunk {i+1}/{len(chunks)} sauvegardé pour {file_path.name}")
                else:
                    logger.error(f"Échec sauvegarde chunk {i+1} pour {file_path.name}")
                    
            except Exception as e:
                logger.error(f"Erreur sauvegarde chunk {i+1} de {file_path.name}: {e}")
        
        return saved_count
    
    def process_file(self, file_path: Path) -> bool:
        """Traite un fichier complet"""
        try:
            logger.info(f"Traitement de {file_path}")
            
            # Calcul du hash
            file_hash = self.calculate_file_hash(file_path)
            
            # Vérification si déjà traité
            if self.is_file_already_embedded(file_hash):
                logger.info(f"Fichier déjà embedé: {file_path.name}")
                return True
            
            # Extraction du texte
            text = self.extract_text_from_file(file_path)
            if not text:
                logger.warning(f"Aucun texte extrait de {file_path}")
                return False
            
            logger.info(f"Texte extrait: {len(text)} caractères")
            
            # Découpage en chunks
            chunks = self.chunk_text(text)
            if not chunks:
                logger.warning(f"Aucun chunk généré pour {file_path}")
                return False
            
            logger.info(f"Généré {len(chunks)} chunks")
            
            # Détermination du type et titre
            document_type = self.determine_document_type(file_path)
            title = self.extract_title_from_content(text, file_path.stem)
            
            # Sauvegarde des embeddings
            saved_count = self.save_embeddings(file_path, file_hash, chunks, document_type, title)
            
            if saved_count > 0:
                logger.info(f"✅ {file_path.name}: {saved_count}/{len(chunks)} chunks sauvegardés")
                return True
            else:
                logger.error(f"❌ Aucun chunk sauvegardé pour {file_path.name}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur traitement {file_path}: {e}")
            return False
    
    def scan_directory(self, directory: Path) -> List[Path]:
        """Scanne un répertoire pour les fichiers supportés"""
        supported_extensions = {'.pdf', '.docx', '.txt', '.md'}
        files = []
        
        for file_path in directory.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
                files.append(file_path)
        
        return sorted(files)
    
    def process_directory(self, directory_path: str) -> Dict[str, int]:
        """Traite tous les fichiers d'un répertoire"""
        directory = Path(directory_path)
        
        if not directory.exists():
            raise FileNotFoundError(f"Répertoire non trouvé: {directory_path}")
        
        logger.info(f"Scan du répertoire: {directory}")
        files = self.scan_directory(directory)
        
        if not files:
            logger.warning(f"Aucun fichier supporté trouvé dans {directory}")
            return {'processed': 0, 'success': 0, 'errors': 0, 'skipped': 0}
        
        logger.info(f"Trouvé {len(files)} fichiers à traiter")
        
        stats = {'processed': 0, 'success': 0, 'errors': 0, 'skipped': 0}
        
        for file_path in files:
            stats['processed'] += 1
            
            try:
                # Vérification rapide si déjà traité
                file_hash = self.calculate_file_hash(file_path)
                if self.is_file_already_embedded(file_hash):
                    stats['skipped'] += 1
                    continue
                
                success = self.process_file(file_path)
                if success:
                    stats['success'] += 1
                else:
                    stats['errors'] += 1
                    
            except Exception as e:
                logger.error(f"Erreur traitement {file_path}: {e}")
                stats['errors'] += 1
        
        return stats
    
    def get_embedding_stats(self) -> Dict:
        """Récupère les statistiques des embeddings"""
        try:
            # Total des documents
            total_result = self.supabase.table('document_embeddings').select('id', count='exact').execute()
            total_count = total_result.count
            
            # Par type de document
            type_result = self.supabase.table('document_embeddings').select('document_type').execute()
            type_stats = {}
            for row in type_result.data:
                doc_type = row['document_type']
                type_stats[doc_type] = type_stats.get(doc_type, 0) + 1
            
            return {
                'total_embeddings': total_count,
                'by_type': type_stats,
                'last_updated': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Erreur récupération stats: {e}")
            return {}

def main():
    """Fonction principale"""
    parser = argparse.ArgumentParser(description='Embedding automatique des documents')
    parser.add_argument('--directory', '-d', default='./data/contracts_laws',
                       help='Répertoire à scanner (défaut: ./data/contracts_laws)')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Afficher uniquement les statistiques')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Mode verbose')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        embedder = DocumentEmbedder()
        
        if args.stats:
            # Affichage des statistiques uniquement
            stats = embedder.get_embedding_stats()
            print("\n=== STATISTIQUES EMBEDDINGS ===")
            print(f"Total embeddings: {stats.get('total_embeddings', 0)}")
            print("Par type de document:")
            for doc_type, count in stats.get('by_type', {}).items():
                print(f"  - {doc_type}: {count}")
            print(f"Dernière mise à jour: {stats.get('last_updated', 'N/A')}")
            return
        
        # Traitement des fichiers
        logger.info("=== DÉBUT EMBEDDING DOCUMENTS ===")
        stats = embedder.process_directory(args.directory)
        
        logger.info("=== RÉSULTATS ===")
        logger.info(f"Fichiers traités: {stats['processed']}")
        logger.info(f"Succès: {stats['success']}")
        logger.info(f"Erreurs: {stats['errors']}")
        logger.info(f"Ignorés (déjà traités): {stats['skipped']}")
        
        # Statistiques finales
        final_stats = embedder.get_embedding_stats()
        logger.info(f"Total embeddings en base: {final_stats.get('total_embeddings', 0)}")
        
        if stats['errors'] > 0:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Erreur fatale: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()