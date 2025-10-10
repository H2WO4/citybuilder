export const resources = { power: 0, water: 0, food: 0, wood: 0 };
export const production = { power: 0, water: 0, food: 0, wood: 0 };

export function updateRes() {
  const p = document.getElementById("r-power");
  const w = document.getElementById("r-water");
  const f = document.getElementById("r-food");
  const wd = document.getElementById("r-wood");
  if (p) p.textContent = String(resources.power);
  if (w) w.textContent = String(resources.water);
  if (f) f.textContent = String(resources.food);
  if (wd) wd.textContent = String(resources.wood);
  window.dispatchEvent(new CustomEvent('resources:changed', { detail: { resources, production } }));
}

export function getResourcesSnapshot(){ return { resources, production }; }
