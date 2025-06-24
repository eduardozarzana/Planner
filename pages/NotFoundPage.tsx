import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import Button from '../components/shared/Button';
import { NotFoundIllustration } from '../components/illustrations/NotFoundIllustration'; // Import the new illustration

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <h1 className="text-6xl font-bold text-yellow-500 mb-4">404</h1>
      <h2 className="text-3xl font-semibold text-green-800 mb-2">Página Não Encontrada</h2>
      <p className="text-green-600 mb-8 max-w-md">
        Oops! A página que você está procurando não existe. Ela pode ter sido movida ou excluída.
      </p>
      <NotFoundIllustration 
        className="rounded-lg shadow-md mb-8 w-full max-w-md h-auto"
      />
      <Link to={ROUTES.DASHBOARD}>
        <Button variant="primary" size="lg">
          Ir para o Painel
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
