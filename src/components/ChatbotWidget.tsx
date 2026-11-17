import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  RotateCcw,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Bien, BienType, BienVille } from '../types';
import {
  addDaysIso,
  buildCerimWhatsAppUrl,
  filterAndSortBiens,
  formatFcfa,
  formatIsoFr,
  getTodayIso,
} from '../utils/dataHelpers';

interface ChatDraft {
  type: BienType | null;
  ville: BienVille | 'Toutes' | null;
  budgetMax: number | null | 'none';
  debut: string | null;
  fin: string | null;
  datesConfirmed: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  results?: Bien[];
  resultDates?: { debut: string; fin: string };
  advisorLink?: string;
  relaxActions?: boolean;
}

const INITIAL_DRAFT: ChatDraft = {
  type: null,
  ville: null,
  budgetMax: null,
  debut: null,
  fin: null,
  datesConfirmed: false,
};

function parseFreeText(
  input: string
): Partial<ChatDraft> & { command?: 'reset' | 'advisor' | 'owner_question' } {
  const lower = input.toLowerCase().trim();
  if (lower.includes('recommencer') || lower === 'reset' || lower === 'nouvelle recherche') {
    return { command: 'reset' };
  }
  if (
    lower.includes('propriétaire') ||
    lower.includes('proprietaire') ||
    lower.includes('proprio') ||
    lower.includes('fournisseur') ||
    lower.includes('qui loue') ||
    lower.includes('à qui appartient') ||
    lower.includes('a qui appartient') ||
    lower.includes('numéro du bailleur') ||
    lower.includes('bailleur')
  ) {
    return { command: 'owner_question' };
  }
  if (lower.includes('conseiller') || lower.includes('humain') || lower.includes('agent')) {
    return { command: 'advisor' };
  }

  const parsed: Partial<ChatDraft> = {};

  if (/\b(appartement|appart|studio|logement|chambre)\b/i.test(lower)) {
    parsed.type = 'Appartement';
  } else if (/\b(voiture|auto|véhicule|vehicule|suv|4x4|berline)\b/i.test(lower)) {
    parsed.type = 'Voiture';
  }

  if (lower.includes('brazza')) {
    parsed.ville = 'Brazzaville';
  } else if (lower.includes('pointe') || lower.includes('pnr')) {
    parsed.ville = 'Pointe-Noire';
  } else if (lower.includes('toutes les villes') || lower.includes('peu importe')) {
    parsed.ville = 'Toutes';
  }

  const kMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  const numMatch = lower.match(/(\d[\d\s]{3,})/);
  if (kMatch) {
    const val = Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
    if (val >= 5000) parsed.budgetMax = val;
  } else if (numMatch) {
    const val = parseInt(numMatch[1].replace(/\s+/g, ''), 10);
    if (val >= 5000) parsed.budgetMax = val;
  }

  return parsed;
}

