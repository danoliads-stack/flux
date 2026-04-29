import { supabase } from '../lib/supabase-client';
import { logger } from '../utils/logger';

/**
 * Serviço para operações GDPR/LGPD
 */

export const gdprService = {
  /**
   * Registra consentimento de política de privacidade
   */
  async recordConsentAfterLogin(operatorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('gdpr_consents')
        .insert({
          operator_id: operatorId,
          policy_version: 1,
          ip_address: null, // Supabase não expõe IP automaticamente
          user_agent: navigator.userAgent,
        });

      if (error) {
        logger.error('Erro ao registrar consentimento GDPR', { error, operatorId });
        // Não bloqueia o fluxo se falhar — é não-crítico
      } else {
        logger.log('Consentimento GDPR registrado', { operatorId });
      }
    } catch (e) {
      logger.error('Erro ao registrar consentimento GDPR', { error: e });
    }
  },

  /**
   * Exporta dados do operador (portabilidade de dados)
   */
  async exportOperatorData(operatorId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc(
        'gdpr_export_operator_data',
        { p_operator_id: operatorId }
      );

      if (error) {
        logger.error('Erro ao exportar dados', { error });
        throw new Error(error.message);
      }

      return data;
    } catch (e) {
      logger.error('Erro ao exportar dados do operador', { error: e });
      throw e;
    }
  },

  /**
   * Anônimiza um operador (direito ao esquecimento) — admin only
   */
  async anonymizeOperator(operatorId: string, reason: string = 'Solicitação GDPR'): Promise<void> {
    try {
      const { data, error } = await supabase.rpc(
        'gdpr_anonymize_operator',
        {
          p_operator_id: operatorId,
          p_reason: reason,
        }
      );

      if (error) {
        logger.error('Erro ao anônimizar operador', { error });
        throw new Error(error.message);
      }

      logger.log('Operador anônimizado', { operatorId, data });
    } catch (e) {
      logger.error('Erro ao anônimizar operador', { error: e });
      throw e;
    }
  },

  /**
   * Verifica se operador tem consentimento recente
   */
  async hasRecentConsent(operatorId: string, maxAgeDays: number = 365): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('gdpr_consents')
        .select('accepted_at')
        .eq('operator_id', operatorId)
        .gte('accepted_at', new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString())
        .order('accepted_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.error('Erro ao verificar consentimento', { error });
        return false;
      }

      return data && data.length > 0;
    } catch (e) {
      logger.error('Erro ao verificar consentimento', { error: e });
      return false;
    }
  },
};
