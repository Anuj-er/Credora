import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const saveAuth = useCallback((tokenValue, userData) => {
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }
      try {
        const data = await authService.getProfile();
        setUser(data.user || data);
        setToken(savedToken);
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [clearAuth]);

  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);
      saveAuth(data.token, data.user);
      try {
        const profile = await authService.getProfile();
        const userData = profile.user || profile;
        saveAuth(data.token, userData);
        data.user = userData;
      } catch {
        // Keep the valid login session if profile enrichment is temporarily unavailable.
      }
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (payload) => {
    try {
      const data = await authService.register(payload);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout().catch(() => {});
    clearAuth();
    toast.success('Logged out successfully');
  };

  const updateProfile = async (data) => {
    try {
      const result = await authService.updateProfile(data);
      setUser(result.user || result);
      localStorage.setItem('user', JSON.stringify(result.user || result));
      toast.success('Profile updated!');
      return result;
    } catch (error) {
      const msg = error.response?.data?.message || 'Profile update failed';
      toast.error(msg);
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
