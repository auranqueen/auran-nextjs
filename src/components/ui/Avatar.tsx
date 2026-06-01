'use client';
import { useState } from 'react';
interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
}
export default function Avatar({ url, name, size = 40 }: AvatarProps) {
  const [error, setError] = useState(false);
  const initial = (name?.trim()?.charAt(0) ?? '').toUpperCase();
  const showImg = !!url && !error;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #7B5EA7, #C9A96E)',
        color: '#FAF6F0',
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {showImg ? (
        <img
          src={url as string}
          alt=""
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{initial || '·'}</span>
      )}
    </div>
  );
}
