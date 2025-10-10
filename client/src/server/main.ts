// import type { UUIDTypes as UUID } from "uuid";
const ENV = import.meta.env
const API_URL: string = ENV.VITE_API_URL

type Method = "GET" | "POST" | "PATCH" | "DELETE"

export function query(method: Method, path: string, body?: object): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // Important pour les sessions/cookies
    headers: {
      "Content-Type": "application/json"
    }
  })
}