export const ChatbotWidget: React.FC = () => {
  const {
    allBiens,
    catalogBlocks,
    reservations,
    navigate,
    chatbotOpen,
    setChatbotOpen,
  } = useApp();

  const [draft, setDraft] = useState<ChatDraft>(INITIAL_DRAFT);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Bonjour ! Je suis l’assistant CERIM. Je vous aide à trouver un appartement ou une voiture à Brazzaville et Pointe-Noire. Réservation sans paiement en ligne : vous payez à votre arrivée. Que recherchez-vous ?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (chatbotOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatbotOpen]);

  useEffect(() => {
    if (!chatbotOpen) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChatbotOpen(false);
        triggerBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chatbotOpen, setChatbotOpen]);

  const appendBotSearchPrompt = (nextDraft: ChatDraft) => {
    if (!nextDraft.type) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: 'Souhaitez-vous louer un appartement ou une voiture ?',
        },
      ]);
      return;
    }
    const chosenType = nextDraft.type;
    if (!nextDraft.ville) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: `Parfait pour un(e) ${chosenType.toLowerCase()}. Dans quelle ville ?`,
        },
      ]);
      return;
    }
    if (nextDraft.budgetMax === null) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: 'Quel est votre budget maximum par période ?',
        },
      ]);
      return;
    }
    if (!nextDraft.datesConfirmed) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: 'Pour quelles dates souhaitez-vous vérifier la disponibilité ?',
        },
      ]);
      return;
    }

    const matches = filterAndSortBiens(
      allBiens,
      {
        type: nextDraft.type,
        ville: nextDraft.ville,
        budgetMax: nextDraft.budgetMax === 'none' ? null : nextDraft.budgetMax,
        debut: nextDraft.debut || '',
        fin: nextDraft.fin || '',
        sort: 'prix-asc',
      },
      catalogBlocks,
      reservations
    ).slice(0, 3);

    if (matches.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: 'Aucun bien ne correspond exactement à ces critères. Souhaitez-vous élargir la recherche ?',
          relaxActions: true,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: `Voici ${matches.length} proposition${matches.length > 1 ? 's' : ''} gérée${
            matches.length > 1 ? 's' : ''
          } par CERIM (triées par tarif croissant, paiement sur place à l’arrivée) :`,
          results: matches,
          resultDates:
            nextDraft.debut && nextDraft.fin
              ? { debut: nextDraft.debut, fin: nextDraft.fin }
              : undefined,
        },
      ]);
    }
  };

  const applyDraftUpdate = (userLabel: string, patch: Partial<ChatDraft>) => {
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: userLabel },
    ]);
    appendBotSearchPrompt(nextDraft);
  };

  const handleReset = () => {
    setDraft(INITIAL_DRAFT);
    setCustomDebut('');
    setCustomFin('');
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'bot',
        text: 'Recherche réinitialisée. Que souhaitez-vous louer aujourd’hui ?',
      },
    ]);
  };

  const handleAdvisor = () => {
    const url = buildCerimWhatsAppUrl(
      'Bonjour CERIM, je souhaite parler à un conseiller de votre équipe pour organiser une réservation.'
    );
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: 'Parler à un conseiller CERIM' },
      {
        id: `b-${Date.now() + 1}`,
        sender: 'bot',
        text: 'CERIM est votre interlocuteur unique pour la réservation et le séjour. Échangez directement avec notre équipe sur WhatsApp :',
        advisorLink: url,
      },
    ]);
  };

  const handleOwnerQuestion = (rawUserQuestion: string) => {
    const url = buildCerimWhatsAppUrl(
      'Bonjour CERIM, j’ai une question concernant la gestion d’un bien.'
    );
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: rawUserQuestion },
      {
        id: `b-${Date.now() + 1}`,
        sender: 'bot',
        text: 'Ce bien est géré par CERIM, votre interlocuteur unique pour la réservation et le séjour.',
        advisorLink: url,
      },
    ]);
  };

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputValue.trim();
    if (!raw) return;
    setInputValue('');

    const parsed = parseFreeText(raw);
    if (parsed.command === 'reset') {
      handleReset();
      return;
    }
    if (parsed.command === 'owner_question') {
      handleOwnerQuestion(raw);
      return;
    }
    if (parsed.command === 'advisor') {
      handleAdvisor();
      return;
    }

    const nextDraft: ChatDraft = {
      type: parsed.type ?? draft.type,
      ville: parsed.ville ?? draft.ville,
      budgetMax: parsed.budgetMax !== undefined ? parsed.budgetMax : draft.budgetMax,
      debut: draft.debut,
      fin: draft.fin,
      datesConfirmed: draft.datesConfirmed,
    };
    setDraft(nextDraft);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: raw }]);

    if (!parsed.type && !parsed.ville && parsed.budgetMax === undefined) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now() + 1}`,
          sender: 'bot',
          text: 'Utilisez les boutons rapides ci-dessous ou indiquez un type (appartement / voiture), une ville (Brazzaville / Pointe-Noire) ou un budget (ex: 60 000). Tapez « recommencer » ou « conseiller » à tout moment.',
        },
      ]);
      return;
    }
    appendBotSearchPrompt(nextDraft);
  };

  const todayIso = getTodayIso();
  const quickStage = useMemo(() => {
    if (!draft.type) return 'type';
    if (!draft.ville) return 'ville';
    if (draft.budgetMax === null) return 'budget';
    if (!draft.datesConfirmed) return 'dates';
    return 'done';
  }, [draft]);

  return (
    <>
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => setChatbotOpen(!chatbotOpen)}
        aria-label="Ouvrir l’assistant CERIM"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2.5 px-4 min-h-[48px] rounded-xl bg-[#123B63] hover:bg-[#0B2A47] text-white shadow-lg border border-white/15 transition-all duration-200"
      >
        <MessageSquare className="w-5 h-5 text-[#20B8A6]" aria-hidden="true" />
        <span className="text-sm font-semibold whitespace-nowrap">Assistant CERIM</span>
      </button>

      {chatbotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assistant CERIM"
          className="fixed inset-2 sm:inset-auto sm:bottom-20 sm:right-6 sm:w-[410px] sm:h-[600px] z-50 bg-white rounded-2xl border border-[#DBE6EC] shadow-2xl flex flex-col overflow-hidden transition-all duration-200"
        >
          <div className="bg-[#0B2A47] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-semibold">Assistant CERIM</h3>
              <p className="text-xs text-white/75">
                Interlocuteur unique · Paiement sur place
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Recommencer la conversation"
                title="Recommencer"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => {
                  setChatbotOpen(false);
                  triggerBtnRef.current?.focus();
                }}
                aria-label="Fermer l’assistant"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F2F7F9]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#123B63] text-white'
                      : 'bg-white text-[#0F2233] border border-[#DBE6EC]'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.advisorLink && (
                    <a
                      href={msg.advisorLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      <span>Écrire à l’équipe CERIM sur WhatsApp</span>
                    </a>
                  )}

                  {msg.results && (
                    <div className="mt-3 space-y-2.5">
                      {msg.results.map((b) => (
                        <div
                          key={b.matricule}
                          className="p-3 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-1.5 py-0.5 bg-white border border-[#123B63] text-[#123B63] text-[11px] font-semibold rounded-[3px]">
                              {b.matricule}
                            </span>
                            <span className="text-xs font-semibold text-[#0C7A6D] tabular-nums">
                              {formatFcfa(b.prix)} / {b.periode}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#123B63]">{b.titre}</p>
                          <p className="text-[11px] text-[#5A7084]">
                            {b.quartier} · {b.ville} · Géré par CERIM
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setChatbotOpen(false);
                                navigate({ page: 'detail', matricule: b.matricule });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Réserver (paiement sur place)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.relaxActions && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          applyDraftUpdate('Retirer le budget maximum', { budgetMax: 'none' })
                        }
                        className="px-2.5 py-1.5 rounded-md bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                      >
                        Retirer le budget max
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyDraftUpdate('Toutes les villes', { ville: 'Toutes' })
                        }
                        className="px-2.5 py-1.5 rounded-md border border-[#DBE6EC] bg-white text-[#123B63] text-xs font-medium"
                      >
                        Toutes les villes
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyDraftUpdate('Dates flexibles', {
                            debut: null,
                            fin: null,
                            datesConfirmed: true,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-md border border-[#DBE6EC] bg-white text-[#123B63] text-xs font-medium"
                      >
                        Dates flexibles
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-[#DBE6EC] space-y-2.5 shrink-0">
            {quickStage === 'type' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Appartement', { type: 'Appartement' })}
                  className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
                >
                  Appartement
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Voiture', { type: 'Voiture' })}
                  className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
                >
                  Voiture
                </button>
                <button
                  type="button"
                  onClick={handleAdvisor}
                  className="min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-[#123B63] text-xs font-medium hover:bg-[#F2F7F9]"
                >
                  Conseiller
                </button>
              </div>
            )}

            {quickStage === 'ville' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Brazzaville', { ville: 'Brazzaville' })}
                  className="flex-1 min-h-[40px] px-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold"
                >
                  Brazzaville
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Pointe-Noire', { ville: 'Pointe-Noire' })}
                  className="flex-1 min-h-[40px] px-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold"
                >
                  Pointe-Noire
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Toutes les villes', { ville: 'Toutes' })}
                  className="min-h-[40px] px-3 rounded-lg border border-[#DBE6EC] text-[#123B63] text-xs font-medium"
                >
                  Les deux
                </button>
              </div>
            )}

            {quickStage === 'budget' && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Budget ≤ 50 000 FCFA', { budgetMax: 50000 })}
                  className="min-h-[38px] px-2.5 rounded-lg border border-[#DBE6EC] hover:border-[#20B8A6] text-[#123B63] text-xs font-medium"
                >
                  ≤ 50 000 FCFA
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Budget ≤ 80 000 FCFA', { budgetMax: 80000 })}
                  className="min-h-[38px] px-2.5 rounded-lg border border-[#DBE6EC] hover:border-[#20B8A6] text-[#123B63] text-xs font-medium"
                >
                  ≤ 80 000 FCFA
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Budget ≤ 150 000 FCFA', { budgetMax: 150000 })}
                  className="min-h-[38px] px-2.5 rounded-lg border border-[#DBE6EC] hover:border-[#20B8A6] text-[#123B63] text-xs font-medium"
                >
                  ≤ 150 000 FCFA
                </button>
                <button
                  type="button"
                  onClick={() => applyDraftUpdate('Sans limite de budget', { budgetMax: 'none' })}
                  className="min-h-[38px] px-2.5 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                >
                  Sans limite
                </button>
              </div>
            )}

            {quickStage === 'dates' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyDraftUpdate('Pour 3 jours dès aujourd’hui', {
                        debut: todayIso,
                        fin: addDaysIso(todayIso, 2),
                        datesConfirmed: true,
                      })
                    }
                    className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-[#20B8A6] text-[#123B63] text-xs font-semibold"
                  >
                    Dès aujourd&apos;hui (3 j)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyDraftUpdate('Dates flexibles', {
                        debut: null,
                        fin: null,
                        datesConfirmed: true,
                      })
                    }
                    className="min-h-[38px] px-3 rounded-lg border border-[#DBE6EC] text-[#123B63] text-xs font-medium"
                  >
                    Dates flexibles
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={customDebut}
                    min={todayIso}
                    onChange={(e) => setCustomDebut(e.target.value)}
                    aria-label="Date de début"
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-[#DBE6EC]"
                  />
                  <input
                    type="date"
                    value={customFin}
                    min={customDebut || todayIso}
                    onChange={(e) => setCustomFin(e.target.value)}
                    aria-label="Date de fin"
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-[#DBE6EC]"
                  />
                  <button
                    type="button"
                    disabled={!customDebut || !customFin || customFin < customDebut}
                    onClick={() =>
                      applyDraftUpdate(
                        `Du ${formatIsoFr(customDebut)} au ${formatIsoFr(customFin)}`,
                        { debut: customDebut, fin: customFin, datesConfirmed: true }
                      )
                    }
                    className="px-3 py-1.5 min-h-[34px] rounded bg-[#123B63] text-white text-xs font-semibold disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleFreeTextSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ex: voiture Brazzaville 80k..."
                aria-label="Votre message à l’assistant"
                className="flex-1 px-3 py-2 min-h-[42px] text-sm rounded-lg border border-[#DBE6EC] focus:border-[#20B8A6] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white transition-colors"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
