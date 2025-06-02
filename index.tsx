// main.tsx ou index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // <-- Importação do CSS, ajuste o nome se necessário
import App from './App';
import { AppDataProvider } from './contexts/AppDataContext';
import { AuthProvider } from './contexts/AuthContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </AuthProvider>
  </React.StrictMode>
);
