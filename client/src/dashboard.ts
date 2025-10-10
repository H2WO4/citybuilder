import { fmtEUR, getMoneyStats, getSpendHistory, getRefundHistory } from './ui';

type MoneyPoint = { t: number; amount: number };

let isOpen = false;
let root: HTMLDivElement | null = null;
// no toggle button, only keyboard 'D'

function ensureUI(){
  if (root) return;
  root = document.getElementById('dashboard') as HTMLDivElement;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'd') {
      e.preventDefault();
      isOpen = !isOpen;
      render();
    }
  });
  render();
}

function render(forceOpen = false){
  if (!root) return;
  if (forceOpen) isOpen = true;
  root.classList.toggle('open', isOpen);
  if (!isOpen) return;
  const { money, totalSpent, totalRefunded, net } = getMoneyStats();
  const spendSvg = renderSpendChart();
  root.innerHTML = `
    <div class="dash-header">
      <div class="dash-title">📊 Tableau de bord</div>
      <button id="dash-close" class="dash-close" title="Fermer">✕</button>
    </div>
    <div class="dash-section">
      <div class="dash-sub">Argent</div>
      <div class="dash-row"><span>Solde</span><span>${fmtEUR.format(money)}</span></div>
      <div class="dash-row"><span>Dépenses cumulées</span><span class="neg">-${fmtEUR.format(totalSpent)}</span></div>
      <div class="dash-row"><span>Remboursements cumulés</span><span class="pos">+${fmtEUR.format(totalRefunded)}</span></div>
      <div class="dash-row"><span>Net depuis départ</span><span>${fmtEUR.format(net)}</span></div>
    </div>
    <div class="dash-section">
      <div class="dash-sub">Courbe des dépenses</div>
      <div class="dash-chart">${spendSvg}</div>
    </div>
  `;
  const close = document.getElementById('dash-close') as HTMLButtonElement;
  if (close) close.addEventListener('click', () => { isOpen = false; render(); });
}

export function initDashboard(forceOpen = false){
  ensureUI();
  render(forceOpen);
  // React to money/resources changes
  window.addEventListener('money:changed', () => render());
  window.addEventListener('spend:changed', () => render());
  window.addEventListener('refund:changed', () => render());
}

function renderSpendChart(): string {
  const spend: MoneyPoint[] = getSpendHistory();
  const refund: MoneyPoint[] = getRefundHistory();
  if (!spend.length && !refund.length) {
    return `<div class="dash-empty">Aucune dépense pour le moment</div>`;
  }
  const now = performance.now();
  const windowMs = 60_000; // dernière minute
  const fSpend: MoneyPoint[] = spend.filter((d: MoneyPoint) => now - d.t <= windowMs);
  const fRefund: MoneyPoint[] = refund.filter((d: MoneyPoint) => now - d.t <= windowMs);
  const sPoints: MoneyPoint[] = fSpend.length ? fSpend : spend.slice(-50);
  const rPoints: MoneyPoint[] = fRefund.length ? fRefund : refund.slice(-50);
  const w = 300, h = 80, pad = 6;
  // Construire des courbes cumulées
  const t0 = Math.min(
    sPoints.length ? sPoints[0].t : now,
    rPoints.length ? rPoints[0].t : now
  );
  let cumS = 0, cumR = 0;
  const sPath: [number, number][] = sPoints.map((p: MoneyPoint) => {
    cumS += p.amount;
    const x = pad + (w - 2*pad) * ((p.t - t0) / Math.max(1, ((sPoints.length?sPoints[sPoints.length-1].t:t0) - t0)));
    return [x, cumS];
  });
  const rPath: [number, number][] = rPoints.map((p: MoneyPoint) => {
    cumR += p.amount;
    const x = pad + (w - 2*pad) * ((p.t - t0) / Math.max(1, ((rPoints.length?rPoints[rPoints.length-1].t:t0) - t0)));
    return [x, cumR];
  });
  const maxY = Math.max(1,
    sPath.reduce((m, [,y]) => Math.max(m, y), 0),
    rPath.reduce((m, [,y]) => Math.max(m, y), 0)
  );
  const dSpend = sPath.map(([x,y], i) => {
    const yy = h - pad - (h - 2*pad) * (y / maxY);
    return (i===0?`M ${x} ${yy}`:`L ${x} ${yy}`);
  }).join(' ');
  const dRefund = rPath.map(([x,y], i) => {
    const yy = h - pad - (h - 2*pad) * (y / maxY);
    return (i===0?`M ${x} ${yy}`:`L ${x} ${yy}`);
  }).join(' ');
  const lastS = cumS, lastR = cumR;
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect x="0" y="0" width="${w}" height="${h}" rx="8" ry="8" fill="#fff" stroke="#222"/>
      <path d="${dSpend}" fill="none" stroke="#b51212" stroke-width="2"/>
      <path d="${dRefund}" fill="none" stroke="#0f7d1f" stroke-width="2"/>
      <text x="${w - pad}" y="${pad + 12}" text-anchor="end" font-size="12" fill="#333">${fmtEUR.format(lastR)} / -${fmtEUR.format(lastS)}</text>
    </svg>
  `;
}
