'use client'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

export type SettingsMap = Record<string, Record<string, string>>

export function useAdminSettings() {
  const supabase = createClient()
  const [settings, setSettings] = useState<SettingsMap>({})
  const [raw, setRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('admin_settings')
      .select('*')
      .order('category')
      .order('key')
    if (err) { setError(err.message); setLoading(false); return }
    const raw = data || []
    setRaw(raw)
    const map: SettingsMap = {}
    for (const row of raw) {
      if (!map[row.category]) map[row.category] = {}
      map[row.category][row.key] = row.value
    }
    setSettings(map)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const get = (category: string, key: string, fallback = '') =>
    settings[category]?.[key] ?? fallback

  const getNum = (category: string, key: string, fallback = 0) =>
    Number(settings[category]?.[key] ?? fallback)

  const getBool = (category: string, key: string, fallback = false) => {
    const v = settings[category]?.[key]
    if (v === undefined) return fallback
    return v === 'true'
  }

  const set = (category: string, key: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: { ...(prev[category] || {}), [key]: String(value) }
    }))
    setDirty(true)
    setSaved(false)
  }

  const saveCategory = async (category: string) => {
    setSaving(true)
    setError(null)
    const catSettings = settings[category] || {}
    const updates = Object.entries(catSettings).map(([key, value]) => ({
      category, key, value
    }))
    const { error: err } = await supabase
      .from('admin_settings')
      .upsert(updates, { onConflict: 'category,key' })
    if (err) { setError(err.message); setSaving(false); return false }
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    return true
  }

  const saveAll = async () => {
    setSaving(true)
    setError(null)
    const updates: { category: string; key: string; value: string }[] = []
    for (const [category, keys] of Object.entries(settings)) {
      for (const [key, value] of Object.entries(keys)) {
        updates.push({ category, key, value })
      }
    }
    const { error: err } = await supabase
      .from('admin_settings')
      .upsert(updates, { onConflict: 'category,key' })
    if (err) { setError(err.message); setSaving(false); return false }
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    return true
  }

  return { settings, raw, loading, saving, dirty, saved, error, get, getNum, getBool, set, saveCategory, saveAll, refetch: fetchSettings }
}
