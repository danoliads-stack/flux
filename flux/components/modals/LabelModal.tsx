
import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../supabase';

interface ChecklistEvent {
  id: string;
  status: string;
  created_at: string;
  checklists?: { nome: string } | { nome: string }[];
}

interface LabelModalProps {
  onClose: () => void;
  opId: string;
  realized: number;
  loteId: string;
  machine: string;
  operator: string;
  unit: string;
  productName: string;
  productDescription?: string;
}

const LabelModal: React.FC<LabelModalProps> = ({ onClose, opId, realized, loteId, machine, operator, unit, productName, productDescription }) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [checklistHistory, setChecklistHistory] = useState<ChecklistEvent[]>([]);

  // Fetch checklist history for this OP
  useEffect(() => {
    const fetchChecklistHistory = async () => {
      if (!opId) return;

      const { data } = await supabase
        .from('checklist_eventos')
        .select('id, status, created_at, checklists(nome)')
        .eq('op_id', opId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) setChecklistHistory(data as ChecklistEvent[]);
    };

    fetchChecklistHistory();
  }, [opId]);

  const handleDownloadPDF = async () => {
    if (!labelRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 4, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');

      // Standard Label Size: 100mm x 150mm (4x6 inches is common)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
      pdf.save(`ETIQUETA_${opId}_${loteId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF da etiqueta.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = async () => {
    if (!labelRef.current) return;
    setIsPrinting(true);
    try {
      const canvas = await html2canvas(labelRef.current, { scale: 4 });
      const imgData = canvas.toDataURL('image/png');

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Imprimir Etiqueta - ${opId}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                img { width: 100%; max-width: 100mm; height: auto; }
                @media print { 
                  body { -webkit-print-color-adjust: exact; } 
                  @page { size: 100mm 150mm; margin: 0; }
                }
              </style>
            </head>
            <body>
              <img src="${imgData}" onload="window.print();window.close()" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Error printing:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl flex flex-col bg-surface-dark rounded-xl shadow-2xl border border-border-dark overflow-hidden animate-fade-in max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border-dark bg-surface-dark-highlight">
          <div className="flex items-center gap-4">

            <div>
              <h2 className="text-white text-2xl font-bold tracking-tight">Etiqueta Gerada</h2>
              <p className="text-text-sub-dark text-sm mt-1">Lote {loteId} finalizado com sucesso.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-sub-dark hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
            <span className="material-icons-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Info & Actions */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-background-dark rounded-xl border border-border-dark p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="material-icons-outlined text-text-sub-dark">info</span>
                Resumo do Lote
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border-dark pb-3 text-sm">
                  <span className="text-text-sub-dark">Ordem de Produção</span>
                  <span className="text-white font-mono font-bold">{opId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border-dark pb-3 text-sm">
                  <span className="text-text-sub-dark">Produto</span>
                  <span className="text-white font-medium text-right">Painel Frontal X5<br /><span className="text-text-sub-dark text-xs">Variante Standard</span></span>
                </div>
                <div className="flex justify-between items-center bg-surface-dark-highlight p-3 rounded-lg border border-border-dark">
                  <span className="text-text-sub-dark">Quantidade</span>
                  <span className="text-secondary text-2xl font-bold">{realized} <span className="text-sm font-normal text-text-sub-dark">{unit}</span></span>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex gap-3 items-start">
              <span className="material-icons-outlined text-blue-400">print</span>
              <div>
                <p className="text-blue-100 text-sm font-medium">Instrução de Etiquetagem</p>
                <p className="text-blue-200/70 text-xs mt-1">Imprima a etiqueta e cole na lateral direita da caixa antes de mover para a expedição.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Label Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-background-dark rounded-xl border border-border-dark p-8 relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="bg-surface-dark text-text-sub-dark text-[10px] px-2 py-1 rounded border border-border-dark uppercase tracking-widest">Preview 100x150mm</span>
            </div>

            {/* LABEL CONTAINER - This is what gets printed/downloaded */}
            <div className="shadow-2xl overflow-hidden bg-white">
              <div
                ref={labelRef}
                className="w-[378px] h-[567px] bg-white text-black p-4 flex flex-col relative border-0 box-border"
                style={{ width: '100mm', height: '150mm' }} // Visual fix, but internal content controls size
              >
                {/* Header */}
                <div className="border-b-4 border-black pb-2 mb-2 flex justify-between items-center">
                  <div>
                    <h1 className="text-4xl font-black tracking-tighter leading-none mb-0">FLUX</h1>
                    <span className="text-[10px] font-bold text-gray-600 tracking-[0.2em] uppercase">Manufacturing</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[8px] font-bold uppercase text-gray-500">Emissão</span>
                    <span className="block text-sm font-bold leading-none">{new Date().toLocaleDateString('pt-BR')}</span>
                    <span className="block text-[10px] font-mono text-gray-600">{new Date().toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col justify-between min-h-0 gap-1">

                  {/* Product Info */}
                  <div className="mb-1">
                    <span className="block text-xs font-bold uppercase text-gray-500 mb-1">Produto / Descrição</span>
                    <div className="text-2xl font-bold leading-tight border border-black p-2 rounded-sm">
                      {productName} <span className="text-lg font-normal text-gray-700 block mt-1">{productDescription || 'Sem descrição'}</span>
                    </div>
                  </div>

                  {/* Codes Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <div>
                      <span className="block text-[8px] font-bold uppercase text-gray-500 mb-0">Código O.P.</span>
                      <div className="text-2xl font-black font-mono tracking-tight leading-none">{opId}</div>
                    </div>
                    <div>
                      <span className="block text-[8px] font-bold uppercase text-gray-500 mb-0">Lote Rastreio</span>
                      <div className="text-base font-bold font-mono text-gray-800 break-all leading-tight">{loteId}</div>
                    </div>
                  </div>

                  {/* Quantity Big */}
                  <div className="border-y-2 border-black py-1 flex items-center justify-between mb-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-gray-500">Quantidade</span>
                      <span className="text-5xl font-black leading-none tracking-tighter">{realized}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">Unidade</span>
                      <span className="text-xl font-bold text-gray-800">{unit}</span>
                    </div>
                  </div>

                  {/* Machine and Operator */}
                  <div className="grid grid-cols-2 gap-2 border-b border-black pb-1 mb-1">
                    <div>
                      <span className="text-[8px] font-bold uppercase text-gray-500 block">Máquina</span>
                      <span className="text-sm font-bold block leading-tight">{machine}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold uppercase text-gray-500 block">Operador</span>
                      <span className="text-sm font-bold block truncate leading-tight">{operator}</span>
                    </div>
                  </div>

                  {/* Checklist History */}
                  {checklistHistory.length > 0 && (
                    <div className="border-b border-black pb-1 mb-1">
                      <span className="text-[8px] font-bold uppercase text-gray-500 mb-1 block">Checklists Realizados</span>
                      <div className="flex flex-wrap gap-1">
                        {checklistHistory.slice(0, 4).map((event) => {
                          const checklistName = Array.isArray(event.checklists)
                            ? event.checklists[0]?.nome
                            : event.checklists?.nome;
                          return (
                            <span
                              key={event.id}
                              className={`text-[7px] px-1 py-0.5 rounded font-bold ${event.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}
                            >
                              {event.status === 'ok' ? '✓' : '✗'} {checklistName || 'Checklist'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* QR Code & Footer */}
                  {/* QR Code & Footer */}
                  <div className="flex gap-3 items-center mt-auto pb-6">
                    <div className="flex flex-col items-center gap-0">
                      <span className="text-[6px] font-bold uppercase text-gray-500 mb-0.5">Histórico</span>
                      <div className="border border-black p-0.5 bg-white">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?lote=' + loteId)}`}
                          alt="QR Code"
                          className="w-20 h-20 block"
                          crossOrigin="anonymous" // Important for html2canvas
                        />
                      </div>
                    </div>
                    <div className="flex-1 text-[8px] font-mono text-gray-500 leading-tight">
                      <p>Este código identifica unicamente este lote dentro do sistema FLUX INSIGHT.</p>
                      <br />
                      <p className="break-all font-bold text-black">HASH: {loteId?.substring(0, 16)}...</p>
                      <p className="font-bold text-black">OP: {opId}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-black text-white text-center py-0.5 text-[6px] font-bold tracking-widest uppercase">
                  Flux Insight / Internal Logistics Control
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-surface-dark border-t border-border-dark flex justify-between items-center gap-4">
          <div className="text-xs text-text-sub-dark hidden md:block">
            Verifique a qualidade da impressão antes de aplicar a etiqueta.
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-border-dark text-text-sub-dark hover:bg-surface-dark-highlight hover:text-white transition-colors font-medium"
            >
              Fechar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-surface-dark-highlight hover:bg-white/10 text-white font-bold border border-white/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isGeneratingPDF ? <span className="material-icons animate-spin text-lg">sync</span> : <span className="material-icons-outlined">download</span>}
              Salvar PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-[2] md:flex-none px-8 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-glow hover:shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span className={`material-icons ${isPrinting ? 'animate-spin' : ''}`}>{isPrinting ? 'sync' : 'print'}</span>
              Imprimir Agora
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default LabelModal;
