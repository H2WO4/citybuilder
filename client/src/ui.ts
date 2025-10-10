export const initialMoney = 200000;
export let money = initialMoney;
// Cumul des dépenses/remboursements pour le tableau de bord
let totalSpent = 0;
let totalRefunded = 0;
const hud = document.getElementById("money-hud") as HTMLElement;
export const fmtEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export function renderMoney() { if (hud) hud.textContent = fmtEUR.format(money); }
function dispatchMoneyChange() {
  window.dispatchEvent(new CustomEvent('money:changed', {
    detail: { money, totalSpent, totalRefunded, net: money - initialMoney }
  }));
}
renderMoney();

// Mutateur de solde + rendu HUD
export function addMoney(delta: number) {
  money += delta;
  renderMoney();
  dispatchMoneyChange();
}

const toast = document.getElementById("toast") as HTMLDivElement;
let toastT: any = null;
export function showToast(msg: any) {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.style.opacity = "0", 1200);
}

interface MoneyPopupAggregate { amount: number; element: HTMLDivElement; timeout: any; lastTime: number; }
const moneyPopupContainer = document.getElementById("money-popups") as HTMLDivElement;
const REFUND_AGG_WINDOW = 450;
const SPEND_AGG_WINDOW = 450;
let refundAggregate: MoneyPopupAggregate | null = null;
let spendAggregate: MoneyPopupAggregate | null = null;

function createMoneyPopup(text: string, key: string, pulse = false) {
  const div = document.createElement('div');
  div.className = `ui money-float money-float--${key}`;
  div.textContent = text;
  moneyPopupContainer.appendChild(div);
  requestAnimationFrame(() => { div.classList.add('show'); if (pulse) div.classList.add('pulse'); });
  setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 400); }, 1500);
  return div;
}

export function showRefund(amount: number) {
  const now = performance.now();
  if (refundAggregate && (now - refundAggregate.lastTime) < REFUND_AGG_WINDOW) {
    refundAggregate.amount += amount;
    refundAggregate.lastTime = now;
    refundAggregate.element.textContent = '+' + fmtEUR.format(refundAggregate.amount);
    refundAggregate.element.classList.add('pulse');
    clearTimeout(refundAggregate.timeout);
    refundAggregate.timeout = setTimeout(() => { refundAggregate?.element.classList.remove('show'); refundAggregate = null; }, 1500);
    totalRefunded += amount;
    dispatchMoneyChange();
    return;
  }
  const el = createMoneyPopup('+' + fmtEUR.format(amount), 'refund', true);
  refundAggregate = { amount, element: el, lastTime: now, timeout: setTimeout(() => { el.classList.remove('show'); refundAggregate = null; }, 1500) };
  totalRefunded += amount;
  dispatchMoneyChange();
}

export function showSpend(amount: number) {
  const now = performance.now();
  if (spendAggregate && (now - spendAggregate.lastTime) < SPEND_AGG_WINDOW) {
    spendAggregate.amount += amount;
    spendAggregate.lastTime = now;
    spendAggregate.element.textContent = '-' + fmtEUR.format(spendAggregate.amount);
    spendAggregate.element.classList.add('pulse');
    clearTimeout(spendAggregate.timeout);
    spendAggregate.timeout = setTimeout(() => { spendAggregate?.element.classList.remove('show'); spendAggregate = null; }, 1500);
    totalSpent += amount;
    dispatchMoneyChange();
    return;
  }
  const el = createMoneyPopup('-' + fmtEUR.format(amount), 'spend', true);
  spendAggregate = { amount, element: el, lastTime: now, timeout: setTimeout(() => { el.classList.remove('show'); spendAggregate = null; }, 1500) };
  totalSpent += amount;
  dispatchMoneyChange();
}

export function getMoneyStats() {
  return { money, totalSpent, totalRefunded, net: money - initialMoney };
}
