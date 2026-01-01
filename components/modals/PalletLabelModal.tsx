import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../src/lib/supabase-client';

interface PalletLabelModalProps {
    onClose: () => void;
    opId: string;
    opCodigo: string;
    productName: string;
    machineId: string;
    machineName: string;
    operatorId: string;
    operatorName: string;
    sectorId: string;
    sectorName: string;
}

const PalletLabelModal: React.FC<PalletLabelModalProps> = ({
    onClose,
    opId,
    opCodigo,
    productName,
    machineId,
    machineName,
    operatorId,
    operatorName,
    sectorId,
    sectorName
}) => {
    const labelRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isLabelGenerated, setIsLabelGenerated] = useState(false);

    // Manual input fields
    const [lote, setLote] = useState<string>('');
    const [quantidadePorCaixa, setQuantidadePorCaixa] = useState<number>(0);
    const [quantidadeCaixas, setQuantidadeCaixas] = useState<number>(0);

    // Auto-calculated
    const quantidadeTotal = quantidadePorCaixa * quantidadeCaixas;

    // Auto fields
    const [numeroEtiqueta, setNumeroEtiqueta] = useState<number>(0);
    const [qrCodeData, setQrCodeData] = useState<string>('');

    // Get current timestamp
    const [emissionDate] = useState(new Date());
    const dateString = emissionDate.toLocaleDateString('pt-BR');
    const timeString = emissionDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Fetch next label number on mount
    useEffect(() => {
        const fetchData = async () => {
            // Get next label number for this OP and type
            const { data: lastLabel } = await supabase
                .from('etiquetas')
                .select('numero_etiqueta')
                .eq('op_id', opId)
                .eq('tipo_etiqueta', 'PALLET')
                .order('numero_etiqueta', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextNumber = (lastLabel?.numero_etiqueta || 0) + 1;
            setNumeroEtiqueta(nextNumber);

            // Generate unique QR code data - points to history page
            const labelId = `PLT-${opId.slice(0, 8)}-${nextNumber}-${Date.now()}`;
            setQrCodeData(`${window.location.origin}/etiqueta/${labelId}`);
        };

        fetchData();
    }, [opId]);

    // Validate form
    const isFormValid = lote.trim() !== '' && quantidadePorCaixa > 0 && quantidadeCaixas > 0;

    // Generate and save label
    const handleGenerateLabel = async () => {
        if (!isFormValid) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        setIsGenerating(true);
        try {
            // Save label to database
            const { error } = await supabase.from('etiquetas').insert({
                op_id: opId,
                maquina_id: machineId,
                operador_id: operatorId,
                setor_id: sectorId,
                tipo_etiqueta: 'PALLET',
                numero_etiqueta: numeroEtiqueta,
                dados_manualmente_preenchidos: {
                    lote: lote,
                    quantidade_por_caixa: quantidadePorCaixa,
                    quantidade_caixas: quantidadeCaixas,
                    quantidade_total: quantidadeTotal
                },
                qr_code_data: qrCodeData,
                created_at: emissionDate.toISOString()
            });

            if (error) throw error;

            setIsLabelGenerated(true);
        } catch (error) {
            console.error('Error saving label:', error);
            alert('Erro ao salvar etiqueta no banco de dados.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!labelRef.current) return;
        setIsGenerating(true);
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
            pdf.save(`ETIQUETA_PLT_${opCodigo}_${numeroEtiqueta}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erro ao gerar PDF.');
        } finally {
            setIsGenerating(false);
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
              <title>Etiqueta Pallet - ${opCodigo}</title>
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
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative w-full max-w-5xl flex flex-col bg-[#0f1115] rounded-2xl shadow-2xl border border-white/5 overflow-hidden animate-fade-in max-h-[95vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02] text-white">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 border border-orange-500/30">
                            <span className="material-icons-outlined text-2xl">inventory_2</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight uppercase text-white">Etiqueta de Pallet</h2>
                            <p className="text-text-sub-dark text-xs mt-0.5">OP {opCodigo} • Pallet #{numeroEtiqueta}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-text-sub-dark hover:text-white rounded-xl hover:bg-white/5 transition-all">
                        <span className="material-icons-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">

                    {/* Left: Input Form */}
                    <div className="flex flex-col gap-6">
                        {/* Auto Data */}
                        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-6">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                Dados Automáticos
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Máquina</span>
                                    <span className="text-white font-bold">{machineName}</span>
                                </div>
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Operador</span>
                                    <span className="text-white font-bold">{operatorName}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Produto</span>
                                    <span className="text-white font-bold text-lg">{productName}</span>
                                </div>
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Data/Hora</span>
                                    <span className="text-white font-bold">{dateString} {timeString}</span>
                                </div>
                            </div>
                        </div>

                        {/* Manual Input */}
                        <div className="bg-orange-500/5 rounded-2xl border border-orange-500/20 p-6">
                            <h3 className="text-orange-400 font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <span className="material-icons text-lg">edit</span>
                                Campos Manuais
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-text-sub-dark text-xs uppercase font-bold tracking-widest block mb-2">
                                        Lote
                                    </label>
                                    <input
                                        type="text"
                                        value={lote}
                                        onChange={(e) => setLote(e.target.value)}
                                        placeholder="Ex: LT-2026-001"
                                        className="w-full h-12 rounded-xl text-white px-4 font-bold bg-background-dark border border-border-dark focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                        disabled={isLabelGenerated}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-text-sub-dark text-xs uppercase font-bold tracking-widest block mb-2">
                                            Qtd por Caixa
                                        </label>
                                        <input
                                            type="number"
                                            value={quantidadePorCaixa || ''}
                                            onChange={(e) => setQuantidadePorCaixa(parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                            className="w-full h-12 rounded-xl text-white text-center font-bold text-lg bg-background-dark border border-border-dark focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                            disabled={isLabelGenerated}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-text-sub-dark text-xs uppercase font-bold tracking-widest block mb-2">
                                            Qtd de Caixas
                                        </label>
                                        <input
                                            type="number"
                                            value={quantidadeCaixas || ''}
                                            onChange={(e) => setQuantidadeCaixas(parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                            className="w-full h-12 rounded-xl text-white text-center font-bold text-lg bg-background-dark border border-border-dark focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                            disabled={isLabelGenerated}
                                        />
                                    </div>
                                </div>
                                <div className="bg-black/30 rounded-xl p-4 flex items-center justify-between">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold tracking-widest">
                                        Quantidade Total no Pallet
                                    </span>
                                    <span className="text-3xl font-black text-orange-400">{quantidadeTotal}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Label Preview */}
                    <div className="flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/5 p-6 relative overflow-hidden">
                        <div className="text-[10px] text-text-sub-dark uppercase tracking-widest mb-4">100 x 150 mm</div>

                        {/* Label Preview Container */}
                        <div className="shadow-[0_30px_80px_rgba(0,0,0,0.7)] rounded-sm overflow-hidden bg-white transform scale-[0.65] origin-top">
                            <div
                                ref={labelRef}
                                className="bg-white text-black flex flex-col"
                                style={{ width: '100mm', height: '150mm' }}
                            >
                                {/* Header */}
                                <div className="p-3 flex justify-between items-start border-b-4 border-black">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-black flex items-center justify-center">
                                                <span className="text-white font-black text-xl">F</span>
                                            </div>
                                            <h1 className="text-2xl font-black tracking-tight">FLUX</h1>
                                        </div>
                                        <span className="text-[7px] font-black uppercase tracking-[0.3em] text-gray-400">Manufacturing Pallet</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[8px] font-black uppercase text-gray-400 block">Pallet Nº</span>
                                        <span className="text-3xl font-black leading-none">{numeroEtiqueta}</span>
                                    </div>
                                </div>

                                {/* Product Section */}
                                <div className="p-3 border-b-2 border-gray-200">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Produto</span>
                                    <span className="text-lg font-black leading-tight block line-clamp-2">{productName}</span>
                                </div>

                                {/* Info Grid */}
                                <div className="p-3 grid grid-cols-2 gap-3 border-b-2 border-gray-200">
                                    <div className="border-l-[3px] border-black pl-2">
                                        <span className="text-[7px] font-black uppercase text-gray-400 block">OP</span>
                                        <span className="text-xl font-black font-mono">{opCodigo}</span>
                                    </div>
                                    <div className="border-l-[3px] border-black pl-2">
                                        <span className="text-[7px] font-black uppercase text-gray-400 block">Lote</span>
                                        <span className="text-lg font-black font-mono">{lote || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[7px] font-black uppercase text-gray-400 block">Máquina</span>
                                        <span className="text-[10px] font-bold">{machineName}</span>
                                    </div>
                                    <div>
                                        <span className="text-[7px] font-black uppercase text-gray-400 block">Operador</span>
                                        <span className="text-[10px] font-bold">{operatorName}</span>
                                    </div>
                                </div>

                                {/* Quantity Section */}
                                <div className="p-3 flex-1 flex flex-col justify-center">
                                    <div className="border-[5px] border-black p-3 bg-white">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <span className="text-[8px] font-black uppercase text-gray-400 block">Qtd/Caixa</span>
                                                <span className="text-2xl font-black">{quantidadePorCaixa || '—'}</span>
                                            </div>
                                            <span className="text-2xl font-black text-gray-300">×</span>
                                            <div>
                                                <span className="text-[8px] font-black uppercase text-gray-400 block">Caixas</span>
                                                <span className="text-2xl font-black">{quantidadeCaixas || '—'}</span>
                                            </div>
                                            <span className="text-2xl font-black text-gray-300">=</span>
                                            <div className="text-right">
                                                <span className="text-[8px] font-black uppercase text-gray-400 block">Total</span>
                                                <span className="text-4xl font-black">{quantidadeTotal}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: QR and Date */}
                                <div className="p-3 flex gap-3 items-end border-t-2 border-gray-200">
                                    <div className="border-2 border-black p-0.5">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCodeData)}`}
                                            alt="QR Code"
                                            className="w-20 h-20"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                    <div className="flex-1 text-right">
                                        <span className="text-[7px] font-black uppercase text-gray-400 block">Data/Hora Emissão</span>
                                        <span className="text-sm font-black">{dateString}</span>
                                        <span className="text-xs font-bold text-gray-500 block">{timeString}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="bg-black text-white h-5 flex items-center justify-between px-3">
                                    <span className="text-[6px] font-black tracking-[0.3em] uppercase">Flux Insight</span>
                                    <span className="text-[5px] opacity-50">PALLET TRACKING SYSTEM © 2026</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="p-6 bg-[#161920] border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-text-sub-dark text-xs">
                        {isLabelGenerated ? '✓ Etiqueta salva no banco de dados' : 'Preencha todos os campos para gerar a etiqueta'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-sm"
                        >
                            Fechar
                        </button>
                        {!isLabelGenerated ? (
                            <button
                                onClick={handleGenerateLabel}
                                disabled={isGenerating || !isFormValid}
                                className="px-8 py-3 rounded-xl bg-orange-500 text-white font-black flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-orange-600 text-sm"
                            >
                                {isGenerating ? (
                                    <span className="material-icons animate-spin text-lg">sync</span>
                                ) : (
                                    <span className="material-icons-outlined text-lg">save</span>
                                )}
                                Gerar Etiqueta
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={isGenerating}
                                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-white/15 text-sm"
                                >
                                    <span className="material-icons-outlined text-lg">file_download</span>
                                    Baixar PDF
                                </button>
                                <button
                                    onClick={handlePrint}
                                    disabled={isPrinting}
                                    className="px-8 py-3 rounded-xl bg-orange-500 text-white font-black flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-orange-600 text-sm"
                                >
                                    <span className={`material-icons text-lg ${isPrinting ? 'animate-spin' : ''}`}>
                                        {isPrinting ? 'sync' : 'print'}
                                    </span>
                                    Imprimir
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PalletLabelModal;
