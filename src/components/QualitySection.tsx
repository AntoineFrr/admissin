import { AlertTriangle, Database, ShieldCheck } from 'lucide-react';
import { audit, quality, records } from '../data';
import { formatInteger, formatNumber, formatPercent } from '../lib/format';

export function QualitySection() {
  const approximateOnly = audit.sensitivityScores - audit.primaryScores;
  const invalidScores = quality.reduce((sum, item) => sum + item.multiOrRange + item.outOfRange + item.invalid, 0);
  const missingScores = quality.reduce((sum, item) => sum + item.missing, 0);
  const extremes = records.filter((record) => record.score !== null && (record.score < 8 || record.score >= 18));

  return (
    <section id="qualite" className="report-section quality-section">
      <div className="section-heading">
        <div><h2>Qualité des données & méthode</h2></div>
        <p>Le détail du nettoyage est accessible sans alourdir la lecture principale.</p>
      </div>

      <div className="quality-summary">
        <div><Database size={20} aria-hidden="true" /><span><strong>{formatInteger(audit.finalRows)}</strong> lignes d’affectation conservées</span></div>
        <div><ShieldCheck size={20} aria-hidden="true" /><span><strong>{formatInteger(audit.primaryScores)}</strong> moyennes dans l’analyse principale</span></div>
        <div><AlertTriangle size={20} aria-hidden="true" /><span><strong>{formatInteger(approximateOnly)}</strong> valeurs seulement en sensibilité</span></div>
      </div>

      <div className="panel quality-panel">
        <div className="panel-header compact">
          <div><h3>Couverture par feuille</h3><p>« Sensibilité » ajoute les moyennes annotées ou approximatives à une seule valeur.</p></div>
        </div>
        <div className="table-wrap">
          <table className="data-table quality-table">
            <thead><tr><th>Feuille</th><th>Lignes</th><th className="optional-column">Exactes</th><th className="optional-column">Dates restaurées</th><th>Couverture principale</th><th>Sensibilité</th><th>Rangs valides</th><th className="paired-optional">Paires moyenne–rang</th></tr></thead>
            <tbody>
              {quality.map((item) => (
                <tr key={item.sheet} className={item.rows === 0 ? 'muted-row' : ''}>
                  <th scope="row">{item.sheet}</th>
                  <td>{item.rows}</td>
                  <td className="optional-column">{item.exact}</td>
                  <td className="optional-column">{item.recovered}</td>
                  <td>{item.rows ? `${formatPercent(item.coverage)} · ${item.primaryN}` : '—'}</td>
                  <td>{item.rows ? `${formatPercent(item.sensitivityCoverage)} · ${item.sensitivityN}` : '—'}</td>
                  <td>{item.hasRank ? `${item.rankN} (${item.rankExcluded} exclus)` : 'non prévu'}</td>
                  <td className="paired-optional">{item.hasRank ? item.pairedN : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-footnote">2021 et « Exemple » sont des feuilles sans lignes d’affectation : elles restent absentes des calculs, et non comptées comme des moyennes nulles.</p>
      </div>

      <div className="method-grid">
        <details open>
          <summary>Nettoyage et normalisation</summary>
          <div className="details-content">
            <ul>
              <li>{audit.rawNominalRows} lignes nominatives brutes ; {audit.repeatedHeadersRemoved} en-têtes répétés et {audit.noteRowsRemoved} commentaires non individuels retirés.</li>
              <li>{audit.sameSchoolDuplicatesMerged} doublons complémentaires dans une même école fusionnés. Un nom présent dans deux écoles en 2020 est conservé des deux côtés faute d’arbitrage possible.</li>
              <li>Analyse principale : nombres exacts et dates Excel au format jour.mois restaurées. Aucune moyenne manquante n’est imputée.</li>
              <li>{missingScores} moyennes sont absentes ; {invalidScores} sont invalides, hors échelle, multiples ou ambiguës. {audit.rankValuesExcluded} rangs non vides sont exclus.</li>
              <li>Alias explicites : ENSEEIHT/N7 regroupés ; variantes typographiques d’ENSEIRB-MATMECA, SIGMA mécanique, École des Mines, EI Purpan et IMT Nord Europe normalisées. ENSCBP et ENSMAC ne sont pas fusionnés.</li>
              <li>Noms, courriels, téléphones et champs de messagerie ne sont pas intégrés au rapport.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Définitions statistiques</summary>
          <div className="details-content">
            <ul>
              <li>Moyenne et médiane sur les valeurs disponibles de la sélection ; les agrégats multi-années sont pondérés par les effectifs disponibles.</li>
              <li>Spread = maximum − minimum. IQR = Q3 − Q1, quantiles par interpolation linéaire. Écart-type descriptif de population (division par n).</li>
              <li>Les rangs d’écoles ne sont calculés que si l’effectif atteint le seuil n choisi. Les petits groupes restent signalés par leur effectif.</li>
              <li>Le spread est sensible aux extrêmes ; l’IQR est la mesure de dispersion plus robuste à privilégier.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Modèle moyenne–classement</summary>
          <div className="details-content">
            <ul>
              <li>Un rang petit est meilleur. La régression est une droite des moindres carrés : moyenne = α + β × rang, calculée par promotion sur les paires complètes.</li>
              <li>β × 100 exprime l’écart de moyenne associé à 100 places de classement. R² mesure l’ajustement linéaire ; ρ de Spearman mesure la monotonie, sans causalité.</li>
              <li>Résidu = moyenne observée − moyenne prédite. Un résidu positif indique une moyenne supérieure à celle attendue pour ce rang dans le modèle.</li>
              <li>La comparaison des positions d’écoles utilise les mêmes individus appariés pour la moyenne et le rang médian. Les rangs bruts ne sont pas regroupés entre promotions.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Valeurs extrêmes conservées ({extremes.length})</summary>
          <div className="details-content">
            <p>Ces valeurs respectent l’échelle 0–20 mais influencent fortement le spread. Elles ne sont pas supprimées sans preuve d’erreur.</p>
            <ul>
              {extremes.map((record) => <li key={record.id}>{record.year} · {record.school} · {formatNumber(record.score)} / 20 · ligne{record.sourceRows.length > 1 ? 's' : ''} {record.sourceRows.join(', ')}</li>)}
            </ul>
          </div>
        </details>
      </div>
    </section>
  );
}
