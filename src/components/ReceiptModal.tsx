import React, { useEffect } from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { Reservation } from '../types';
import { formatDateTimeFr, formatFcfa, formatIsoFr } from '../utils/dataHelpers';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';

interface ReceiptModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  reservation,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !reservation || !reservation.paiementSurPlace) return null;

  const paiement = reservation.paiementSurPlace;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      className="fixed inset-0 z-50 bg-[#0B2A47]/65 backdrop-blur-xs flex items-center justify-center p-4 print:bg-white print:static print:p-0"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl border border-[#DBE6EC] shadow-2xl overflow-hidden print:shadow-none print:border print:rounded-none">
        <div className="px-5 py-4 border-b border-[#DBE6EC] bg-[#123B63] text-white flex items-center justify-between gap-3 print:bg-white print:text-[#123B63]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#20B8A6]">
              CERIM · Brazzaville &amp; Pointe-Noire
            </p>
            <h2 id="receipt-modal-title" className="text-lg font-semibold">
              Reçu de paiement sur place
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le reçu"
            className="min-w-[38px] min-h-[38px] rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center print:hidden"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#DBE6EC]">
            <div>
              <p className="text-xs text-[#5A7084]">Référence réservation</p>
              <p className="text-lg font-bold text-[#123B63] tracking-wide tabular-nums">
                {reservation.code}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#20B8A6]/15 border border-[#20B8A6] text-[#0C7A6D] text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Payé sur place</span>
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Bien réservé</span>
              <span className="font-semibold text-[#123B63] text-right">
                [{reservation.matricule}] {reservation.titre}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Localisation</span>
              <span className="font-medium text-[#0F2233] text-right">
                {reservation.quartier}, {reservation.ville}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Client</span>
              <span className="font-semibold text-[#123B63] text-right">
                {reservation.client.nom}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Séjour</span>
              <span className="font-medium text-[#0F2233] tabular-nums text-right">
                {formatIsoFr(reservation.debut)} → {formatIsoFr(reservation.fin)} (
                {reservation.dureeLabel})
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-2.5">
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Date d&apos;encaissement</span>
              <span className="font-medium text-[#123B63] tabular-nums">
                {formatDateTimeFr(paiement.date)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Mode de paiement</span>
              <span className="font-semibold text-[#123B63]">{paiement.mode}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#5A7084]">Encaissé par</span>
              <span className="font-bold text-[#0C7A6D]">
                {paiement.encaissePar === 'CERIM' ? 'CERIM' : 'Fournisseur'}
              </span>
            </div>
            <div className="flex justify-between gap-4 pt-2 border-t border-[#DBE6EC]">
              <span className="font-semibold text-[#123B63]">Montant total réglé</span>
              <span className="text-xl font-bold text-[#123B63] tabular-nums">
                {formatFcfa(paiement.montant)}
              </span>
            </div>
          </div>

          <div className="text-xs text-[#5A7084] space-y-1">
            <p>
              Reçu généré et journalisé pour envoi WhatsApp au client lors du check-in.
            </p>
            <p className="tabular-nums">
              Interlocuteur unique CERIM : <strong className="text-[#123B63]">{CERIM_WHATSAPP_DISPLAY}</strong>
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#DBE6EC] bg-[#F2F7F9] flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-lg border border-[#DBE6EC] bg-white text-sm font-semibold text-[#5A7084] hover:text-[#123B63]"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[42px] px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Imprimer le reçu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
