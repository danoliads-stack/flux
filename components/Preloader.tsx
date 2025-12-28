import React from 'react';

const Preloader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b0c10] text-white overflow-hidden">
            {/* Background Texture/Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,20,28,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,20,28,0)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

            <style>{`
                @keyframes stroke-draw {
                    0% { stroke-dashoffset: 1000; opacity: 0; }
                    10% { opacity: 1; }
                    100% { stroke-dashoffset: 0; opacity: 1; }
                }
                @keyframes logo-glow {
                    0%, 100% { filter: drop-shadow(0 0 15px rgba(0, 255, 148, 0.1)); }
                    50% { filter: drop-shadow(0 0 30px rgba(0, 255, 148, 0.4)); }
                }
                @keyframes scan-line {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(200%); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>

            <div className="relative mb-12 transform scale-125">
                {/* Logo Container */}
                <div className="relative w-40 h-40 flex items-center justify-center">

                    {/* Main Logo Image with Glow */}
                    <img
                        src="/assets/logo-square.png"
                        alt="Flux Insight"
                        className="w-full h-full object-contain relative z-10 animate-[logo-glow_3s_ease-in-out_infinite]"
                    />

                    {/* Simulating "Stroke" effect with a scanning overlay */}
                    <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay opacity-50 overflow-hidden rounded-xl">
                        <div className="w-full h-1/2 bg-gradient-to-b from-transparent via-primary/50 to-transparent animate-[scan-line_2s_linear_infinite]"></div>
                    </div>

                    {/* Orbital Rings - Elegant and minimal */}
                    <div className="absolute inset-[-20%] border border-primary/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                    <div className="absolute inset-[-10%] border border-primary/10 rounded-full animate-[spin_7s_linear_infinite_reverse]"></div>
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 z-10">
                <h2 className="text-3xl font-display font-black tracking-[0.2em] text-white flex items-center gap-3">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">FLUX</span>
                    <span className="text-primary drop-shadow-[0_0_10px_rgba(0,255,148,0.5)]">INSIGHTS</span>
                </h2>

                {/* Minimal Loading Bar */}
                <div className="w-64 h-1 bg-gray-800/50 rounded-full overflow-hidden mt-8 backdrop-blur-sm border border-white/5">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-primary to-transparent origin-left animate-[shimmer_2s_infinite]"></div>
                </div>

                <div className="flex flex-col items-center gap-1 mt-4">
                    <span className="text-[10px] text-primary/70 font-mono tracking-widest uppercase animate-pulse">
                        Inicializando Sistema
                    </span>
                    <span className="text-[9px] text-gray-600 font-mono">
                        v1.0.4 • Building Core
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Preloader;
