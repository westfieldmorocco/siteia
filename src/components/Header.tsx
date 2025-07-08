import React from 'react';
import { FileText, Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  onAuthClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ isMobileMenuOpen, setIsMobileMenuOpen, onAuthClick }) => {
  const { user, logout, isAuthenticated } = useAuth();

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      onAuthClick();
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI LOVE CONTRACTS
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#accueil" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
              Accueil
            </a>
            <a href="#comment-ca-marche" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
              Comment ça marche
            </a>
            <a href="#tarifs" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
              Tarifs
            </a>
            <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
              Contact
            </a>
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-gray-700">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {user?.fullName || user?.email}
                  </span>
                </div>
                <button
                  onClick={handleAuthAction}
                  className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Déconnexion</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuthAction}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-200 font-medium"
              >
                Connexion
              </button>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/20">
            <div className="flex flex-col space-y-4">
              <a href="#accueil" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                Accueil
              </a>
              <a href="#comment-ca-marche" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                Comment ça marche
              </a>
              <a href="#tarifs" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                Tarifs
              </a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                Contact
              </a>
              
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {user?.fullName || user?.email}
                    </span>
                  </div>
                  <button
                    onClick={handleAuthAction}
                    className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Déconnexion</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAuthAction}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-200 font-medium w-fit"
                >
                  Connexion
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;