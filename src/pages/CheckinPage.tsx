import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lock,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChecklistItemState, PaiementSurPlace, Reservation } from '../types';
import { getChecklistTemplate, reservationService } from '../services/reservationGateway';
import { compressImageFile } from '../utils/imageCompression';
import { formatDateTimeFr, formatFcfa, formatIsoFr, STATUT_LABELS } from '../utils/dataHelpers';
import { ReceiptModal } from '../components/ReceiptModal';
import { buildAdminSeoConfig, usePageSeo } from '../utils/seo';

export const CheckinPage: React.FC = () => {
  const {
    route,
    navigate,
    allBiens,
    reservations,
    refreshReservations,
    adminSettings,
    isAdmin,
    loginAdmin,
    showToast,
  } = useApp();

  const seoConfig = useMemo(() => buildAdminSeoConfig(), []);
  usePageSeo(seoConfig);

  const [adminCode, setAdminCode] = useState('');
  const [authError, setAuthError] = useState('');

  const [searchCode, setSearchCode] = useState(route.trackingCode || '');
  const [selectedCode, setSelectedCode] = useState(route.trackingCode || '');
  const [checklistItems, setChecklistItems] = useState<ChecklistItemState[]>([]);
  const [photosAvant, setPhotosAvant] = useState<string[]>([]);
  const [photosApres, setPhotosApres] = useState<string[]>([]);
  const [montant, setMontant] = useState<string>('');
  const [mode, setMode] = useState<PaiementSurPlace['mode']>('Especes');
  const [encaissePar, setEncaissePar] = useState<PaiementSurPlace['encaissePar']>(
    adminSettings.encaissementPar
  );
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (route.trackingCode) {
      setSearchCode(route.trackingCode);
      setSelectedCode(route.trackingCode);
    }
  }, [route.trackingCode]);

  const activeReservation: Reservation | undefined = useMemo(() => {
    if (!selectedCode.trim()) return undefined;
    return reservations.find((r) => r.code.toUpperCase() === selectedCode.trim().toUpperCase());
  }, [reservations, selectedCode]);

  const activeBien = useMemo(
    () => (activeReservation ? allBiens.find((b) => b.matricule === activeReservation.matricule) : undefined),
    [allBiens, activeReservation]
  );

  useEffect(() => {
    if (activeReservation) {
      setMontant(String(activeReservation.totalEstime));
      setEncaissePar(adminSettings.encaissementPar);
      setPhotosAvant(activeReservation.photosEtat?.avant || []);
      setPhotosApres(activeReservation.photosEtat?.apres || []);
      setChecklistItems(
        activeReservation.checklist?.items ||
          getChecklistTemplate(activeBien?.type || 'Appartement')
      );
      setError('');
    }
  }, [activeReservation?.code, activeReservation?.statut, activeBien?.type, adminSettings.encaissementPar]);

  const queueReservations = useMemo(() => {
    return reservations.filter((r) =>
      ['confirmee', 'bien_pret', 'arrivee'].includes(r.statut)
    );
  }, [reservations]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!loginAdmin(adminCode)) {
      setAuthError('Code d’accès administrateur incorrect.');
    } else {
      setAdminCode('');
    }
  };

  const handlePhotoUpload = async (
    files: FileList | null,
    target: 'avant' | 'apres'
  ) => {
    if (!files || files.length === 0) return;
    setError('');
    setCompressing(true);
    try {
      const nextUrls: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const res = await compressImageFile(file, 1024 * 1024);
        nextUrls.push(res.dataUrl);
      }
      if (target === 'avant') {
        setPhotosAvant((prev) => [...prev, ...nextUrls].slice(0, 6));
      } else {
        setPhotosApres((prev) => [...prev, ...nextUrls].slice(0, 6));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la compression photo.');
    } finally {
      setCompressing(false);
    }
  };

  const handleValidateChecklist = async () => {
    if (!activeReservation) return;
    setError('');
    setSubmitting(true);
    try {
      await reservationService.validerChecklist(activeReservation.code, checklistItems, allBiens);
      refreshReservations();
      showToast({
        title: 'Checklist validée',
        description: `${activeReservation.code} est passé au statut « Bien prêt ».`,
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de valider la checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReservation) return;
    setError('');
    const numMontant = Number(montant);
    if (!numMontant || numMontant <= 0) {
      setError('Veuillez saisir le montant encaissé sur place en FCFA.');
      return;
    }
    setSubmitting(true);
    try {
      await reservationService.enregistrerArrivee({
        code: activeReservation.code,
        photosAvant,
        paiement: {
          montant: numMontant,
          mode,
          encaissePar,
        },
        allBiens,
      });
      refreshReservations();
      setReceiptOpen(true);
      showToast({
        title: 'Check-in enregistré',
        description: `Paiement sur place de ${formatFcfa(numMontant)} validé (${encaissePar}).`,
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (!activeReservation) return;
    setError('');
    setSubmitting(true);
    try {
      await reservationService.terminerSejour({
        code: activeReservation.code,
        photosApres,
      });
      refreshReservations();
      showToast({
        title: 'Séjour terminé',
        description: `État des lieux de sortie enregistré pour ${activeReservation.code}.`,
        type: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la clôture du séjour.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="bg-white rounded-2xl border border-[#DBE6EC] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-[#123B63] text-[#20B8A6] flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-[#123B63] tracking-tight">
              Check-in Agent CERIM
            </h1>
            <p className="text-sm text-[#5A7084]">
              Connectez-vous pour enregistrer l’arrivée du client, les photos d’état et le paiement
              sur place.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="checkin-admin-code" className="block text-xs font-semibold text-[#123B63]">
                Code d’accès CERIM
              </label>
              <input
                id="checkin-admin-code"
                type="password"
                required
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Entrez le code"
                className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#DBE6EC] text-sm"
              />
            </div>
            {authError && (
              <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[46px] rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors"
            >
              Ouvrir l’interface Check-in
            </button>
          </form>
          <p className="text-xs text-center text-[#5A7084] pt-2 border-t border-[#DBE6EC]">
            Code aperçu : <span className="font-semibold text-[#123B63]">CERIM2026</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#DBE6EC]">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate({ page: 'admin', adminTab: 'reservations' })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A6D] hover:text-[#123B63]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retour au Back-Office CERIM</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#123B63] tracking-tight">
            Check-in sur place &amp; État des lieux
          </h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSelectedCode(searchCode.trim().toUpperCase());
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#5A7084] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Code ex. CER-AP1-0042"
              aria-label="Rechercher un code de réservation"
              className="min-h-[42px] pl-9 pr-3 rounded-lg border border-[#DBE6EC] bg-white text-sm uppercase"
            />
          </div>
          <button
            type="submit"
            className="min-h-[42px] px-4 rounded-lg bg-[#123B63] text-white text-xs font-semibold hover:bg-[#0B2A47]"
          >
            Charger
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Queue sidebar */}
        <aside className="lg:col-span-4 bg-white rounded-xl border border-[#DBE6EC] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[#123B63]">
            Dossiers prêts / en cours ({queueReservations.length})
          </h2>
          {queueReservations.length === 0 ? (
            <p className="text-xs text-[#5A7084]">
              Aucune réservation confirmée, prête ou en séjour pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {queueReservations.map((r) => {
                const isSelected = r.code === activeReservation?.code;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSearchCode(r.code);
                      setSelectedCode(r.code);
                    }}
                    className={`w-full p-3 rounded-lg border text-left space-y-1 transition-colors ${
                      isSelected
                        ? 'border-[#20B8A6] bg-[#20B8A6]/10'
                        : 'border-[#DBE6EC] hover:border-[#123B63] bg-[#F2F7F9]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#123B63] tabular-nums">
                        {r.code}
                      </span>
                      <span className="text-[11px] font-semibold text-[#0C7A6D]">
                        {r.statut === 'bien_pret'
                          ? 'Bien prêt'
                          : r.statut === 'arrivee'
                            ? 'Arrivée'
                            : 'Confirmée'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#0F2233] truncate">{r.titre}</p>
                    <p className="text-[11px] text-[#5A7084]">
                      {r.client.nom} · {formatIsoFr(r.debut)} ({r.creneauArrivee || '—'})
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main check-in workspace */}
        <section className="lg:col-span-8 space-y-6">
          {!activeReservation ? (
            <div className="bg-white rounded-xl border border-[#DBE6EC] p-8 text-center space-y-2">
              <ClipboardCheck className="w-8 h-8 text-[#0C7A6D] mx-auto" aria-hidden="true" />
              <p className="text-base font-semibold text-[#123B63]">
                Sélectionnez un dossier ou saisissez un code CER
              </p>
              <p className="text-xs text-[#5A7084]">
                Utilisez cette vue pour inspecter le bien, vérifier la pièce d&apos;identité,
                encaisser le paiement sur place et générer le reçu.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#DBE6EC] p-5 sm:p-6 space-y-6">
              {/* Header info */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#DBE6EC]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#123B63] text-white text-xs font-semibold rounded">
                      {activeReservation.code}
                    </span>
                    <span className="text-xs font-semibold text-[#0C7A6D]">
                      {STATUT_LABELS[activeReservation.statut]}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#123B63]">
                    [{activeReservation.matricule}] {activeReservation.titre}
                  </h2>
                  <p className="text-xs text-[#5A7084]">
                    Client : <strong className="text-[#123B63]">{activeReservation.client.nom}</strong>{' '}
                    · Créneau : {activeReservation.creneauArrivee || '—'} ·{' '}
                    {formatIsoFr(activeReservation.debut)} → {formatIsoFr(activeReservation.fin)}
                  </p>
                </div>

                {activeReservation.paiementSurPlace && (
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="min-h-[40px] px-4 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" aria-hidden="true" />
                    <span>Voir / Imprimer le reçu</span>
                  </button>
                )}
              </div>

              {/* Client ID review */}
              <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-[#0C7A6D] shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#123B63]">
                      Pièce d&apos;identité du client
                    </p>
                    <p className="text-xs text-[#5A7084]">
                      {activeReservation.client.pieceIdentite
                        ? 'Document transmis et prêt à être vérifié visuellement.'
                        : 'Aucune pièce transmise en ligne — vérification physique obligatoire à l’arrivée.'}
                    </p>
                  </div>
                </div>
                {activeReservation.client.pieceIdentite && (
                  <img
                    src={activeReservation.client.pieceIdentite}
                    alt="Pièce d'identité transmise"
                    className="h-16 w-24 object-cover rounded-lg border border-[#DBE6EC] shrink-0"
                  />
                )}
              </div>

              {/* Step 0 if still confirmee -> validate checklist first */}
              {activeReservation.statut === 'confirmee' && (
                <div className="rounded-xl border border-[#20B8A6] bg-[#20B8A6]/5 p-5 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-[#123B63]">
                      Étape préalable : valider la checklist « Bien prêt »
                    </h3>
                    <p className="text-xs text-[#5A7084]">
                      Cochez tous les points de préparation avant de procéder au check-in.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {checklistItems.map((it) => (
                      <label key={it.id} className="flex items-center gap-2.5 text-xs text-[#0F2233] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          onChange={(e) =>
                            setChecklistItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, checked: e.target.checked } : x
                              )
                            )
                          }
                          className="w-4 h-4 accent-[#20B8A6]"
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={submitting || !checklistItems.every((i) => i.checked)}
                    onClick={handleValidateChecklist}
                    className="min-h-[42px] px-4 rounded-lg bg-[#123B63] text-white text-xs font-semibold hover:bg-[#0B2A47] disabled:opacity-45"
                  >
                    Valider la checklist (« Bien prêt »)
                  </button>
                </div>
              )}

              {/* Check-in form (statut bien_pret) */}
              {activeReservation.statut === 'bien_pret' && (
                <form onSubmit={handleConfirmArrival} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#123B63]">
                      Photos d&apos;état des lieux AVANT remise des clés (compressées &le; 1 Mo)
                    </label>
                    <label className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg border border-dashed border-[#123B63] bg-[#F2F7F9] hover:bg-white text-xs font-semibold text-[#123B63] cursor-pointer">
                      <Camera className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                      <span>
                        {compressing ? 'Compression...' : 'Ajouter des photos d’arrivée'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => handlePhotoUpload(e.target.files, 'avant')}
                      />
                    </label>

                    {photosAvant.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                        {photosAvant.map((src, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={src}
                              alt={`État avant ${idx + 1}`}
                              className="w-full h-16 object-cover rounded-lg border border-[#DBE6EC]"
                            />
                            <button
                              type="button"
                              aria-label="Retirer cette photo"
                              onClick={() =>
                                setPhotosAvant((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute top-1 right-1 w-5 h-5 rounded bg-[#123B63] text-white inline-flex items-center justify-center"
                            >
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#DBE6EC] p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-[#123B63]">
                      Encaissement du paiement sur place
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="ci-montant" className="block text-xs font-semibold text-[#123B63]">
                          Montant encaissé (FCFA)
                        </label>
                        <input
                          id="ci-montant"
                          type="number"
                          required
                          min={1000}
                          value={montant}
                          onChange={(e) => setMontant(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] text-sm tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="ci-mode" className="block text-xs font-semibold text-[#123B63]">
                          Mode de règlement
                        </label>
                        <select
                          id="ci-mode"
                          value={mode}
                          onChange={(e) => setMode(e.target.value as PaiementSurPlace['mode'])}
                          className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                        >
                          <option value="Especes">Espèces (FCFA)</option>
                          <option value="Mobile Money sur place">Mobile Money sur place</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="ci-enc" className="block text-xs font-semibold text-[#123B63]">
                          Encaissé par
                        </label>
                        <select
                          id="ci-enc"
                          value={encaissePar}
                          onChange={(e) =>
                            setEncaissePar(e.target.value as PaiementSurPlace['encaissePar'])
                          }
                          className="w-full min-h-[42px] px-3 rounded-lg border border-[#DBE6EC] bg-white text-sm"
                        >
                          <option value="CERIM">CERIM</option>
                          <option value="FOURNISSEUR">Fournisseur</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || compressing}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    <span>Valider le check-in &amp; émettre le reçu</span>
                  </button>
                </form>
              )}

              {/* Check-out flow (statut arrivee) */}
              {activeReservation.statut === 'arrivee' && (
                <div className="space-y-5">
                  <div className="rounded-xl bg-[#20B8A6]/10 border border-[#20B8A6] p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 text-xs text-[#123B63]">
                      <CheckCircle2 className="w-5 h-5 text-[#0C7A6D] shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">
                          Arrivée enregistrée le{' '}
                          {activeReservation.paiementSurPlace
                            ? formatDateTimeFr(activeReservation.paiementSurPlace.date)
                            : ''}
                        </p>
                        <p className="text-[#5A7084]">
                          {photosAvant.length} photo(s) d&apos;entrée enregistrée(s).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#123B63]">
                      Photos d&apos;état des lieux APRÈS séjour (sortie / restitution des clés)
                    </label>
                    <label className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg border border-dashed border-[#123B63] bg-[#F2F7F9] hover:bg-white text-xs font-semibold text-[#123B63] cursor-pointer">
                      <Camera className="w-4 h-4 text-[#0C7A6D]" aria-hidden="true" />
                      <span>
                        {compressing ? 'Compression...' : 'Ajouter des photos de sortie'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => handlePhotoUpload(e.target.files, 'apres')}
                      />
                    </label>

                    {photosApres.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                        {photosApres.map((src, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={src}
                              alt={`État après ${idx + 1}`}
                              className="w-full h-16 object-cover rounded-lg border border-[#DBE6EC]"
                            />
                            <button
                              type="button"
                              aria-label="Retirer cette photo"
                              onClick={() =>
                                setPhotosApres((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute top-1 right-1 w-5 h-5 rounded bg-[#123B63] text-white inline-flex items-center justify-center"
                            >
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={submitting || compressing}
                    onClick={handleCheckout}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-[#123B63] hover:bg-[#0B2A47] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#20B8A6]" aria-hidden="true" />
                    <span>Clôturer le séjour (état de sortie validé)</span>
                  </button>
                </div>
              )}

              {/* Finished view (statut terminee) */}
              {activeReservation.statut === 'terminee' && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-[#0C7A6D]">
                    Séjour clôturé. Comparatif des photos d&apos;état :
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-2">
                      <p className="text-xs font-semibold text-[#123B63]">
                        Avant ({photosAvant.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {photosAvant.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt={`Avant ${i + 1}`}
                            className="w-full h-16 object-cover rounded border border-[#DBE6EC]"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F2F7F9] border border-[#DBE6EC] space-y-2">
                      <p className="text-xs font-semibold text-[#123B63]">
                        Après ({photosApres.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {photosApres.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt={`Après ${i + 1}`}
                            className="w-full h-16 object-cover rounded border border-[#DBE6EC]"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <ReceiptModal
        reservation={activeReservation || null}
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  );
};
