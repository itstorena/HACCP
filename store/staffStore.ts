'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: 'chef' | 'cook' | 'cleaner' | 'manager'
  avatarUrl: string | null
}

interface StaffStore {
  currentStaff: StaffMember | null
  lastActivity: number
  login: (staff: StaffMember) => void
  logout: () => void
  updateActivity: () => void
  isSessionExpired: () => boolean
}

const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000 // 4 ore

export const useStaffStore = create<StaffStore>()(
  persist(
    (set, get) => ({
      currentStaff: null,
      lastActivity: Date.now(),
      login: (staff) => set({ currentStaff: staff, lastActivity: Date.now() }),
      logout: () => set({ currentStaff: null, lastActivity: Date.now() }),
      updateActivity: () => set({ lastActivity: Date.now() }),
      isSessionExpired: () => {
        const { lastActivity } = get()
        return Date.now() - lastActivity > INACTIVITY_LIMIT_MS
      },
    }),
    {
      name: 'haccp-staff-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
