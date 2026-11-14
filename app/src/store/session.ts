import { create } from 'zustand'
import { CREW, type Crew } from '../sim/crew'
import { useStore } from './store'

/**
 * Demo sign-in. Orb is frontend only, so there is no account server: a crew
 * member signs in with their mission email and the app opens on their own
 * health. The password is not checked. The session is remembered in this
 * browser so the demo does not ask again on every reload.
 */

const KEY = 'orb.session'
const DOMAIN = 'orb.mission'

/** amara.okafor@orb.mission */
export function crewEmail(crew: Crew): string {
  return `${crew.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${DOMAIN}`
}

export function findCrewByEmail(email: string): Crew | undefined {
  const wanted = email.trim().toLowerCase()
  return CREW.find((c) => crewEmail(c) === wanted)
}

function readSaved(): string | null {
  try {
    const id = window.localStorage.getItem(KEY)
    return id && CREW.some((c) => c.id === id) ? id : null
  } catch {
    return null
  }
}

function save(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id)
    else window.localStorage.removeItem(KEY)
  } catch {
    // Private mode or blocked storage: the session just lasts until reload.
  }
}

interface Session {
  crewId: string | null
  signIn: (crewId: string) => void
  signOut: () => void
}

export const useSession = create<Session>((set) => {
  const saved = readSaved()
  if (saved) useStore.getState().setCrew(saved)
  return {
    crewId: saved,
    signIn: (crewId) => {
      save(crewId)
      useStore.getState().setCrew(crewId)
      set({ crewId })
    },
    signOut: () => {
      save(null)
      set({ crewId: null })
    },
  }
})
