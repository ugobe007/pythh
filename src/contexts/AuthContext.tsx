import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminEmail } from '../lib/adminConfig';

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
  isLoading: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage AND Supabase on mount
  useEffect(() => {
    // Check Supabase session FIRST (this is the source of truth)
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('[AuthContext] getSession error (ignored):', error.message);
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('isLoggedIn');
        }
        setIsLoading(false);
        return;
      }
      
      if (session?.user) {
        await syncUserFromSupabase(session.user);
        loadProfile(session.user.id);
      } else {
        // No Supabase session - check localStorage for backward compat
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
          } catch (err) {
            console.warn('[AuthContext] Failed to parse saved user:', err);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isLoggedIn');
          }
        }
      }
      setIsLoading(false);
    }).catch((err) => {
      console.warn('[AuthContext] getSession threw (ignored):', err);
      setIsLoading(false);
    });
    
    // Listen for auth changes (this will fire when session is restored or created)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        await syncUserFromSupabase(session.user);
        loadProfile(session.user.id);
      } else {
        // Session removed - clear state
        setUser(null);
        setProfile(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const syncUserFromSupabase = async (supabaseUser: SupabaseUser) => {
    const email = supabaseUser.email || '';
    
    // Check database for admin flag (proper way)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', supabaseUser.id)
      .maybeSingle();
    
    // Fallback to email check if profile doesn't exist yet
    const isAdminFromDb = profile?.is_admin === true;
    const isAdminFromEmail = isAdminEmail(email);
    
    const newUser: User = {
      id: supabaseUser.id,
      email,
      name: supabaseUser.user_metadata?.name || email.split('@')[0],
      isAdmin: isAdminFromDb || isAdminFromEmail  // Database first, fallback to email
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
        .maybeSingle();
      
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

  const login = (email: string, password: string) => {
    // This is now mainly for backward compatibility
    // Real auth happens in Login.tsx via supabase.auth.signIn
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
    try {
      // Sign out from Supabase (this clears the persisted session)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthContext] Sign out error:', error);
      }
    } catch (err) {
      console.error('[AuthContext] Sign out exception:', err);
    }
    
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
      isLoading,
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
