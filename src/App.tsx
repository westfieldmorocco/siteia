import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FileUploader from './components/FileUploader';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import AnalysisResults from './components/AnalysisResults';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Header 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
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
      </div>
    </Router>
  );
}

export default App;