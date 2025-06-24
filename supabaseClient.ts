import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// !! ATENÇÃO: Estas são as suas credenciais do Supabase.                !!
// !! Mantenha este arquivo seguro. A chave 'anon public' é projetada    !!
// !! para uso no cliente e depende das Políticas de Segurança em Nível  !!
// !! de Linha (RLS) para proteger seus dados.                           !!
// =============================================================================
const supabaseUrl = "https://ardzsloaomwjakqbcxsr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHpzbG9hb213amFrcWJjeHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NDIyMDYsImV4cCI6MjA2NDIxODIwNn0.SaQJvU2S9CbvwNKhZ1Sqxh0-yxuJDDs-SkufF3zNLkE";
// =============================================================================

// Garante que algum valor foi fornecido (não apenas espaços em branco),
// antes de tentar criar o cliente.
if (!supabaseUrl || supabaseUrl.trim() === "") {
  const errorMessage = "A URL do Supabase (supabaseUrl) está vazia ou contém apenas espaços. Verifique supabaseClient.ts.";
  console.error(errorMessage);
  // Para uma configuração crítica como esta, um alerta e erro são úteis para feedback imediato.
  alert(errorMessage);
  throw new Error(errorMessage);
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === "") {
  const errorMessage = "A Chave Anon do Supabase (supabaseAnonKey) está vazia ou contém apenas espaços. Verifique supabaseClient.ts.";
  console.error(errorMessage);
  alert(errorMessage);
  throw new Error(errorMessage);
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
