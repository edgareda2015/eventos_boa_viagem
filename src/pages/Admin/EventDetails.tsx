

import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Evento, Inscrito } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { exportToXLSX } from '../../utils/export';
import { generateReceipt, generateEventRedirectQRCode } from '../../utils/receipt';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AlertDialog from '../../components/ui/AlertDialog';
import QRCodeEditorModal from '../../components/QRCodeEditorModal';
import { parseLocalDate } from '../../utils/date';

interface AdminEventDetailsProps {
  eventos: Evento[];
  onEnd: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteRegistration: (id: string) => Promise<void>;
  onCheckin: (token: string) => Promise<{ success: boolean; message: string }>;
  onRegisterBulk: (eventoId: string, inscritos: { nomeCompleto: string; telefone: string; dataInscricao?: string }[]) => Promise<void>;
}

const AdminEventDetails: React.FC<AdminEventDetailsProps> = ({ eventos, onEnd, onReopen, onDelete, onDeleteRegistration, onCheckin, onRegisterBulk }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const evento = eventos.find(e => e.id === id);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'pending'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Import State & Ref
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const excelDateToJSDate = (serial: any) => {
    if (!serial || isNaN(serial)) return new Date().toISOString();
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds).toISOString();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

          if (rawData.length === 0) {
            setAlertConfig({
              isOpen: true,
              title: 'Planilha Vazia',
              message: 'Nenhum registro encontrado na planilha.',
              type: 'error'
            });
            setIsImporting(false);
            return;
          }

          const firstRow = rawData[0];
          const hasNome = 'NOME' in firstRow;

          if (!hasNome) {
            setAlertConfig({
              isOpen: true,
              title: 'Colunas Inválidas',
              message: 'A planilha deve conter uma coluna com o cabeçalho "NOME". Opcionalmente, pode conter "CONTATO" (ou "TELEFONE") e "DATA".',
              type: 'error'
            });
            setIsImporting(false);
            return;
          }

          const mapped = rawData.map(row => {
            const nomeCompleto = row['NOME']?.toString().trim() || 'N/A';
            const telefone = (row['CONTATO'] || row['TELEFONE'] || 'N/A').toString().trim();
            const rawDate = row['DATA '] || row['DATA'] || row['Data'];
            const dataInscricao = excelDateToJSDate(rawDate);

            return {
              nomeCompleto,
              telefone,
              dataInscricao
            };
          });

          await onRegisterBulk(evento.id, mapped);

          setAlertConfig({
            isOpen: true,
            title: 'Importação Concluída',
            message: `Sucesso ao importar ${mapped.length} participantes para o evento!`,
            type: 'success'
          });
        } catch (err: any) {
          console.error(err);
          setAlertConfig({
            isOpen: true,
            title: 'Erro ao Importar',
            message: `Ocorreu um erro ao processar a planilha: ${err.message || err}`,
            type: 'error'
          });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      setAlertConfig({
        isOpen: true,
        title: 'Erro ao Importar',
        message: `Ocorreu um erro ao abrir o arquivo: ${err.message || err}`,
        type: 'error'
      });
      setIsImporting(false);
    }
  };

  // Modal States
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'info'
  });

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const filteredInscritos = useMemo(() => {
    if (!evento) return [];

    let result = [...evento.inscritos];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i =>
        i.nomeCompleto.toLowerCase().includes(term) ||
        (i.cpf && i.cpf.includes(term)) ||
        (i.email && i.email.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter === 'present') {
      result = result.filter(i => i.checkedIn);
    } else if (statusFilter === 'pending') {
      result = result.filter(i => !i.checkedIn);
    }

    // Sort
    result.sort((a, b) => {
      const nameA = a.nomeCompleto.toLowerCase();
      const nameB = b.nomeCompleto.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    return result;
  }, [evento, searchTerm, statusFilter, sortOrder]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortOrder]);

  const paginatedInscritos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInscritos.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInscritos, currentPage]);

  const totalPages = Math.ceil(filteredInscritos.length / itemsPerPage);

  if (!evento) {
    return <div className="text-center py-20 font-bold text-gray-400">Evento institucional não localizado.</div>;
  }

  const handleEncerrar = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Encerrar Evento',
      message: 'CONFIRMAÇÃO: Encerrar o registro de presença? Ninguém mais poderá confirmar participação online.',
      onConfirm: () => onEnd(evento.id),
      type: 'warning'
    });
  };

  const handleReabrir = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Restaurar Evento',
      message: 'CONFIRMAÇÃO: Deseja realmente restaurar este evento? Ele ficará ativo novamente para inscrições e o check-in online continuará funcionando com os mesmos QR Codes já impressos.',
      onConfirm: () => onReopen(evento.id),
      type: 'info'
    });
  };

  const handleDelete = () => {
    setDeletePassword('');
    setPasswordError(false);
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Evento',
      message: `ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nDeseja realmente excluir o evento "${evento.nome}"?\n\nTodos os registros de participantes também serão excluídos.\n\nDIGITE A SENHA DE SEGURANÇA PARA PROSSEGUIR:`,
      onConfirm: () => {
        // Validation happens inside the component handle or here? 
        // Let's handle it in the component and only call deletion if password is correct.
      },
      type: 'danger'
    });
  };

  const handleConfirmDelete = () => {
    const MASTER_PASSWORD = '240686';
    if (deletePassword === MASTER_PASSWORD) {
      onDelete(evento?.id || '');
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      navigate('/admin');
    } else {
      setPasswordError(true);
      setAlertConfig({
        isOpen: true,
        title: 'Senha Incorreta',
        message: 'A senha digitada está incorreta. A exclusão foi cancelada.',
        type: 'error'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ["Nome Completo", "CPF", "Telefone", "E-mail", "Escolaridade", "Interesse/Tipo", "Curso Interesse", "Cidade", "Estado", "País", "Data/Hora Registro", "Presença", "Data/Hora Check-in"];
    const rows = evento.inscritos.map(i => [
      i.nomeCompleto,
      i.cpf || 'N/A',
      i.telefone,
      i.email || 'N/A',
      i.escolaridade || 'N/A',
      i.interesseGraduacao || i.interesseTipo || 'N/A',
      i.cursoInteresse || 'N/A',
      i.cidade || 'N/A',
      i.estado || 'N/A',
      i.pais || 'N/A',
      new Date(i.dataInscricao).toLocaleString('pt-BR'),
      i.checkedIn ? 'SIM' : 'NÃO',
      i.checkinDate ? new Date(i.checkinDate).toLocaleString('pt-BR') : 'N/A'
    ]);

    exportToXLSX(rows, headers, `LISTA_AUDITORIO_${evento.nome.toUpperCase().replace(/\s/g, '_')}`);
  };

  const columns: Column<Inscrito>[] = [
    {
      header: 'Participante',
      accessor: (item) => (
        <div className="min-w-[120px]">
          <p className="font-bold text-gray-900 text-xs">{item.nomeCompleto.toUpperCase()}</p>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter leading-tight">{item.escolaridade}</p>
        </div>
      ),
      sortable: true
    },
    {
      header: evento.tipo === 'link_externo' ? 'Matrícula' : 'CPF',
      accessor: 'cpf',
      className: 'text-[11px] font-bold text-gray-700 min-w-[100px]'
    },
    {
      header: 'Contato',
      accessor: (item) => (
        <div className="min-w-[140px]">
          <p className="text-[10px] text-gray-400 truncate">{item.email}</p>
          <p className="text-[10px] text-gray-400">{item.telefone}</p>
        </div>
      )
    },
    {
      header: 'Interesse',
      accessor: (item) => item.cursoInteresse ? (
        <div className="bg-primary/5 p-1.5 rounded-lg inline-block border border-primary/10 max-w-[150px]">
          <p className="text-[8px] font-black text-primary uppercase tracking-widest leading-none mb-1">Curso:</p>
          <p className="text-[10px] font-bold text-gray-800 leading-tight">{item.cursoInteresse}</p>
        </div>
      ) : (
        <span className="text-[10px] text-gray-300 font-bold italic">Nenhum</span>
      )
    },
    {
      header: 'Origem',
      accessor: (item) => (item.cidade || item.estado || item.pais) ? (
        <div className="min-w-[120px]">
          <p className="text-[10px] font-bold text-gray-800 leading-tight">
            {item.cidade}{item.estado ? `, ${item.estado}` : ''}
          </p>
          <p className="text-[8px] font-black text-primary uppercase tracking-widest leading-none mt-1">{item.pais}</p>
        </div>
      ) : (
        <span className="text-[10px] text-gray-300 font-bold italic">N/A</span>
      ),
    },
    {
      header: 'Data Registro',
      accessor: (item) => (
        <div className="text-center min-w-[80px]">
          <p className="text-[10px] font-bold text-gray-500">
            {new Date(item.dataInscricao).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-[9px] text-gray-400">
            {new Date(item.dataInscricao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ),
      className: 'text-center',
      sortable: true
    },
    {
      header: evento.tipo === 'link_externo' ? 'Status' : 'Presença',
      accessor: (item) => (
        <div className="text-center min-w-[100px]">
          {item.checkedIn || evento.tipo === 'link_externo' ? (
            <div className="flex flex-col items-center">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-600 border border-green-200">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                {evento.tipo === 'link_externo' ? 'ACESSOU' : 'PRESENTE'}
              </span>
              {(item.checkinDate || evento.tipo === 'link_externo') && (
                <p className="text-[8px] text-gray-400 font-bold mt-1">
                  {new Date(item.checkinDate || item.dataInscricao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-400 border border-gray-200">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              PENDENTE
            </span>
          )}
        </div>
      ),
      className: 'text-center',
      sortable: true
    },
    {
      header: 'Ações',
      accessor: (item) => (
        <div className="flex justify-center gap-2 no-print">
          {(item.checkedIn || evento.tipo === 'link_externo') ? (
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">done_all</span>
              {evento.tipo === 'link_externo' ? 'Registrado' : 'Validado'}
            </span>
          ) : (
            <button
              onClick={async () => {
                setConfirmConfig({
                  isOpen: true,
                  title: 'Confirmar Presença',
                  message: `Confirmar presença manual para ${item.nomeCompleto.toUpperCase()}?`,
                  onConfirm: async () => {
                    const result = await onCheckin(item.qrToken);
                    if (!result.success) {
                      setAlertConfig({
                        isOpen: true,
                        title: 'Erro no Check-in',
                        message: result.message,
                        type: 'error'
                      });
                    }
                  },
                  type: 'info'
                });
              }}
              className="bg-primary text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
              Confirmar
            </button>
          )}

          <button
            onClick={() => generateReceipt(evento, item)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 shadow-sm ${item.checkedIn || evento.tipo === 'link_externo'
              ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
              : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            title={item.checkedIn ? "Gerar Certificado de Presença" : "Reimprimir Comprovante de Inscrição"}
          >
            <span className="material-symbols-outlined text-[14px]">{item.checkedIn ? 'verified' : 'print'}</span>
            {(item.checkedIn || evento.tipo === 'link_externo') ? 'Certificado' : 'Recibo'}
          </button>

          <button
            onClick={async () => {
              setConfirmConfig({
                isOpen: true,
                title: 'Excluir Participante',
                message: `ATENÇÃO: Deseja realmente excluir o registro de ${item.nomeCompleto.toUpperCase()}?\n\nEsta ação não pode ser desfeita.`,
                onConfirm: async () => {
                  try {
                    await onDeleteRegistration(item.id);
                  } catch (e) {
                    setAlertConfig({
                      isOpen: true,
                      title: 'Erro ao Excluir',
                      message: 'Erro ao excluir participante. Tente novamente.',
                      type: 'error'
                    });
                  }
                },
                type: 'danger'
              });
            }}
            className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-1 shadow-sm"
            title="Excluir Participante"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      ),
      className: 'text-center'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 no-print px-4 md:px-0">
        <Link to="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm font-black uppercase tracking-tighter">
          <span className="material-symbols-outlined font-bold">arrow_back</span>
          Painel do Auditório
        </Link>

        <div className="grid grid-cols-2 sm:flex gap-3">
          <Link
            to={`/admin/evento/${evento.id}/editar`}
            className="bg-white border-2 border-primary text-primary px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-primary-light transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Editar
          </Link>
          <button
            onClick={handlePrint}
            className="bg-white border-2 border-gray-100 text-gray-700 px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            Imprimir
          </button>
          {evento.encerrado ? (
            <button
              onClick={handleReabrir}
              className="col-span-2 sm:col-auto bg-green-50 text-green-600 border-2 border-green-50 px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">restore</span>
              Restaurar Evento
            </button>
          ) : (
            <button
              onClick={handleEncerrar}
              className="col-span-2 sm:col-auto bg-red-50 text-red-600 border-2 border-red-50 px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
            >
              Encerrar Evento
            </button>
          )}
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="col-span-2 sm:col-auto bg-primary text-white border-2 border-primary px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            <span className="material-symbols-outlined text-lg">qr_code_2</span>
            QR Inscrição
          </button>
          <button
            onClick={handleDelete}
            className="col-span-2 sm:col-auto bg-red-600 text-white border-2 border-red-600 px-4 md:px-5 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Excluir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar info */}
        <div className="lg:col-span-1 space-y-6 no-print px-4 md:px-0">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="mb-6 flex items-center gap-2">
              <span className={`inline-block size-3 rounded-full ${evento.encerrado ? 'bg-red-500' : 'bg-green-500'}`}></span>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${evento.encerrado ? 'text-red-500' : 'text-green-500'}`}>
                {evento.encerrado ? 'REGISTRO ENCERRADO' : 'INSCRIÇÕES ABERTAS'}
              </span>
            </div>

            <div className="mb-6">
              {evento.tipo === 'link_externo' ? (
                <span className="px-4 py-1.5 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-green-100 flex items-center gap-2 w-fit">
                  <span className="material-symbols-outlined text-sm">link</span>
                  Redirecionamento Externo
                </span>
              ) : evento.tipo === 'externo' ? (
                <span className="px-4 py-1.5 bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-purple-100 flex items-center gap-2 w-fit">
                  <span className="material-symbols-outlined text-sm">public</span>
                  Evento Externo
                </span>
              ) : (
                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-100 flex items-center gap-2 w-fit">
                  <span className="material-symbols-outlined text-sm">school</span>
                  Evento Interno
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-6 leading-tight tracking-tight">{evento.nome}</h2>

            <div className="space-y-5 border-t border-gray-50 pt-6">
              <div className="flex gap-4">
                <div className="size-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-gray-400">calendar_today</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Programada</p>
                  <p className="text-sm font-bold text-gray-800">{parseLocalDate(evento.data).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="size-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-gray-400">schedule</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário Previsto</p>
                  <p className="text-sm font-bold text-gray-800">{evento.horario}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="size-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-gray-400">location_on</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Localização</p>
                  <p className="text-sm font-bold text-gray-800">{evento.local}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary p-6 md:p-8 rounded-[2rem] shadow-xl shadow-primary/20 text-white relative overflow-hidden group">
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white/10 text-7xl md:text-9xl group-hover:scale-110 transition-transform">
              {evento.tipo === 'link_externo' ? 'ads_click' : 'group'}
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary-light/70 mb-1">
              {evento.tipo === 'link_externo' ? 'Total de Acessos' : 'Presenças Confirmadas'}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl md:text-6xl font-black">
                {evento.tipo === 'link_externo' ? evento.inscritos.length : evento.inscritos.filter(i => i.checkedIn).length}
              </p>
              {evento.tipo !== 'link_externo' && (
                <p className="text-lg md:text-xl font-bold text-primary-light/60">/ {evento.inscritos.length}</p>
              )}
            </div>
            <p className="text-[9px] font-bold text-primary-light/50 mt-2 uppercase tracking-tighter">
              {evento.tipo === 'link_externo' 
                ? 'Acessos registrados via QR Code' 
                : `${((evento.inscritos.filter(i => i.checkedIn).length / (evento.inscritos.length || 1)) * 100).toFixed(0)}% de comparecimento`}
            </p>
          </div>
        </div>

        {/* List of Subscribers */}
        <div className="lg:col-span-2 space-y-6 w-full print:w-full px-4 md:px-0">
          <div className="bg-white md:rounded-[2.5rem] shadow-sm border-y md:border border-gray-100 overflow-hidden">
            <div className="p-5 md:p-8 border-b flex flex-col gap-6 no-print">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <h3 className="text-lg md:text-xl font-black text-gray-900">
                    {evento.tipo === 'link_externo' ? 'Lista de Acessos' : 'Participantes Registrados'}
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Mostrando {paginatedInscritos.length} de {filteredInscritos.length} registros
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <button
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="bg-white border-2 border-primary text-primary px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isImporting ? 'sync' : 'upload'}
                    </span>
                    {isImporting ? 'Importando...' : 'Importar Excel'}
                  </button>
                  {evento.inscritos.length > 0 && (
                    <button
                      onClick={handleExport}
                      className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100 w-full sm:w-auto"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      Exportar Excel
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                  <input
                    type="text"
                    placeholder="Buscar por nome, CPF ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="present">Presentes</option>
                    <option value="pending">Pendentes</option>
                  </select>

                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {sortOrder === 'asc' ? 'sort_by_alpha' : 'sort_by_alpha'}
                    </span>
                    {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                  </button>
                </div>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print-only p-10 border-b-2 border-gray-200 text-center mb-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h1 className="text-3xl font-black text-primary">UNINASSAU</h1>
                  {evento.imagem && (
                    <img src={evento.imagem} alt="" className="h-12 w-auto rounded object-contain" />
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lista de Presença Oficial</p>
                  <p className="text-xs font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <h2 className="text-2xl font-black uppercase mb-2">{evento.nome}</h2>
              <div className="flex justify-center gap-6 text-sm font-bold text-gray-600">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_month</span> {parseLocalDate(evento.data).toLocaleDateString('pt-BR')}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {evento.horario}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span> {evento.local}</span>
              </div>
            </div>

            <Table
              data={paginatedInscritos}
              columns={columns.filter(col => {
                if (col.header === 'Origem' && evento.tipo !== 'mobilidade') return false;
                return true;
              })}
              keyExtractor={(item) => item.id}
              emptyMessage={searchTerm || statusFilter !== 'all' ? "Nenhum participante encontrado com esses filtros." : "Aguardando primeiros registros"}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-6 bg-gray-50/50 border-t no-print">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="size-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-primary hover:border-primary disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>

                <div className="flex items-center gap-1 px-4">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Show first, last, current, and pages around current
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`size-10 rounded-xl text-xs font-black transition-all ${currentPage === pageNum
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (
                      (pageNum === 2 && currentPage > 3) ||
                      (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return <span key={pageNum} className="text-gray-300 text-xs font-bold">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="size-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-primary hover:border-primary disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>

                <div className="ml-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Total: {filteredInscritos.length} registros
                </div>
              </div>
            )}

            <div className="hidden print-only p-20 mt-20 border-t-0">
              <div className="flex justify-between gap-12">
                <div className="flex-1 border-t border-gray-900 pt-2 text-center">
                  <p className="text-xs font-bold uppercase">Responsável pelo Evento</p>
                </div>
                <div className="flex-1 border-t border-gray-900 pt-2 text-center">
                  <p className="text-xs font-bold uppercase">Coordenação UNINASSAU</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setDeletePassword('');
          setPasswordError(false);
        }}
        onConfirm={confirmConfig.title === 'Excluir Evento' ? handleConfirmDelete : confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      >
        {confirmConfig.title === 'Excluir Evento' && (
          <div className="mt-4 w-full px-8">
            <input
              type="password"
              placeholder="Senha de segurança"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setPasswordError(false);
              }}
              className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl text-center text-lg font-black tracking-[0.5em] focus:outline-none focus:ring-2 transition-all ${passwordError ? 'border-red-500 focus:ring-red-200' : 'border-gray-100 focus:ring-primary/20 focus:border-primary'
                }`}
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-[10px] font-black mt-2 uppercase">Senha incorreta!</p>}
          </div>
        )}
      </ConfirmDialog>

      <AlertDialog
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

      <QRCodeEditorModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onGenerate={(texts) => {
          generateEventRedirectQRCode(evento, texts);
        }}
        eventName={evento.nome}
        eventType={evento.tipo}
      />
    </div>
  );
};

export default AdminEventDetails;
