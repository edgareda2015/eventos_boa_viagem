import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Evento, Escolaridade, Inscrito } from '../../types';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import logo from '../../assets/img/logo.png';
import { generateReceipt } from '../../utils/receipt';
import AlertDialog from '../../components/ui/AlertDialog';
import { useLanguage } from '../../hooks/useLanguage';
import { PhoneInputWithCountry } from '../../components/ui/PhoneInputWithCountry';

interface PublicEventRegistrationProps {
  eventos: Evento[];
  isLoading?: boolean;
  onRegister: (eventoId: string, inscrito: Omit<Inscrito, 'id' | 'dataInscricao'>) => Promise<Inscrito>;
}

const COURSES = [
  "ADMINISTRAÇÃO",
  "BIOMEDICINA",
  "CIÊNCIAS AERONÁUTICAS",
  "CIÊNCIAS CONTÁBEIS",
  "CST ANÁLISE E DESENVOLVIMENTO DE SISTEMAS",
  "DIREITO",
  "ENFERMAGEM",
  "FARMÁCIA",
  "FISIOTERAPIA",
  "FONOAUDIOLOGIA",
  "MEDICINA",
  "NUTRIÇÃO",
  "ODONTOLOGIA",
  "PEDAGOGIA",
  "PSICOLOGIA",
  "RELAÇÕES INTERNACIONAIS",
  "TERAPIA OCUPACIONAL"
];

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const COUNTRIES = [
  "Brasil", "Portugal", "Espanha", "Itália", "Alemanha", "França", "Estados Unidos", "Argentina", "Chile", "Uruguai", "Outro"
];

