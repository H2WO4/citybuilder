import { fmtEUR, getMoneyStats } from './ui';
import { getResourcesSnapshot } from './ressources';

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

function render(){
  if (!root) return;
  root.classList.toggle('open', isOpen);
  if (!isOpen) return;
  const { money, totalSpent, totalRefunded, net } = getMoneyStats();
  const { resources } = getResourcesSnapshot();
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
      <div class="dash-sub">Ressources</div>
      <div class="dash-row"><span>⚡ Électricité</span><span>${resources.power}</span></div>
      <div class="dash-row"><span>💧 Eau</span><span>${resources.water}</span></div>
      <div class="dash-row"><span>🍖 Nourriture</span><span>${resources.food}</span></div>
      <div class="dash-row"><span>🪵 Bois</span><span>${resources.wood}</span></div>
    </div>
  `;
  const close = document.getElementById('dash-close') as HTMLButtonElement;
  if (close) close.addEventListener('click', () => { isOpen = false; render(); });
}

export function initDashboard(){
  ensureUI();
  // React to money/resources changes
  window.addEventListener('money:changed', () => render());
  window.addEventListener('resources:changed', () => render());
}
