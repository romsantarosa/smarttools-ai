import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { PainelOperacional } from './pages/Dashboard';
import { Navios } from './pages/Navios';
import { Ferramentas } from './pages/Ferramentas';
import { Manutencao } from './pages/Manutencao';
import { Compras } from './pages/Compras';
import { SupervisorIA } from './pages/SupervisorIA';
import { Relatorios } from './pages/Relatorios';
import { Historico } from './pages/Historico';
import { Configuracoes } from './pages/Configuracoes';
import { Perfil } from './pages/Perfil';
import { Escala } from './pages/Escala';
import { AtracacaoSaida } from './pages/AtracacaoSaida';
import { PlanejamentoSplit } from './pages/PlanejamentoSplit';
import { ProgramacaoBtp } from './pages/ProgramacaoBtp';

// Guarded Route component
const ProtectedRoutes: React.FC = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<PainelOperacional />} />
            <Route path="/escala" element={<Escala />} />
            <Route path="/programacao-btp" element={<ProgramacaoBtp />} />
            <Route path="/atracacao-saida" element={<AtracacaoSaida />} />
            <Route path="/navios" element={<Navios />} />
            <Route path="/ferramentas" element={<Ferramentas />} />
            <Route path="/manutencao" element={<Manutencao />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/supervisor-ia" element={<SupervisorIA />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/planejamento-split" element={<PlanejamentoSplit />} />
          </Route>

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
