
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  shift?: string;
}

const LabelModal: React.FC<LabelModalProps> = ({
  onClose, opId, realized, loteId, machine, operator, unit, productName, productDescription, shift = 'N/A'
}) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Simplify the HASH for visual display (e.g., L-231230-8A1B)
  const displayHash = loteId ? `L-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${loteId.slice(0, 8).toUpperCase()}` : 'N/A';

  const handleDownloadPDF = async () => {
    if (!labelRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png', 1.0);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
      pdf.save(`ETIQUETA_${opId || 'OP'}_${displayHash}.pdf`);
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
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #eee; }
                img { width: 100mm; height: 150mm; object-fit: contain; }
                @media print { 
                  body { background: white; -webkit-print-color-adjust: exact; } 
                  @page { size: 100mm 150mm; margin: 0; }
                  img { width: 100mm; height: 150mm; }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl flex flex-col bg-[#0f1115] rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden animate-fade-in max-h-[95vh]">

        {/* Header UI */}
        <div className="flex items-center justify-between px-10 py-7 border-b border-white/5 bg-white/[0.02] text-white">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-glow-sm">
              <span className="material-icons-outlined text-4xl">qr_code_2</span>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight uppercase italic text-white line-height-1">Etiqueta Premium</h2>
              <p className="text-text-sub-dark text-sm mt-0.5 font-medium opacity-60">Identificação Técnica e Rastreabilidade FluxV1</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-text-sub-dark hover:text-white rounded-2xl hover:bg-white/5 transition-all">
            <span className="material-icons-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 text-white">

          {/* Left: Summary & Instructions */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-white/[0.03] rounded-3xl border border-white/5 p-8 shadow-inner">
              <h3 className="text-white font-black text-lg mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
                <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                Conferência de Dados
              </h3>
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <span className="text-text-sub-dark text-[10px] uppercase font-black tracking-widest opacity-40">Ordem de Produção</span>
                  <span className="text-2xl font-mono font-black text-primary tracking-tighter">{opId || 'OFFLINE'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-text-sub-dark text-[10px] uppercase font-black tracking-widest opacity-40">Descrição do Produto</span>
                  <span className="text-xl font-bold text-white leading-tight">{productName}</span>
                </div>
                <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 mt-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-text-sub-dark text-[10px] uppercase font-black tracking-widest opacity-40">Quantidade Validada</span>
                    <span className="text-primary text-xs font-black uppercase tracking-widest">{unit}</span>
                  </div>
                  <div className="text-5xl font-black text-white tracking-tighter">{realized}</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-3xl p-8 border border-primary/20 flex gap-6 items-start">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0 animate-pulse">
                <span className="material-icons">verified</span>
              </div>
              <div>
                <p className="text-primary text-sm font-black uppercase tracking-widest mb-1">Garantia de Origem</p>
                <p className="text-text-sub-dark text-xs leading-relaxed opacity-70">
                  Esta etiqueta contém o hash único de rastreabilidade do lote. Todas as informações de processo (Máquina, Operador e Turno) foram sincronizadas com o banco de dados auditável.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Label Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-black/40 rounded-[40px] border border-white/5 p-12 relative overflow-hidden group">
            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="absolute -top-48 -right-48 w-[500px] h-[500px] rounded-full bg-primary blur-[150px]"></div>
              <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-secondary blur-[150px]"></div>
            </div>

            {/* Scale Label Info */}
            <div className="absolute top-6 right-8 flex items-center gap-3 z-10">
              <span className="material-icons text-primary/40 text-sm">straighten</span>
              <span className="text-text-sub-dark/60 text-[10px] font-black uppercase tracking-[0.3em]">100 x 150 mm</span>
            </div>

            {/* LABEL CONTAINER - THE ACTUAL PRINTABLE PART */}
            <div className="shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden bg-white hover:scale-[1.03] transition-all duration-700 rounded-sm">
              <div
                ref={labelRef}
                className="bg-white text-black p-0 flex flex-col relative border-0 box-border overflow-hidden"
                style={{ width: '100mm', height: '150mm' }}
              >
                {/* 1. Header with Logo Area */}
                <div className="p-4 flex justify-between items-start border-b-[4px] border-black">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-8 h-8 bg-black flex items-center justify-center">
                        <span className="text-white font-black text-xl tracking-tighter">F</span>
                      </div>
                      <h1 className="text-3xl font-black tracking-tight leading-none text-black">FLUX</h1>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">Manufacturing System</span>
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Emissão</span>
                    <span className="text-sm font-black leading-none text-black">{new Date().toLocaleDateString('pt-BR')}</span>
                    <span className="text-[10px] font-mono font-bold text-gray-500 italic">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* 2. Main Identity Section */}
                <div className="flex-1 flex flex-col p-4 gap-3">

                  {/* Product Title */}
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Identificação do Produto</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-black text-white rounded-full">REF: {productDescription || 'N/A'}</span>
                    </div>
                    <div className="text-2xl font-black leading-[1.1] text-black tracking-tight min-h-[50px]">
                      {productName}
                    </div>
                  </div>

                  {/* Top Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-l-[3px] border-black pl-3 py-0.5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Cód. Ordem (OP)</span>
                      <span className="text-2xl font-black font-mono tracking-tighter text-black">{opId || 'N/A'}</span>
                    </div>
                    <div className="border-l-[3px] border-black pl-3 py-0.5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Código Rastreio</span>
                      <span className="text-lg font-black font-mono tracking-tight leading-none truncate block mt-0.5 text-black">{displayHash}</span>
                    </div>
                  </div>

                  {/* QUANTITY SECTION - Optimized for no overlap */}
                  <div className="relative mt-1">
                    <div className="flex items-start justify-between border-[6px] border-black p-4 bg-white">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5">Volume do Lote</span>
                        <span className="text-[80px] font-black leading-none tracking-[-0.08em] mt-[-4px] text-black">
                          {realized}
                        </span>
                      </div>
                      <div className="flex flex-col items-end pt-1">
                        <div className="bg-black text-white px-2.5 py-1 font-black text-lg italic tracking-tighter">
                          {unit}
                        </div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Unidade</span>
                      </div>
                    </div>
                    {/* Floating Status Indicator */}
                    <div className="absolute -bottom-2.5 right-4 bg-black text-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
                      Lote Validado
                    </div>
                  </div>

                  {/* Production Context Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-[8px] font-black uppercase text-gray-400 block mb-0.5">Máquina</span>
                      <span className="text-[10px] font-black uppercase truncate block text-black">{machine}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase text-gray-400 block mb-0.5">Operador</span>
                      <span className="text-[10px] font-black uppercase truncate block text-black">{operator}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase text-gray-400 block mb-0.5">Turno</span>
                      <span className="text-[10px] font-black uppercase block text-black">{shift}</span>
                    </div>
                  </div>

                  {/* Bottom Area: QR & Details */}
                  <div className="mt-auto flex gap-4 items-end">
                    <div className="flex flex-col gap-1 items-center">
                      <div className="border-[2px] border-black p-0.5 bg-white">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(loteId)}`}
                          alt="QR Code"
                          className="w-20 h-20 block"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <span className="text-[6px] font-black uppercase tracking-widest text-gray-300">Auth QR Code</span>
                    </div>
                    <div className="flex-1 border-l border-gray-100 pl-3 py-0.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black text-gray-400 uppercase tracking-widest">
                          <span>Verification ID</span>
                          <span className="text-black">Audit: OK</span>
                        </div>
                        <div className="font-mono text-[8px] font-bold text-gray-400 space-y-0.5">
                          <p className="flex justify-between"><span>UUID:</span> <span>{loteId?.substring(0, 16).toUpperCase()}</span></p>
                          <p className="flex justify-between"><span>SYSTEM:</span> <span>FLUX_V1</span></p>
                          <p className="flex justify-between text-black font-black"><span>REF OP:</span> <span>{opId || 'INTERNAL'}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer Bar */}
                <div className="bg-black text-white h-[20px] flex items-center justify-center px-4">
                  <div className="flex justify-between w-full items-center">
                    <span className="text-[7px] font-black tracking-[0.4em] uppercase">Flux Insight</span>
                    <span className="text-[6px] font-bold opacity-30">PROPRIETARY MANUFACTURING SYSTEM © 2025</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-10 bg-[#161920] border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col">
            <p className="text-text-sub-dark text-xs font-medium opacity-60">
              Imprima em papel térmico adesivo de alta qualidade (100x150mm).
            </p>
            <p className="text-text-sub-dark text-[10px] mt-1 italic font-mono opacity-30 capitalize">
              Tracking hash: {displayHash}
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={onClose}
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-sm uppercase tracking-widest"
            >
              Fechar Visualização
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black flex items-center justify-center gap-3 transition-all disabled:opacity-50 hover:bg-white/15 text-sm uppercase tracking-widest"
            >
              {isGeneratingPDF ? <span className="material-icons animate-spin text-xl">sync</span> : <span className="material-icons-outlined text-xl">file_download</span>}
              Baixar Documento
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-12 py-4 rounded-2xl bg-primary text-black font-black shadow-[0_10px_40px_rgba(45,212,191,0.3)] hover:shadow-primary/40 flex items-center justify-center gap-3 transition-all disabled:opacity-50 hover:scale-[1.05] text-sm uppercase tracking-widest"
            >
              <span className={`material-icons text-xl ${isPrinting ? 'animate-spin' : ''}`}>{isPrinting ? 'sync' : 'print'}</span>
              Imprimir Etiqueta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelModal;
