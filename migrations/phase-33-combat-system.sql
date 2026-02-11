-- Phase 33: Turn-Based Combat System - Schema Migration
-- Run this script on your Neon database

-- ==============================
-- 1. Update users table with combat stats
-- ==============================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mana INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS max_mana INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS crit_rate INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS crit_damage INTEGER DEFAULT 150,
ADD COLUMN IF NOT EXISTS dodge_rate INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS element TEXT;

-- ==============================
-- 2. Update beasts table with combat stats
-- ==============================
ALTER TABLE beasts
ADD COLUMN IF NOT EXISTS mana INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS max_mana INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS crit_rate INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS dodge_rate INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS element TEXT,
ADD COLUMN IF NOT EXISTS ai_pattern TEXT DEFAULT 'balanced';

-- ==============================
-- 3. Create skills table
-- ==============================
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT NOT NULL CHECK (tier IN ('pham', 'huyen', 'dia', 'thien', 'than')),
    element TEXT NOT NULL CHECK (element IN ('fire', 'water', 'earth', 'wind', 'lightning', 'ice', 'dark', 'light', 'neutral')),
    mana_cost INTEGER NOT NULL,
    cooldown INTEGER DEFAULT 0,
    damage_multiplier INTEGER NOT NULL,
    effects TEXT,
    animation TEXT,
    cultivation_req INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- 4. Create user_skills table  
-- ==============================
CREATE TABLE IF NOT EXISTS user_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id),
    level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 10),
    times_used INTEGER DEFAULT 0,
    equipped_slot INTEGER CHECK (equipped_slot >= 1 AND equipped_slot <= 4),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_skill_idx ON user_skills(user_id, skill_id);

-- ==============================
-- 5. Create skill_books table
-- ==============================
CREATE TABLE IF NOT EXISTS skill_books (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES skills(id),
    name TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('pham', 'huyen', 'dia', 'thien', 'than')),
    icon TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- 6. Create combat_sessions table
-- ==============================
CREATE TABLE IF NOT EXISTS combat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enemy_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'victory', 'defeat', 'fled')),
    turn INTEGER DEFAULT 1,
    
    player_hp INTEGER NOT NULL,
    player_mana INTEGER NOT NULL,
    player_buffs TEXT,
    player_cooldowns TEXT,
    
    enemy_hp INTEGER NOT NULL,
    enemy_mana INTEGER NOT NULL,
    enemy_buffs TEXT,
    enemy_cooldowns TEXT,
    
    combat_log TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS combat_user_idx ON combat_sessions(user_id);
CREATE INDEX IF NOT EXISTS combat_state_idx ON combat_sessions(state);

-- ==============================
-- 7. Create enemy_skills table
-- ==============================
CREATE TABLE IF NOT EXISTS enemy_skills (
    id SERIAL PRIMARY KEY,
    enemy_id TEXT NOT NULL,
    skill_id TEXT NOT NULL REFERENCES skills(id),
    usage_rate INTEGER NOT NULL CHECK (usage_rate >= 0 AND usage_rate <= 100),
    min_turn INTEGER DEFAULT 1,
    UNIQUE(enemy_id, skill_id)
);

CREATE INDEX IF NOT EXISTS enemy_skill_idx ON enemy_skills(enemy_id);

-- ==============================
-- 8. Clean up old combat sessions (optional, for production)
-- ==============================
-- Delete abandoned combat sessions older than 1 hour
-- DELETE FROM combat_sessions WHERE state = 'active' AND created_at < NOW() - INTERVAL '1 hour';

-- ==============================
-- Migration Complete
-- ==============================
-- Next steps:
-- 1. Run seed-combat-data.sql to populate initial skills and skill books
-- 2. Update existing beasts with element types and AI patterns
-- 3. Deploy backend combat controllers
