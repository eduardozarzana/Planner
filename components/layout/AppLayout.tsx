
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { APP_NAME } from '../../constants';

const AppFooter: React.FC = () => (
  <footer className="bg-green-800 text-lime-50 text-center p-4 text-sm">
    © {new Date().getFullYear()} {APP_NAME} - Sistema de agendamento de produção. Todos os direitos reservados.
  </footer>
);

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Outlet /> {/* Nested routes will render here */}
      </main>
      <AppFooter />
    </div>
  );
};

export default AppLayout;
