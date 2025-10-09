/**
 * Simple runtime state holder for selected city and other global state.
 * Kept minimal and synchronous to avoid coupling with frameworks.
 */

let _selectedCity: string | null = null

export function setSelectedCity(id: string | null) {
  _selectedCity = id
}

export function getSelectedCity(): string | null {
  return _selectedCity
}

export default { setSelectedCity, getSelectedCity }
