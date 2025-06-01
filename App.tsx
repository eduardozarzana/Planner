
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './constants';

import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PageLayout from './components/layout/PageLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EquipmentManagementPage from './pages/EquipmentManagementPage';
import ProductRegistrationPage from './pages/ProductRegistrationPage';
import LineSetupPage from './pages/LineSetupPage';
import ProductionSchedulingPage from './pages/ProductionSchedulingPage';
import NotFoundPage from './pages/NotFoundPage';


const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        
        {/* Protected Application Routes rendered within AppLayout */}
        <Route 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.DASHBOARD} element={<PageLayout title="Painel de Controle"><DashboardPage /></PageLayout>} />
          <Route path={ROUTES.EQUIPMENT} element={<PageLayout title="Gerenciamento de Equipamentos"><EquipmentManagementPage /></PageLayout>} />
          <Route path={ROUTES.PRODUCTS} element={<PageLayout title="Cadastro de Produtos"><ProductRegistrationPage /></PageLayout>} />
          <Route path={ROUTES.LINES} element={<PageLayout title="Configuração de Linhas"><LineSetupPage /></PageLayout>} />
          <Route path={ROUTES.SCHEDULING} element={<PageLayout title="Agendamento de Produção"><ProductionSchedulingPage /></PageLayout>} />
          
          {/* 404 page for routes within the authenticated app that don't match */}
          <Route path="/404" element={<PageLayout title="Página Não Encontrada"><NotFoundPage /></PageLayout>} />
          <Route path="*" element={<Navigate to="/404" replace />} /> 
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
