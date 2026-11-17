import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { Bien, BienVille } from '../types';
import { useApp } from '../context/AppContext';
import { FallbackImage } from './BrandMark';
import { formatFcfa, isAvailableToday } from '../utils/dataHelpers';

interface SearchMapViewProps {
  biens: Bien[];
  cityFilter: 'Toutes' | BienVille;
}

const CITY_CENTERS: Record<BienVille, [number, number]> = {
  Brazzaville: [-4.2634, 15.2712],
  'Pointe-Noire': [-4.7761, 11.8635],
};

function formatCompactPrice(prix: number): string {
  if (prix >= 1000) {
    return `${Math.round(prix / 1000)}k`;
  }
  return String(prix);
}

function buildMarkerHtml(bien: Bien, availableToday: boolean, isSelected: boolean): string {
  const bg = isSelected ? '#123B63' : availableToday ? '#20B8A6' : '#FFFFFF';
  const text = isSelected ? '#FFFFFF' : availableToday ? '#123B63' : '#5A7084';
  const border = isSelected ? '#20B8A6' : availableToday ? '#123B63' : '#DBE6EC';
  const typeTag = bien.type === 'Appartement' ? 'Apt' : 'Auto';

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 5px;
    background: ${bg};
    color: ${text};
    border: 1.5px solid ${border};
    font-family: Outfit, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
    box-shadow: 0 3px 10px rgba(11, 42, 71, 0.22);
    transform: translate(-50%, -100%);
    cursor: pointer;
  `;

  const code = document.createElement('span');
  code.textContent = bien.matricule;
  code.style.cssText = `
    padding: 1px 4px;
    border-radius: 3px;
    background: ${isSelected ? '#20B8A6' : '#FFFFFF'};
    color: #123B63;
    border: 1px solid #123B63;
    font-size: 10px;
    font-weight: 700;
  `;

  const price = document.createElement('span');
  price.textContent = `${typeTag} · ${formatCompactPrice(bien.prix)}`;

  wrap.appendChild(code);
  wrap.appendChild(price);
  return wrap.outerHTML;
}

function createPopupDom(
  bien: Bien,
  availableToday: boolean,
  onOpenDetail: (matricule: string) => void
): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'font-family: Outfit, sans-serif; min-width: 210px; max-width: 250px;';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;';

  const mat = document.createElement('span');
  mat.textContent = bien.matricule;
  mat.style.cssText =
    'padding: 1px 6px; border: 1.5px solid #123B63; border-radius: 3px; font-size: 11px; font-weight: 600; color: #123B63; background: #FFFFFF;';

  const avail = document.createElement('span');
  avail.textContent = availableToday ? "Disponible aujourd'hui" : "Occupé aujourd'hui";
  avail.style.cssText = `font-size: 11px; font-weight: 600; color: ${availableToday ? '#0C7A6D' : '#5A7084'};`;

  topRow.appendChild(mat);
  topRow.appendChild(avail);

  const title = document.createElement('p');
  title.textContent = bien.titre;
  title.style.cssText = 'margin: 4px 0 2px; font-size: 13px; font-weight: 600; color: #123B63; line-height: 1.3;';

  const loc = document.createElement('p');
  loc.textContent = `${bien.quartier} · ${bien.ville}`;
  loc.style.cssText = 'margin: 0 0 6px; font-size: 11px; color: #5A7084;';

  const price = document.createElement('p');
  price.textContent = `${formatFcfa(bien.prix)} / ${bien.periode}`;
  price.style.cssText = 'margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #0C7A6D;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Voir la fiche';
  btn.style.cssText =
    'width: 100%; padding: 6px 10px; border-radius: 6px; background: #20B8A6; color: #123B63; font-size: 12px; font-weight: 600; border: none; cursor: pointer;';
  btn.addEventListener('click', () => onOpenDetail(bien.matricule));

  root.appendChild(topRow);
  root.appendChild(title);
  root.appendChild(loc);
  root.appendChild(price);
  root.appendChild(btn);

  return root;
}

export const SearchMapView: React.FC<SearchMapViewProps> = ({ biens, cityFilter }) => {
  const { navigate, catalogBlocks, reservations } = useApp();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByMatriculeRef = useRef<Record<string, L.Marker>>({});

  const [selectedMatricule, setSelectedMatricule] = useState<string>(
    biens[0]?.matricule || ''
  );

  // Keep selected item synchronized with filtered results
  useEffect(() => {
    if (!biens.some((b) => b.matricule === selectedMatricule)) {
      setSelectedMatricule(biens[0]?.matricule || '');
    }
  }, [biens, selectedMatricule]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CITY_CENTERS.Brazzaville,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      markersByMatriculeRef.current = {};
    };
  }, []);

  // Sync markers whenever biens, catalogBlocks, reservations, or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markersByMatriculeRef.current = {};

    biens.forEach((bien) => {
      const extraBlocked = catalogBlocks[bien.matricule] || [];
      const availableToday = isAvailableToday(bien, extraBlocked, reservations);
      const isSelected = bien.matricule === selectedMatricule;

      const icon = L.divIcon({
        className: 'cerim-map-pin',
        html: buildMarkerHtml(bien, availableToday, isSelected),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([bien.localisation.lat, bien.localisation.lng], {
        icon,
        zIndexOffset: isSelected ? 500 : 0,
      });

      const popupContent = createPopupDom(bien, availableToday, (mat) =>
        navigate({ page: 'detail', matricule: mat })
      );
      marker.bindPopup(popupContent, { closeButton: true, offset: L.point(0, -18) });

      marker.on('click', () => {
        setSelectedMatricule(bien.matricule);
      });

      marker.addTo(group);
      markersByMatriculeRef.current[bien.matricule] = marker;
    });
  }, [biens, catalogBlocks, reservations, selectedMatricule, navigate]);

  // Fit map bounds when results or cityFilter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || biens.length === 0) return;

    if (cityFilter !== 'Toutes') {
      const cityItems = biens.filter((b) => b.ville === cityFilter);
      if (cityItems.length > 0) {
        const bounds = L.latLngBounds(
          cityItems.map((b) => [b.localisation.lat, b.localisation.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        return;
      }
      map.setView(CITY_CENTERS[cityFilter], 12);
      return;
    }

    const bounds = L.latLngBounds(
      biens.map((b) => [b.localisation.lat, b.localisation.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [biens, cityFilter]);

  const focusCity = (ville: 'Toutes' | BienVille) => {
    const map = mapRef.current;
    if (!map) return;

    const subset = ville === 'Toutes' ? biens : biens.filter((b) => b.ville === ville);
    if (subset.length > 0) {
      const bounds = L.latLngBounds(
        subset.map((b) => [b.localisation.lat, b.localisation.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
    } else if (ville !== 'Toutes') {
      map.setView(CITY_CENTERS[ville], 12, { animate: true });
    }
  };

  const focusListing = (bien: Bien) => {
    setSelectedMatricule(bien.matricule);
    const map = mapRef.current;
    if (map) {
      map.setView([bien.localisation.lat, bien.localisation.lng], 14, { animate: true });
      const marker = markersByMatriculeRef.current[bien.matricule];
      marker?.openPopup();
    }
  };

  const selectedBien = useMemo(
    () => biens.find((b) => b.matricule === selectedMatricule) || biens[0] || null,
    [biens, selectedMatricule]
  );

  const brazzaCount = useMemo(
    () => biens.filter((b) => b.ville === 'Brazzaville').length,
    [biens]
  );
  const pnrCount = useMemo(
    () => biens.filter((b) => b.ville === 'Pointe-Noire').length,
    [biens]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Map Column */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-[#DBE6EC] overflow-hidden flex flex-col">
        {/* City Quick Focus Bar */}
        <div className="px-4 py-3 border-b border-[#DBE6EC] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => focusCity('Brazzaville')}
              className="min-h-[36px] px-3 rounded-lg bg-[#F2F7F9] hover:bg-[#20B8A6]/25 border border-[#DBE6EC] text-xs font-semibold text-[#123B63] transition-colors tabular-nums"
            >
              Brazzaville ({brazzaCount})
            </button>
            <button
              type="button"
              onClick={() => focusCity('Pointe-Noire')}
              className="min-h-[36px] px-3 rounded-lg bg-[#F2F7F9] hover:bg-[#20B8A6]/25 border border-[#DBE6EC] text-xs font-semibold text-[#123B63] transition-colors tabular-nums"
            >
              Pointe-Noire ({pnrCount})
            </button>
            <button
              type="button"
              onClick={() => focusCity('Toutes')}
              className="min-h-[36px] px-3 rounded-lg border border-[#DBE6EC] hover:border-[#123B63] text-xs font-medium text-[#5A7084] hover:text-[#123B63] transition-colors"
            >
              Vue Congo
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#5A7084]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#20B8A6] border border-[#123B63]" aria-hidden="true" />
              <span>Disponible</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-white border border-[#DBE6EC]" aria-hidden="true" />
              <span>Occupé aujourd&apos;hui</span>
            </span>
          </div>
        </div>

        {/* Leaflet Container */}
        <div
          ref={mapContainerRef}
          aria-label="Carte interactive des biens à Brazzaville et Pointe-Noire"
          className="w-full h-[420px] lg:h-[520px] bg-[#DBE6EC]/35 z-0"
        />
      </div>

      {/* Synchronized List & Selected Preview Column */}
      <div className="lg:col-span-4 flex flex-col gap-3 max-h-[580px]">
        {selectedBien && (
          <div className="bg-white rounded-xl border border-[#123B63]/25 p-4 space-y-3 shadow-sm shrink-0">
            <div className="flex gap-3">
              <div className="w-24 h-20 rounded-lg overflow-hidden bg-[#F2F7F9] shrink-0">
                <FallbackImage
                  src={selectedBien.photos[0] || ''}
                  alt={selectedBien.titre}
                  type={selectedBien.type}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-white border-[1.5px] border-[#123B63] text-[#123B63] text-[11px] font-semibold rounded-[3px]">
                    {selectedBien.matricule}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0C7A6D]">
                    {selectedBien.type}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#123B63] line-clamp-2 leading-snug">
                  {selectedBien.titre}
                </p>
                <p className="text-xs text-[#5A7084] truncate">
                  {selectedBien.quartier} · {selectedBien.ville}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DBE6EC] flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#123B63] tabular-nums">
                {formatFcfa(selectedBien.prix)} / {selectedBien.periode}
              </span>
              <button
                type="button"
                onClick={() => navigate({ page: 'detail', matricule: selectedBien.matricule })}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#20B8A6] hover:bg-[#36CBB9] text-[#123B63] text-xs font-semibold transition-colors"
              >
                <span>Voir</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Markers List */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-[#DBE6EC] divide-y divide-[#DBE6EC]">
          {biens.map((bien) => {
            const extraBlocked = catalogBlocks[bien.matricule] || [];
            const available = isAvailableToday(bien, extraBlocked, reservations);
            const active = bien.matricule === selectedMatricule;

            return (
              <button
                key={bien.matricule}
                type="button"
                onClick={() => focusListing(bien)}
                className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 ${
                  active ? 'bg-[#F2F7F9]' : 'hover:bg-[#F2F7F9]/60'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 bg-white border border-[#123B63] text-[#123B63] font-semibold rounded-[3px]">
                      {bien.matricule}
                    </span>
                    {available ? (
                      <span className="inline-flex items-center gap-1 text-[#0C7A6D] font-semibold">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        <span>Libre</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#5A7084] font-medium">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>Occupé</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#123B63] truncate">{bien.titre}</p>
                  <p className="inline-flex items-center gap-1 text-[11px] text-[#5A7084]">
                    <MapPin className="w-3 h-3 shrink-0 text-[#0C7A6D]" aria-hidden="true" />
                    <span>
                      {bien.quartier} · {bien.ville}
                    </span>
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#123B63] tabular-nums shrink-0">
                  {formatFcfa(bien.prix)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
