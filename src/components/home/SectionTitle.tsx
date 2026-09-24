import React from 'react'

export const SECTION_GAP = 40
export const CARD_RADIUS = 16
export const CARD_PADDING = 20

export const sectionTitleStyles = {
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'rgba(201,169,110,0.6)',
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 16,
    fontWeight: 400,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: 400,
  },
}

interface SectionTitleProps {
  eyebrow?: string
  title: string
  description?: string
}

export default function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return (
    <div>
      {eyebrow && <div style={sectionTitleStyles.eyebrow}>{eyebrow}</div>}
      <div style={sectionTitleStyles.title}>{title}</div>
      {description && <div style={sectionTitleStyles.description}>{description}</div>}
    </div>
  )
}
