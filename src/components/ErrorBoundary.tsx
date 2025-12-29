import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Using explicit property declarations to fix TypeScript errors
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // Explicitly declare inherited properties
    declare props: ErrorBoundaryProps;
    declare state: ErrorBoundaryState;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        const { hasError, error } = this.state;
        const { children, fallback } = this.props;

        if (hasError) {
            if (fallback) {
                return fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center h-screen bg-background-dark text-white p-6">
                    <div className="bg-surface-dark p-8 rounded-lg shadow-xl max-w-md w-full text-center border border-border-dark">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h1>
                        <p className="text-text-sub-dark mb-6">
                            Ocorreu um erro inesperado na aplicação.
                            {error && <span className="block mt-2 text-xs font-mono bg-black/30 p-2 rounded text-red-300">{error.message}</span>}
                        </p>

                        <button
                            onClick={this.handleReload}
                            className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                            Recarregar Aplicação
                        </button>
                    </div>
                </div>
            );
        }

        return children;
    }
}

export { ErrorBoundaryClass as ErrorBoundary };
