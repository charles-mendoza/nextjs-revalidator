'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Close when the backdrop is clicked. Ignored if `onClose` is not set. */
  closeOnBackdrop?: boolean;
  /** Close when Escape is pressed. Ignored if `onClose` is not set. */
  closeOnEscape?: boolean;
  /** Max-width utility for the panel, e.g. `max-w-lg`. */
  maxWidth?: string;
  /** Backdrop styling (overlay tint + blur). */
  backdropClassName?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  maxWidth = 'max-w-lg',
  backdropClassName = 'bg-black/85 backdrop-blur-sm',
  children,
}) => {
  // Lock background scroll and wire up Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in ${backdropClassName}`}
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
    >
      <div
        className={`bg-[#09090b] border border-zinc-800 w-full ${maxWidth} rounded-xl shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

interface ModalHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  onClose?: () => void;
}

/** Standard icon + title/subtitle header with an optional close button. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({ icon, title, subtitle, onClose }) => (
  <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-400 truncate max-w-xs">{subtitle}</p>}
      </div>
    </div>
    {onClose && (
      <button
        onClick={onClose}
        className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    )}
  </div>
);
