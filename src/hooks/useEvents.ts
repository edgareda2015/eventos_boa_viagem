import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Evento, Inscrito } from '../types';
import { eventService } from '../services/factory';

export const useStore = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  // ✅ Sync authReady with Clerk's isLoaded
  useEffect(() => {
    if (isLoaded) {
      setAuthReady(true);
    }
  }, [isLoaded]);

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

  return {
    eventos,
    isLoading,
    isAdmin: !!isSignedIn,
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
    uploadImage
  };
};
