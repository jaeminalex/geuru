-- Supabase SQL Schema for 'Geuru' 
-- Run this in the Supabase SQL Editor

-- 1. Profiles 테이블 생성
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tasks 테이블 생성 (일일 계획 & 대시보드 할일)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'dashboard', 'daily', 'dashboard_note'
    task_date DATE DEFAULT CURRENT_DATE, -- 날짜 연동
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'normal', -- 'urgent', 'normal', 'relaxed'
    completed BOOLEAN DEFAULT false,
    start_time TEXT, -- HH:MM format
    end_time TEXT,   -- HH:MM format
    subtasks JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Weekly Goals 테이블 생성 (주간 로드맵)
CREATE TABLE IF NOT EXISTS weekly_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'normal', -- 'urgent', 'normal', 'relaxed'
    completed BOOLEAN DEFAULT false,
    subtasks JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Monthly Notes 테이블 생성 (월간 캘린더 개별 메모)
CREATE TABLE IF NOT EXISTS monthly_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    note_date DATE NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Reflections 테이블 생성 (일기/회고)
CREATE TABLE IF NOT EXISTS reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    emotion_index INTEGER, -- 0: 즐거움, 1: 평온, 2: 피곤, 3: 우울, 4: 화남
    q1 TEXT,
    q2 TEXT,
    q3 TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- RLS (Row Level Security) 설정
-- ==========================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Weekly Goals
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own weekly goals" ON weekly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly goals" ON weekly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly goals" ON weekly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly goals" ON weekly_goals FOR DELETE USING (auth.uid() = user_id);

-- Monthly Notes
ALTER TABLE monthly_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own monthly notes" ON monthly_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly notes" ON monthly_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly notes" ON monthly_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly notes" ON monthly_notes FOR DELETE USING (auth.uid() = user_id);

-- Reflections
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reflections" ON reflections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reflections" ON reflections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reflections" ON reflections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reflections" ON reflections FOR DELETE USING (auth.uid() = user_id);
