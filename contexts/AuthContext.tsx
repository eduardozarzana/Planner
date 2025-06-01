import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Import Supabase client
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (emailInput: string, passwordInput: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const getInitialSession = async () => {
      setIsLoading(true);
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Auth: Error getting initial session:", error);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (emailInput: string, passwordInput: string): Promise<{ success: boolean, error?: string }> => {
    setIsLoading(true);
    // No Supabase, o "username" é tratado como email para login com senha.
    // Se você quiser usar um nome de usuário distinto, precisaria de uma coluna 'username'
    // na tabela auth.users (ou uma tabela de perfis vinculada) e lógica customizada.
    // Por agora, assumiremos que o input de "username" do usuário é o email dele.
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });
    setIsLoading(false);
    if (error) {
      console.error("Auth: Login error", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Auth: Logout error", error);
    }
    // O onAuthStateChange vai lidar com a atualização de user e session para null.
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!user && !!session, // Considera autenticado se houver user e session
      login, 
      logout, 
      isLoading,
      user,
      session 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
