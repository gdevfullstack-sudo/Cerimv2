import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Bien, Reservation } from '../types';
import {
  getOccupiedDatesSet,
  getTodayIso,
  isRangeAvailable,
  formatIsoFr,
} from '../utils/dataHelpers';

interface AvailabilityCalendarProps {
  bien: Bien;
  extraBlocked?: string[];
  activeReservations?: Reservation[];
  mode?: 'select' | 'block';
  selectedStart?: string;
  selectedEnd?: string;
  onSelectRange?: (debut: string, fin: string) => void;
  onToggleBlockDate?: (isoDate: string) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  bien,
  extraBlocked = [],
  activeReservations = [],
  mode = 'select',
  selectedStart = '',
  selectedEnd = '',
  onSelectRange,
  onToggleBlockDate,
}) => {
  const todayIso = getTodayIso();
  const [todayYear, todayMonth] = todayIso.split('-').map(Number);

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth - 1); // 0-indexed
  const [rangeError, setRangeError] = useState<string>('');

  const occupiedSet = useMemo(() => {
    if (mode === 'block') {
      // In block mode, distinguish reserved vs manually blocked
      return getOccupiedDatesSet(
        { ...bien, bloques: [] },
        [],
        activeReservations
      );
    }
    return getOccupiedDatesSet(bien, extraBlocked, activeReservations);
  }, [bien, extraBlocked, activeReservations, mode]);

  const blockedOnlySet = useMemo(() => {
    return new Set([...bien.bloques, ...extraBlocked]);
  }, [bien.bloques, extraBlocked]);

  const monthLabel = useMemo(() => {
    const dt = new Date(viewYear, viewMonth, 1);
    return dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ iso: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      cells.push({ iso, dayNum: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    setRangeError('');
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setRangeError('');
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayClick = (iso: string) => {
    setRangeError('');
    if (iso < todayIso) return;

    if (mode === 'block') {
      if (occupiedSet.has(iso)) {
        setRangeError('Ce jour fait partie d’une réservation existante.');
        return;
      }
      onToggleBlockDate?.(iso);
      return;
    }

    // Client selection mode
    if (occupiedSet.has(iso)) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      onSelectRange?.(iso, '');
      return;
    }

    // Selecting end date
    if (iso < selectedStart) {
      onSelectRange?.(iso, '');
      return;
    }

    if (!isRangeAvailable(bien, selectedStart, iso, extraBlocked, activeReservations)) {
      setRangeError(
        'La période sélectionnée traverse des jours indisponibles. Veuillez choisir une autre plage.'
      );
      return;
    }

    onSelectRange?.(selectedStart, iso);
  };

  return (
    <div className="bg-white rounded-xl border border-[#DBE6EC] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Mois précédent"
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[#DBE6EC] text-[#123B63] hover:bg-[#F2F7F9] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <h4 className="text-sm sm:text-base font-semibold text-[#123B63] capitalize">
          {monthLabel}
        </h4>

        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Mois suivant"
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[#DBE6EC] text-[#123B63] hover:bg-[#F2F7F9] transition-colors"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-xs font-medium text-[#5A7084] py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Disponibilités ${monthLabel}`}>
        {calendarDays.map((cell, idx) => {
          if (!cell.iso || cell.dayNum === null) {
            return <div key={`empty-${idx}`} className="h-10" />;
          }

          const iso = cell.iso;
          const isPast = iso < todayIso;
          const isReserved = occupiedSet.has(iso);
          const isManuallyBlocked = blockedOnlySet.has(iso);
          const isDisabled =
            mode === 'select' ? isPast || isReserved : isPast || isReserved;

          const isSelectedEdge =
            mode === 'select' && (iso === selectedStart || iso === selectedEnd);
          const isInRange =
            mode === 'select' &&
            selectedStart &&
            selectedEnd &&
            iso > selectedStart &&
            iso < selectedEnd;

          let btnClass =
            'h-10 w-full rounded-md text-sm font-medium tabular-nums transition-colors duration-150 flex items-center justify-center ';

          if (isDisabled) {
            btnClass +=
              'bg-[#F2F7F9] text-[#5A7084]/60 line-through cursor-not-allowed';
          } else if (mode === 'block' && isManuallyBlocked) {
            btnClass +=
              'bg-[#123B63] text-white font-semibold hover:bg-[#0B2A47]';
          } else if (isSelectedEdge) {
            btnClass +=
              'bg-[#20B8A6] text-[#123B63] font-semibold ring-2 ring-[#123B63]/20';
          } else if (isInRange) {
            btnClass += 'bg-[#20B8A6]/25 text-[#123B63] font-medium';
          } else {
            btnClass +=
              'bg-white text-[#0F2233] hover:bg-[#F2F7F9] border border-transparent hover:border-[#DBE6EC]';
          }

          const ariaLabel = isDisabled
            ? `${formatIsoFr(iso)} indisponible`
            : mode === 'block' && isManuallyBlocked
              ? `${formatIsoFr(iso)} bloqué sur le calendrier, cliquer pour débloquer`
              : `${formatIsoFr(iso)} disponible`;

          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              onClick={() => handleDayClick(iso)}
              aria-label={ariaLabel}
              aria-pressed={isSelectedEdge || (mode === 'block' && isManuallyBlocked) ? true : undefined}
              className={btnClass}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>

      {rangeError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg bg-[#123B63]/5 border border-[#123B63]/20 p-3 text-xs text-[#123B63]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#0C7A6D] mt-0.5" aria-hidden="true" />
          <span>{rangeError}</span>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#DBE6EC] flex flex-wrap items-center gap-4 text-xs text-[#5A7084]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-white border border-[#DBE6EC]" aria-hidden="true" />
          <span>Disponible</span>
        </span>
        {mode === 'select' ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#20B8A6]" aria-hidden="true" />
            <span>Période choisie</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#123B63]" aria-hidden="true" />
            <span>Bloqué par vous</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-[#F2F7F9] border border-[#DBE6EC]" aria-hidden="true" />
          <span className="line-through">Indisponible</span>
        </span>
      </div>
    </div>
  );
};
