import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminEmail } from '../lib/adminConfig';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id?: string;  // Supabase user ID
  email: string;
  name: string;
  isAdmin: boolean;
}

interface Profile {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'elite';
  role?: string;
  display_name?: string;
  email_alerts_enabled?: boolean;
  digest_enabled?: boolean;
  timezone?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load user from localStorage AND Supabase on mount
  useEffect(() => {
    // First check localStorage for backward compat
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    // Then check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUserFromSupabase(session.user);
        loadProfile(session.user.id);
      }
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncUserFromSupabase(session.user);
        loadProfile(session.user.id);
      } else {
        // Don't clear localStorage user - keep backward compat
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const syncUserFromSupabase = (supabaseUser: SupabaseUser) => {
    const email = supabaseUser.email || '';
    const newUser: User = {
      id: supabaseUser.id,
      email,
      name: supabaseUser.user_metadata?.name || email.split('@')[0],
      isAdmin: isAdminEmail(email)
    };
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    localStorage.setItem('isLoggedIn', 'true');
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data && !error) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('[AuthContext] Failed to load profile:', err);
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  };

  const login = (email: string, _password: string) => {
    // SECURITY: This only sets local UI state for backward compatibility.
    // Real authentication must happen via supabase.auth.signInWithPassword() first.
    // This function should only be called AFTER successful Supabase auth.
    const newUser: User = {
      email,
      name: email.split('@')[0],
      isAdmin: isAdminEmail(email),
    };
    
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    localStorage.setItem('isLoggedIn', 'true');
  };

  const logout = async () => {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear local state
    setUser(null);
    setProfile(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      isLoggedIn: !!user, 
      login, 
      logout,
      updateUser,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
