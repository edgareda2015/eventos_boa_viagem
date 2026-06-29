import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Evento, Inscrito, AdminUser, DrawHistory } from '../types';
import { eventService } from '../services/factory';

export const useStore = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      console.log('[DATA] Fetching events from Supabase...');
      const data = await eventService.getEvents();
      console.log(`[DATA] ${data.length} events loaded.`);
      setEventos(data);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncProfile = async () => {
    if (isSignedIn && user) {
      try {
        const email = user.primaryEmailAddress?.emailAddress || '';
        const name = user.fullName || user.username || 'Colaborador';
        const profile = await eventService.syncUserProfile(user.id, email, name);
        if (profile) {
          if (profile.status === 'inativo') {
            await signOut();
            setAdminProfile(null);
          } else {
            setAdminProfile(profile);
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar perfil administrativo:', err);
      }
    } else {
      setAdminProfile(null);
    }
  };

  // ✅ Sync authReady with Clerk's isLoaded
  useEffect(() => {
    if (isLoaded) {
      setAuthReady(true);
      syncProfile();
    }
  }, [isLoaded, isSignedIn, user]);

  // ✅ Load events when auth is ready (even if not signed in, for public view)
  useEffect(() => {
    if (authReady) {
      loadEvents();
    }
  }, [authReady]);

  const login = () => {
    // Handled by Clerk UI
  };

  const logout = async () => {
    await signOut();
    setAdminProfile(null);
  };

  const addEvento = async (evento: Omit<Evento, 'id' | 'inscritos' | 'encerrado'>) => {
    await eventService.createEvent(evento);
    await loadEvents();
  };

  const encerrarEvento = async (id: string) => {
    await eventService.closeEvent(id);
    await loadEvents();
  };

  const reabrirEvento = async (id: string) => {
    await eventService.reopenEvent(id);
    await loadEvents();
  };

  const deleteEvento = async (id: string) => {
    await eventService.deleteEvent(id);
    await loadEvents();
  };

  const updateEvento = async (evento: Evento) => {
    await eventService.updateEvent(evento);
    await loadEvents();
  };

  const registrarInscrito = async (eventoId: string, inscrito: Omit<Inscrito, 'id' | 'dataInscricao'>) => {
    const result = await eventService.registerSubscriber(eventoId, inscrito);
    await loadEvents();
    return result;
  };

  const registrarInscritosBulk = async (eventoId: string, inscritos: { nomeCompleto: string; telefone: string; dataInscricao?: string }[]) => {
    await eventService.registerSubscribersBulk(eventoId, inscritos);
    await loadEvents();
  };

  const deleteInscrito = async (id: string) => {
    await eventService.deleteRegistration(id);
    await loadEvents();
  };

  const validateCheckin = async (token: string) => {
    const result = await eventService.validateCheckin(token);
    if (result.success) {
      await loadEvents();
    }
    return result;
  };

  const uploadImage = async (file: File) => {
    return await eventService.uploadImage(file);
  };

  // Operações de usuários
  const getAdminUsers = async () => {
    return await eventService.getAdminUsers();
  };

  const createAdminUser = async (u: Omit<AdminUser, 'createdAt'>) => {
    const res = await eventService.createAdminUser(u);
    return res;
  };

  const updateAdminUser = async (u: AdminUser) => {
    const res = await eventService.updateAdminUser(u);
    return res;
  };

  const deleteAdminUser = async (id: string) => {
    await eventService.deleteAdminUser(id);
  };

  // Operações de sorteio
  const getDrawHistory = async (eventId?: string) => {
    return await eventService.getDrawHistory(eventId);
  };

  const saveDraw = async (draw: Omit<DrawHistory, 'id' | 'dataSorteio'>) => {
    const res = await eventService.saveDraw(draw);
    return res;
  };

  return {
    eventos,
    isLoading,
    isAdmin: !!isSignedIn && adminProfile?.status === 'ativo',
    adminProfile,
    authReady,
    user,
    login,
    logout,
    addEvento,
    updateEvento,
    encerrarEvento,
    reabrirEvento,
    deleteEvento,
    registrarInscrito,
    registrarInscritosBulk,
    deleteInscrito,
    validateCheckin,
    uploadImage,
    getAdminUsers,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    getDrawHistory,
    saveDraw
  };
};
