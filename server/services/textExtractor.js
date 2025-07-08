import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let pdfParse;
let mammoth;

async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = require('pdf-parse'); // Import propre, sans test
  }
  return pdfParse;
}

async function getMammoth() {
  if (!mammoth) {
    const mammothModule = await import('mammoth');
    mammoth = mammothModule.default || mammothModule;
  }
  return mammoth;
}

export async function extractTextFromFile(file) {
  console.log('=== DÉBUT EXTRACTION TEXTE ===');
  console.log('Fichier:', {
    name: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });

  try {
    const { buffer, mimetype, originalname } = file;

    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer de fichier vide');
    }

    let extractedText = '';

    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      console.log('?? Extraction PDF via buffer...');
      const pdfParser = await getPdfParse();
      const result = await pdfParser(buffer);
      extractedText = result.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.toLowerCase().endsWith('.docx')
    ) {
      console.log('?? Extraction DOCX...');
      const mammothParser = await getMammoth();
      const result = await mammothParser.extractRawText({ buffer });
      extractedText = result.value;
    } else if (
      mimetype === 'application/msword' ||
      originalname.toLowerCase().endsWith('.doc')
    ) {
      throw new Error('Format .doc non supporté. Veuillez convertir en .docx ou PDF.');
    } else {
      throw new Error(`Type de fichier non supporté: ${mimetype}`);
    }

    const cleanedText = cleanText(extractedText);

    if (!cleanedText || cleanedText.trim().length === 0) {
      throw new Error('Aucun texte extractible trouvé dans le fichier');
    }

    if (cleanedText.length < 50) {
      throw new Error('Le fichier contient très peu de texte ou est corrompu.');
    }

    console.log('? Extraction réussie. Longueur texte :', cleanedText.length);
    return cleanedText;

  } catch (error) {
    console.error('=== ERREUR EXTRACTION ===');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Impossible d'extraire le texte: ${error.message}`);
  }
}

function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function chunkText(text, maxChunkSize = 4000) {
  if (!text || typeof text !== 'string') return [];

  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  const paragraphs = text.split('\n\n');
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/[.!?]+/);
        let sentenceChunk = '';

        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (!trimmed) continue;

          if (sentenceChunk.length + trimmed.length + 2 <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? '. ' : '') + trimmed;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk + '.');
            sentenceChunk = trimmed;
          }
        }

        if (sentenceChunk) currentChunk = sentenceChunk + '.';
        else currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks.filter(chunk => chunk && chunk.trim().length > 0);
}
