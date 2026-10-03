'use client'

import { createContext, useContext } from 'react'

export const InSheetContext = createContext(false)

export function useInSheet() {
  return useContext(InSheetContext)
}
