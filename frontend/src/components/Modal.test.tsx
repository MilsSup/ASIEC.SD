import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ModalHeader } from './Modal';

describe('Modal', () => {
  it('показывает заголовок и содержимое', () => {
    render(
      <Modal onClose={() => {}}>
        <ModalHeader title="Тестовая модалка" subtitle="подзаголовок" onClose={() => {}} />
        <div>Содержимое</div>
      </Modal>,
    );
    expect(screen.getByText('Тестовая модалка')).toBeTruthy();
    expect(screen.getByText('подзаголовок')).toBeTruthy();
    expect(screen.getByText('Содержимое')).toBeTruthy();
  });

  it('клик по затемнённому фону вызывает onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal onClose={onClose}><div>x</div></Modal>);
    const backdrop = container.querySelector('.absolute');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