const PublicEventRegistration: React.FC<PublicEventRegistrationProps> = ({ eventos, isLoading, onRegister }) => {
  const { t, language, locale } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const evento = eventos.find(e => e.id === id);

  const [dynamicCountries, setDynamicCountries] = useState<{ name: string, code: string, commonName: string }[]>([]);
  const [dynamicStates, setDynamicStates] = useState<{ nome: string, sigla: string }[]>([]);
  const [dynamicCities, setDynamicCities] = useState<string[]>([]);
  const [loadingLocation, setLoadingLocation] = useState({ countries: false, states: false, cities: false });

  const [formData, setFormData] = useState({
    // ... rest of state stays same ...

    isEstrangeiro: false,
    matricula: '',
    nomeCompleto: '',
    telefone: '',
    cpf: '',
    email: '',
    escolaridade: '',
    interesseGraduacao: '',
    interesseTipo: '',
    cursoInteresse: '',
    cidade: '',
    estado: '',
    pais: 'Brasil'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [registeredInscrito, setRegisteredInscrito] = useState<Inscrito | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Fetch Countries on Mount
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingLocation(prev => ({ ...prev, countries: true }));
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,translations,cca2');
        const data = await res.json();
        const formatted = data
          .map((c: any) => {
            // Get translated name or fallback to common name
            const langKey = language === 'en' ? 'eng' : language === 'es' ? 'spa' : 'por';
            const translatedName = c.translations?.[langKey]?.common || c.name.common;

            return {
              name: translatedName,
              commonName: c.name.common, // Keep English common name for mapping
              code: c.cca2
            };
          })
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setDynamicCountries(formatted);
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setLoadingLocation(prev => ({ ...prev, countries: false }));
      }
    };
    fetchCountries();
  }, [language]); // Re-fetch or re-map when language changes

  // Fetch States when Country is Brazil
  useEffect(() => {
    const isBrazil = formData.pais === 'Brasil' || formData.pais === 'Brazil' || formData.pais === 'Brasil';
    if (isBrazil) {
      const fetchStates = async () => {
        setLoadingLocation(prev => ({ ...prev, states: true }));
        try {
          const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
          const data = await res.json();
          setDynamicStates(data.map((s: any) => ({ nome: s.nome, sigla: s.sigla })));
        } catch (err) {
          console.error('Error fetching states:', err);
        } finally {
          setLoadingLocation(prev => ({ ...prev, states: false }));
        }
      };
      fetchStates();
    } else {
      setDynamicStates([]);
      setDynamicCities([]);
    }
  }, [formData.pais]);

  // Fetch Cities when State is selected (Brazil only)
  useEffect(() => {
    if (formData.estado && (formData.pais === 'Brasil' || formData.pais === 'Brazil')) {
      const fetchCities = async () => {
        setLoadingLocation(prev => ({ ...prev, cities: true }));
        try {
          // Find if it's name or sigla
          const state = dynamicStates.find(s => s.nome === formData.estado || s.sigla === formData.estado);
          const stateCode = state ? state.sigla : formData.estado;

          const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`);
          const data = await res.json();
          setDynamicCities(data.map((c: any) => c.nome));
        } catch (err) {
          console.error('Error fetching cities:', err);
        } finally {
          setLoadingLocation(prev => ({ ...prev, cities: false }));
        }
      };
      fetchCities();
    }
  }, [formData.estado, formData.pais, dynamicStates]);

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

  // Helper Functions para Máscaras
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const showGradInterest =
    formData.escolaridade === Escolaridade.MEDIO_COMPLETO ||
    formData.escolaridade === Escolaridade.MEDIO_ANDAMENTO;

  const showHigherInterest =
    formData.escolaridade === Escolaridade.SUPERIOR_COMPLETO;

  const showCourseField =
    (showGradInterest && formData.interesseGraduacao === 'Sim') ||
    (showHigherInterest && formData.interesseTipo === 'Segunda Graduação') ||
    (showHigherInterest && formData.interesseTipo === 'Pós-graduação');

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      interesseGraduacao: '',
      interesseTipo: '',
      cursoInteresse: ''
    }));
  }, [formData.escolaridade]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center animate-pulse">
        <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
      </div>
    );
  }

  if (!evento || evento.encerrado) {
    return (
      <div className="max-w-md mx-auto text-center py-32 animate-in text-gray-900 px-4">
        <div className="size-20 bg-gray-100 text-gray-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">event_busy</span>
        </div>
        <h2 className="text-2xl font-black mb-2">{t('event_not_available')}</h2>
        <p className="text-gray-500 mb-8 px-4">{t('event_not_available_msg')}</p>
        <Link to="/" className="bg-primary text-white px-8 py-3 rounded-2xl font-black hover:bg-primary-dark transition-all inline-block shadow-lg shadow-primary/20">
          {t('see_other_events')}
        </Link>
      </div>
    );
  }

  const isExterno = evento.tipo === 'externo' || evento.tipo === 'mobilidade';
  const isMobilidade = evento.tipo === 'mobilidade';
  const isLinkExterno = evento.tipo === 'link_externo';

  const isFormValid = isLinkExterno
    ? formData.matricula.trim().length === 8
    : isExterno
      ? (formData.nomeCompleto.trim().length >= 3 &&
        ((isMobilidade && formData.isEstrangeiro) || (formData.pais === 'Brasil' ? formData.telefone.length === 15 : formData.telefone.trim().length >= 8)) &&
        ((isMobilidade && formData.isEstrangeiro) || (
          formData.interesseGraduacao !== '' &&
          (formData.interesseGraduacao === 'Não' || formData.cursoInteresse !== '')
        )) &&
        (!isMobilidade || (formData.cidade.trim() !== '' && formData.estado !== '' && formData.pais !== '')))
      : (formData.nomeCompleto.trim().length >= 3 &&
        (formData.pais === 'Brasil' ? formData.telefone.length === 15 : formData.telefone.trim().length >= 8) &&
        formData.cpf.length === 14 &&
        validateEmail(formData.email) &&
        formData.escolaridade !== '' &&
        (!showGradInterest || formData.interesseGraduacao !== '') &&
        (!showHigherInterest || formData.interesseTipo !== '') &&
        (formData.interesseGraduacao === 'Não' || formData.cursoInteresse !== ''));



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const payload: any = {};

    if (isLinkExterno) {
      payload.nomeCompleto = `Matrícula: ${formData.matricula.trim()}`;
      payload.telefone = '00000000000';
      payload.cpf = formData.matricula.trim();
      payload.email = 'matricula@aluno.com';
      payload.escolaridade = 'N/A';
    } else {
      payload.nomeCompleto = formData.nomeCompleto;
      payload.telefone = formData.telefone;

      if (!isExterno) {
        payload.cpf = formData.cpf;
        payload.email = formData.email;
        payload.escolaridade = formData.escolaridade;
      }

      if (isMobilidade) {
        payload.cidade = formData.cidade;
        payload.estado = formData.estado;
        payload.pais = formData.pais;
      }

      if (formData.interesseGraduacao) payload.interesseGraduacao = formData.interesseGraduacao;
      if (formData.interesseTipo) payload.interesseTipo = formData.interesseTipo;

      // Se for pós-graduação, o curso de interesse é a própria pós
      if (formData.interesseTipo === 'Pós-graduação') {
        payload.cursoInteresse = 'Pós-graduação';
      } else if (formData.cursoInteresse) {
        payload.cursoInteresse = formData.cursoInteresse;
      }
    }

    setIsSubmitting(true);
    onRegister(evento.id, payload)
      .then(async (result) => {
        // Redireciona se houver link externo (qualquer tipo de evento)
        if (evento.linkExterno) {
          window.location.href = evento.linkExterno;
          return;
        }

        setRegisteredInscrito(result);
        if (result.qrToken) {
          // Gerar QR Code em Base64
          // Formato: https://seusite.com/checkin/confirm?token=TOKEN
          const baseUrl = window.location.origin + window.location.pathname;
          const checkinUrl = `${baseUrl}#/checkin?token=${result.qrToken}`;
          const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
            margin: 2,
            width: 200,
            color: {
              dark: '#004a99',
              light: '#ffffff'
            }
          });
          setQrCodeDataUrl(qrDataUrl);
        }
        setIsSuccess(true);
        setIsSubmitting(false);
      })
      .catch(err => {
        console.error('Erro ao registrar:', err);
        setIsSubmitting(false);
        setAlertConfig({
          isOpen: true,
          title: 'Erro na Inscrição',
          message: 'Erro ao realizar inscrição. Tente novamente.',
          type: 'error'
        });
      });
  };

  const handleDownload = async () => {
    if (registeredInscrito) {
      await generateReceipt(evento, registeredInscrito, () => {
        // Show success modal
        setAlertConfig({
          isOpen: true,
          title: 'Comprovante Baixado!',
          message: 'Seu comprovante foi baixado com sucesso!\n\n📱 No celular: Verifique na Galeria de Fotos ou pasta Downloads\n💻 No computador: Verifique na pasta Downloads',
          type: 'success'
        });
        setIsDownloaded(true);
      });
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto py-6 md:py-12 animate-in px-4">
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-primary/5 text-center relative border border-gray-100 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="size-24 bg-green-50 text-green-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <span className="material-symbols-outlined text-5xl font-black">check_circle</span>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t('registration_confirmed')}</h2>
          <p className="text-primary font-black text-xl mb-4 tracking-tight uppercase">{t(evento.nome)}</p>
          <p className="text-gray-500 mb-10 text-lg">{t('success_msg')}</p>
          <div className="bg-gray-50 p-6 rounded-3xl text-left border border-gray-100 mb-10 space-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('participant')}</p>
              <p className="text-lg font-bold text-gray-800">{formData.nomeCompleto.toUpperCase()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CPF</p>
                <p className="text-sm font-bold text-gray-700">{formData.cpf}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evento</p>
                <p className="text-sm font-bold text-gray-700">{t(evento.nome)}</p>
              </div>
            </div>

            {(formData.cidade || formData.estado || formData.pais) && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('origin')}</p>
                <p className="text-sm font-bold text-gray-700">
                  {formData.cidade}{formData.estado ? `, ${formData.estado}` : ''} - {formData.pais}
                </p>
              </div>
            )}
          </div>

          {!isDownloaded && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3 animate-pulse no-print">
              <span className="material-symbols-outlined text-amber-600">warning</span>
              <p className="text-xs text-amber-800 font-bold text-left">
                {t('attention')}: {t('download_warning')}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 no-print ${isDownloaded
                ? 'bg-gray-50 text-gray-400 border-2 border-gray-100'
                : 'bg-white border-2 border-primary text-primary hover:bg-primary-light'
                }`}
            >
              <span className="material-symbols-outlined">{isDownloaded ? 'check' : 'download'}</span>
              {isDownloaded ? t('received_downloaded') : t('download_receipt')}
            </button>
            <button
              onClick={() => isDownloaded && navigate('/')}
              disabled={!isDownloaded}
              className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all shadow-lg no-print ${isDownloaded
                ? 'bg-primary text-white hover:bg-primary-dark shadow-primary/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
            >
              {t('finish')}
            </button>
          </div>
        </div>

        {/* Alert Dialog */}
        <AlertDialog
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />
      </div>
    );
  }

  if (isLinkExterno) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-in">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-gray-100 flex flex-col items-center">
            {/* Logo Centralizada */}
            <div className="mb-10">
              <img src={logo} alt="Logo" className="h-16 object-contain" />
            </div>

            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">
                {evento.nome}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-wrap">
                {evento.descricao || "Digite sua matrícula para acessar o link."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
              <Input
                label="Matrícula"
                placeholder="Ex: 01234567"
                value={formData.matricula}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setFormData({ ...formData, matricula: val });
                }}
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                required
              />

              <Button
                type="submit"
                isLoading={isSubmitting}
                fullWidth
                disabled={!isFormValid || isSubmitting}
                variant={!isFormValid || isSubmitting ? 'secondary' : 'primary'}
                icon={isFormValid && !isSubmitting ? 'open_in_new' : undefined}
                className="py-4 text-base rounded-2xl"
              >
                {isFormValid ? 'Acessar agora' : 'Informe a Matrícula'}
              </Button>
            </form>

            <p className="mt-10 text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">
              Acesso Institucional Seguro
            </p>
          </div>
        </div>

        {/* Alert Dialog */}
        <AlertDialog
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 px-4">
      <div className="max-w-6xl mx-auto animate-in">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm font-black uppercase tracking-tighter no-print">
            <span className="material-symbols-outlined font-bold">arrow_back</span>
            {t('back')}
          </Link>
          <Link
            to="/tutorial?from=form"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all font-bold text-sm no-print"
          >
            <span className="material-symbols-outlined text-lg">help</span>
            {t('help')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
          <div className="lg:col-span-12 space-y-6 md:space-y-8">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100">
              {/* Event Image */}
              <div className={`mb-8 -mx-6 md:-mx-10 -mt-6 md:-mt-10 ${!evento.imagem ? 'bg-primary/5 p-12 flex items-center justify-center' : ''}`}>
                <img
                  src={evento.imagem || logo}
                  alt={t(evento.nome)}
                  className={evento.imagem
                    ? "w-full h-64 md:h-80 object-cover rounded-t-[2rem] md:rounded-t-[3rem]"
                    : "max-w-[200px] md:max-w-[300px] object-contain opacity-90"
                  }
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = logo;
                    (e.target as HTMLImageElement).className = "max-w-[200px] md:max-w-[300px] object-contain opacity-90";
                    (e.target as HTMLImageElement).parentElement?.classList.add('bg-primary/5', 'p-12', 'flex', 'items-center', 'justify-center');
                  }}
                />
              </div>

              <span className="inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-primary-light text-primary mb-6">
                {t('institutional_event')}
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-6 leading-[1.1] tracking-tight">{t(evento.nome)}</h2>
              <p className="text-gray-500 text-lg md:text-xl leading-relaxed mb-10">{t(evento.descricao)}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:grid-cols-2 md:gap-6">
                <div className="flex items-center gap-5 p-6 bg-secondary/50 rounded-[2rem] border border-gray-100/50">
                  <div className="size-14 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">event</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('when')}</p>
                    <p className="text-base font-black text-gray-800">{new Date(evento.data).toLocaleDateString(locale)}</p>
                    <p className="text-xs font-bold text-gray-500">{evento.horario}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 p-6 bg-secondary/50 rounded-[2rem] border border-gray-100/50">
                  <div className="size-14 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">meeting_room</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('where')}</p>
                    <p className="text-base font-black text-gray-800">{evento.local}</p>
                    <p className="text-xs font-bold text-gray-500">{t('institution_local')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-12">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-primary/5 border border-gray-100">
                  <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                    <div className="size-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-white text-lg">edit_note</span>
                    </div>
                    {t('confirm_presence')}
                  </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isMobilidade && (
                  <RadioGroup
                    label={t('foreigner_question')}
                    name="isEstrangeiro"
                    options={[
                      { value: 'false', label: t('brazilian') },
                      { value: 'true', label: t('foreigner') }
                    ]}
                    value={formData.isEstrangeiro.toString()}
                    onChange={val => {
                      const isEstrangeiro = val === 'true';
                      setFormData({
                        ...formData,
                        isEstrangeiro,
                        cpf: '',
                        telefone: '',
                        pais: isEstrangeiro ? '' : 'Brasil',
                        estado: '',
                        cidade: ''
                      });
                    }}
                    required
                  />
                )}

                <Input
                  label={t('full_name')}
                  placeholder={t('full_name_placeholder')}
                  value={formData.nomeCompleto}
                  onChange={e => setFormData({ ...formData, nomeCompleto: e.target.value })}
                  required
                />

                {!isExterno ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PhoneInputWithCountry
                        label="Telefone"
                        value={formData.telefone}
                        onChange={val => setFormData({ ...formData, telefone: val })}
                        onCountryChange={country => setFormData(prev => ({ ...prev, pais: country }))}
                        countryName={formData.pais}
                        required={!(isMobilidade && formData.isEstrangeiro)}
                      />
                      {!(isMobilidade && formData.isEstrangeiro) && (
                        <Input
                          label="CPF"
                          placeholder="000.000.000-00"
                          value={formData.cpf}
                          onChange={e => setFormData({ ...formData, cpf: maskCPF(e.target.value) })}
                          required
                        />
                      )}
                    </div>

                    <Input
                      label="E-mail"
                      type="email"
                      placeholder="exemplo@email.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
                      error={formData.email && !validateEmail(formData.email) ? t('email_error') : undefined}
                      required
                    />

                    <Select
                      label={t('educational_level')}
                      placeholder={t('select_option')}
                      value={formData.escolaridade}
                      onChange={e => setFormData({ ...formData, escolaridade: e.target.value })}
                      options={Object.values(Escolaridade).map(esc => ({ value: esc, label: t(esc) }))}
                      required
                    />

                    {showGradInterest && (
                      <RadioGroup
                        label={t('interests_grad')}
                        name="interesseGraduacao"
                        options={[
                          { value: 'Sim', label: t('yes') },
                          { value: 'Não', label: t('no') }
                        ]}
                        value={formData.interesseGraduacao}
                        onChange={val => setFormData({ ...formData, interesseGraduacao: val })}
                        required
                      />
                    )}

                    {showHigherInterest && (
                      <RadioGroup
                        label={t('interests_higher')}
                        name="interesseTipo"
                        options={[
                          { value: 'Segunda Graduação', label: t('second_degree') },
                          { value: 'Pós-graduação', label: t('graduate_study') },
                          { value: 'Não tenho interesse no momento', label: t('no_interest_now') }
                        ]}
                        value={formData.interesseTipo}
                        onChange={val => setFormData({ ...formData, interesseTipo: val })}
                        required
                      />
                    )}

                    {showCourseField && (
                      <Select
                        label={t('course_interest')}
                        placeholder={t('select_course')}
                        value={formData.cursoInteresse}
                        onChange={e => setFormData({ ...formData, cursoInteresse: e.target.value })}
                        options={COURSES.map(course => ({ value: course, label: course }))}
                        required
                      />
                    )}
                  </>
                ) : (
                  <>
                    <PhoneInputWithCountry
                      label="Telefone"
                      value={formData.telefone}
                      onChange={val => setFormData({ ...formData, telefone: val })}
                      onCountryChange={country => setFormData(prev => ({ ...prev, pais: country }))}
                      countryName={formData.pais}
                      required
                    />

                    {!(isMobilidade && formData.isEstrangeiro) && (
                      <>
                        <RadioGroup
                          label={t('interests_grad')}
                          name="interesseGraduacao"
                          options={[
                            { value: 'Sim', label: t('yes') },
                            { value: 'Não', label: t('no') }
                          ]}
                          value={formData.interesseGraduacao}
                          onChange={val => setFormData({ ...formData, interesseGraduacao: val })}
                          required
                        />

                        {formData.interesseGraduacao === 'Sim' && (
                          <Select
                            label={t('course_interest')}
                            placeholder={t('select_course')}
                            value={formData.cursoInteresse}
                            onChange={e => setFormData({ ...formData, cursoInteresse: e.target.value })}
                            options={COURSES.map(course => ({ value: course, label: course }))}
                            required
                          />
                        )}
                      </>
                    )}

                    {isMobilidade && (
                      <div className="space-y-5 pt-2 border-t border-gray-100 mt-4">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{t('location_info')}</p>

                        <datalist id="countries-list">
                          {dynamicCountries.map(c => (
                            <React.Fragment key={c.code}>
                              <option value={c.name} />
                              {/* Add aliases for common countries in Portuguese */}
                              {language === 'pt' && c.commonName === 'United States' && <option value="EUA" />}
                              {language === 'pt' && c.commonName === 'United States' && <option value="Estados Unidos" />}
                              {language === 'pt' && c.commonName === 'United Kingdom' && <option value="Inglaterra" />}
                              {language === 'pt' && c.commonName === 'United Kingdom' && <option value="Reino Unido" />}
                            </React.Fragment>
                          ))}
                        </datalist>

                        <datalist id="states-list">
                          {dynamicStates.map(s => <option key={s.sigla} value={s.nome} />)}
                        </datalist>

                        <datalist id="cities-list">
                          {dynamicCities.map(c => <option key={c} value={c} />)}
                        </datalist>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label={t('country')}
                            placeholder={t('country_placeholder')}
                            value={formData.pais}
                            list="countries-list"
                            onChange={e => setFormData({ ...formData, pais: e.target.value })}
                            required
                          />
                          <Input
                            label={t('state')}
                            placeholder={t('state_placeholder')}
                            value={formData.estado}
                            list={formData.pais === t('Brasil') ? 'states-list' : undefined}
                            onChange={e => setFormData({ ...formData, estado: e.target.value })}
                            required
                          />
                        </div>
                        <Input
                          label={t('city')}
                          placeholder={t('city_placeholder')}
                          value={formData.cidade}
                          list="cities-list"
                          onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                          required
                        />
                      </div>
                    )}
                  </>
                )}

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  fullWidth
                  disabled={!isFormValid || isSubmitting}
                  variant={!isFormValid || isSubmitting ? 'secondary' : 'primary'}
                  icon={isFormValid && !isSubmitting ? 'arrow_forward' : undefined}
                >
                  {isFormValid ? t('submit_registration') : t('complete_fields_to_register')}
                </Button>

                <div className="flex gap-2 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 mt-6">
                  <span className="material-symbols-outlined text-primary text-lg">info</span>
                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                    {t('privacy_disclosure')}
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

export default PublicEventRegistration;
