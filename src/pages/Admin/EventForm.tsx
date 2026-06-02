
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Evento } from '../../types';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import AlertDialog from '../../components/ui/AlertDialog';

interface AdminEventFormProps {
  onSave: (evento: any) => void;
  onUpload?: (file: File) => Promise<string>;
  initialData?: Evento;
}

const AdminEventForm: React.FC<AdminEventFormProps> = ({ onSave, onUpload, initialData }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome: '',
    data: '',
    horario: '',
    descricao: '',
    local: 'Auditório UNINASSAU Boa Viagem',
    imagem: '',
    tipo: 'interno' as 'interno' | 'externo' | 'mobilidade' | 'link_externo',
    linkExterno: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome,
        data: initialData.data,
        horario: initialData.horario,
        descricao: initialData.descricao,
        local: initialData.local,
        imagem: initialData.imagem || '',
        tipo: initialData.tipo || 'interno',
        linkExterno: initialData.linkExterno || ''
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let imageUrl = formData.imagem;
      if (selectedFile && onUpload) {
        imageUrl = await onUpload(selectedFile);
      }

      const finalData = { ...formData, imagem: imageUrl };

      if (initialData) {
        await onSave({ ...initialData, ...finalData });
      } else {
        await onSave(finalData);
      }
      navigate('/admin');
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      setAlertConfig({
        isOpen: true,
        title: 'Erro ao Salvar',
        message: 'Erro ao salvar evento: ' + (error instanceof Error ? error.message : JSON.stringify(error)),
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-in">
      <div className="mb-6">
        <Link to={initialData ? `/admin/evento/${initialData.id}` : "/admin"} className="text-gray-500 hover:text-primary font-bold flex items-center gap-1 text-sm">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Voltar
        </Link>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
          {initialData ? 'Editar Evento' : 'Cadastrar Novo Evento'}
        </h2>
        <p className="text-gray-500 mb-8 text-sm md:text-base">
          {initialData ? 'Atualize os detalhes do evento institucional.' : 'Preencha os detalhes do evento que ocorrerá no auditório.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nome do Evento"
            placeholder="Ex: Simpósio de Direito Civil"
            value={formData.nome}
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Data"
              type="date"
              value={formData.data}
              onChange={e => setFormData({ ...formData, data: e.target.value })}
              required
            />
            <Input
              label="Horário"
              placeholder="Ex: 19:00 - 22:00"
              value={formData.horario}
              onChange={e => setFormData({ ...formData, horario: e.target.value })}
              required
            />
          </div>

          <Input
            label="Local"
            value={formData.local}
            onChange={e => setFormData({ ...formData, local: e.target.value })}
            required
          />

          <div className="flex flex-col gap-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo do Evento</label>
            <select
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              value={formData.tipo}
              onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
            >
              <option value="interno">🎓 Evento Interno (Formulário Completo)</option>
              <option value="externo">🌍 Evento Externo (Formulário Simplificado)</option>
              <option value="mobilidade">✈️ Evento de Mobilidade (Simplificado + Localização)</option>
              <option value="link_externo">🔗 Evento de Redirecionamento (Link Externo via Matrícula)</option>
            </select>
            <p className="text-[10px] text-gray-400 font-medium">
              Eventos externos e de mobilidade solicitam informações simplificadas, sendo que mobilidade inclui Cidade, Estado e País. O evento de redirecionamento encaminha para um site externo após a captura da matrícula.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border ${formData.tipo === 'link_externo' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
            <Input
              label={formData.tipo === 'link_externo' ? 'Link Externo de Redirecionamento' : 'Link Externo (Opcional)'}
              type="url"
              placeholder="Ex: https://av1.uninassau.edu.br/..."
              value={formData.linkExterno}
              onChange={e => setFormData({ ...formData, linkExterno: e.target.value })}
              required={formData.tipo === 'link_externo'}
            />
            <p className={`text-[10px] font-bold mt-2 ${formData.tipo === 'link_externo' ? 'text-blue-500' : 'text-gray-400'}`}>
              {formData.tipo === 'link_externo'
                ? '* Obrigatório: os alunos informarão a Matrícula e serão redirecionados para essa URL.'
                : '* Opcional: se preenchido, será exibido um botão de acesso externo na página do evento.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Imagem do Evento (Opcional)</label>
            <div className="flex flex-col gap-4">
              {formData.imagem && !selectedFile && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <img src={formData.imagem} alt="Preview" className="size-20 rounded-xl object-cover border border-gray-200" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-700">Imagem atual</p>
                    <p className="text-[10px] text-gray-400 truncate mt-1">{formData.imagem}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imagem: '' })}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-100 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Remover
                  </button>
                </div>
              )}
              {selectedFile && (
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="size-20 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl">image</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary">Nova imagem selecionada</p>
                    <p className="text-[10px] text-gray-600 mt-1">{selectedFile.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="px-4 py-2 bg-white text-gray-600 rounded-xl text-xs font-black hover:bg-gray-50 transition-colors border border-gray-200"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {!selectedFile && (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary-dark transition-all cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">Selecione uma imagem JPG, PNG ou WebP</p>
                </div>
              )}
            </div>
          </div>

          <Textarea
            label="Descrição"
            placeholder="Breve descrição do evento..."
            rows={4}
            value={formData.descricao}
            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
            required
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <Link to={initialData ? `/admin/evento/${initialData.id}` : "/admin"} className="px-6 py-4 font-bold text-gray-400 hover:text-gray-600 transition-all flex items-center justify-center">Cancelar</Link>
            <Button type="submit" fullWidth className="sm:w-auto" disabled={isUploading}>
              {isUploading ? 'Processando...' : (initialData ? 'Salvar Alterações' : 'Criar Evento')}
            </Button>
          </div>
        </form>
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

export default AdminEventForm;
