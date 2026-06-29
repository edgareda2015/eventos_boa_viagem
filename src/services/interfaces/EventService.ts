import { Evento, Inscrito, AdminUser, DrawHistory } from '../../types';

export interface EventService {
    getEvents(): Promise<Evento[]>;
    getEventById(id: string): Promise<Evento | undefined>;
    createEvent(evento: Omit<Evento, 'id' | 'inscritos' | 'encerrado'>): Promise<Evento>;
    updateEvent(evento: Evento): Promise<Evento>;
    closeEvent(id: string): Promise<void>;
    reopenEvent(id: string): Promise<void>;
    deleteEvent(id: string): Promise<void>;
    registerSubscriber(eventoId: string, inscrito: Omit<Inscrito, 'id' | 'dataInscricao'>): Promise<Inscrito>;
    registerSubscribersBulk(eventoId: string, inscritos: { nomeCompleto: string; telefone: string; dataInscricao?: string }[]): Promise<void>;
    deleteRegistration(id: string): Promise<void>;
    validateCheckin(token: string): Promise<{ success: boolean; message: string; inscrito?: Inscrito }>;
    uploadImage(file: File): Promise<string>;
    isAdmin(): boolean;
    setAdmin(isAdmin: boolean): void;
    
    // Novas operações V2
    syncUserProfile(clerkId: string, email: string, nome: string): Promise<AdminUser | null>;
    getAdminUsers(): Promise<AdminUser[]>;
    createAdminUser(user: Omit<AdminUser, 'createdAt'>): Promise<AdminUser>;
    updateAdminUser(user: AdminUser): Promise<AdminUser>;
    deleteAdminUser(id: string): Promise<void>;
    getDrawHistory(eventId?: string): Promise<DrawHistory[]>;
    saveDraw(draw: Omit<DrawHistory, 'id' | 'dataSorteio'>): Promise<DrawHistory>;
}
