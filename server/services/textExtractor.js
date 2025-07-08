/**
 * Split text into chunks for processing
 */
export function chunkText(text, maxChunkSize = 6000) {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  // Découpage plus intelligent par paragraphes puis par phrases
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + trimmedParagraph;
    
    if (potentialChunk.length <= maxChunkSize) {
      currentChunk = potentialChunk;
    } else {
      // Si le chunk actuel n'est pas vide, on le sauvegarde
      if (currentChunk.trim()) {
        chunks.push(currentChunk);
      }
      
      // Si le paragraphe seul est trop long, on le découpe par phrases
      if (trimmedParagraph.length > maxChunkSize) {
        const sentences = trimmedParagraph.split(/[.!?]+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;
          
          const potentialSentenceChunk = sentenceChunk + (sentenceChunk ? '. ' : '') + trimmedSentence;
          
          if (potentialSentenceChunk.length <= maxChunkSize) {
            sentenceChunk = potentialSentenceChunk;
          } else {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk);
            }
            sentenceChunk = trimmedSentence;
          }
        }
        
        currentChunk = sentenceChunk;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  // Limite le nombre de chunks pour éviter trop d'appels API
  const maxChunks = 3;
  if (chunks.length > maxChunks) {
    console.log(`Limitation du nombre de chunks de ${chunks.length} à ${maxChunks}`);
    return chunks.slice(0, maxChunks);
  }

  return chunks;
}