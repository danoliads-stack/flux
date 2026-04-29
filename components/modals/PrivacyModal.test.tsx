import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyModal from './PrivacyModal';

describe('PrivacyModal', () => {
  const mockOnAccept = vi.fn();
  const mockOnDecline = vi.fn();

  it('não deve renderizar quando isOpen é false', () => {
    const { container } = render(
      <PrivacyModal isOpen={false} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('deve renderizar modal quando isOpen é true', () => {
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    expect(screen.getByText('Política de Privacidade')).toBeInTheDocument();
  });

  it('deve renderizar 3 seções: Dados Coletados, Retenção, Direitos LGPD', () => {
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    expect(screen.getByText('Dados Coletados')).toBeInTheDocument();
    expect(screen.getByText('Retenção de Dados')).toBeInTheDocument();
    expect(screen.getByText('Seus Direitos LGPD')).toBeInTheDocument();
  });

  it('deve expandir seção "Dados Coletados" ao clicar', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const buttons = screen.getAllByRole('button');
    const dadosButton = buttons.find(btn => btn.textContent.includes('Dados Coletados'));

    expect(dadosButton).toBeInTheDocument();

    if (dadosButton) {
      await user.click(dadosButton);

      // Verifica que conteúdo da seção apareceu
      expect(screen.getByText('Coletamos e processamos:')).toBeInTheDocument();
    }
  });

  it('deve expandir seção "Retenção de Dados"', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const buttons = screen.getAllByRole('button');
    const retencaoButton = buttons.find(btn => btn.textContent.includes('Retenção de Dados'));

    if (retencaoButton) {
      await user.click(retencaoButton);
      expect(screen.getByText('Mantemos seus dados pelo tempo necessário:')).toBeInTheDocument();
    }
  });

  it('deve expandir seção "Seus Direitos LGPD"', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const buttons = screen.getAllByRole('button');
    const direitosButton = buttons.find(btn => btn.textContent.includes('Seus Direitos LGPD'));

    if (direitosButton) {
      await user.click(direitosButton);
      expect(screen.getByText('Você tem o direito de:')).toBeInTheDocument();
    }
  });

  it('deve ter checkbox de aceite inicialmente desmarcado', () => {
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('deve marcar checkbox ao clicar', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('deve desabilitar botão "Aceitar e Continuar" quando checkbox não marcado', () => {
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const botoes = screen.getAllByRole('button');
    const aceitarButton = botoes.find(btn => btn.textContent.includes('Aceitar'));

    expect(aceitarButton).toBeDisabled();
  });

  it('deve habilitar botão "Aceitar e Continuar" quando checkbox marcado', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const botoes = screen.getAllByRole('button');
    const aceitarButton = botoes.find(btn => btn.textContent.includes('Aceitar'));

    expect(aceitarButton).not.toBeDisabled();
  });

  it('deve chamar onAccept quando clica em "Aceitar e Continuar" com checkbox marcado', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const botoes = screen.getAllByRole('button');
    const aceitarButton = botoes.find(btn => btn.textContent.includes('Aceitar'));

    if (aceitarButton) {
      await user.click(aceitarButton);
      expect(mockOnAccept).toHaveBeenCalled();
    }
  });

  it('deve chamar onDecline quando clica em "Rejeitar"', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const botoes = screen.getAllByRole('button');
    const rejeitarButton = botoes.find(btn => btn.textContent.includes('Rejeitar'));

    if (rejeitarButton) {
      await user.click(rejeitarButton);
      expect(mockOnDecline).toHaveBeenCalled();
    }
  });

  it('deve exibir aviso importante sobre coleta de dados', () => {
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    expect(
      screen.getByText(/Ao usar FLUX, você aceita que seus dados pessoais/)
    ).toBeInTheDocument();
  });

  it('deve listar direitos LGPD: Acessar, Corrigir, Deletar, Portar, Reclamar', async () => {
    const user = userEvent.setup();
    render(
      <PrivacyModal isOpen={true} onAccept={mockOnAccept} onDecline={mockOnDecline} />
    );

    const buttons = screen.getAllByRole('button');
    const direitosButton = buttons.find(btn => btn.textContent.includes('Seus Direitos LGPD'));

    if (direitosButton) {
      await user.click(direitosButton);
      expect(screen.getByText(/Acessar:/)).toBeInTheDocument();
      expect(screen.getByText(/Corrigir:/)).toBeInTheDocument();
      expect(screen.getByText(/Deletar:/)).toBeInTheDocument();
      expect(screen.getByText(/Portar:/)).toBeInTheDocument();
      expect(screen.getByText(/Reclamar:/)).toBeInTheDocument();
    }
  });
});
