import { create } from 'zustand'
import { CREW, type Crew } from '../sim/crew'
import { useStore } from './store'

/**
 * Demo sign-in. Orb is frontend only, so there is no account server.
 *
 * Two kinds of account:
 * - a crew member signs in with their mission email and sees their own health;
 * - the flight surgeon on Earth signs in as flight.surgeon@orb.mission and gets
 *   Mission Control, and can open any crew member's own view ("view as").
 *
 * Passwords are not checked. The session is remembered in this browser.
 */

export type Role = 'crew' | 'flight-surgeon'

const KEY = 'orb.session'
const DOMAIN = 'orb.mission'
export const SURGEON_EMAIL = `flight.surgeon@${DOMAIN}`

/** amara.okafor@orb.mission */
export function crewEmail(crew: Crew): string {
  return `${crew.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${DOMAIN}`
}

export function findCrewByEmail(email: string): Crew | undefined {
  const wanted = email.trim().toLowerCase()
  return CREW.find((c) => crewEmail(c) === wanted)
}

export type Account = { role: 'crew'; crewId: string } | { role: 'flight-surgeon' }

/** Who an email belongs to, or undefined. */
export function accountForEmail(email: string): Account | undefined {
  if (email.trim().toLowerCase() === SURGEON_EMAIL) return { role: 'flight-surgeon' }
  const crew = findCrewByEmail(email)
  return crew ? { role: 'crew', crewId: crew.id } : undefined
}

function readSaved(): Account | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    // Older sessions stored just the crew id.
    if (CREW.some((c) => c.id === raw)) return { role: 'crew', crewId: raw }
    const parsed = JSON.parse(raw) as Partial<Account> & { crewId?: string }
    if (parsed.role === 'flight-surgeon') return { role: 'flight-surgeon' }
    if (parsed.role === 'crew' && CREW.some((c) => c.id === parsed.crewId)) {
      return { role: 'crew', crewId: parsed.crewId! }
    }
  } catch {
    // Unreadable or blocked storage: start signed out.
  }
  return null
}

function save(account: Account | null) {
  try {
    if (account) window.localStorage.setItem(KEY, JSON.stringify(account))
    else window.localStorage.removeItem(KEY)
  } catch {
    // Private mode or blocked storage: the session just lasts until reload.
  }
}

interface Session {
  role: Role | null
  /** The crew member whose own view is shown: the signed-in crew member, or
   *  whoever the flight surgeon is viewing as. */
  crewId: string | null
  signIn: (account: Account) => void
  signOut: () => void
  /** Flight surgeon only: open a crew member's own view, or null to go back. */
  viewAs: (crewId: string | null) => void
}

function apply(account: Account | null) {
  // A person answers crew messages while the flight surgeon is signed in.
  useStore.getState().setAutoReply(account?.role !== 'flight-surgeon')
  if (account?.role === 'crew') useStore.getState().setCrew(account.crewId)
}

export const useSession = create<Session>((set, get) => {
  const saved = readSaved()
  apply(saved)
  return {
    role: saved?.role ?? null,
    crewId: saved?.role === 'crew' ? saved.crewId : null,
    signIn: (account) => {
      save(account)
      apply(account)
      set({ role: account.role, crewId: account.role === 'crew' ? account.crewId : null })
    },
    signOut: () => {
      save(null)
      apply(null)
      set({ role: null, crewId: null })
    },
    viewAs: (crewId) => {
      if (get().role !== 'flight-surgeon') return
      if (crewId) useStore.getState().setCrew(crewId)
      set({ crewId })
    },
  }
})
