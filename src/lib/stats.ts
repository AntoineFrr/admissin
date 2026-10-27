import type { AffectationRecord } from '../data';

export interface DescriptiveStats {
  n: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  spread: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
}

export interface RegressionStats {
  n: number;
  pearson: number | null;
  spearman: number | null;
  slope: number | null;
  slope100: number | null;
  intercept: number | null;
  r2: number | null;
}

export const getScore = (record: AffectationRecord, includeApproximate: boolean) =>
  includeApproximate ? record.sensitivityScore : record.score;

export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function describe(values: Array<number | null | undefined>): DescriptiveStats {
  const clean = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const n = clean.length;
  if (!n) {
    return { n: 0, mean: null, median: null, std: null, min: null, max: null, spread: null, q1: null, q3: null, iqr: null };
  }
  const mean = clean.reduce((sum, value) => sum + value, 0) / n;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const q1 = quantile(clean, 0.25);
  const q3 = quantile(clean, 0.75);
  return {
    n,
    mean,
    median: quantile(clean, 0.5),
    std: Math.sqrt(variance),
    min,
    max,
    spread: max - min,
    q1,
    q3,
    iqr: q1 !== null && q3 !== null ? q3 - q1 : null,
  };
}

function averageRanks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < indexed.length) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let cursor = start; cursor < end; cursor += 1) ranks[indexed[cursor].index] = averageRank;
    start = end;
  }
  return ranks;
}

export function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  let numerator = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < x.length; index += 1) {
    const dx = x[index] - meanX;
    const dy = y[index] - meanY;
    numerator += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return null;
  return numerator / Math.sqrt(varianceX * varianceY);
}

export function pairedRecords(records: AffectationRecord[], includeApproximate: boolean) {
  return records
    .map((record) => ({ record, score: getScore(record, includeApproximate), rank: record.rank }))
    .filter((item): item is { record: AffectationRecord; score: number; rank: number } =>
      item.score !== null && item.rank !== null && Number.isFinite(item.score) && Number.isFinite(item.rank),
    );
}

export function regression(records: AffectationRecord[], includeApproximate: boolean): RegressionStats {
  const pairs = pairedRecords(records, includeApproximate);
  const x = pairs.map((pair) => pair.rank);
  const y = pairs.map((pair) => pair.score);
  const n = pairs.length;
  const empty = { n, pearson: null, spearman: null, slope: null, slope100: null, intercept: null, r2: null };
  if (n < 3) return empty;
  const pearsonValue = pearson(x, y);
  if (pearsonValue === null) return empty;
  const spearmanValue = pearson(averageRanks(x), averageRanks(y));
  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;
  const numerator = x.reduce((sum, value, index) => sum + (value - meanX) * (y[index] - meanY), 0);
  const denominator = x.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  return { n, pearson: pearsonValue, spearman: spearmanValue, slope, slope100: slope * 100, intercept, r2: pearsonValue ** 2 };
}

export interface ResidualItem {
  record: AffectationRecord;
  score: number;
  rank: number;
  predicted: number;
  residual: number;
}

export function residualItems(records: AffectationRecord[], includeApproximate: boolean): ResidualItem[] {
  const model = regression(records, includeApproximate);
  if (model.slope === null || model.intercept === null) return [];
  return pairedRecords(records, includeApproximate)
    .map(({ record, score, rank }) => {
      const predicted = model.intercept! + model.slope! * rank;
      return { record, score, rank, predicted, residual: score - predicted };
    })
    .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual));
}

export interface SchoolStats extends DescriptiveStats {
  school: string;
  rankN: number;
  medianRank: number | null;
  pairedN: number;
}

export function schoolStatistics(records: AffectationRecord[], includeApproximate: boolean): SchoolStats[] {
  const schools = [...new Set(records.map((record) => record.school))].sort((a, b) => a.localeCompare(b, 'fr'));
  return schools.map((school) => {
    const subset = records.filter((record) => record.school === school);
    const stats = describe(subset.map((record) => getScore(record, includeApproximate)));
    const ranks = subset.map((record) => record.rank).filter((rank): rank is number => rank !== null);
    return {
      ...stats,
      school,
      rankN: ranks.length,
      medianRank: quantile(ranks, 0.5),
      pairedN: pairedRecords(subset, includeApproximate).length,
    };
  });
}

export interface SchoolRankingComparison {
  school: string;
  n: number;
  mean: number;
  medianRank: number;
  meanPosition: number;
  rankPosition: number;
  delta: number;
}

export function compareSchoolRankings(records: AffectationRecord[], includeApproximate: boolean, minimumN: number): SchoolRankingComparison[] {
  const schools = [...new Set(records.map((record) => record.school))];
  const rows = schools.flatMap((school) => {
    const pairs = pairedRecords(records.filter((record) => record.school === school), includeApproximate);
    if (pairs.length < minimumN) return [];
    const stats = describe(pairs.map((pair) => pair.score));
    const medianRank = quantile(pairs.map((pair) => pair.rank), 0.5);
    if (stats.mean === null || medianRank === null) return [];
    return [{ school, n: pairs.length, mean: stats.mean, medianRank, meanPosition: 0, rankPosition: 0, delta: 0 }];
  });
  [...rows].sort((a, b) => b.mean - a.mean).forEach((row, index) => { row.meanPosition = index + 1; });
  [...rows].sort((a, b) => a.medianRank - b.medianRank).forEach((row, index) => { row.rankPosition = index + 1; });
  return rows.map((row) => ({ ...row, delta: row.meanPosition - row.rankPosition }))
    .sort((a, b) => a.meanPosition - b.meanPosition);
}
