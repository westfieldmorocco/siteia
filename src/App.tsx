import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FileUploader from './components/FileUploader';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import AnalysisResults from './components/AnalysisResults';
import AuthModal from './components/auth/AuthModal';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-white">
          <Header 
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            onAuthClick={() => setIsAuthModalOpen(true)}
          />
          
          <Routes>
            <Route path="/" element={
              <>
                <HeroSection />
                <FileUploader />
                <HowItWorks />
              </>
            } />
            <Route path="/results/:analysisId" element={<AnalysisResults />} />
          </Routes>
          
          <Footer />
          
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;