import React from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useStore } from './hooks/useEvents';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminLogin from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminArchive from './pages/Admin/Archive';
import AdminEventForm from './pages/Admin/EventForm';
import AdminEventDetails from './pages/Admin/EventDetails';
import AdminDocumentation from './pages/Admin/Documentation';
import PublicEventList from './pages/Public/EventList';
import PublicEventRegistration from './pages/Public/EventRegistration';
import CheckinPage from './pages/Public/Checkin';
import TutorialPage from './pages/Public/TutorialPage';

import { LanguageProvider } from './hooks/useLanguage';

const AppContent: React.FC = () => {
  const store = useStore();
  const location = useLocation();

  // Check if current route is a link_externo event
  const eventMatch = location.pathname.match(/^\/evento\/(.+)$/);
  const currentEventId = eventMatch ? eventMatch[1] : null;
  const currentEvent = currentEventId ? store.eventos.find(e => e.id === currentEventId) : null;
  const isLinkExternoPage = currentEvent?.tipo === 'link_externo';

  return (
    <div className="flex flex-col min-h-screen">
      {!isLinkExternoPage && <Header />}
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicEventList eventos={store.eventos} />} />
          <Route
            path="/evento/:id"
            element={<PublicEventRegistration eventos={store.eventos} isLoading={store.isLoading} onRegister={store.registrarInscrito} />}
          />
          <Route
            path="/checkin"
            element={<CheckinPage validateCheckin={store.validateCheckin} />}
          />
          <Route
            path="/tutorial"
            element={<TutorialPage />}
          />

          {/* Custom Admin Login Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <>
                <SignedIn>
                  <Routes>
                    <Route index element={<AdminDashboard eventos={store.eventos} adminProfile={store.adminProfile} />} />
                    <Route path="arquivo" element={<AdminArchive eventos={store.eventos} onReopen={store.reabrirEvento} />} />
                    <Route path="novo" element={<AdminEventForm onSave={store.addEvento} onUpload={store.uploadImage} adminProfile={store.adminProfile} />} />
                    <Route path="evento/:id" element={<AdminEventDetails eventos={store.eventos} adminProfile={store.adminProfile} onEnd={store.encerrarEvento} onReopen={store.reabrirEvento} onDelete={store.deleteEvento} onDeleteRegistration={store.deleteInscrito} onCheckin={store.validateCheckin} onRegisterBulk={store.registrarInscritosBulk} />} />
                    <Route path="evento/:id/editar" element={<AdminEventEditWrapper eventos={store.eventos} isLoading={store.isLoading} onSave={store.updateEvento} onUpload={store.uploadImage} adminProfile={store.adminProfile} />} />
                    <Route path="documentacao" element={<AdminDocumentation />} />
                    <Route path="sorteios" element={<AdminDrawsWrapper store={store} />} />
                    <Route path="usuarios" element={<AdminAccessControlWrapper store={store} />} />
                  </Routes>
                </SignedIn>
                <SignedOut>
                  <Navigate to="/admin/login" replace />
                </SignedOut>
              </>
            }
          />

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {!isLinkExternoPage && <Footer />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </LanguageProvider>
  );
};

// Wrapper para edição de evento
const AdminEventEditWrapper: React.FC<{
  eventos: any[];
  isLoading: boolean;
  onSave: (evento: any) => void;
  onUpload: (file: File) => Promise<string>;
  adminProfile?: any;
}> = ({ eventos, isLoading, onSave, onUpload, adminProfile }) => {
  const { id } = useParams<{ id: string }>();
  const evento = eventos.find(e => e.id === id);

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center animate-pulse">
        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Carregando Evento...</p>
      </div>
    );
  }

  if (!evento) return <div className="text-center py-20 font-bold text-gray-400">Evento não localizado.</div>;

  return <AdminEventForm onSave={onSave} onUpload={onUpload} initialData={evento} adminProfile={adminProfile} />;
};

// Wrapper para a tela de Sorteios
const AdminDrawsWrapper: React.FC<{ store: any }> = ({ store }) => {
  const Draws = React.lazy(() => import('./pages/Admin/Draws'));
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    }>
      <Draws
        eventos={store.eventos}
        adminProfile={store.adminProfile}
        getDrawHistory={store.getDrawHistory}
        saveDraw={store.saveDraw}
      />
    </React.Suspense>
  );
};

// Wrapper para a tela de Controle de Acesso
const AdminAccessControlWrapper: React.FC<{ store: any }> = ({ store }) => {
  if (store.adminProfile?.perfil !== 'ADMIN') {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="size-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-red-100 border border-red-100">
          <span className="material-symbols-outlined text-5xl font-black">gpp_bad</span>
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Permissão Insuficiente</h2>
        <p className="text-gray-500 max-w-md mb-8">Apenas administradores podem acessar o Controle de Usuários.</p>
      </div>
    );
  }

  const AccessControl = React.lazy(() => import('./pages/Admin/AccessControl'));
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    }>
      <AccessControl
        getAdminUsers={store.getAdminUsers}
        createAdminUser={store.createAdminUser}
        updateAdminUser={store.updateAdminUser}
        deleteAdminUser={store.deleteAdminUser}
      />
    </React.Suspense>
  );
};

export default App;
