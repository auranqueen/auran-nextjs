-- Migration 215: user_role enum에 'curator' 추가
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'curator';
