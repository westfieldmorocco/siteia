import React from 'react';
import { Upload, Brain, FileText } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: Upload,
      title: "Téléchargez votre contrat",
      description: "Glissez-déposez ou sélectionnez votre fichier PDF, DOC ou DOCX. Notre système accepte tous les formats de contrats juridiques.",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Brain,
      title: "IA analyse le document",
      description: "Notre intelligence artificielle spécialisée en droit marocain examine chaque clause, identifie les risques et les points d'attention.",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: FileText,
      title: "Recevez votre rapport",
      description: "Obtenez un rapport détaillé avec recommandations, points de vigilance et suggestions d'amélioration en quelques minutes.",
      color: "from-indigo-500 to-indigo-600"
    }
  ];

  return (
    <section id="comment-ca-marche" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            En seulement 3 étapes simples, obtenez une analyse complète et professionnelle 
            de vos contrats juridiques marocains.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div key={index} className="relative text-center group">
                {/* Connection line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 z-0">
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-gray-300 rounded-full"></div>
                  </div>
                )}

                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`mx-auto w-20 h-20 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="h-10 w-10 text-white" />
                  </div>

                  {/* Step number */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-sm font-bold text-gray-700 shadow-sm">
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="mt-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Analyse en 30 secondes", value: "⚡" },
            { label: "Confidentialité garantie", value: "🔒" },
            { label: "Droit marocain", value: "🇲🇦" },
            { label: "Disponible 24/7", value: "🕐" }
          ].map((feature, index) => (
            <div key={index} className="text-center p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
              <div className="text-3xl mb-2">{feature.value}</div>
              <div className="text-sm font-medium text-gray-700">{feature.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;