// UI interactions (floating action button + accessibility)
// Type augmentation for global window to expose actionToggle if needed elsewhere
declare global {
  interface Window {
    actionToggle?: () => void;
  }
}

function adjustFab(action: HTMLElement): void {
  if (!action) return;
  action.classList.remove('flip-x', 'flip-y');
  const list = action.querySelector<HTMLUListElement>('ul');
  if (!list) return;
  const wasHidden = !action.classList.contains('active');
  if (wasHidden) {
    action.classList.add('active');
    list.style.visibility = 'hidden';
    list.style.opacity = '0';
  }
  const rect = list.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let flipX = false;
  let flipY = false;
  if (rect.right > vw) flipX = true;
  if (rect.left < 0) flipX = true; // left overflow
  if (rect.top < 0) flipY = true;  // top overflow
  if (rect.bottom > vh) flipY = true; // bottom overflow
  if (flipX) action.classList.add('flip-x');
  if (flipY) action.classList.add('flip-y');
  if (wasHidden) {
    action.classList.remove('active');
    list.style.visibility = '';
    list.style.opacity = '';
  }
}

export function actionToggle(): void {
  const action = document.querySelector<HTMLElement>('.action');
  if (!action) return;
  const isActive = action.classList.toggle('active');
  action.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  if (isActive) {
    requestAnimationFrame(() => adjustFab(action));
  }
}

// Optionally expose globally (only if some inline HTML uses it)
window.actionToggle = actionToggle;

const fab = document.getElementById('fab') as HTMLElement | null;
if (fab) {
  fab.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    actionToggle();
  });
  fab.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      actionToggle();
    }
    if (e.key === 'Escape') {
      fab.classList.remove('active');
      fab.setAttribute('aria-expanded', 'false');
    }
  });
  fab.setAttribute('tabindex', '0');
  fab.setAttribute('aria-expanded', 'false');
}

export function init(): void {
  // Close when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const act = document.querySelector<HTMLElement>('.action.active');
    if (act && !act.contains(e.target as Node)) {
      act.classList.remove('active');
      act.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('resize', () => {
    const active = document.querySelector<HTMLElement>('.action.active');
    if (active) adjustFab(active);
  });
}

 init();
