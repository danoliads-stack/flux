import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../src/lib/supabase-client';
import { ChecklistSnapshot } from '../../types';

interface ChecklistLabelModalProps {
    onClose: () => void;
    opId: string;
    opCodigo: string;
    machineId: string;
    machineName: string;
    operatorId: string;
    operatorName: string;
    operatorMatricula?: string;
    sectorId: string;
    sectorName: string;
}

const ChecklistLabelModal: React.FC<ChecklistLabelModalProps> = ({
    onClose,
    opId,
    opCodigo,
    machineId,
    machineName,
    operatorId,
    operatorName,
    operatorMatricula = '',
    sectorId,
    sectorName
}) => {
    const labelRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [quantidadeAnalisada, setQuantidadeAnalisada] = useState<number>(0);
    const [numeroEtiqueta, setNumeroEtiqueta] = useState<number>(0);
    const [checklistSnapshot, setChecklistSnapshot] = useState<ChecklistSnapshot[]>([]);
    const [qrCodeData, setQrCodeData] = useState<string>('');
    const [isLabelGenerated, setIsLabelGenerated] = useState(false);

    // Get current timestamp
    const [emissionDate] = useState(new Date());
    const dateString = emissionDate.toLocaleDateString('pt-BR');
    const timeString = emissionDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Fetch next label number and checklist snapshot on mount
    useEffect(() => {
        const fetchData = async () => {
            // Get next label number for this OP and type
            const { data: lastLabel } = await supabase
                .from('etiquetas')
                .select('numero_etiqueta')
                .eq('op_id', opId)
                .eq('tipo_etiqueta', 'CHECKLIST')
                .order('numero_etiqueta', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextNumber = (lastLabel?.numero_etiqueta || 0) + 1;
            setNumeroEtiqueta(nextNumber);

            // Generate unique QR code data - points to history page
            const labelId = `CHK-${opId.slice(0, 8)}-${nextNumber}-${Date.now()}`;
            setQrCodeData(`${window.location.origin}/etiqueta/${labelId}`);

            // Fetch recent checklist events for snapshot
            const { data: checklistEvents } = await supabase
                .from('checklist_eventos')
                .select('checklist_id, status, created_at, checklists(nome)')
                .eq('op_id', opId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (checklistEvents) {
                // Group by checklist_id and get latest status
                const snapshotMap = new Map<string, ChecklistSnapshot>();
                checklistEvents.forEach((event: any) => {
                    if (!snapshotMap.has(event.checklist_id)) {
                        snapshotMap.set(event.checklist_id, {
                            checklist_id: event.checklist_id,
                            checklist_nome: event.checklists?.nome || 'Checklist',
                            status: event.status,
                            ultimo_evento_at: event.created_at
                        });
                    }
                });
                setChecklistSnapshot(Array.from(snapshotMap.values()));
            }
        };

        fetchData();
    }, [opId]);

    // Generate and save label
    const handleGenerateLabel = async () => {
        if (quantidadeAnalisada <= 0) {
            alert('Por favor, informe a quantidade analisada.');
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
                tipo_etiqueta: 'CHECKLIST',
                numero_etiqueta: numeroEtiqueta,
                dados_manualmente_preenchidos: {
                    quantidade_analisada: quantidadeAnalisada
                },
                qr_code_data: qrCodeData,
                checklist_snapshot: checklistSnapshot,
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
                orientation: 'landscape',
                unit: 'mm',
                format: [70, 50]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, 70, 50);
            pdf.save(`ETIQUETA_CHK_${opCodigo}_${numeroEtiqueta}.pdf`);
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
              <title>Etiqueta Checklist - ${opCodigo}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #eee; }
                img { width: 70mm; height: 50mm; object-fit: contain; }
                @media print { 
                  body { background: white; -webkit-print-color-adjust: exact; } 
                  @page { size: 70mm 50mm; margin: 0; }
                  img { width: 70mm; height: 50mm; }
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
            <div className="relative w-full max-w-4xl flex flex-col bg-[#0f1115] rounded-2xl shadow-2xl border border-white/5 overflow-hidden animate-fade-in max-h-[95vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02] text-white">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                            <span className="material-icons-outlined text-2xl">fact_check</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight uppercase text-white">Etiqueta de Checklist</h2>
                            <p className="text-text-sub-dark text-xs mt-0.5">OP {opCodigo} • Etiqueta #{numeroEtiqueta}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-text-sub-dark hover:text-white rounded-xl hover:bg-white/5 transition-all">
                        <span className="material-icons-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">

                    {/* Left: Input Form */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-6">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                Dados Automáticos
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Máquina</span>
                                    <span className="text-white font-bold">{machineName}</span>
                                </div>
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Setor</span>
                                    <span className="text-white font-bold">{sectorName}</span>
                                </div>
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Operador</span>
                                    <span className="text-white font-bold">{operatorName}</span>
                                    {operatorMatricula && <span className="text-text-sub-dark text-xs ml-1">({operatorMatricula})</span>}
                                </div>
                                <div>
                                    <span className="text-text-sub-dark text-[10px] uppercase font-bold tracking-widest block mb-1">Data/Hora</span>
                                    <span className="text-white font-bold">{dateString} {timeString}</span>
                                </div>
                            </div>
                        </div>

                        {/* Manual Input */}
                        <div className="bg-blue-500/5 rounded-2xl border border-blue-500/20 p-6">
                            <h3 className="text-blue-400 font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <span className="material-icons text-lg">edit</span>
                                Campo Manual
                            </h3>
                            <div>
                                <label className="text-text-sub-dark text-xs uppercase font-bold tracking-widest block mb-2">
                                    Quantidade Analisada na Caixa
                                </label>
                                <input
                                    type="number"
                                    value={quantidadeAnalisada || ''}
                                    onChange={(e) => setQuantidadeAnalisada(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full h-14 rounded-xl text-white text-center font-bold text-2xl bg-background-dark border border-border-dark focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    disabled={isLabelGenerated}
                                />
                            </div>
                        </div>

                        {/* Checklist Snapshot */}
                        {checklistSnapshot.length > 0 && (
                            <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
                                <h3 className="text-text-sub-dark font-bold text-[10px] mb-3 uppercase tracking-widest">
                                    Checklists Associados ({checklistSnapshot.length})
                                </h3>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {checklistSnapshot.map((cl) => (
                                        <div key={cl.checklist_id} className="flex items-center justify-between text-xs">
                                            <span className="text-white truncate">{cl.checklist_nome}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cl.status === 'ok' ? 'bg-green-500/20 text-green-400' :
                                                cl.status === 'NAO_REALIZADO' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {cl.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Label Preview */}
                    <div className="flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/5 p-8">
                        <div className="text-[10px] text-text-sub-dark uppercase tracking-widest mb-4">70 x 50 mm</div>

                        {/* Label Preview Container */}
                        <div className="shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden bg-white">
                            <div
                                ref={labelRef}
                                className="bg-white text-black flex flex-col"
                                style={{ width: '70mm', height: '50mm' }}
                            >
                                {/* Header */}
                                <div className="bg-black text-white px-2 py-1 flex justify-between items-center">
                                    <div className="flex items-center gap-1">
                                        <span className="font-black text-sm tracking-tight">FLUX</span>
                                        <span className="text-[6px] opacity-60">CHECKLIST</span>
                                    </div>
                                    <span className="text-[7px] font-bold">#{numeroEtiqueta}</span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-2 flex gap-2">
                                    {/* Left Info */}
                                    <div className="flex-1 flex flex-col gap-1 text-[7px]">
                                        <div>
                                            <span className="text-gray-400 uppercase text-[5px] block">OP</span>
                                            <span className="font-black text-sm">{opCodigo}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div>
                                                <span className="text-gray-400 uppercase text-[5px] block">Máquina</span>
                                                <span className="font-bold text-[8px]">{machineName}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 uppercase text-[5px] block">Setor</span>
                                                <span className="font-bold text-[8px]">{sectorName}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 uppercase text-[5px] block">Operador</span>
                                            <span className="font-bold text-[8px]">{operatorName}</span>
                                        </div>
                                        <div className="mt-auto border-t border-gray-200 pt-1">
                                            <span className="text-gray-400 uppercase text-[5px] block">Qtd Analisada</span>
                                            <span className="font-black text-lg leading-none">{quantidadeAnalisada || '—'}</span>
                                        </div>
                                    </div>

                                    {/* Right QR */}
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="border border-black p-0.5">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeData)}`}
                                                alt="QR Code"
                                                className="w-16 h-16"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                        <span className="text-[5px] text-gray-400 mt-0.5">{dateString} {timeString}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="p-6 bg-[#161920] border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-text-sub-dark text-xs">
                        {isLabelGenerated ? '✓ Etiqueta salva no banco de dados' : 'Preencha a quantidade para gerar a etiqueta'}
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
                                disabled={isGenerating || quantidadeAnalisada <= 0}
                                className="px-8 py-3 rounded-xl bg-blue-500 text-white font-black flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-blue-600 text-sm"
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
                                    className="px-8 py-3 rounded-xl bg-blue-500 text-white font-black flex items-center gap-2 transition-all disabled:opacity-50 hover:bg-blue-600 text-sm"
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

export default ChecklistLabelModal;
