'use client'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

export type SettingsMap = Record<string, Record<string, string>>

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000
let _cachedAt = 0
let _cachedRaw: any[] = []
let _cachedMap: SettingsMap = {}

export function useAdminSettings() {
  const supabase = createClient()
  const [settings, setSettings] = useState<SettingsMap>({})
  const [raw, setRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fetchSettings = useCallback(async (force = false) => {
    setLoading(true)
    const now = Date.now()
    if (!force && _cachedAt > 0 && now - _cachedAt < SETTINGS_CACHE_TTL_MS) {
      setRaw(_cachedRaw)
      setSettings(_cachedMap)
      setLoading(false)
      return
    }

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
    _cachedAt = now
    _cachedRaw = raw
    _cachedMap = map
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

  const saveCategory = async (
    category: string,
    meta?: Record<string, { label?: string; unit?: string; value_type?: string }>
  ) => {
    setSaving(true)
    setError(null)
    const catSettings = settings[category] || {}
    const { data: auth } = await supabase.auth.getUser()
    let updatedBy: string | null = null
    if (auth?.user?.id) {
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      updatedBy = me?.id || null
    }
    const updates = Object.entries(catSettings).map(([key, value]) => ({
      category,
      key,
      value,
      label: meta?.[key]?.label || null,
      unit: meta?.[key]?.unit || null,
      value_type: meta?.[key]?.value_type || null,
      updated_by: updatedBy,
    }))
    const { error: err } = await supabase
      .from('admin_settings')
      .upsert(updates, { onConflict: 'category,key' })
    if (err) { setError(err.message); setSaving(false); return false }
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await fetchSettings(true)
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
    await fetchSettings(true)
    setSaving(false)
    return true
  }

  // alias: getSetting('category','key') 형태로도 읽기 편하게 제공
  const getSetting = get
  const getSettingNum = getNum

  return {
    settings,
    raw,
    loading,
    saving,
    dirty,
    saved,
    error,
    get,
    getNum,
    getBool,
    getSetting,
    getSettingNum,
    set,
    saveCategory,
    saveAll,
    refetch: fetchSettings,
  }
}
