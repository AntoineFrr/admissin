import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ChevronDown, ChevronUp } from 'lucide-react';
import type { SchoolStats } from '../lib/stats';
import { formatNumber } from '../lib/format';

export type RangeSort = 'mean' | 'spread' | 'iqr' | 'n';

interface RangePlotProps {
  rows: SchoolStats[];
  minimumN: number;
  sort: RangeSort;
  onSortChange: (sort: RangeSort) => void;
  onSelectSchool: (school: string) => void;
  selectedSchool: string;
}

const position = (value: number, minimum: number, maximum: number) =>
  Math.max(0, Math.min(100, ((value - minimum) / (maximum - minimum)) * 100));

export function RangePlot({ rows, minimumN, sort, onSortChange, onSelectSchool, selectedSchool }: RangePlotProps) {
  const [showAll, setShowAll] = useState(false);
  const eligible = useMemo(() => {
    const filtered = rows.filter((row) => row.n >= minimumN && row.mean !== null);
    return filtered.sort((a, b) => {
      if (sort === 'n') return b.n - a.n || a.school.localeCompare(b.school, 'fr');
      const aValue = a[sort] ?? -Infinity;
      const bValue = b[sort] ?? -Infinity;
      return Number(bValue) - Number(aValue) || a.school.localeCompare(b.school, 'fr');
    });
  }, [rows, minimumN, sort]);

  const domain = useMemo(() => {
    const minima = eligible.map((row) => row.min).filter((value): value is number => value !== null);
    const maxima = eligible.map((row) => row.max).filter((value): value is number => value !== null);
    if (!minima.length || !maxima.length) return { minimum: 0, maximum: 20 };
    let minimum = Math.max(0, Math.floor((Math.min(...minima) - 0.4) * 2) / 2);
    let maximum = Math.min(20, Math.ceil((Math.max(...maxima) + 0.4) * 2) / 2);
    if (maximum - minimum < 2) maximum = Math.min(20, minimum + 2);
    return { minimum, maximum };
  }, [eligible]);

  const visible = showAll ? eligible : eligible.slice(0, 12);
  const ticks = Array.from({ length: 5 }, (_, index) => domain.minimum + (domain.maximum - domain.minimum) * index / 4);

  return (
    <div className="range-plot">
      <div className="range-toolbar">
        <div className="range-legend" aria-label="Légende">
          <span><i className="legend-minmax" /> Min–max</span>
          <span><i className="legend-iqr" /> IQR</span>
          <span><i className="legend-median" /> Médiane</span>
          <span><i className="legend-mean" /> Moyenne</span>
        </div>
        <label className="sort-control">
          <ArrowDownWideNarrow size={15} aria-hidden="true" />
          <span>Trier</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as RangeSort)}>
            <option value="mean">Moyenne</option>
            <option value="iqr">IQR</option>
            <option value="spread">Spread</option>
            <option value="n">Effectif</option>
          </select>
        </label>
      </div>

      {eligible.length ? (
        <>
          <div className="range-axis" aria-hidden="true">
            <span className="range-axis-label">École</span>
            <div className="range-axis-scale">
              {ticks.map((tick, index) => (
                <span key={tick} style={{ left: `${position(tick, domain.minimum, domain.maximum)}%`, transform: index === 0 ? 'none' : index === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{formatNumber(tick, 1)}</span>
              ))}
            </div>
            <span className="range-axis-mean">Moy.</span>
          </div>
          <div className="range-rows">
            {visible.map((row) => {
              const minmaxLeft = position(row.min!, domain.minimum, domain.maximum);
              const minmaxRight = position(row.max!, domain.minimum, domain.maximum);
              const iqrLeft = position(row.q1!, domain.minimum, domain.maximum);
              const iqrRight = position(row.q3!, domain.minimum, domain.maximum);
              const meanLeft = position(row.mean!, domain.minimum, domain.maximum);
              const medianLeft = position(row.median!, domain.minimum, domain.maximum);
              const details = `${row.school} — n=${row.n}, moyenne=${formatNumber(row.mean)}, médiane=${formatNumber(row.median)}, spread=${formatNumber(row.spread)}, IQR=${formatNumber(row.iqr)}`;
              return (
                <button
                  type="button"
                  className={`range-row ${selectedSchool === row.school ? 'is-selected' : ''}`}
                  key={row.school}
                  onClick={() => onSelectSchool(row.school)}
                  title={`${details}. Cliquer pour filtrer.`}
                  aria-label={`${details}. Appliquer le filtre école.`}
                >
                  <span className="range-school"><strong>{row.school}</strong><small>n = {row.n}</small></span>
                  <span className="range-track">
                    {ticks.map((tick) => <i className="range-gridline" key={tick} style={{ left: `${position(tick, domain.minimum, domain.maximum)}%` }} />)}
                    <i className="range-minmax" style={{ left: `${minmaxLeft}%`, width: `${Math.max(0.35, minmaxRight - minmaxLeft)}%` }} />
                    <i className="range-iqr" style={{ left: `${iqrLeft}%`, width: `${Math.max(0.5, iqrRight - iqrLeft)}%` }} />
                    <i className="range-median" style={{ left: `${medianLeft}%` }} />
                    <i className="range-mean" style={{ left: `${meanLeft}%` }} />
                  </span>
                  <span className="range-value">{formatNumber(row.mean)}</span>
                </button>
              );
            })}
          </div>
          <div className="range-footer">
            <span>{eligible.length} école{eligible.length > 1 ? 's' : ''} avec n ≥ {minimumN} · {rows.length - eligible.length} masquée{rows.length - eligible.length > 1 ? 's' : ''} par le seuil</span>
            {eligible.length > 12 && (
              <button type="button" className="text-button" onClick={() => setShowAll((value) => !value)}>
                {showAll ? <>Réduire <ChevronUp size={15} /></> : <>Tout afficher ({eligible.length}) <ChevronDown size={15} /></>}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">Aucune école n’atteint le seuil n ≥ {minimumN}. Abaissez le seuil ou élargissez les filtres.</div>
      )}
    </div>
  );
}
