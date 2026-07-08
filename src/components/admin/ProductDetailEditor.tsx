'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  onImageUpload?: (file: File) => Promise<string>
  onVideoUpload?: (file: File) => Promise<string>
}

const BTN = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => {
  const { active, style, ...rest } = props
  return (
    <button
      type="button"
      {...rest}
      style={{
        width: 28, height: 28, borderRadius: 5, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(123,94,167,0.3)' : 'transparent',
        color: active ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        ...style,
      }}
    />
  )
}

const TDIV = () => <div style={{ width: 0.5, background: 'rgba(255,255,255,0.1)', margin: '0 3px', height: 18 }} />

const DIVIDERS = [
  { label: '──────', html: '<hr class="div-fade"/>' },
  { label: '─·─', html: '<hr class="div-text"/>' },
  { label: '━───', html: '<hr class="div-gold"/>' },
  { label: '·●·', html: '<hr class="div-dots"/>' },
  { label: '- - -', html: '<hr class="div-dash"/>' },
]

export default function ProductDetailEditor({ value, onChange, onImageUpload, onVideoUpload }: Props) {
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const divPickerRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        style: 'min-height:200px;outline:none;padding:14px;font-size:13px;line-height:1.8;color:#e8e4dc',
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) return null

  const insertDivider = (html: string) => {
    editor.chain().focus().insertContent(html).run()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (file.type.startsWith('image/') && onImageUpload) {
      const url = await onImageUpload(file)
      editor.chain().focus().setImage({ src: url }).run()
    } else if (file.type.startsWith('video/') && onVideoUpload) {
      const url = await onVideoUpload(file)
      editor.chain().focus().insertContent(`<video src="${url}" controls style="max-width:100%;border-radius:8px"></video>`).run()
    }
  }

  return (
    <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
      {/* 툴바 */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value=""
          onChange={e => {
            const v = e.target.value
            if (v === 'p') editor.chain().focus().setParagraph().run()
            else if (v === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
            else if (v === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
            else if (v === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
          }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 6px', color: '#e8e4dc', fontSize: 11, outline: 'none' }}
        >
          <option value="p">본문</option>
          <option value="h1">제목 1</option>
          <option value="h2">제목 2</option>
          <option value="h3">제목 3</option>
        </select>
        <TDIV />
        <BTN active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게">B</BTN>
        <BTN active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임" style={{ fontStyle: 'italic' }}>I</BTN>
        <BTN active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄" style={{ textDecoration: 'underline' }}>U</BTN>
        <BTN active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선" style={{ textDecoration: 'line-through' }}>S</BTN>
        <TDIV />
        <BTN active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: 'rgba(201,169,110,0.25)' }).run()} title="하이라이트">🖊</BTN>
        <TDIV />
        <BTN active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="좌측">≡</BTN>
        <BTN active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="가운데">≡</BTN>
        <BTN active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="우측">≡</BTN>
        <TDIV />
        <BTN active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="목록">•</BTN>
        <BTN active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호">1.</BTN>
        <TDIV />
        {/* 사진 버튼 */}
        <button
          type="button"
          onClick={() => imageRef.current?.click()}
          style={{ padding: '0 8px', height: 26, borderRadius: 5, border: '0.5px solid rgba(123,94,167,0.3)', background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          📷 사진
        </button>
        {/* 영상 버튼 */}
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          style={{ padding: '0 8px', height: 26, borderRadius: 5, border: '0.5px solid rgba(255,180,0,0.3)', background: 'rgba(255,180,0,0.08)', color: 'rgba(255,180,0,0.8)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          🎥 영상
        </button>
        <TDIV />
        {/* 구분선 피커 */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => { if (divPickerRef.current) divPickerRef.current.style.display = divPickerRef.current.style.display === 'none' ? 'block' : 'none' }}
            style={{ padding: '0 8px', height: 26, borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer' }}
          >
            — 구분선
          </button>
          <div ref={divPickerRef} style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#1a1714', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 6, zIndex: 20, minWidth: 120, marginTop: 4 }}>
            {DIVIDERS.map(d => (
              <div key={d.label} onClick={() => { insertDivider(d.html); if (divPickerRef.current) divPickerRef.current.style.display = 'none' }}
                style={{ padding: '6px 10px', fontSize: 12, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
        <TDIV />
        <BTN onClick={() => editor.chain().focus().undo().run()} title="되돌리기">↩</BTN>
        <BTN onClick={() => editor.chain().focus().redo().run()} title="다시실행">↪</BTN>
      </div>
      {/* 에디터 본문 */}
      <div style={{ background: 'rgba(255,255,255,0.02)' }} onDragOver={handleDragOver} onDrop={(e) => void handleDrop(e)}>
        <EditorContent editor={editor} />
      </div>
      {/* 하단 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderTop: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{editor.storage.characterCount?.characters?.() || 0}자</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => navigator.clipboard.writeText(editor.getHTML())}
            style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>
            HTML 복사
          </button>
        </div>
      </div>
      {/* 숨긴 파일 input */}
      <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
        const f = e.target.files?.[0]; if (!f || !onImageUpload) return
        const url = await onImageUpload(f)
        editor.chain().focus().setImage({ src: url }).run()
        e.target.value = ''
      }} />
      <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={async e => {
        const f = e.target.files?.[0]; if (!f || !onVideoUpload) return
        const url = await onVideoUpload(f)
        editor.chain().focus().insertContent(`<video src="${url}" controls style="max-width:100%;border-radius:8px"></video>`).run()
        e.target.value = ''
      }} />
    </div>
  )
}
