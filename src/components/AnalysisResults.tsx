import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Star,
  Clock,
  Shield,
  TrendingUp,
  Eye,
  RefreshCw
} from 'lucide-react';

interface Risk {
  level: 'élevé' | 'moyen' | 'faible';
  title: string;
  description: string;
  recommendation: string;
}

interface Suggestion {
  priority: 'haute' | 'moyenne' | 'basse';
  title: string;
  description: string;
  impact: string;
}

interface Compliance {
  status: 'conforme' | 'non-conforme' | 'à vérifier';
  article: string;
  description: string;
  action: string;
}

interface Analysis {
  contractType: string;
  overallScore: number;
  risks: Risk[];
  suggestions: Suggestion[];
  compliance: Compliance[];
  summary: string;
  keyPoints: string[];
}

interface AnalysisData {
  fileName: string;
  fileSize: number;
  analysis: Analysis;
  timestamp: string;
}

const AnalysisResults: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'suggestions' | 'compliance'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (analysisId) {
      const storedData = sessionStorage.getItem(`analysis_${analysisId}`);
      if (storedData) {
        setAnalysisData(JSON.parse(storedData));
      }
      setLoading(false);
    }
  }, [analysisId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyse non trouvée</h2>
          <p className="text-gray-600 mb-6">Les résultats de cette analyse ne sont plus disponibles.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const { analysis, fileName, fileSize } = analysisData;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'élevé': return 'text-red-600 bg-red-50 border-red-200';
      case 'moyen': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'faible': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'haute': return 'text-red-600 bg-red-50 border-red-200';
      case 'moyenne': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'basse': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'conforme': return 'text-green-600 bg-green-50 border-green-200';
      case 'non-conforme': return 'text-red-600 bg-red-50 border-red-200';
      case 'à vérifier': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadReport = () => {
    const reportContent = `
RAPPORT D'ANALYSE DE CONTRAT
============================

Fichier: ${fileName}
Taille: ${formatFileSize(fileSize)}
Type de contrat: ${analysis.contractType}
Score global: ${analysis.overallScore}/10
Date d'analyse: ${new Date(analysisData.timestamp).toLocaleDateString('fr-FR')}

RÉSUMÉ EXÉCUTIF
===============
${analysis.summary}

POINTS CLÉS
===========
${analysis.keyPoints.map(point => `• ${point}`).join('\n')}

RISQUES IDENTIFIÉS
==================
${analysis.risks.map(risk => `
RISQUE ${risk.level.toUpperCase()}: ${risk.title}
Description: ${risk.description}
Recommandation: ${risk.recommendation}
`).join('\n')}

SUGGESTIONS D'AMÉLIORATION
==========================
${analysis.suggestions.map(suggestion => `
PRIORITÉ ${suggestion.priority.toUpperCase()}: ${suggestion.title}
Description: ${suggestion.description}
Impact: ${suggestion.impact}
`).join('\n')}

CONFORMITÉ RÉGLEMENTAIRE
========================
${analysis.compliance.map(item => `
STATUT: ${item.status.toUpperCase()}
Article: ${item.article}
Description: ${item.description}
Action: ${item.action}
`).join('\n')}

---
Rapport généré par AI LOVE CONTRACTS
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-analyse-${fileName.replace(/\.[^/.]+$/, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Retour</span>
            </button>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={downloadReport}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Télécharger le rapport</span>
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Nouvelle analyse</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{fileName}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{formatFileSize(fileSize)}</span>
                <span>•</span>
                <span>{analysis.contractType}</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(analysisData.timestamp).toLocaleDateString('fr-FR')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className={`text-3xl font-bold mb-2 ${getScoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}/10
            </div>
            <div className="text-gray-600">Score global</div>
            <div className="flex justify-center mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(analysis.overallScore / 2) 
                      ? 'text-yellow-400 fill-current' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {analysis.risks.filter(r => r.level === 'élevé').length}
            </div>
            <div className="text-gray-600">Risques élevés</div>
            <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mt-2" />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {analysis.suggestions.length}
            </div>
            <div className="text-gray-600">Suggestions</div>
            <TrendingUp className="h-6 w-6 text-blue-500 mx-auto mt-2" />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {analysis.compliance.filter(c => c.status === 'conforme').length}
            </div>
            <div className="text-gray-600">Points conformes</div>
            <Shield className="h-6 w-6 text-green-500 mx-auto mt-2" />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: Eye },
                { id: 'risks', label: 'Risques', icon: AlertTriangle },
                { id: 'suggestions', label: 'Suggestions', icon: TrendingUp },
                { id: 'compliance', label: 'Conformité', icon: Shield }
              ].map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Résumé exécutif</h3>
                  <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Points clés</h3>
                  <ul className="space-y-2">
                    {analysis.keyPoints.map((point, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Risks Tab */}
            {activeTab === 'risks' && (
              <div className="space-y-4">
                {analysis.risks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-gray-600">Aucun risque majeur identifié</p>
                  </div>
                ) : (
                  analysis.risks.map((risk, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${getRiskColor(risk.level)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{risk.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(risk.level)}`}>
                          {risk.level}
                        </span>
                      </div>
                      <p className="mb-3">{risk.description}</p>
                      <div className="bg-white/50 rounded p-3">
                        <p className="text-sm"><strong>Recommandation:</strong> {risk.recommendation}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-4">
                {analysis.suggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">Aucune suggestion d'amélioration</p>
                  </div>
                ) : (
                  analysis.suggestions.map((suggestion, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(suggestion.priority)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{suggestion.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <p className="mb-3">{suggestion.description}</p>
                      <div className="bg-white/50 rounded p-3">
                        <p className="text-sm"><strong>Impact attendu:</strong> {suggestion.impact}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && (
              <div className="space-y-4">
                {analysis.compliance.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Aucune vérification de conformité disponible</p>
                  </div>
                ) : (
                  analysis.compliance.map((item, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${getComplianceColor(item.status)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{item.article}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getComplianceColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mb-3">{item.description}</p>
                      {item.action && (
                        <div className="bg-white/50 rounded p-3">
                          <p className="text-sm"><strong>Action recommandée:</strong> {item.action}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;