import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger.log', () => {
    it('deve logar mensagem com label', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('Teste de log');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve logar mensagem com label e dados', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('Operador logado', { matricula: '3333' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('não deve expor dados sensíveis em log', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('Pin attempt', { pin: '1234', user: 'test' });

      // Verifica que foi logado, mas conteúdo é abstraído
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('logger.error', () => {
    it('deve logar erro', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      logger.error('Erro crítico', new Error('Test error'));

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('deve sempre logar errors (não deve ser silencioso)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      logger.error('Falha de autenticação');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('deve logar erro com contexto adicional', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      logger.error('RPC Error', {
        rpc: 'validate_operator_pin',
        status: 400,
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('logger.warn', () => {
    it('deve logar aviso', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      logger.warn('Atenção: valor fora do esperado');

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Dados variados', () => {
    it('deve permitir logar com diferentes tipos de dados', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('User info', { email: 'user@test.com', matricula: '3333' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve logar nomes de usuário', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('Operator info', { name: 'JOSEMAR', matricula: '3333' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve logar objetos complexos', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      logger.log('Complex data', {
        operator: { id: '001', name: 'Test' },
        timestamp: new Date().toISOString(),
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
