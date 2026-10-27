import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Info, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { audit, quality, records, years, type AffectationRecord } from './data';
import { CoverageStrip, RankScatter, TrendChart, type YearStat } from './components/Charts';
import { RangePlot, type RangeSort } from './components/RangePlot';
import { CppTable, type CppStats } from './components/CppTable';
import { QualitySection } from './components/QualitySection';
import {
  compareSchoolRankings,
  describe,
  getScore,
  regression,
  residualItems,
  schoolStatistics,
} from './lib/stats';
import { formatInteger, formatNumber, formatPercent, formatSigned } from './lib/format';
import './App.css';

type Promotion = number | 'all';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function buildYearStats(source: AffectationRecord[], includeApproximate: boolean): YearStat[] {
  return years.map((year) => {
    const subset = source.filter((record) => record.year === year);
    const stats = describe(subset.map((record) => getScore(record, includeApproximate)));
    return { ...stats, year, rows: subset.length, coverage: subset.length ? stats.n / subset.length : null };
  });
}

function App() {
  const [promotion, setPromotion] = useState<Promotion>(2024);
  const [school, setSchool] = useState('all');
  const [cpp, setCpp] = useState('all');
  const [includeApproximate, setIncludeApproximate] = useState(false);
  const [minimumN, setMinimumN] = useState(3);
  const [rangeSort, setRangeSort] = useState<RangeSort>('mean');
  const reducedMotion = useReducedMotion();

  const schools = useMemo(() => [...new Set(records.map((record) => record.school))].sort((a, b) => a.localeCompare(b, 'fr')), []);
  const cpps = useMemo(() => [...new Set(records.map((record) => record.cpp).filter((value): value is string => value !== null))].sort((a, b) => a.localeCompare(b, 'fr')), []);

  const contextRecords = useMemo(() => records.filter((record) =>
    (school === 'all' || record.school === school) && (cpp === 'all' || record.cpp === cpp),
  ), [school, cpp]);

  const selectedRecords = useMemo(() => contextRecords.filter((record) =>
    promotion === 'all' || record.year === promotion,
  ), [contextRecords, promotion]);

  const currentStats = useMemo(() => describe(selectedRecords.map((record) => getScore(record, includeApproximate))), [selectedRecords, includeApproximate]);
  const yearStats = useMemo(() => buildYearStats(contextRecords, includeApproximate), [contextRecords, includeApproximate]);
  const primaryYearStats = useMemo(() => buildYearStats(contextRecords, false), [contextRecords]);
  const sensitivityYearStats = useMemo(() => buildYearStats(contextRecords, true), [contextRecords]);
  const schoolRows = useMemo(() => schoolStatistics(selectedRecords, includeApproximate), [selectedRecords, includeApproximate]);

  const cppRows = useMemo<CppStats[]>(() => {
    const groups = [...new Set(selectedRecords.map((record) => record.cpp).filter((value): value is string => value !== null))];
    return groups.map((group) => ({
      ...describe(selectedRecords.filter((record) => record.cpp === group).map((record) => getScore(record, includeApproximate))),
      cpp: group,
    }));
  }, [selectedRecords, includeApproximate]);

  const selectedQuality = promotion === 'all' ? null : quality.find((item) => item.sheet === String(promotion));
  const rankSectionAvailable = Boolean(selectedQuality?.hasRank);
  const model = useMemo(() => rankSectionAvailable ? regression(selectedRecords, includeApproximate) : regression([], includeApproximate), [rankSectionAvailable, selectedRecords, includeApproximate]);
  const residuals = useMemo(() => rankSectionAvailable ? residualItems(selectedRecords, includeApproximate) : [], [rankSectionAvailable, selectedRecords, includeApproximate]);
  const schoolRanking = useMemo(() => rankSectionAvailable && school === 'all'
    ? compareSchoolRankings(selectedRecords, includeApproximate, minimumN)
    : [], [rankSectionAvailable, school, selectedRecords, includeApproximate, minimumN]);

  const coverage = selectedRecords.length ? currentStats.n / selectedRecords.length : null;
  const approximateOnly = selectedRecords.filter((record) => record.score === null && record.sensitivityScore !== null).length;
  const missingCpp = selectedRecords.filter((record) => record.cpp === null).length;
  const extremeCount = selectedRecords.filter((record) => getScore(record, includeApproximate) !== null && ((getScore(record, includeApproximate) ?? 10) < 8 || (getScore(record, includeApproximate) ?? 10) >= 18)).length;

  const eligibleSchools = schoolRows.filter((row) => row.n >= minimumN && row.mean !== null);
  const topSchool = [...eligibleSchools].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0))[0];
  const widestSchool = [...eligibleSchools].sort((a, b) => (b.iqr ?? 0) - (a.iqr ?? 0))[0];

  const selectedLabel = promotion === 'all' ? '2019—2026' : String(promotion);
  const activeContext = [promotion === 'all' ? 'toutes promotions' : `promotion ${promotion}`, school === 'all' ? 'toutes écoles' : school, cpp === 'all' ? 'toutes CPP' : `CPP ${cpp}`].join(' · ');

  const trend2024 = yearStats.find((item) => item.year === 2024);
  const trend2026 = yearStats.find((item) => item.year === 2026);
  const alternative2026 = (includeApproximate ? primaryYearStats : sensitivityYearStats).find((item) => item.year === 2026);
  const matureMeans = yearStats.filter((item) => item.year <= 2024 && item.n >= minimumN && item.mean !== null).map((item) => item.mean!);
  const matureAmplitude = matureMeans.length > 1 ? Math.max(...matureMeans) - Math.min(...matureMeans) : null;
  const delta2024To2026 = trend2024?.mean !== null && trend2024?.mean !== undefined && trend2026?.mean !== null && trend2026?.mean !== undefined
    ? trend2026.mean - trend2024.mean
    : null;

  const resetFilters = () => {
    setPromotion(2024);
    setSchool('all');
    setCpp('all');
    setIncludeApproximate(false);
    setMinimumN(3);
    setRangeSort('mean');
  };

  const selectSchool = (value: string) => setSchool((current) => current === value ? 'all' : value);

  const exportView = () => {
    const rows = schoolRows.filter((row) => row.n >= minimumN);
    if (!rows.length) return;
    const headers = ['Ecole', 'n_moyennes', 'moyenne', 'mediane', 'ecart_type_population', 'minimum', 'Q1', 'Q3', 'maximum', 'spread', 'IQR', 'n_rangs', 'rang_median', 'n_paires'];
    const csvRows = rows.map((row) => [row.school, row.n, row.mean, row.median, row.std, row.min, row.q1, row.q3, row.max, row.spread, row.iqr, row.rankN, row.medianRank, row.pairedN]);
    const escape = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const text = typeof value === 'number' ? String(Math.round(value * 1000000) / 1000000) : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = '\ufeff' + [headers, ...csvRows].map((row) => row.map(escape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analyse_affectations_${selectedLabel.replace('—', '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#synthese" className="brand" aria-label="Retour à la synthèse"><BarChart3 size={22} aria-hidden="true" /><span>Affectations <strong>Écoles</strong></span></a>
        <nav className="main-nav" aria-label="Sommaire du rapport">
          <a href="#tendances">Tendances</a>
          <a href="#ecoles">Écoles & CPP</a>
          <a href="#classement">Classement</a>
          <a href="#qualite">Méthode</a>
        </nav>
        <button type="button" aria-label="Exporter la vue agrégée en CSV" className="primary-button export-button" onClick={exportView} disabled={!eligibleSchools.length} title="Exporter les agrégats écoles de la vue courante"><Download size={16} aria-hidden="true" /><span>Exporter la vue</span></button>
      </header>

      <main>
        <section className="hero" id="synthese">
          <div className="hero-copy">
            <span className="section-kicker">Rapport interactif · 8 promotions + feuille Exemple</span>
            <h1>Les écarts derrière<br />les affectations.</h1>
            <p>Moyennes, dispersion et classement sont analysés ensemble, avec la couverture des données affichée au même niveau que les résultats.</p>
            <div className="hero-meta"><span>{formatInteger(audit.finalRows)} lignes normalisées</span><span>{formatInteger(audit.primaryScores)} moyennes principales</span><span>aucune coordonnée personnelle</span></div>
          </div>
          <div className="hero-year" aria-live="polite">
            <span>Vue active</span>
            <strong>{selectedLabel}</strong>
            <p>{formatInteger(selectedRecords.length)} lignes · {formatInteger(currentStats.n)} moyennes</p>
            <p>{coverage === null ? 'Aucune donnée' : `${formatPercent(coverage, 1)} de couverture`}</p>
          </div>
        </section>

        <section className="filter-panel" aria-label="Filtres du rapport">
          <div className="filter-title"><SlidersHorizontal size={18} aria-hidden="true" /><span>Explorer les données</span></div>
          <label>Promotion
            <select value={String(promotion)} onChange={(event) => setPromotion(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
              <option value="all">Toutes</option>
              {years.map((year) => <option value={year} key={year}>{year}{year === 2021 ? ' · vide' : ''}</option>)}
            </select>
          </label>
          <label>École
            <select value={school} onChange={(event) => setSchool(event.target.value)}>
              <option value="all">Toutes</option>
              {schools.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>CPP
            <select value={cpp} onChange={(event) => setCpp(event.target.value)}>
              <option value="all">Toutes</option>
              {cpps.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>n minimum par groupe
            <select value={minimumN} onChange={(event) => setMinimumN(Number(event.target.value))}>
              {[1, 3, 5, 10].map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label className="switch-control">
            <input type="checkbox" checked={includeApproximate} onChange={(event) => setIncludeApproximate(event.target.checked)} />
            <span><strong>Inclure les approximations</strong><small>{approximateOnly} valeur{approximateOnly > 1 ? 's' : ''} supplémentaire{approximateOnly > 1 ? 's' : ''} dans la vue</small></span>
          </label>
          <button type="button" className="secondary-button reset-button" onClick={resetFilters}><RotateCcw size={16} aria-hidden="true" />Réinitialiser</button>
          <p className="filter-context"><strong>{activeContext}</strong> · {includeApproximate ? 'analyse de sensibilité' : 'analyse principale'}. Par défaut, 2024 est présélectionnée pour sa couverture élevée et ses rangs disponibles ; les tendances gardent toutes les années.</p>
        </section>

        {coverage !== null && coverage < 0.5 && (
          <div className="warning-banner" role="status"><AlertTriangle size={19} aria-hidden="true" /><p><strong>Couverture faible : {formatPercent(coverage, 1)}.</strong> Les moyennes et spreads de cette vue ne doivent pas être extrapolés à l’ensemble des lignes. {includeApproximate ? 'La sensibilité est active : comparez-la au calcul principal avant de conclure.' : 'Activez la sensibilité pour tester l’effet des approximations, sans la confondre avec le calcul principal.'}</p></div>
        )}
        {promotion === 2021 && <div className="info-banner"><Info size={19} aria-hidden="true" /><p>La feuille 2021 ne contient aucune ligne d’affectation. Choisissez une autre promotion pour la vue détaillée ; le graphique de tendance conserve le vide 2021.</p></div>}

        <section className="kpi-strip" aria-label="Indicateurs de la sélection">
          <div><span>Moyennes utilisées</span><strong>{formatInteger(currentStats.n)}</strong><small>{formatInteger(selectedRecords.length)} lignes · {formatPercent(coverage, 1)}</small></div>
          <div><span>Moyenne</span><strong>{formatNumber(currentStats.mean)}</strong><small>sur 20</small></div>
          <div><span>Médiane</span><strong>{formatNumber(currentStats.median)}</strong><small>50 % de part et d’autre</small></div>
          <div><span>Écart-type σ</span><strong>{formatNumber(currentStats.std)}</strong><small>dispersion autour de la moyenne</small></div>
          <div><span>Spread brut</span><strong>{formatNumber(currentStats.spread)}</strong><small>{formatNumber(currentStats.min)} à {formatNumber(currentStats.max)} · {extremeCount} extrême{extremeCount > 1 ? 's' : ''}</small></div>
          <div><span>IQR</span><strong>{formatNumber(currentStats.iqr)}</strong><small>{formatNumber(currentStats.q1)} à {formatNumber(currentStats.q3)} · plus robuste</small></div>
        </section>

        <section className="insight-strip" aria-label="Faits saillants de la sélection">
          <div><span>Niveau le plus élevé · n ≥ {minimumN}</span>{topSchool ? <><strong>{topSchool.school}</strong><p>{formatNumber(topSchool.mean)} / 20 en moyenne · n = {topSchool.n}</p></> : <p>Effectif insuffisant</p>}</div>
          <div><span>Plus forte dispersion robuste</span>{widestSchool ? <><strong>{widestSchool.school}</strong><p>IQR {formatNumber(widestSchool.iqr)} pt · spread {formatNumber(widestSchool.spread)} pt</p></> : <p>Effectif insuffisant</p>}</div>
          <div><span>Relation moyenne–rang</span>{rankSectionAvailable && model.spearman !== null ? <><strong>ρ = {formatNumber(model.spearman, 3)}</strong><p>{formatSigned(model.slope100)} pt pour 100 places · n = {model.n}</p></> : <p>{promotion === 'all' ? 'Sélectionnez une promotion 2023–2026.' : 'Pas assez de paires dans cette vue.'}</p>}</div>
        </section>

        <section id="tendances" className="report-section">
          <div className="section-heading"><div><h2>Trajectoires, avec les trous de données visibles</h2></div><p>Les filtres école et CPP s’appliquent ici, mais pas le filtre de promotion : le contexte temporel reste complet.</p></div>
          <div className="two-column trend-layout">
            <div className="panel">
              <div className="panel-header"><div><h3>Moyenne et médiane annuelles</h3><p>2021 reste un intervalle sans donnée, jamais un zéro.</p></div><div className="chart-legend"><span><i className="line-main" /> Moyenne</span><span><i className="line-secondary" /> Médiane</span></div></div>
              <TrendChart data={yearStats} selectedYear={promotion} reducedMotion={reducedMotion} />
              <div className="coverage-heading"><span>Couverture des moyennes</span><small>Cliquer sur une année change la vue détaillée</small></div>
              <CoverageStrip data={yearStats} selectedYear={promotion} onSelectYear={setPromotion} />
            </div>
            <aside className="panel narrative-panel">
              <span className="section-kicker">Lecture automatique</span>
              <h3>Ce que la tendance permet — et ne permet pas — de dire</h3>
              <ul className="narrative-list">
                <li><strong>2019–2024.</strong> {matureAmplitude === null ? 'Pas assez d’années au-dessus du seuil pour mesurer une amplitude.' : `L’amplitude des moyennes annuelles est de ${formatNumber(matureAmplitude)} pt pour les années avec n ≥ ${minimumN}.`}</li>
                <li><strong>2024 → 2026.</strong> {delta2024To2026 === null ? 'Comparaison impossible avec les effectifs et données disponibles.' : `La variation estimée est de ${formatSigned(delta2024To2026)} pt. Elle reste descriptive et dépend de la couverture.`}</li>
                <li><strong>Test de sensibilité 2026.</strong> {alternative2026?.n && trend2026?.n ? `La moyenne passe de ${formatNumber(trend2026.mean)} (n = ${trend2026.n}) à ${formatNumber(alternative2026.mean)} (n = ${alternative2026.n}) selon le traitement des approximations.` : 'Pas assez de moyennes pour comparer les deux traitements.'}</li>
                <li><strong>Prudence.</strong> Une variation peut venir du mix d’écoles et de CPP, des valeurs manquantes ou des saisies approximatives. Aucune causalité n’est inférée.</li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="ecoles" className="report-section">
          <div className="section-heading"><div><h2>Les écoles ne se résument pas à une moyenne</h2></div><p>La ligne montre le min–max, la bande l’IQR, le trait la médiane et le point la moyenne. Cliquer sur une ligne filtre toute l’interface.</p></div>
          <div className="panel">
            <div className="panel-header"><div><h3>Distributions par école</h3><p>{activeContext} · tri et seuil modifiables.</p></div></div>
            <RangePlot rows={schoolRows} minimumN={minimumN} sort={rangeSort} onSortChange={setRangeSort} onSelectSchool={selectSchool} selectedSchool={school} />
          </div>

          <div className="panel cpp-panel" id="cpp">
            <div className="panel-header"><div><h3>Comparaison par CPP d’origine</h3><p>Groupes avec n ≥ {minimumN} · {missingCpp} ligne{missingCpp > 1 ? 's' : ''} sans CPP exploitable dans la sélection.</p></div></div>
            <CppTable rows={cppRows} minimumN={minimumN} />
          </div>
        </section>

        <section id="classement" className="report-section">
          <div className="section-heading"><div><h2>Moyenne et classement : mesurer l’alignement et les résidus</h2></div><p>Le modèle est recalculé par promotion, uniquement sur les paires moyenne–rang valides. Un rang petit est meilleur.</p></div>
          {promotion === 'all' ? (
            <div className="panel empty-action"><h3>Choisissez une promotion pour conserver des rangs comparables.</h3><p>Les classements bruts ne sont pas regroupés entre années.</p><div>{[2023, 2024, 2025, 2026].map((year) => <button type="button" className="secondary-button" key={year} onClick={() => setPromotion(year)}>Analyser {year}</button>)}</div></div>
          ) : !rankSectionAvailable ? (
            <div className="panel empty-action"><h3>{promotion === 2021 ? 'La feuille 2021 est vide.' : `La feuille ${promotion} ne prévoit pas de classement.`}</h3><p>La relation moyenne–rang est disponible de 2023 à 2026.</p><div><button type="button" className="secondary-button" onClick={() => setPromotion(2024)}>Analyser 2024</button></div></div>
          ) : model.n < 3 || model.spearman === null ? (
            <div className="panel empty-action"><h3>Seulement {model.n} paire{model.n > 1 ? 's' : ''} exploitable{model.n > 1 ? 's' : ''}.</h3><p>Il faut au moins trois paires non constantes pour estimer la relation. Élargissez les filtres ou changez de promotion.</p></div>
          ) : (
            <>
              <div className="two-column rank-layout">
                <div className="panel">
                  <div className="panel-header"><div><h3>Chaque point est une affectation anonymisée</h3><p>{activeContext} · {model.n} paires · {includeApproximate ? 'sensibilité active' : 'analyse principale'}.</p></div><div className="chart-legend"><span><i className="dot-scatter" /> Individu</span><span><i className="line-regression" /> Régression</span></div></div>
                  <RankScatter points={residuals} model={model} reducedMotion={reducedMotion} />
                </div>
                <aside className="panel model-panel">
                  <span className="section-kicker">Paramètres estimés</span>
                  <div className="model-metrics">
                    <div><span>Spearman ρ</span><strong>{formatNumber(model.spearman, 3)}</strong><small>−1 = ordre inverse parfait</small></div>
                    <div><span>Pente β × 100</span><strong>{formatSigned(model.slope100)}</strong><small>points pour 100 places</small></div>
                    <div><span>R² linéaire</span><strong>{formatNumber(model.r2, 3)}</strong><small>Pearson r = {formatNumber(model.pearson, 3)}</small></div>
                    <div><span>Équation</span><strong className="equation">{formatNumber(model.intercept)} {model.slope !== null && model.slope < 0 ? '−' : '+'} {formatNumber(Math.abs(model.slope ?? 0), 4)} × rang</strong><small>moyenne prédite sur 20</small></div>
                  </div>
                  <p className="panel-footnote">La pente négative est attendue : plus le numéro de rang augmente, moins le classement est bon et plus la moyenne tend à baisser.</p>
                </aside>
              </div>

              <div className="panel residual-panel">
                <div className="panel-header compact"><div><h3>Plus grands résidus absolus</h3><p>Moyenne observée − moyenne prédite ; aucune identité n’est affichée.</p></div></div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>École</th><th>CPP</th><th>Moyenne</th><th>Rang</th><th>Prédite</th><th>Résidu</th></tr></thead><tbody>
                  {residuals.slice(0, 5).map((item) => <tr key={item.record.id}><th scope="row">{item.record.school}</th><td>{item.record.cpp ?? '—'}</td><td>{formatNumber(item.score)}</td><td>{item.rank}</td><td>{formatNumber(item.predicted)}</td><td className={item.residual >= 0 ? 'positive-value' : 'negative-value'}>{formatSigned(item.residual)}</td></tr>)}
                </tbody></table></div>
              </div>

              {schoolRanking.length >= 2 && (
                <div className="panel ranking-panel">
                  <div className="panel-header compact"><div><h3>Classement des écoles : moyenne versus rang médian</h3><p>Mêmes individus appariés dans les deux lectures, n ≥ {minimumN}. Δ = position par moyenne − position par rang médian ; un Δ positif signifie que l’école est mieux placée par le rang médian.</p></div></div>
                  <div className="table-wrap"><table className="data-table"><thead><tr><th>École</th><th>n apparié</th><th>Moyenne</th><th className="rank-median-optional">Rang médian</th><th>Pos. moyenne</th><th>Pos. rang</th><th>Δ</th></tr></thead><tbody>
                    {schoolRanking.map((row) => <tr key={row.school}><th scope="row">{row.school}</th><td>{row.n}</td><td>{formatNumber(row.mean)}</td><td className="rank-median-optional">{formatNumber(row.medianRank, 1)}</td><td>{row.meanPosition}</td><td>{row.rankPosition}</td><td className={row.delta > 0 ? 'positive-value' : row.delta < 0 ? 'negative-value' : ''}>{formatSigned(row.delta, 0)}</td></tr>)}
                  </tbody></table></div>
                </div>
              )}
            </>
          )}
        </section>

        <QualitySection />
      </main>

      <footer><span>Source unique : « Affectations Écoles.xlsx ». Analyse descriptive, sans données externes ni inférence causale.</span><span>Calculs locaux · export agrégé et anonymisé.</span></footer>
    </div>
  );
}

export default App;
