import { Evento, Inscrito, AdminUser, DrawHistory } from '../../types';
import { EventService } from '../interfaces/EventService';

const STORAGE_KEY = 'uninassau_eventos_v1';
const ADMIN_KEY = 'is_admin';

export class LocalStorageService implements EventService {
    async getEvents(): Promise<Evento[]> {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);

        // Initial Seed Data
        const initialData: Evento[] = [
            {
                id: '1',
                nome: 'Workshop de Inovação Tecnológica e IA',
                data: '2025-01-09',
                horario: '14:00 - 18:00',
                descricao: 'Um encontro exclusivo para discutir o futuro da tecnologia aplicada aos negócios. Garanta sua vaga preenchendo o formulário.',
                local: 'Auditório UNINASSAU Boa Viagem',
                encerrado: false,
                inscritos: []
            }
        ];
        this.saveEventsInternal(initialData);
        return initialData;
    }

    async getEventById(id: string): Promise<Evento | undefined> {
        const events = await this.getEvents();
        return events.find(e => e.id === id);
    }

    async createEvent(eventoData: Omit<Evento, 'id' | 'inscritos' | 'encerrado'>): Promise<Evento> {
        const events = await this.getEvents();
        const newEvent: Evento = {
            ...eventoData,
            id: Math.random().toString(36).substr(2, 9),
            inscritos: [],
            encerrado: false
        };

        events.unshift(newEvent);
        this.saveEventsInternal(events);
        return newEvent;
    }

    async updateEvent(evento: Evento): Promise<Evento> {
        const events = await this.getEvents();
        const index = events.findIndex(e => e.id === evento.id);
        if (index !== -1) {
            events[index] = evento;
            this.saveEventsInternal(events);
        }
        return evento;
    }

    async closeEvent(id: string): Promise<void> {
        const events = await this.getEvents();
        const updatedEvents = events.map(e => e.id === id ? { ...e, encerrado: true } : e);
        this.saveEventsInternal(updatedEvents);
    }

    async reopenEvent(id: string): Promise<void> {
        const events = await this.getEvents();
        const updatedEvents = events.map(e => e.id === id ? { ...e, encerrado: false } : e);
        this.saveEventsInternal(updatedEvents);
    }

    async registerSubscriber(eventoId: string, inscritoData: Omit<Inscrito, 'id' | 'dataInscricao'>): Promise<Inscrito> {
        const events = await this.getEvents();
        let createdInscrito: Inscrito | undefined;

        const updatedEvents = events.map(e => {
            if (e.id === eventoId) {
                createdInscrito = {
                    ...inscritoData,
                    id: Math.random().toString(36).substring(2, 9),
                    dataInscricao: new Date().toISOString(),
                    checkedIn: false,
                    qrToken: Math.random().toString(36).substring(2, 9)
                };
                return { ...e, inscritos: [...e.inscritos, createdInscrito] };
            }
            return e;
        });

        this.saveEventsInternal(updatedEvents);

        if (!createdInscrito) {
            throw new Error('Evento não encontrado');
        }

        return createdInscrito;
    }

    async deleteEvent(id: string): Promise<void> {
        const events = await this.getEvents();
        const updatedEvents = events.filter(e => e.id !== id);
        this.saveEventsInternal(updatedEvents);
    }

    async deleteRegistration(id: string): Promise<void> {
        const events = await this.getEvents();
        const updatedEvents = events.map(e => ({
            ...e,
            inscritos: e.inscritos.filter(i => i.id !== id)
        }));
        this.saveEventsInternal(updatedEvents);
    }

    async validateCheckin(token: string): Promise<{ success: boolean; message: string; inscrito?: Inscrito }> {
        const events = await this.getEvents();
        let foundInscrito: Inscrito | undefined;
        let eventId: string | undefined;

        for (const e of events) {
            const ins = e.inscritos.find(i => i.qrToken === token);
            if (ins) {
                foundInscrito = ins;
                eventId = e.id;
                break;
            }
        }

        if (!foundInscrito || !eventId) {
            return { success: false, message: 'QR Code inválido ou não encontrado.' };
        }

        if (foundInscrito.checkedIn) {
            return { success: false, message: 'Este QR Code já foi utilizado para check-in.', inscrito: foundInscrito };
        }

        foundInscrito.checkedIn = true;
        foundInscrito.checkinDate = new Date().toISOString();

        const updatedEvents = events.map(e => {
            if (e.id === eventId) {
                return {
                    ...e,
                    inscritos: e.inscritos.map(i => i.id === foundInscrito!.id ? foundInscrito! : i)
                };
            }
            return e;
        });

        this.saveEventsInternal(updatedEvents);

        return {
            success: true,
            message: 'Entrada confirmada com sucesso!',
            inscrito: foundInscrito
        };
    }

    async registerSubscribersBulk(eventoId: string, inscritos: { nomeCompleto: string; telefone: string; dataInscricao?: string }[]): Promise<void> {
        const events = await this.getEvents();
        const updatedEvents = events.map(e => {
            if (e.id === eventoId) {
                const newInscritos = inscritos.map(ins => ({
                    id: Math.random().toString(36).substring(2, 9),
                    nomeCompleto: ins.nomeCompleto,
                    telefone: ins.telefone,
                    cpf: `EXT-${Math.random().toString(36).substring(2, 9)}`,
                    email: 'N/A',
                    escolaridade: 'N/A',
                    dataInscricao: ins.dataInscricao || new Date().toISOString(),
                    checkedIn: false,
                    qrToken: Math.random().toString(36).substring(2, 9)
                }));
                return { ...e, inscritos: [...e.inscritos, ...newInscritos] };
            }
            return e;
        });
        this.saveEventsInternal(updatedEvents);
    }

    async uploadImage(file: File): Promise<string> {
        return URL.createObjectURL(file);
    }

    isAdmin(): boolean {
        return localStorage.getItem(ADMIN_KEY) === 'true';
    }

    setAdmin(isAdmin: boolean): void {
        if (isAdmin) {
            localStorage.setItem(ADMIN_KEY, 'true');
        } else {
            localStorage.removeItem(ADMIN_KEY);
        }
    }

    // Novas operações V2
    async syncUserProfile(clerkId: string, email: string, nome: string): Promise<AdminUser | null> {
        const users = await this.getAdminUsers();
        let user = users.find(u => u.email === email);
        if (!user) {
            const perfil = users.length === 0 ? 'ADMIN' : 'COMERCIAL';
            user = {
                id: clerkId,
                nome,
                email,
                perfil,
                status: 'ativo',
                createdAt: new Date().toISOString()
            };
            users.push(user);
            localStorage.setItem('admin_users', JSON.stringify(users));
        } else if (user.id !== clerkId) {
            user.id = clerkId;
            user.nome = nome;
            localStorage.setItem('admin_users', JSON.stringify(users));
        }
        return user;
    }

    async getAdminUsers(): Promise<AdminUser[]> {
        const saved = localStorage.getItem('admin_users');
        return saved ? JSON.parse(saved) : [];
    }

    async createAdminUser(userData: Omit<AdminUser, 'createdAt'>): Promise<AdminUser> {
        const users = await this.getAdminUsers();
        const newUser: AdminUser = {
            ...userData,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem('admin_users', JSON.stringify(users));
        return newUser;
    }

    async updateAdminUser(user: AdminUser): Promise<AdminUser> {
        const users = await this.getAdminUsers();
        const index = users.findIndex(u => u.id === user.id || u.email === user.email);
        if (index !== -1) {
            users[index] = { ...users[index], ...user };
            localStorage.setItem('admin_users', JSON.stringify(users));
        }
        return user;
    }

    async deleteAdminUser(id: string): Promise<void> {
        const users = await this.getAdminUsers();
        const updated = users.filter(u => u.id !== id);
        localStorage.setItem('admin_users', JSON.stringify(updated));
    }

    async getDrawHistory(eventId?: string): Promise<DrawHistory[]> {
        const saved = localStorage.getItem('draw_history');
        const history: DrawHistory[] = saved ? JSON.parse(saved) : [];
        if (eventId) {
            return history.filter(h => h.eventId === eventId);
        }
        return history;
    }

    async saveDraw(drawData: Omit<DrawHistory, 'id' | 'dataSorteio'>): Promise<DrawHistory> {
        const history = await this.getDrawHistory();
        const newDraw: DrawHistory = {
            ...drawData,
            id: Math.random().toString(36).substring(2, 9),
            dataSorteio: new Date().toISOString()
        };
        history.push(newDraw);
        localStorage.setItem('draw_history', JSON.stringify(history));
        return newDraw;
    }

    private saveEventsInternal(events: Evento[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }
}
