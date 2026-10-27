import type { DescriptiveStats } from '../lib/stats';
import { formatNumber } from '../lib/format';

export interface CppStats extends DescriptiveStats {
  cpp: string;
}

export function CppTable({ rows, minimumN }: { rows: CppStats[]; minimumN: number }) {
  const eligible = rows.filter((row) => row.n >= minimumN && row.mean !== null).sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
  if (!eligible.length) return <div className="empty-state">Aucune CPP n’atteint le seuil n ≥ {minimumN} pour cette sélection.</div>;
  const best = eligible[0];
  const worst = eligible[eligible.length - 1];
  return (
    <>
      <div className="table-wrap">
        <table className="data-table cpp-table">
          <thead><tr><th>CPP</th><th>n</th><th>Moyenne</th><th>Médiane</th><th className="optional-column">Spread</th><th className="optional-column">IQR</th></tr></thead>
          <tbody>
            {eligible.map((row) => (
              <tr key={row.cpp}>
                <th scope="row">{row.cpp}</th>
                <td>{row.n}</td>
                <td>
                  <div className="mean-cell"><span>{formatNumber(row.mean)}</span><i aria-hidden="true"><b style={{ width: `${((row.mean ?? 0) / 20) * 100}%` }} /></i></div>
                </td>
                <td>{formatNumber(row.median)}</td>
                <td className="optional-column">{formatNumber(row.spread)}</td>
                <td className="optional-column">{formatNumber(row.iqr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        {eligible.length > 1 ? <>Écart de moyenne maximal : <strong>{formatNumber((best.mean ?? 0) - (worst.mean ?? 0))} pt</strong> entre {best.cpp} et {worst.cpp}.</> : 'Une seule CPP dépasse le seuil.'} Les écarts reflètent aussi le mix d’écoles, d’années et la couverture ; ils ne sont pas causaux.
      </p>
    </>
  );
}
