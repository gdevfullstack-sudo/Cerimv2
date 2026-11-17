import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Building2, Car, MapPin, TrendingUp } from 'lucide-react';
import { BienType, BienVille } from '../types';
import { useApp } from '../context/AppContext';
import { formatFcfa } from '../utils/dataHelpers';
import { getNeighborhoodTrends, NeighborhoodTrendSeries } from '../utils/marketTrends';

interface MarketPriceChartProps {
  initialVille?: BienVille;
  initialType?: BienType;
  highlightQuartier?: string;
  compact?: boolean;
}

export const MarketPriceChart: React.FC<MarketPriceChartProps> = ({
  initialVille = 'Brazzaville',
  initialType = 'Appartement',
  highlightQuartier,
  compact = false,
}) => {
  const { allBiens } = useApp();
  const [ville, setVille] = useState<BienVille>(initialVille);
  const [type, setType] = useState<BienType>(initialType);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoverMonthIdx, setHoverMonthIdx] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);

  useEffect(() => {
    setVille(initialVille);
    setType(initialType);
    setHiddenIds([]);
    setHoverMonthIdx(null);
  }, [initialVille, initialType]);

  const allSeries = useMemo(
    () => getNeighborhoodTrends(allBiens, ville, type),
    [allBiens, ville, type]
  );

  // Auto-focus matching neighborhood when viewing a property detail page
  useEffect(() => {
    if (!highlightQuartier) {
      setFocusedId(null);
      return;
    }
    const token = highlightQuartier.split(' ')[0].toLowerCase();
    const matched = allSeries.find((s) => s.quartier.toLowerCase().includes(token));
    setFocusedId(matched ? matched.id : null);
  }, [highlightQuartier, allSeries]);

  const visibleSeries = useMemo(
    () => allSeries.filter((s) => !hiddenIds.includes(s.id)),
    [allSeries, hiddenIds]
  );

  const activeSeries = visibleSeries.length > 0 ? visibleSeries : allSeries;

  // Responsive SVG width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(280, Math.floor(el.clientWidth));
      setContainerWidth(next);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateWidth());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Render D3 chart cleanly into svgRef
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || activeSeries.length === 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const chartHeight = compact ? 250 : 310;
    const isNarrow = containerWidth < 480;
    const margin = {
      top: 18,
      right: isNarrow ? 16 : 24,
      bottom: 34,
      left: isNarrow ? 54 : 72,
    };

    const innerW = Math.max(160, containerWidth - margin.left - margin.right);
    const innerH = Math.max(140, chartHeight - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg
      .attr('viewBox', `0 0 ${containerWidth} ${chartHeight}`)
      .attr('width', containerWidth)
      .attr('height', chartHeight);

    const root = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const monthLabels = activeSeries[0].points.map((p) => p.shortLabel);
    const xScale = d3
      .scalePoint<string>()
      .domain(monthLabels)
      .range([0, innerW])
      .padding(0.15);

    const allPrices = activeSeries.flatMap((s) => s.points.map((p) => p.prixMoyen));
    const minVal = d3.min(allPrices) ?? 20000;
    const maxVal = d3.max(allPrices) ?? 90000;
    const pad = Math.max(5000, Math.round((maxVal - minVal) * 0.18));

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, minVal - pad), maxVal + pad])
      .nice()
      .range([innerH, 0]);

    // Horizontal gridlines
    const yTicks = yScale.ticks(isNarrow ? 4 : 5);
    root
      .append('g')
      .attr('class', 'cerim-d3-grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#E2ECF1')
      .attr('stroke-dasharray', '3,3');

    // Y axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(isNarrow ? 4 : 5)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat((d) => {
        const num = Number(d);
        return num >= 1000 ? `${Math.round(num / 1000)}k` : `${num}`;
      });

    const yAxisGroup = root.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', '#5A7084')
      .attr('font-size', isNarrow ? '11px' : '12px')
      .attr('font-family', 'Outfit, system-ui, sans-serif');

    // Y unit caption
    root
      .append('text')
      .attr('x', -margin.left + 4)
      .attr('y', -6)
      .attr('fill', '#5A7084')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'Outfit, system-ui, sans-serif')
      .text(type === 'Appartement' ? 'FCFA / nuit' : 'FCFA / jour');

    // X axis
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(12);
    const xAxisGroup = root
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisGroup.select('.domain').attr('stroke', '#DBE6EC');
    xAxisGroup
      .selectAll('text')
      .attr('fill', '#5A7084')
      .attr('font-size', isNarrow ? '11px' : '12px')
      .attr('font-weight', '500')
      .attr('font-family', 'Outfit, system-ui, sans-serif');

    const lineGenerator = d3
      .line<{ shortLabel: string; prixMoyen: number }>()
      .x((d) => xScale(d.shortLabel) ?? 0)
      .y((d) => yScale(d.prixMoyen))
      .curve(d3.curveMonotoneX);

    const areaGenerator = d3
      .area<{ shortLabel: string; prixMoyen: number }>()
      .x((d) => xScale(d.shortLabel) ?? 0)
      .y0(innerH)
      .y1((d) => yScale(d.prixMoyen))
      .curve(d3.curveMonotoneX);

    // Subtle area fill for focused series (or first series if single)
    const primarySeries =
      (focusedId ? activeSeries.find((s) => s.id === focusedId) : null) ||
      (activeSeries.length === 1 ? activeSeries[0] : null);

    if (primarySeries) {
      root
        .append('path')
        .datum(primarySeries.points)
        .attr('fill', primarySeries.color)
        .attr('fill-opacity', 0.08)
        .attr('d', areaGenerator);
    }

    // Draw neighborhood trend lines + points
    activeSeries.forEach((series) => {
      const isDimmed = focusedId !== null && focusedId !== series.id;
      const strokeOpacity = isDimmed ? 0.28 : 1;
      const strokeWidth = focusedId === series.id ? 3 : 2.25;

      const path = root
        .append('path')
        .datum(series.points)
        .attr('fill', 'none')
        .attr('stroke', series.color)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-opacity', strokeOpacity)
        .attr('d', lineGenerator);

      const node = path.node();
      if (node && !prefersReducedMotion) {
        const totalLength = node.getTotalLength();
        path
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(620)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
          .on('end', () => {
            path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
          });
      }

      root
        .selectAll(`.dot-${series.id}`)
        .data(series.points)
        .join('circle')
        .attr('class', `dot-${series.id}`)
        .attr('cx', (d) => xScale(d.shortLabel) ?? 0)
        .attr('cy', (d) => yScale(d.prixMoyen))
        .attr('r', (_, i) => (hoverMonthIdx === i ? 5.5 : 3.5))
        .attr('fill', hoverMonthIdx !== null ? series.color : '#FFFFFF')
        .attr('stroke', series.color)
        .attr('stroke-width', 2)
        .attr('opacity', strokeOpacity);
    });

    // Vertical hover guide line
    if (hoverMonthIdx !== null) {
      const targetLabel = monthLabels[hoverMonthIdx];
      const xPos = xScale(targetLabel);
      if (xPos !== undefined) {
        root
          .append('line')
          .attr('x1', xPos)
          .attr('x2', xPos)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', '#123B63')
          .attr('stroke-opacity', 0.25)
          .attr('stroke-width', 1.25)
          .attr('stroke-dasharray', '4,4')
          .attr('pointer-events', 'none');
      }
    }

    // Invisible pointer overlay for interactive D3 scrubbing
    const positions = monthLabels.map((lbl) => xScale(lbl) ?? 0);
    const findNearestIndex = (pointerX: number): number => {
      let bestIdx = 0;
      let bestDist = Infinity;
      positions.forEach((px, idx) => {
        const dist = Math.abs(px - pointerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    root
      .append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .attr('class', 'cursor-crosshair')
      .on('mousemove', function (event: MouseEvent) {
        const [mx] = d3.pointer(event, this);
        setHoverMonthIdx(findNearestIndex(mx));
      })
      .on('touchstart touchmove', function (event: TouchEvent) {
        const [mx] = d3.pointer(event, this);
        setHoverMonthIdx(findNearestIndex(mx));
      })
      .on('mouseleave', () => setHoverMonthIdx(null));
  }, [activeSeries, containerWidth, compact, focusedId, hoverMonthIdx, type]);

  const toggleSeries = (id: string) => {
    setHiddenIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (allSeries.length - prev.length <= 1) return prev;
      return [...prev, id];
    });
  };

  // Summary metrics for the active market view
  const stats = useMemo(() => {
    if (activeSeries.length === 0) {
      return { avg: 0, lowest: null as NeighborhoodTrendSeries | null, avgPct: 0 };
    }
    const avg = Math.round(
      activeSeries.reduce((sum, s) => sum + s.currentAvg, 0) / activeSeries.length
    );
    const lowest = [...activeSeries].sort((a, b) => a.currentAvg - b.currentAvg)[0];
    const avgPct = Number(
      (activeSeries.reduce((sum, s) => sum + s.changePct, 0) / activeSeries.length).toFixed(1)
    );
    return { avg, lowest, avgPct };
  }, [activeSeries]);

  const activeMonthIdx = hoverMonthIdx !== null ? hoverMonthIdx : 5;
  const activeMonthLabel =
    activeSeries[0]?.points[activeMonthIdx]?.monthLabel || 'Novembre 2026';

  const unitLabel = type === 'Appartement' ? 'FCFA / nuit' : 'FCFA / jour';

  return (
    <div className="bg-white rounded-2xl border border-[#DBE6EC] p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0C7A6D]">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            <span>Observatoire des loyers · 6 derniers mois</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#123B63] tracking-tight">
            Évolution des prix moyens par quartier à {ville}
          </h2>
          <p className="text-xs sm:text-sm text-[#5A7084]">
            Comparez les tendances mensuelles ({unitLabel}) pour situer chaque bien à son juste
            prix, avec paiement sur place à votre arrivée.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* City Switch */}
          <div
            role="group"
            aria-label="Choisir la ville du graphique"
            className="inline-flex items-center gap-1 p-1 bg-[#F2F7F9] rounded-lg border border-[#DBE6EC]"
          >
            {(['Brazzaville', 'Pointe-Noire'] as const).map((v) => {
              const active = ville === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setVille(v);
                    setHiddenIds([]);
                  }}
                  aria-pressed={active}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#123B63] text-white'
                      : 'text-[#5A7084] hover:text-[#123B63]'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{v}</span>
                </button>
              );
            })}
          </div>

          {/* Category Switch */}
          <div
            role="group"
            aria-label="Choisir la catégorie du graphique"
            className="inline-flex items-center gap-1 p-1 bg-[#F2F7F9] rounded-lg border border-[#DBE6EC]"
          >
            <button
              type="button"
              onClick={() => {
                setType('Appartement');
                setHiddenIds([]);
              }}
              aria-pressed={type === 'Appartement'}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                type === 'Appartement'
                  ? 'bg-[#20B8A6] text-[#123B63]'
                  : 'text-[#5A7084] hover:text-[#123B63]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Appartements</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('Voiture');
                setHiddenIds([]);
              }}
              aria-pressed={type === 'Voiture'}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                type === 'Voiture'
                  ? 'bg-[#20B8A6] text-[#123B63]'
                  : 'text-[#5A7084] hover:text-[#123B63]'
              }`}
            >
              <Car className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Voitures</span>
            </button>
          </div>
        </div>
      </div>

      {/* Market Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] px-4 py-3">
          <p className="text-xs text-[#5A7084]">Moyenne actuelle ({ville})</p>
          <p className="text-lg font-semibold text-[#123B63] tabular-nums mt-0.5">
            {formatFcfa(stats.avg)}{' '}
            <span className="text-xs font-medium text-[#5A7084]">
              / {type === 'Appartement' ? 'nuit' : 'jour'}
            </span>
          </p>
        </div>
        <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] px-4 py-3">
          <p className="text-xs text-[#5A7084]">Quartier le plus accessible</p>
          <p className="text-sm sm:text-base font-semibold text-[#123B63] mt-0.5 truncate">
            {stats.lowest ? `${stats.lowest.quartier} (${formatFcfa(stats.lowest.currentAvg)})` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] px-4 py-3">
          <p className="text-xs text-[#5A7084]">Évolution moyenne sur 6 mois</p>
          <p className="text-lg font-semibold text-[#0C7A6D] tabular-nums mt-0.5">
            {stats.avgPct > 0 ? `+${stats.avgPct}%` : `${stats.avgPct}%`}
          </p>
        </div>
      </div>

      {/* Chart + Live Month Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 min-w-0">
          <div ref={containerRef} className="w-full overflow-hidden">
            <svg
              ref={svgRef}
              role="img"
              aria-label={`Graphique D3.js des prix moyens de location (${type}) par quartier à ${ville} sur les 6 derniers mois`}
              className="w-full block select-none"
            />
          </div>

          {/* Interactive Neighborhood Legend */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#DBE6EC]">
            {allSeries.map((s) => {
              const hidden = hiddenIds.includes(s.id);
              const isFocused = focusedId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSeries(s.id)}
                  onMouseEnter={() => !hidden && setFocusedId(s.id)}
                  onMouseLeave={() => {
                    if (!highlightQuartier) setFocusedId(null);
                  }}
                  aria-pressed={!hidden}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    hidden
                      ? 'border-[#DBE6EC] bg-[#F2F7F9] text-[#5A7084] opacity-55 line-through'
                      : isFocused
                        ? 'border-[#123B63] bg-[#F2F7F9] text-[#123B63]'
                        : 'border-[#DBE6EC] bg-white text-[#123B63] hover:border-[#20B8A6]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dotClass}`}
                    aria-hidden="true"
                  />
                  <span>{s.quartier}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Month / Hovered Point Breakdown */}
        <div className="lg:col-span-4 rounded-xl bg-[#F2F7F9] border border-[#DBE6EC] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#DBE6EC]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0C7A6D]">
                {hoverMonthIdx !== null ? 'Mois sélectionné' : 'Dernier relevé'}
              </p>
              <p className="text-sm font-semibold text-[#123B63]">{activeMonthLabel}</p>
            </div>
            <span className="text-[11px] text-[#5A7084]">Survolez la courbe</span>
          </div>

          <div className="space-y-2.5">
            {activeSeries.map((s) => {
              const pt = s.points[activeMonthIdx];
              const isMatchedQuartier =
                highlightQuartier &&
                s.quartier.toLowerCase().includes(highlightQuartier.split(' ')[0].toLowerCase());
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                    isMatchedQuartier ? 'bg-white border border-[#20B8A6]' : 'bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dotClass}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-[#123B63] truncate">
                      {s.quartier}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#123B63] tabular-nums">
                      {pt ? formatFcfa(pt.prixMoyen) : '—'}
                    </p>
                    <p className="text-[11px] text-[#0C7A6D] tabular-nums">
                      {s.changePct > 0 ? `+${s.changePct}%` : `${s.changePct}%`} / 6 mois
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
