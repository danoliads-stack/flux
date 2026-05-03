import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gdprService } from './gdprService';
import { supabase } from '../lib/supabase-client';

vi.mock('../lib/supabase-client');
vi.mock('../utils/logger');

describe('gdprService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordConsentAfterLogin', () => {
    it('deve registrar consentimento GDPR após login', async () => {
      const operatorId = 'op-001';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await gdprService.recordConsentAfterLogin(operatorId);

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
      expect(mockSupabase.from('gdpr_consents').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          operator_id: operatorId,
          policy_version: 1,
        })
      );
    });

    it('deve lidar com erro de insert silenciosamente', async () => {
      const operatorId = 'op-002';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Erro ao inserir' },
        }),
      });

      // Não deve lançar erro, apenas logar
      await expect(
        gdprService.recordConsentAfterLogin(operatorId)
      ).resolves.not.toThrow();
    });

    it('deve incluir user_agent no consentimento', async () => {
      const operatorId = 'op-003';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await gdprService.recordConsentAfterLogin(operatorId);

      expect(mockSupabase.from('gdpr_consents').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_agent: navigator.userAgent,
        })
      );
    });
  });

  describe('exportOperatorData', () => {
    it('deve chamar RPC gdpr_export_operator_data com operator_id correto', async () => {
      const operatorId = 'op-004';
      const mockData = {
        operator: { id: operatorId, nome: 'Test' },
        sessions: [],
        production_records: [],
      };
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi
        .fn()
        .mockResolvedValue({ data: mockData, error: null });

      const result = await gdprService.exportOperatorData(operatorId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'gdpr_export_operator_data',
        { p_operator_id: operatorId }
      );
      expect(result).toEqual(mockData);
    });

    it('deve lançar erro se RPC falhar', async () => {
      const operatorId = 'op-005';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Erro RPC' },
      });

      await expect(gdprService.exportOperatorData(operatorId)).rejects.toThrow();
    });

    it('deve retornar operador não encontrado em erro', async () => {
      const operatorId = 'op-999';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { error: 'Operador não encontrado' },
        error: null,
      });

      const result = await gdprService.exportOperatorData(operatorId);

      expect(result).toEqual({ error: 'Operador não encontrado' });
    });
  });

  describe('anonymizeOperator', () => {
    it('deve chamar RPC gdpr_anonymize_operator com dados corretos', async () => {
      const operatorId = 'op-006';
      const reason = 'Solicicitação do usuário';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { success: true, message: 'Operador anônimizado' },
        error: null,
      });

      await gdprService.anonymizeOperator(operatorId, reason);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'gdpr_anonymize_operator',
        {
          p_operator_id: operatorId,
          p_reason: reason,
        }
      );
    });

    it('deve usar motivo padrão se não fornecido', async () => {
      const operatorId = 'op-007';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await gdprService.anonymizeOperator(operatorId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'gdpr_anonymize_operator',
        {
          p_operator_id: operatorId,
          p_reason: 'Solicitação GDPR',
        }
      );
    });

    it('deve lançar erro se RPC falhar', async () => {
      const operatorId = 'op-008';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Erro RPC' },
      });

      await expect(gdprService.anonymizeOperator(operatorId)).rejects.toThrow();
    });
  });

  describe('hasRecentConsent', () => {
    it('deve retornar true se houver consentimento recente', async () => {
      const operatorId = 'op-009';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ accepted_at: new Date().toISOString() }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await gdprService.hasRecentConsent(operatorId);

      expect(result).toBe(true);
    });

    it('deve retornar false se não houver consentimento recente', async () => {
      const operatorId = 'op-010';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await gdprService.hasRecentConsent(operatorId);

      expect(result).toBe(false);
    });

    it('deve retornar false se erro na query', async () => {
      const operatorId = 'op-011';
      const mockSupabase = vi.mocked(supabase);

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Erro' },
                }),
              }),
            }),
          }),
        }),
      });

      const result = await gdprService.hasRecentConsent(operatorId);

      expect(result).toBe(false);
    });
  });
});
