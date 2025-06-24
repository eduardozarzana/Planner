
import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES, APP_NAME } from '../constants';
import Input from '../components/shared/Input';
import Button from '../components/shared/Button';
import Alert from '../components/shared/Alert';
import { UserIcon, LockClosedIcon, ChartBarIcon } from '../components/icons';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState(''); // Changed from username to email
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || ROUTES.DASHBOARD;

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email e senha são obrigatórios.');
      return;
    }

    const { success, error: loginError } = await auth.login(email, password);
    if (success) {
      navigate(from, { replace: true });
    } else {
      setError(loginError || 'Email ou senha inválidos.');
    }
  };
  
  if (auth.isLoading) {
     return (
        <div className="flex items-center justify-center min-h-screen bg-lime-50">
            <div className="p-6 bg-white rounded-lg shadow-xl text-center">
                <p className="text-green-700 text-lg">Verificando autenticação...</p>
            </div>
        </div>
    );
  }

  // Se já autenticado e o efeito não redirecionou ainda, não renderizar o formulário.
  if (auth.isAuthenticated) {
      return null; 
  }

  return (
    <div className="min-h-screen bg-lime-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div className="text-center">
          <ChartBarIcon className="mx-auto h-12 w-auto text-yellow-400" />
          <h2 className="mt-4 text-3xl font-extrabold text-green-800">
            Bem-vindo ao {APP_NAME}
          </h2>
          <p className="mt-2 text-sm text-green-600">
            Faça login para continuar. Use seu e-mail e senha.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
          <Input
            id="email" // Changed from username
            name="email"
            type="email" // Changed type to email
            label="Email" // Changed label
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            IconComponent={UserIcon}
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="Senha"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            IconComponent={LockClosedIcon}
          />
          <div>
            <Button type="submit" className="w-full" isLoading={auth.isLoading} size="lg">
              Entrar
            </Button>
          </div>
        </form>
      </div>
       <footer className="mt-8 text-center text-sm text-green-700">
            <p>© {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.</p>
            <p className="text-xs mt-1">Para testar, seu primeiro login criará o usuário no Supabase.</p>
        </footer>
    </div>
  );
};

export default LoginPage;
