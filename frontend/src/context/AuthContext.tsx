import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import api from '../services/api';

export interface AppUser {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  mobile_number?: string;
  profile_picture_url?: string;
  currency_preference: string;
  theme_preference: string;
  is_claimed: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (fbUser: FirebaseUser) => {
    try {
      // First try to just get the user profile
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // User not found in DB, we need to call login to create/upsert
        try {
          const loginResponse = await api.post('/api/auth/login', {
            name: fbUser.displayName || 'Anonymous User',
            email: fbUser.email,
            profile_picture_url: fbUser.photoURL
          });
          setUser(loginResponse.data);
        } catch (loginError) {
          console.error("Error creating user in backend", loginError);
        }
      } else {
        console.error("Error fetching user profile", error);
        if (error.response?.status === 401) {
          await auth.signOut();
          setUser(null);
        }
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await fetchAppUser(fbUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchAppUser(firebaseUser);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, refreshUser, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
