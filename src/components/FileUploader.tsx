import React, { useState, useRef, useCallback } from 'react';
import { Upload, File, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  file?: File;
  analysisId?: string;
  error?: string;
}

const FileUploader: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isValidFileType = (file: File): boolean => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    return validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');
  };

  const analyzeContract = async (file: UploadedFile, index: number) => {
    try {
      // Update status to analyzing
      setUploadedFiles(prev => 
        prev.map((f, i) => 
          i === index ? { ...f, status: 'analyzing', progress: 50 } : f
        )
      );

      const formData = new FormData();
      formData.append('contract', file.file!);

      // Ajout du token d'authentification si disponible
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Sending request to /api/analyze-contract');

      const response = await fetch('/api/analyze-contract', {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Check if response is ok
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Try to get error message from response
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const textError = await response.text();
            errorMessage = textError || errorMessage;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        throw new Error('Réponse vide du serveur');
      }

      // Try to parse JSON response
      let result;
      try {
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        if (!responseText.trim()) {
          throw new Error('Réponse vide du serveur');
        }
        
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Réponse invalide du serveur. Veuillez réessayer.');
      }

      // Validate response structure
      if (!result || !result.analysis) {
        throw new Error('Format de réponse invalide');
      }
      
      // Generate analysis ID for navigation
      const analysisId = Date.now().toString();
      
      // Store analysis results in sessionStorage
      sessionStorage.setItem(`analysis_${analysisId}`, JSON.stringify({
        fileName: result.fileName,
        fileSize: result.fileSize,
        analysis: result.analysis,
        timestamp: new Date().toISOString()
      }));

      // Update file status
      setUploadedFiles(prev => 
        prev.map((f, i) => 
          i === index ? { 
            ...f, 
            status: 'completed', 
            progress: 100, 
            analysisId 
          } : f
        )
      );

    } catch (error) {
      console.error('Analysis error:', error);
      
      let errorMessage = 'Erreur inconnue';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setUploadedFiles(prev => 
        prev.map((f, i) => 
          i === index ? { 
            ...f, 
            status: 'error', 
            progress: 0,
            error: errorMessage
          } : f
        )
      );
    }
  };

  const simulateUpload = (file: UploadedFile, index: number) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Start analysis after upload simulation
        setTimeout(() => {
          analyzeContract(file, index);
        }, 500);
      }
      
      setUploadedFiles(prev => 
        prev.map((f, i) => 
          i === index ? { ...f, progress: Math.min(progress, 100) } : f
        )
      );
    }, 200);
  };

  const handleFiles = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter(isValidFileType);
    const invalidFiles = Array.from(files).filter(file => !isValidFileType(file));

    if (invalidFiles.length > 0) {
      alert(`Fichiers non supportés: ${invalidFiles.map(f => f.name).join(', ')}\nUtilisez uniquement PDF, DOC ou DOCX.`);
    }

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'uploading' as const,
      file: file
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Start upload simulation for each file
    newFiles.forEach((file, index) => {
      simulateUpload(file, uploadedFiles.length + index);
    });
  }, [uploadedFiles.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const viewResults = (analysisId: string) => {
    navigate(`/results/${analysisId}`);
  };

  const retryAnalysis = (index: number) => {
    const file = uploadedFiles[index];
    if (file.file) {
      setUploadedFiles(prev => 
        prev.map((f, i) => 
          i === index ? { ...f, status: 'uploading', progress: 0, error: undefined } : f
        )
      );
      simulateUpload(file, index);
    }
  };

  return (
    <section id="upload-section" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Téléchargez votre contrat
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Glissez-déposez votre fichier ou cliquez pour le sélectionner. 
            Notre IA analysera votre contrat selon le droit marocain.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 scale-105'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="space-y-6">
            <div className="mx-auto w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Upload className="h-12 w-12 text-white" />
            </div>

            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                Glissez vos fichiers ici
              </h3>
              <p className="text-gray-600 mb-6">
                ou cliquez pour parcourir vos fichiers
              </p>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Choisir un fichier
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Formats supportés : PDF, DOC, DOCX • Taille max : 10MB
            </p>
          </div>
        </div>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Fichiers en cours d'analyse</h3>
            {uploadedFiles.map((file, index) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <File className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {file.status === 'uploading' && (
                      <div className="flex items-center space-x-2">
                        <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                        <span className="text-sm text-blue-600">Téléchargement...</span>
                      </div>
                    )}
                    {file.status === 'analyzing' && (
                      <div className="flex items-center space-x-2">
                        <Loader className="h-5 w-5 text-purple-600 animate-spin" />
                        <span className="text-sm text-purple-600">Analyse en cours...</span>
                      </div>
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {file.status === 'error' && (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      file.status === 'analyzing' 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600'
                    }`}
                    style={{ width: `${file.progress}%` }}
                  ></div>
                </div>

                {/* Status Messages */}
                {file.status === 'completed' && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-800 font-medium">Analyse terminée</span>
                      </div>
                      <button 
                        onClick={() => viewResults(file.analysisId!)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm font-medium"
                      >
                        Voir les résultats
                      </button>
                    </div>
                  </div>
                )}

                {file.status === 'error' && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                          <span className="text-red-800 font-medium">Erreur d'analyse</span>
                          {file.error && (
                            <p className="text-sm text-red-600 mt-1">{file.error}</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => retryAnalysis(index)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm font-medium"
                      >
                        Réessayer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FileUploader;