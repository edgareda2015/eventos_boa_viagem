import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Evento, Inscrito, AdminUser, DrawHistory } from '../../types';

interface DrawsProps {
  eventos: Evento[];
  adminProfile: AdminUser | null;
  getDrawHistory: (eventId?: string) => Promise<DrawHistory[]>;
  saveDraw: (draw: Omit<DrawHistory, 'id' | 'dataSorteio'>) => Promise<DrawHistory>;
}

const Draws: React.FC<DrawsProps> = ({
  eventos,
  adminProfile,
  getDrawHistory,
  saveDraw,
}) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [scope, setScope] = useState<'all' | 'new'>('all');
  const [history, setHistory] = useState<DrawHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Sorteador State
  const [status, setStatus] = useState<'idle' | 'drawing' | 'winner'>('idle');
  const [winner, setWinner] = useState<Inscrito | null>(null);
  const [animatingName, setAnimatingName] = useState('');
  
  // Feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load overall history on mount
  useEffect(() => {
    fetchHistory();
  }, [selectedEventId]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await getDrawHistory(selectedEventId || undefined);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter events based on role
  const visibleEvents = eventos.filter(e => {
    if (adminProfile?.perfil === 'COMERCIAL') {
      return e.proprietarioId === adminProfile.id;
    }
    return true; // ADMIN ve todos
  });

  const selectedEvent = eventos.find(e => e.id === selectedEventId);

  // Get drawing metrics for selected event
  const getEventDrawMetrics = () => {
    if (!selectedEvent) return { total: 0, new: 0, latestDrawDate: null, newInscritosList: [] as Inscrito[] };
    
    // Find history of draws for this event
    const eventHistory = history.filter(h => h.eventId === selectedEvent.id);
    let latestDrawDate: Date | null = null;
    
    if (eventHistory.length > 0) {
      // Get the most recent draw date
      const dates = eventHistory.map(h => new Date(h.dataSorteio).getTime());
      latestDrawDate = new Date(Math.max(...dates));
    }

    const allInscritos = selectedEvent.inscritos || [];
    
    // Determine new ones since latestDrawDate
    let newInscritosList = allInscritos;
    if (latestDrawDate) {
      const cutOff = latestDrawDate.getTime();
      newInscritosList = allInscritos.filter(i => new Date(i.dataInscricao).getTime() > cutOff);
    } else {
      // Se nunca foi sorteado, todos são considerados "novos" para o primeiro sorteio
      newInscritosList = allInscritos;
    }

    return {
      total: allInscritos.length,
      new: newInscritosList.length,
      latestDrawDate,
      newInscritosList
    };
  };

  const { total: totalInscritos, new: novosInscritos, latestDrawDate, newInscritosList } = getEventDrawMetrics();

  const handleStartDraw = () => {
    if (!selectedEvent) {
      showToast('Por favor, selecione um evento primeiro.', 'error');
      return;
    }

    const pool = scope === 'all' ? (selectedEvent.inscritos || []) : newInscritosList;

    if (pool.length === 0) {
      showToast(
        scope === 'all'
          ? 'Não há participantes inscritos neste evento para sortear.'
          : 'Não há novos participantes inscritos desde o último sorteio.',
        'error'
      );
      return;
    }

    setStatus('drawing');
    setWinner(null);

    // Roleta animation
    let duration = 3000; // 3 seconds
    let intervalTime = 80;
    let elapsed = 0;

    const timer = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      setAnimatingName(pool[randomIdx].nomeCompleto);
      elapsed += intervalTime;

      // Slow down slightly near the end
      if (elapsed > duration - 1000) {
        clearInterval(timer);
        slowDownDraw(pool, intervalTime * 1.5, 0, duration - elapsed);
      }
    }, intervalTime);
  };

  const slowDownDraw = (pool: Inscrito[], currentInterval: number, steps: number, remaining: number) => {
    if (steps > 6) {
      // Determine final winner
      const finalIdx = Math.floor(Math.random() * pool.length);
      const chosen = pool[finalIdx];
      
      setWinner(chosen);
      setStatus('winner');
      setAnimatingName('');
      
      // Save draw in database
      saveDrawToDatabase(chosen);
      return;
    }

    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      setAnimatingName(pool[randomIdx].nomeCompleto);
      slowDownDraw(pool, currentInterval * 1.3, steps + 1, remaining);
    }, currentInterval);
  };

  const saveDrawToDatabase = async (chosen: Inscrito) => {
    if (!selectedEvent || !adminProfile) return;
    try {
      await saveDraw({
        eventId: selectedEvent.id,
        registrationId: chosen.id,
        responsavelId: adminProfile.id,
        totalInscritos: totalInscritos,
        novosInscritos: novosInscritos
      });
      showToast('Sorteio registrado com sucesso!', 'success');
      fetchHistory(); // refresh history table
    } catch (err) {
      console.error('Erro ao salvar histórico do sorteio:', err);
    }
  };

  const handleResetDraw = () => {
    setStatus('idle');
    setWinner(null);
    setAnimatingName('');
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-in">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl transition-all ${
          toastMessage.type === 'success' ? 'bg-green-600 text-white shadow-green-200 animate-bounce' : 'bg-red-600 text-white shadow-red-200'
        }`}>
          <span className="material-symbols-outlined font-bold">
            {toastMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className="text-sm font-bold">{toastMessage.text}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 px-4 md:px-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/admin" className="text-gray-400 hover:text-primary transition-colors flex items-center gap-1 text-[10px] md:text-xs font-black uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar ao Painel
            </Link>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl md:text-4xl text-gray-400">celebration</span>
            Sorteador de Brindes
          </h2>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Realize sorteios em tempo real para os inscritos presentes nos eventos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left/Middle Column: Config & Drawing Board */}
        <div className="lg:col-span-2 space-y-8">
          {/* Card Configuração */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 border-b pb-4">
              <span className="material-symbols-outlined text-primary">tune</span>
              Configurações do Sorteio
            </h3>
            
            {/* Event Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Selecione o Evento</label>
              <div className="relative bg-[#E8F0FE] rounded-2xl overflow-hidden">
                <select
                  disabled={status === 'drawing'}
                  className="w-full bg-transparent border-none p-5 text-sm font-bold text-gray-700 outline-none pr-10 cursor-pointer disabled:opacity-55 focus:ring-2 focus:ring-blue-500/20"
                  value={selectedEventId}
                  onChange={e => {
                    setSelectedEventId(e.target.value);
                    handleResetDraw();
                  }}
                >
                  <option value="">-- Escolha um Evento --</option>
                  {visibleEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEvent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in">
                {/* Stats Panel */}
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col justify-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Informações do Evento</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span className="text-gray-500">Inscritos Totais:</span>
                      <span className="text-gray-900 bg-gray-200/60 px-2 py-0.5 rounded-lg text-xs">{totalInscritos}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span className="text-gray-500">Novos Inscritos:</span>
                      <span className="text-primary bg-primary-light px-2 py-0.5 rounded-lg text-xs">{novosInscritos}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-tight pt-2 border-t">
                      <span>Último Sorteio:</span>
                      <span>{latestDrawDate ? latestDrawDate.toLocaleDateString('pt-BR') : 'Nenhum'}</span>
                    </div>
                  </div>
                </div>

                {/* Scope selection */}
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Escopo dos Participantes</p>
                  
                  <label className="flex items-center gap-3 cursor-pointer group text-sm font-bold text-gray-700">
                    <input
                      type="radio"
                      name="scope"
                      disabled={status === 'drawing'}
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                      className="text-primary focus:ring-primary border-gray-300 size-4"
                    />
                    <span>Sortear entre todos</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group text-sm font-bold text-gray-700">
                    <input
                      type="radio"
                      name="scope"
                      disabled={status === 'drawing'}
                      checked={scope === 'new'}
                      onChange={() => setScope('new')}
                      className="text-primary focus:ring-primary border-gray-300 size-4"
                    />
                    <div>
                      <span>Sortear apenas novos inscritos</span>
                      <p className="text-[10px] text-gray-400 font-medium">Cadastrados desde o último sorteio</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Sorteador Display Board */}
          {selectedEvent && (
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center min-h-[400px] flex flex-col justify-center items-center">
              <span className="material-symbols-outlined absolute -right-16 -top-16 text-white/5 text-[15rem] pointer-events-none select-none">celebration</span>
              
              {status === 'idle' && (
                <div className="space-y-6 max-w-md animate-in">
                  <span className="material-symbols-outlined text-amber-400 text-7xl font-bold animate-pulse">local_activity</span>
                  <h4 className="text-white text-2xl font-black">Pronto para Iniciar</h4>
                  <p className="text-white/60 text-sm">O sorteador irá selecionar um participante aleatório com base no escopo escolhido.</p>
                  <button
                    onClick={handleStartDraw}
                    className="bg-amber-500 hover:bg-amber-400 text-white font-black text-lg px-12 py-5 rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all w-full md:w-auto uppercase tracking-wider"
                  >
                    Começar Sorteio
                  </button>
                </div>
              )}

              {status === 'drawing' && (
                <div className="space-y-8 animate-pulse">
                  <div className="size-20 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <h4 className="text-amber-400 text-[11px] font-black uppercase tracking-[0.4em]">Sorteando Ganhador...</h4>
                  <p className="text-white text-3xl md:text-4xl font-black min-h-[50px] tracking-tight truncate max-w-xl">
                    {animatingName || '...'}
                  </p>
                </div>
              )}

              {status === 'winner' && winner && (
                <div className="space-y-8 animate-in max-w-lg w-full bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 relative">
                  {/* Confetti effect inside card */}
                  <span className="absolute -top-6 -left-6 text-amber-400 text-5xl rotate-12">🎉</span>
                  <span className="absolute -top-6 -right-6 text-amber-400 text-5xl -rotate-12">🎉</span>

                  <h4 className="text-amber-400 text-xs font-black uppercase tracking-[0.3em]">🏆 Parabéns ao Vencedor!</h4>
                  
                  <div className="space-y-2">
                    <p className="text-white text-3xl font-black uppercase tracking-tight truncate">{winner.nomeCompleto}</p>
                    <p className="text-white/70 text-sm font-semibold">{winner.email}</p>
                    <p className="text-white/70 text-sm font-semibold">{winner.telefone}</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left grid grid-cols-2 gap-4 text-xs font-semibold text-white/80">
                    <div>
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Inscrição (CPF)</p>
                      <p className="text-sm font-bold text-white mt-0.5">{winner.cpf}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Token Validador</p>
                      <p className="text-sm font-bold text-white mt-0.5 truncate">{winner.qrToken || 'Interno'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={handleStartDraw}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all"
                    >
                      Sortear Novamente
                    </button>
                    <button
                      onClick={handleResetDraw}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all border border-white/20"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Draw History */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 border-b pb-4 mb-6">
              <span className="material-symbols-outlined text-primary">history</span>
              Últimos Sorteados
            </h3>

            {loadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center animate-pulse">
                <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Carregando histórico...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center grayscale opacity-45">
                <span className="material-symbols-outlined text-4xl text-gray-400">emoji_events</span>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mt-2">Nenhum sorteio registrado</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {history.map(h => (
                  <div key={h.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors flex flex-col gap-2 relative">
                    <span className="absolute right-4 top-4 text-xs font-black text-amber-500">🏆</span>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">{h.eventName}</p>
                      <p className="font-bold text-gray-800 text-sm truncate mt-0.5">{h.winnerName?.toUpperCase()}</p>
                    </div>
                    <div className="flex justify-between items-end border-t pt-2 mt-1 text-[9px] text-gray-400 font-bold uppercase tracking-tight">
                      <div>
                        <span>Por: {h.responsavelName}</span>
                      </div>
                      <div className="text-right">
                        <span>{new Date(h.dataSorteio).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Draws;
