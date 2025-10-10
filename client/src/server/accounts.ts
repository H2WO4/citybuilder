import { query } from "./main"

export interface LoginData {
  name: String
  pass: String
}

export async function signin(data: LoginData): Promise<void> {
  const response = await query("POST", "/signin", data)
  await response.json()

  return
}

export async function login(data: LoginData): Promise<void> {
  const response = await query("POST", "/login", data)
  await response.json()

  return
}

export async function logout(): Promise<void> {
  const response = await query("POST", "/logout")
  await response.json()

  return
}
