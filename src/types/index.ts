
export interface Evento {
  id: string;
  nome: string;
  data: string;
  horario: string;
  descricao: string;
  local: string;
  encerrado: boolean;
  inscritos: Inscrito[];
  imagem?: string;
  tipo?: 'interno' | 'externo' | 'mobilidade' | 'link_externo';
  linkExterno?: string;
  proprietarioId?: string;
  dataFinal?: string;
  horarioFinal?: string;
}

export interface Inscrito {
  id: string;
  nomeCompleto: string;
  telefone: string;
  cpf: string;
  email: string;
  escolaridade: string;
  interesseGraduacao?: string; // Sim/Não
  interesseTipo?: string; // Nova Graduação / Pós / Não
  cursoInteresse?: string;
  dataInscricao: string;
  qrToken?: string;
  checkedIn?: boolean;
  checkinDate?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
}

export enum Escolaridade {
  FUNDAMENTAL = 'Ensino fundamental',
  MEDIO_COMPLETO = 'Ensino médio completo',
  MEDIO_ANDAMENTO = 'Ensino médio em andamento',
  SUPERIOR_ANDAMENTO = 'Ensino superior em andamento',
  SUPERIOR_COMPLETO = 'Ensino superior completo',
  POS_GRADUACAO = 'Pós-graduação'
}

export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'COMERCIAL';
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export interface DrawHistory {
  id: string;
  eventId: string;
  eventName?: string;
  registrationId: string;
  winnerName?: string;
  winnerEmail?: string;
  winnerPhone?: string;
  winnerRegistrationNumber?: string;
  responsavelId: string;
  responsavelName?: string;
  totalInscritos: number;
  novosInscritos: number;
  dataSorteio: string;
}
