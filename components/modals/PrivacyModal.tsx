import React, { useState } from 'react';

interface PrivacyModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onAccept, onDecline }) => {
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dados: false,
    retention: false,
    rights: false,
  });

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAccept = () => {
    if (!acceptedAll) {
      alert('Você deve aceitar a Política de Privacidade para continuar.');
      return;
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-dark rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border-dark">
        {/* Header */}
        <div className="sticky top-0 bg-surface-dark border-b border-border-dark p-6 flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">Política de Privacidade</h1>
            <p className="text-text-sub-dark">
              Leia e aceite os termos para continuar usando FLUX
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Aviso importante */}
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
            <span className="material-icons-outlined text-warning flex-shrink-0 mt-0.5">error_outline</span>
            <p className="text-sm text-text-main-dark">
              Ao usar FLUX, você aceita que seus dados pessoais (nome, matrícula, PIN) sejam coletados e processados para operação do sistema de produção.
            </p>
          </div>

          {/* Section 1: Dados Coletados */}
          <div className="border border-border-dark rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('dados')}
              className="w-full p-4 bg-surface-dark hover:bg-surface-dark/50 flex items-center justify-between text-left transition"
            >
              <span className="font-semibold text-text-main-dark">Dados Coletados</span>
              {expandedSections.dados ? (
                <span className="material-icons-outlined">expand_less</span>
              ) : (
                <span className="material-icons-outlined">expand_more</span>
              )}
            </button>
            {expandedSections.dados && (
              <div className="p-4 bg-surface-dark border-t border-border-dark text-text-main-dark space-y-2">
                <p className="text-sm">Coletamos e processamos:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Matrícula e nome (identificação)</li>
                  <li>PIN (autenticação — sempre criptografado)</li>
                  <li>Setor e turno de trabalho</li>
                  <li>Avatar (imagem de perfil, opcional)</li>
                  <li>Apontamentos de produção (bom/refugo)</li>
                  <li>Histórico de máquinas e OPs que trabalhou</li>
                  <li>IP e User-Agent (apenas em login)</li>
                </ul>
              </div>
            )}
          </div>

          {/* Section 2: Retenção */}
          <div className="border border-border-dark rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('retention')}
              className="w-full p-4 bg-surface-dark hover:bg-surface-dark/50 flex items-center justify-between text-left transition"
            >
              <span className="font-semibold text-text-main-dark">Retenção de Dados</span>
              {expandedSections.retention ? (
                <span className="material-icons-outlined">expand_less</span>
              ) : (
                <span className="material-icons-outlined">expand_more</span>
              )}
            </button>
            {expandedSections.retention && (
              <div className="p-4 bg-surface-dark border-t border-border-dark text-text-main-dark space-y-2">
                <p className="text-sm">Mantemos seus dados pelo tempo necessário:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Apontamentos de produção:</strong> 2 anos (para auditoria e rastreabilidade)</li>
                  <li><strong>Paradas/Interrupções:</strong> 1 ano após finalização</li>
                  <li><strong>Dados pessoais:</strong> Mantém-se enquanto você for operador</li>
                  <li><strong>Logs de login:</strong> 90 dias (para segurança)</li>
                </ul>
                <p className="text-sm mt-3 pt-3 border-t border-border-dark">
                  Dados expirados são deletados automaticamente. Você pode solicitar deleção imediata contando ao seu supervisor.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Seus Direitos */}
          <div className="border border-border-dark rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('rights')}
              className="w-full p-4 bg-surface-dark hover:bg-surface-dark/50 flex items-center justify-between text-left transition"
            >
              <span className="font-semibold text-text-main-dark">Seus Direitos LGPD</span>
              {expandedSections.rights ? (
                <span className="material-icons-outlined">expand_less</span>
              ) : (
                <span className="material-icons-outlined">expand_more</span>
              )}
            </button>
            {expandedSections.rights && (
              <div className="p-4 bg-surface-dark border-t border-border-dark text-text-main-dark space-y-2">
                <p className="text-sm font-semibold mb-2">Você tem o direito de:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Acessar:</strong> Ver todos seus dados armazenados</li>
                  <li><strong>Corrigir:</strong> Solicitar correção de dados incorretos</li>
                  <li><strong>Deletar:</strong> Pedir apagamento (direito ao esquecimento)</li>
                  <li><strong>Portar:</strong> Exportar seus dados em formato acessível</li>
                  <li><strong>Reclamar:</strong> Contactar autoridades se houver violação</li>
                </ul>
                <p className="text-sm mt-3 pt-3 border-t border-border-dark">
                  Para exercer qualquer direito, solicite ao seu supervisor ou gerente.
                </p>
              </div>
            )}
          </div>

          {/* Checkbox de aceite */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedAll}
                onChange={(e) => setAcceptedAll(e.target.checked)}
                className="mt-1 w-4 h-4 accent-primary"
              />
              <span className="text-sm text-text-main-dark">
                Aceito a Política de Privacidade e os Termos de Uso de FLUX. Entendo que meus dados serão coletados e processados conforme descrito acima.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-dark border-t border-border-dark p-6 flex gap-3 justify-end">
          <button
            onClick={onDecline}
            className="px-6 py-2 rounded-lg border border-border-dark text-text-main-dark hover:bg-surface-dark/50 transition font-medium"
          >
            Rejeitar
          </button>
          <button
            onClick={handleAccept}
            disabled={!acceptedAll}
            className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Aceitar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
