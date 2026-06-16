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

import { LanguageProvider, useLanguage } from './hooks/useLanguage';

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
                    <Route index element={<AdminDashboard eventos={store.eventos} />} />
                    <Route path="arquivo" element={<AdminArchive eventos={store.eventos} onReopen={store.reabrirEvento} />} />
                    <Route path="novo" element={<AdminEventForm onSave={store.addEvento} onUpload={store.uploadImage} />} />
                    <Route path="evento/:id" element={<AdminEventDetails eventos={store.eventos} onEnd={store.encerrarEvento} onReopen={store.reabrirEvento} onDelete={store.deleteEvento} onDeleteRegistration={store.deleteInscrito} onCheckin={store.validateCheckin} onRegisterBulk={store.registrarInscritosBulk} />} />
                    <Route path="evento/:id/editar" element={<AdminEventEditWrapper eventos={store.eventos} isLoading={store.isLoading} onSave={store.updateEvento} onUpload={store.uploadImage} />} />
                    <Route path="documentacao" element={<AdminDocumentation />} />
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

const AdminEventEditWrapper: React.FC<{ eventos: any[], isLoading: boolean, onSave: (evento: any) => void, onUpload: (file: File) => Promise<string> }> = ({ eventos, isLoading, onSave, onUpload }) => {
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

  return <AdminEventForm onSave={onSave} onUpload={onUpload} initialData={evento} />;
};

export default App;
