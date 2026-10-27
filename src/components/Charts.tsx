import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DescriptiveStats, RegressionStats, ResidualItem } from '../lib/stats';
import { formatNumber, formatPercent, formatSigned } from '../lib/format';

export interface YearStat extends DescriptiveStats {
  year: number;
  rows: number;
  coverage: number | null;
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as YearStat;
  return (
    <div className="chart-tooltip">
      <strong>Promotion {item.year}</strong>
      <span>Moyenne : {formatNumber(item.mean)} / 20</span>
      <span>Médiane : {formatNumber(item.median)} / 20</span>
      <span>IQR : {formatNumber(item.iqr)} pt</span>
      <span>Spread : {formatNumber(item.spread)} pt</span>
      <span>{item.n} moyennes · {formatPercent(item.coverage)} de couverture</span>
    </div>
  );
}

interface TrendChartProps {
  data: YearStat[];
  selectedYear: number | 'all';
  reducedMotion: boolean;
}

export function TrendChart({ data, selectedYear, reducedMotion }: TrendChartProps) {
  return (
    <div className="chart-frame" aria-label="Évolution des moyennes et médianes par promotion">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 18, left: -8, bottom: 4 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="year" type="category" ticks={data.map((item) => item.year)} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
          <YAxis
            type="number"
            domain={[(minimum: number) => Math.max(0, Math.floor((minimum - 0.75) * 2) / 2), (maximum: number) => Math.min(20, Math.ceil((maximum + 0.75) * 2) / 2)]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(value: number) => formatNumber(value, 1)}
            width={48}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} />
          {selectedYear !== 'all' && <ReferenceLine x={selectedYear} stroke="var(--accent-strong)" strokeDasharray="3 4" />}
          <Line name="Moyenne" type="monotone" dataKey="mean" stroke="var(--series-main)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--surface)', stroke: 'var(--series-main)', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={!reducedMotion} animationDuration={220} />
          <Line name="Médiane" type="monotone" dataKey="median" stroke="var(--series-secondary)" strokeWidth={1.8} strokeDasharray="5 5" dot={false} connectNulls={false} isAnimationActive={!reducedMotion} animationDuration={220} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CoverageStripProps {
  data: YearStat[];
  selectedYear: number | 'all';
  onSelectYear: (year: number) => void;
}

export function CoverageStrip({ data, selectedYear, onSelectYear }: CoverageStripProps) {
  return (
    <div className="coverage-strip" aria-label="Couverture des moyennes par promotion">
      {data.map((item) => (
        <button
          type="button"
          key={item.year}
          className={`coverage-item ${selectedYear === item.year ? 'is-selected' : ''}`}
          onClick={() => onSelectYear(item.year)}
          aria-pressed={selectedYear === item.year}
          title={item.rows ? `Sélectionner ${item.year} — ${item.n} moyennes sur ${item.rows} lignes` : `${item.year} — aucune donnée`}
        >
          <span className="coverage-year">{item.year}</span>
          <span className="coverage-track" aria-hidden="true"><span style={{ width: `${(item.coverage ?? 0) * 100}%` }} /></span>
          <span className="coverage-value">{item.rows ? formatPercent(item.coverage) : 'vide'}</span>
          <span className="coverage-n">{item.n} / {item.rows}</span>
        </button>
      ))}
    </div>
  );
}

function RankTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload.map((entry: any) => entry.payload).find((entry: any) => entry?.record);
  if (!item) return null;
  return (
    <div className="chart-tooltip">
      <strong>{item.record.school}</strong>
      <span>CPP : {item.record.cpp ?? 'non renseignée'}</span>
      <span>Moyenne : {formatNumber(item.score)} / 20</span>
      <span>Classement : {item.rank}</span>
      <span>Résidu : {formatSigned(item.residual)} pt</span>
      <span className="tooltip-muted">Ligne source : {item.record.sourceRows.join(', ')}</span>
    </div>
  );
}

interface RankScatterProps {
  points: ResidualItem[];
  model: RegressionStats;
  reducedMotion: boolean;
}

export function RankScatter({ points, model, reducedMotion }: RankScatterProps) {
  const ranks = points.map((point) => point.rank);
  const regressionLine = model.slope !== null && model.intercept !== null && ranks.length
    ? [Math.min(...ranks), Math.max(...ranks)].map((rank) => ({ rank, score: model.intercept! + model.slope! * rank }))
    : [];
  return (
    <div className="chart-frame chart-frame-scatter" aria-label="Nuage de points entre classement et moyenne">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 14, right: 18, left: -4, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 5" />
          <XAxis
            dataKey="rank"
            type="number"
            domain={['auto', 'auto']}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            label={{ value: 'Classement · 1 = meilleur', position: 'insideBottom', offset: -6, fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis
            dataKey="score"
            type="number"
            domain={[(minimum: number) => Math.max(0, Math.floor((minimum - 0.75) * 2) / 2), (maximum: number) => Math.min(20, Math.ceil((maximum + 0.75) * 2) / 2)]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(value: number) => formatNumber(value, 1)}
            width={48}
          />
          <Tooltip content={<RankTooltip />} cursor={{ stroke: 'var(--chart-cursor)', strokeDasharray: '3 3' }} />
          <Scatter data={points} dataKey="score" fill="var(--series-scatter)" fillOpacity={0.68} stroke="var(--surface)" strokeWidth={1} isAnimationActive={!reducedMotion} animationDuration={200} />
          {regressionLine.length === 2 && <Line data={regressionLine} dataKey="score" type="linear" stroke="var(--series-regression)" strokeWidth={2.4} dot={false} activeDot={false} isAnimationActive={!reducedMotion} animationDuration={220} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
