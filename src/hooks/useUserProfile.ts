import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export type UserProfile = {
  skin_type: string | null
  skin_concerns: string[] | null
  grade: string | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
  birth_date: string | null
  menstrual_cycle: string | null
  body_status: string | null
  sleep_hours: number | null
  drink_frequency: string | null
  exercise_frequency: string | null
  stress_level: string | null
  allergy_ingredients: string[] | null
  procedure_history: string[] | null
  preferred_brands: string[] | null
}

let cachedProfile: UserProfile | null = null

export function useUserProfile() {
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile)
  const [loading, setLoading] = useState(!cachedProfile)

  useEffect(() => {
    if (cachedProfile) return
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select(
          `
          skin_type, skin_concerns, grade,
          username, full_name, avatar_url, birth_date,
          menstrual_cycle, body_status, sleep_hours,
          drink_frequency, exercise_frequency, stress_level,
          allergy_ingredients, procedure_history, preferred_brands
        `
        )
        .eq('auth_id', user.id)
        .maybeSingle()
      if (data) {
        cachedProfile = data as UserProfile
        setProfile(data as UserProfile)
      }
      setLoading(false)
    }
    void load()
  }, [])

  const refresh = async () => {
    cachedProfile = null
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select(
        `
        skin_type, skin_concerns, grade,
        username, full_name, avatar_url, birth_date,
        menstrual_cycle, body_status, sleep_hours,
        drink_frequency, exercise_frequency, stress_level,
        allergy_ingredients, procedure_history, preferred_brands
      `
      )
      .eq('auth_id', user.id)
      .maybeSingle()
    if (data) {
      cachedProfile = data as UserProfile
      setProfile(data as UserProfile)
    }
  }

  return { profile, loading, refresh }
}
