import { supabase } from '../../lib/supabase';
import { Evento, Inscrito, AdminUser, DrawHistory } from '../../types';
import { EventService } from '../interfaces/EventService';


export class SupabaseEventService implements EventService {
    async getEvents(): Promise<Evento[]> {
        if (!supabase) return [];
        try {
            const { data: events, error: eventsError } = await supabase
                .from('events')
                .select('*')
                .order('data_evento', { ascending: false })
                .limit(1000);

            if (eventsError) throw eventsError;

            // Fetch registrations for all events in parallel to be faster
            const eventsWithInscritos = await Promise.all((events || []).map(async (event: any) => {
                let allRegistrations: any[] = [];
                let page = 0;
                const pageSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data: regs, error: regsError } = await supabase
                        .from('registrations')
                        .select('*')
                        .eq('event_id', event.id)
                        .range(page * pageSize, (page + 1) * pageSize - 1)
                        .order('data_inscricao', { ascending: true });

                    if (regsError) throw regsError;

                    if (regs && regs.length > 0) {
                        allRegistrations = [...allRegistrations, ...regs];
                        if (regs.length < pageSize) {
                            hasMore = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMore = false;
                    }
                }

                return {
                    id: event.id,
                    nome: event.nome_evento,
                    data: event.data_evento,
                    horario: event.horario_evento || '00:00',
                    descricao: event.descricao || '',
                    local: event.local,
                    encerrado: event.status === 'encerrado',
                    imagem: event.imagem_url,
                    tipo: event.tipo || 'interno',
                    linkExterno: event.link_externo,
                    proprietarioId: event.proprietario_id,
                    dataFinal: event.data_final,
                    horarioFinal: event.horario_final,
                    inscritos: allRegistrations.map((reg: any) => ({
                        id: reg.id,
                        nomeCompleto: reg.nome,
                        telefone: reg.telefone,
                        cpf: reg.cpf,
                        email: reg.email,
                        escolaridade: reg.escolaridade,
                        interesseGraduacao: reg.interesse === 'graduacao' ? 'Sim' : 'Não',
                        interesseTipo: reg.interesse,
                        cursoInteresse: reg.curso,
                        dataInscricao: reg.data_inscricao,
                        qrToken: reg.qr_token,
                        checkedIn: reg.checked_in,
                        checkinDate: reg.checkin_date,
                        cidade: reg.cidade,
                        estado: reg.estado,
                        pais: reg.pais
                    }))
                };
            }));

            return eventsWithInscritos;
        } catch (e) {
            console.error('Erro ao buscar eventos:', e);
            return [];
        }
    }

    async getEventById(id: string): Promise<Evento | undefined> {
        if (!supabase) return undefined;
        try {
            const { data: event, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .single();

            if (eventError || !event) return undefined;

            let allRegistrations: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: regs, error: regsError } = await supabase
                    .from('registrations')
                    .select('*')
                    .eq('event_id', event.id)
                    .range(page * pageSize, (page + 1) * pageSize - 1)
                    .order('data_inscricao', { ascending: true });

                if (regsError) throw regsError;

                if (regs && regs.length > 0) {
                    allRegistrations = [...allRegistrations, ...regs];
                    if (regs.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            return {
                id: event.id,
                nome: event.nome_evento,
                data: event.data_evento,
                horario: event.horario_evento || '00:00',
                descricao: event.descricao || '',
                local: event.local,
                encerrado: event.status === 'encerrado',
                imagem: event.imagem_url,
                tipo: event.tipo || 'interno',
                linkExterno: event.link_externo,
                proprietarioId: event.proprietario_id,
                dataFinal: event.data_final,
                horarioFinal: event.horario_final,
                inscritos: allRegistrations.map((reg: any) => ({
                    id: reg.id,
                    nomeCompleto: reg.nome,
                    telefone: reg.telefone,
                    cpf: reg.cpf,
                    email: reg.email,
                    escolaridade: reg.escolaridade,
                    interesseGraduacao: reg.interesse === 'graduacao' ? 'Sim' : 'Não',
                    interesseTipo: reg.interesse,
                    cursoInteresse: reg.curso,
                    dataInscricao: reg.data_inscricao,
                    qrToken: reg.qr_token,
                    checkedIn: reg.checked_in,
                    checkinDate: reg.checkin_date,
                    cidade: reg.cidade,
                    estado: reg.estado,
                    pais: reg.pais
                }))
            };
        } catch (e) {
            console.error('Erro ao buscar evento por ID:', e);
            return undefined;
        }
    }

    async createEvent(eventoData: Omit<Evento, 'id' | 'inscritos' | 'encerrado'>): Promise<Evento> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data, error } = await supabase
            .from('events')
            .insert([{
                nome_evento: eventoData.nome,
                descricao: eventoData.descricao,
                data_evento: eventoData.data,
                horario_evento: eventoData.horario,
                local: eventoData.local,
                imagem_url: (eventoData as any).imagem,
                status: 'ativo',
                tipo: (eventoData as any).tipo || 'interno',
                link_externo: (eventoData as any).linkExterno,
                proprietario_id: (eventoData as any).proprietarioId,
                data_final: (eventoData as any).dataFinal,
                horario_final: (eventoData as any).horarioFinal
            }])
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            nome: data.nome_evento,
            data: data.data_evento,
            horario: data.horario_evento || '00:00',
            descricao: data.descricao || '',
            local: data.local,
            encerrado: false,
            imagem: data.imagem_url,
            tipo: data.tipo || 'interno',
            linkExterno: data.link_externo,
            proprietarioId: data.proprietario_id,
            dataFinal: data.data_final,
            horarioFinal: data.horario_final,
            inscritos: []
        };
    }

    async updateEvent(evento: Evento): Promise<Evento> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data, error } = await supabase
            .from('events')
            .update({
                nome_evento: evento.nome,
                descricao: evento.descricao,
                data_evento: evento.data,
                horario_evento: evento.horario,
                local: evento.local,
                imagem_url: evento.imagem,
                status: evento.encerrado ? 'encerrado' : 'ativo',
                tipo: evento.tipo,
                link_externo: evento.linkExterno,
                proprietario_id: evento.proprietarioId,
                data_final: evento.dataFinal,
                horario_final: evento.horarioFinal
            })
            .eq('id', evento.id)
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            nome: data.nome_evento,
            data: data.data_evento,
            horario: data.horario_evento || '00:00',
            descricao: data.descricao || '',
            local: data.local,
            encerrado: data.status === 'encerrado',
            imagem: data.imagem_url,
            tipo: data.tipo || 'interno',
            linkExterno: data.link_externo,
            proprietarioId: data.proprietario_id,
            dataFinal: data.data_final,
            horarioFinal: data.horario_final,
            inscritos: evento.inscritos
        };
    }

    async closeEvent(id: string): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { error } = await supabase
            .from('events')
            .update({ status: 'encerrado' })
            .eq('id', id);

        if (error) throw error;
    }

    async reopenEvent(id: string): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { error } = await supabase
            .from('events')
            .update({ status: 'ativo' })
            .eq('id', id);

        if (error) throw error;
    }

    async deleteEvent(id: string): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async registerSubscriber(eventoId: string, inscritoData: Omit<Inscrito, 'id' | 'dataInscricao'>): Promise<Inscrito> {
        if (!supabase) throw new Error('Supabase não configurado.');

        const qrToken = crypto.randomUUID();

        const { data, error } = await supabase
            .from('registrations')
            .insert([{
                event_id: eventoId,
                nome: inscritoData.nomeCompleto,
                cpf: inscritoData.cpf || 'N/A',
                telefone: inscritoData.telefone,
                email: inscritoData.email || 'N/A',
                escolaridade: inscritoData.escolaridade || 'N/A',
                interesse: inscritoData.interesseTipo === 'Pós-graduação' ? 'pos' :
                    inscritoData.interesseTipo === 'Segunda Graduação' ? 'segunda_graduacao' : 'graduacao',
                curso: inscritoData.cursoInteresse,
                qr_token: qrToken,
                cidade: inscritoData.cidade,
                estado: inscritoData.estado,
                pais: inscritoData.pais
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            nomeCompleto: data.nome,
            telefone: data.telefone,
            cpf: data.cpf,
            email: data.email,
            escolaridade: data.escolaridade,
            interesseGraduacao: data.interesse === 'graduacao' ? 'Sim' : 'Não',
            interesseTipo: data.interesse,
            cursoInteresse: data.curso,
            dataInscricao: data.data_inscricao,
            qrToken: data.qr_token,
            checkedIn: data.checked_in,
            checkinDate: data.checkin_date,
            cidade: data.cidade,
            estado: data.estado,
            pais: data.pais
        };
    }

    async registerSubscribersBulk(eventoId: string, inscritos: { nomeCompleto: string; telefone: string; dataInscricao?: string }[]): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');

        const records = inscritos.map(inscrito => {
            const qrToken = crypto.randomUUID();
            return {
                event_id: eventoId,
                nome: inscrito.nomeCompleto,
                cpf: `EXT-${qrToken}`,
                telefone: inscrito.telefone || 'N/A',
                email: 'N/A',
                escolaridade: 'N/A',
                interesse: 'graduacao',
                qr_token: qrToken,
                checked_in: false,
                checkin_date: null,
                cidade: null,
                estado: null,
                pais: null,
                data_inscricao: inscrito.dataInscricao || new Date().toISOString()
            };
        });

        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { error } = await supabase
                .from('registrations')
                .insert(batch);
            if (error) throw error;
        }
    }

    async deleteRegistration(id: string): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { error } = await supabase
            .from('registrations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async validateCheckin(token: string): Promise<{ success: boolean; message: string; inscrito?: Inscrito }> {
        if (!supabase) throw new Error('Supabase não configurado.');

        try {
            const { data: inscrito, error: fetchError } = await supabase
                .from('registrations')
                .select('*, events(nome_evento)')
                .eq('qr_token', token)
                .single();

            if (fetchError || !inscrito) {
                return { success: false, message: 'QR Code inválido ou não encontrado.' };
            }

            if (inscrito.checked_in) {
                return {
                    success: false,
                    message: 'Este QR Code já foi utilizado para check-in.',
                    inscrito: {
                        id: inscrito.id,
                        nomeCompleto: inscrito.nome,
                        telefone: inscrito.telefone,
                        cpf: inscrito.cpf,
                        email: inscrito.email,
                        escolaridade: inscrito.escolaridade,
                        dataInscricao: inscrito.data_inscricao,
                        qrToken: inscrito.qr_token,
                        checkedIn: inscrito.checked_in,
                        checkinDate: inscrito.checkin_date
                    }
                };
            }

            const { data: updated, error: updateError } = await supabase
                .from('registrations')
                .update({
                    checked_in: true,
                    checkin_date: new Date().toISOString()
                })
                .eq('id', inscrito.id)
                .select()
                .single();

            if (updateError) throw updateError;

            return {
                success: true,
                message: 'Entrada confirmada com sucesso!',
                inscrito: {
                    id: updated.id,
                    nomeCompleto: updated.nome,
                    telefone: updated.telefone,
                    cpf: updated.cpf,
                    email: updated.email,
                    escolaridade: updated.escolaridade,
                    dataInscricao: updated.data_inscricao,
                    qrToken: updated.qr_token,
                    checkedIn: updated.checked_in,
                    checkinDate: updated.checkin_date
                }
            };
        } catch (e) {
            console.error('Erro na validação de check-in:', e);
            return { success: false, message: 'Erro ao processar check-in. Tente novamente.' };
        }
    }

    async uploadImage(file: File): Promise<string> {
        if (!supabase) throw new Error('Supabase não configurado.');

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('imagem eventos')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('imagem eventos')
            .getPublicUrl(filePath);

        return publicUrl;
    }

    isAdmin(): boolean {
        return false;
    }

    setAdmin(_isAdmin: boolean): void {
    }

    // Novas operações V2
    async syncUserProfile(clerkId: string, email: string, nome: string): Promise<AdminUser | null> {
        if (!supabase) return null;
        try {
            const { data: existingUser, error: fetchError } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existingUser) {
                if (existingUser.id !== clerkId) {
                    const { data: updatedUser, error: updateError } = await supabase
                        .from('admin_users')
                        .update({ id: clerkId, nome })
                        .eq('email', email)
                        .select()
                        .single();
                    if (updateError) throw updateError;
                    return {
                        id: updatedUser.id,
                        nome: updatedUser.nome,
                        email: updatedUser.email,
                        perfil: updatedUser.perfil as any,
                        status: updatedUser.status as any,
                        createdAt: updatedUser.created_at
                    };
                }
                return {
                    id: existingUser.id,
                    nome: existingUser.nome,
                    email: existingUser.email,
                    perfil: existingUser.perfil as any,
                    status: existingUser.status as any,
                    createdAt: existingUser.created_at
                };
            }

            const { count, error: countError } = await supabase
                .from('admin_users')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            const perfil = (count === 0) ? 'ADMIN' : 'COMERCIAL';
            const status = 'ativo';
            
            const { data: newUser, error: insertError } = await supabase
                .from('admin_users')
                .insert([{
                    id: clerkId,
                    nome,
                    email,
                    perfil,
                    status
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            return {
                id: newUser.id,
                nome: newUser.nome,
                email: newUser.email,
                perfil: newUser.perfil as any,
                status: newUser.status as any,
                createdAt: newUser.created_at
            };
        } catch (e) {
            console.error('Erro ao sincronizar perfil do usuário:', e);
            return null;
        }
    }

    async getAdminUsers(): Promise<AdminUser[]> {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(u => ({
                id: u.id,
                nome: u.nome,
                email: u.email,
                perfil: u.perfil as any,
                status: u.status as any,
                createdAt: u.created_at
            }));
        } catch (e) {
            console.error('Erro ao listar usuários administrativos:', e);
            return [];
        }
    }

    async createAdminUser(user: Omit<AdminUser, 'createdAt'>): Promise<AdminUser> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data, error } = await supabase
            .from('admin_users')
            .insert([{
                id: user.id || crypto.randomUUID(),
                nome: user.nome,
                email: user.email,
                perfil: user.perfil,
                status: user.status
            }])
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            nome: data.nome,
            email: data.email,
            perfil: data.perfil as any,
            status: data.status as any,
            createdAt: data.created_at
        };
    }

    async updateAdminUser(user: AdminUser): Promise<AdminUser> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data, error } = await supabase
            .from('admin_users')
            .update({
                nome: user.nome,
                perfil: user.perfil,
                status: user.status
            })
            .eq('email', user.email)
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            nome: data.nome,
            email: data.email,
            perfil: data.perfil as any,
            status: data.status as any,
            createdAt: data.created_at
        };
    }

    async deleteAdminUser(id: string): Promise<void> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { error } = await supabase
            .from('admin_users')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async getDrawHistory(eventId?: string): Promise<DrawHistory[]> {
        if (!supabase) return [];
        try {
            let query = supabase
                .from('draw_history')
                .select('*, events(nome_evento), registrations(nome, email, telefone, cpf), admin_users(nome)')
                .order('data_sorteio', { ascending: false });

            if (eventId) {
                query = query.eq('event_id', eventId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map(d => ({
                id: d.id,
                eventId: d.event_id,
                eventName: d.events?.nome_evento || 'Evento não localizado',
                registrationId: d.registration_id,
                winnerName: d.registrations?.nome || 'Inscrito não localizado',
                winnerEmail: d.registrations?.email || 'N/A',
                winnerPhone: d.registrations?.telefone || 'N/A',
                winnerRegistrationNumber: d.registrations?.cpf || 'N/A',
                responsavelId: d.responsavel_id,
                responsavelName: d.admin_users?.nome || 'Responsável não localizado',
                totalInscritos: d.total_inscritos,
                novosInscritos: d.novos_inscritos,
                dataSorteio: d.data_sorteio
            }));
        } catch (e) {
            console.error('Erro ao buscar histórico de sorteios:', e);
            return [];
        }
    }

    async saveDraw(draw: Omit<DrawHistory, 'id' | 'dataSorteio'>): Promise<DrawHistory> {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data, error } = await supabase
            .from('draw_history')
            .insert([{
                event_id: draw.eventId,
                registration_id: draw.registrationId,
                responsavel_id: draw.responsavelId,
                total_inscritos: draw.totalInscritos,
                novos_inscritos: draw.novosInscritos
            }])
            .select('*, events(nome_evento), registrations(nome, email, telefone, cpf), admin_users(nome)')
            .single();

        if (error) throw error;
        return {
            id: data.id,
            eventId: data.event_id,
            eventName: data.events?.nome_evento || 'Evento não localizado',
            registrationId: data.registration_id,
            winnerName: data.registrations?.nome || 'Inscrito não localizado',
            winnerEmail: data.registrations?.email || 'N/A',
            winnerPhone: data.registrations?.telefone || 'N/A',
            winnerRegistrationNumber: data.registrations?.cpf || 'N/A',
            responsavelId: data.responsavel_id,
            responsavelName: data.admin_users?.nome || 'Responsável não localizado',
            totalInscritos: data.total_inscritos,
            novosInscritos: data.novosInscritos,
            dataSorteio: data.data_sorteio
        };
    }
}
