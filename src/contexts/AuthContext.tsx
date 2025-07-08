import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  fullName?: string;
  company?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Chargement initial du token depuis localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Vérification de la validité du token
        verifyToken(savedToken);
      } catch (error) {
        console.error('Erreur chargement auth:', error);
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token invalide');
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // Si on ne peut pas parser le JSON, on considère le token comme invalide
        throw new Error('Token invalide');
      }
      
      if (data.success) {
        setUser(data.data.user);
      } else {
        throw new Error('Token invalide');
      }
    } catch (error) {
      console.error('Erreur vérification token:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const textResponse = await response.text();
        throw new Error(`Erreur de connexion au serveur. Réponse: ${textResponse || 'Aucune réponse'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      const { user: userData, token: userToken } = data.data;
      
      setUser(userData);
      setToken(userToken);
      
      // Sauvegarde en localStorage
      localStorage.setItem('auth_token', userToken);
      localStorage.setItem('auth_user', JSON.stringify(userData));

    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const textResponse = await response.text();
        throw new Error(`Erreur de connexion au serveur. Réponse: ${textResponse || 'Aucune réponse'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }

      const { user: newUser, token: userToken } = data.data;
      
      setUser(newUser);
      setToken(userToken);
      
      // Sauvegarde en localStorage
      localStorage.setItem('auth_token', userToken);
      localStorage.setItem('auth_user', JSON.stringify(newUser));

    } catch (error) {
      console.error('Erreur register:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const updateProfile = async (profileData: Partial<User>) => {
    try {
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const textResponse = await response.text();
        throw new Error(`Erreur de connexion au serveur. Réponse: ${textResponse || 'Aucune réponse'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur mise à jour profil');
      }

      const updatedUser = data.data.user;
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));

    } catch (error) {
      console.error('Erreur update profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    updateProfile,
    isLoading,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};