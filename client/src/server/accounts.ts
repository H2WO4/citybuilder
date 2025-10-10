import { query } from "./main"

export interface LoginData {
  name: String
  pass: String
}

export async function signin(data: LoginData): Promise<void> {
  const response = await query("POST", "/signin", data)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Erreur lors de la création du compte')
  }

  return
}

export async function login(data: LoginData): Promise<void> {
  const response = await query("POST", "/login", data)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Identifiants incorrects')
  }

  return
}

export async function logout(): Promise<void> {
  const response = await query("POST", "/logout")
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Erreur lors de la déconnexion')
  }

  // La réponse peut être vide (status 204), donc on ne parse pas forcément du JSON
  if (response.status !== 204) {
    try {
      await response.json()
    } catch (e) {
      // Ignore les erreurs de parsing JSON si la réponse est vide
    }
  }

  return
}
