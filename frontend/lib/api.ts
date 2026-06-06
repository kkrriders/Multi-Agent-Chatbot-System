import { API_URL } from './config'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CandidateProfile {
  id: string
  name: string | null
  skills: string[]
  experience: Array<{ company: string; role: string; duration: string; description: string }>
  education: Array<{ institution: string; degree: string; field: string; year: string }>
  parsedAt: string
}

export type QuestionFormat = 'text' | 'coding' | 'system_design'
export type QuestionSubtype = 'blank' | 'fix' | 'improve' | null

export interface Question {
  id: string
  text: string
  category: 'technical' | 'behavioral' | 'situational' | 'intro' | 'closing' | 'system_design' | 'coding' | 'cs_fundamentals'
  difficulty: 'easy' | 'medium' | 'hard'
  timeLimitSeconds: number | null
  interviewerName?: 'Alex' | 'Priya' | 'James' | null
  role?: string
  expectedKeywords?: string[]
  followUpQuestions?: string[]
  active?: boolean
  // Format-specific fields
  questionFormat?: QuestionFormat
  subtype?: QuestionSubtype
  templateDiagram?: string | null   // React Flow JSON for fix/improve subtypes
  starterCode?: string | null
  constraints?: string | null
  evaluationRubric?: string[]
}

export interface PanelPersonaFeedback {
  score: number
  strengths: string[]
  gaps: string[]
  summary: string
}

export interface Interview {
  _id: string
  mode: 'practice' | 'timed' | 'full' | 'panel'
  status: 'pending' | 'active' | 'completed' | 'abandoned'
  targetRole: string
  overallScore?: number
  categoryScores?: Record<string, { overall: number }>
  panelFeedback?: { alex: PanelPersonaFeedback; priya: PanelPersonaFeedback; james: PanelPersonaFeedback }
  durationSeconds?: number
  completedAt?: string
  createdAt: string
}

export interface IntegritySignals {
  pasteCount: number
  pastedChars: number
  typedChars: number
  tabSwitchCount: number
  tabSwitchSeconds: number
  timeToFirstKeystroke: number | null
}

export interface Answer {
  _id: string
  questionId: { _id: string; text: string; category: string; difficulty: string } | string
  text: string
  scores: { relevance: number; depth: number; clarity: number; overall: number }
  inputMethod?: 'text' | 'voice'
  scored: boolean
  improvementSuggestions: string[]
  keywordsHit: string[]
  keywordsMissed: string[]
  speechMetrics?: {
    fillerWordCount: number
    fillerWords: string[]
    wordsPerMinute: number | null
    pronunciationScore: number
    paceLabel: string | null
  } | null
  integrityScore?: number | null
  integrityFlag?: 'CLEAN' | 'SUSPICIOUS' | 'LIKELY_AI' | null
}

export interface Achievement {
  _id: string
  type: string
  awardedAt: string
  badge: { label: string; description: string }
  metadata?: Record<string, unknown>
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Origin: typeof window !== 'undefined' ? window.location.origin : '',
      ...(init.headers ?? {}),
    },
    ...init,
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

function get<T>(path: string) { return request<T>(path, { method: 'GET' }) }
function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}
function put<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}
function del<T>(path: string) { return request<T>(path, { method: 'DELETE' }) }

// ── Speech ───────────────────────────────────────────────────────────────────

export const speech = {
  transcribe: async (blob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    const res = await fetch(`${API_URL}/api/speech/transcribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { Origin: typeof window !== 'undefined' ? window.location.origin : '' },
      body: formData,
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`)
    return data.text as string
  },
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    post<{ user: { id: string; email: string } }>('/api/auth/login', { email, password }),
  signup: (email: string, password: string) =>
    post<{ user: { id: string; email: string } }>('/api/auth/signup', { email, password }),
  logout: () => post('/api/auth/logout', {}),
}

// ── CV ───────────────────────────────────────────────────────────────────────

export const cv = {
  upload: async (file: File): Promise<{ profile: CandidateProfile }> => {
    const form = new FormData()
    form.append('cv', file)
    const res = await fetch(`${API_URL}/api/cv/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { Origin: typeof window !== 'undefined' ? window.location.origin : '' },
      body: form,
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data
  },
  profile: () => get<{ profile: CandidateProfile }>('/api/cv/profile'),
  analyzeGap: (jobDescription: string) =>
    post<{ missingSkills: string[]; matchedSkills: string[]; fitScore: number | null }>(
      '/api/cv/analyze-gap', { jobDescription }
    ),
}

// ── Interview ────────────────────────────────────────────────────────────────

export const interview = {
  start: (mode: string, targetRole?: string, jobDescription?: string, companyName?: string) =>
    post<{ sessionId: string; interview: Interview; questions: Question[] }>(
      '/api/interview/start', { mode, targetRole, jobDescription, companyName }
    ),
  state: (sessionId: string) =>
    get<{ interview: Interview; questions: Question[]; answers: Answer[]; nextQuestion: Question | null }>(
      `/api/interview/${sessionId}`
    ),
  submitAnswer: (sessionId: string, payload: {
    questionId: string; questionIndex: number; answerText?: string;
    inputMethod?: string; timeSpentSeconds?: number; speechDurationSeconds?: number
    integritySignals?: IntegritySignals
    diagramSnapshot?: string | null
    code?: string | null
    language?: string | null
  }) => post<{ answerId: string; speechMetrics: unknown }>(`/api/interview/${sessionId}/answer`, payload),
  complete: (sessionId: string) =>
    post<{ interview: Interview; overallScore: number; categoryScores: Record<string, { overall: number }> }>(
      `/api/interview/${sessionId}/complete`, {}
    ),
  summary: (sessionId: string) =>
    get<{ interview: Interview; answers: Answer[]; progress: unknown }>(`/api/interview/${sessionId}/summary`),
  history: () => get<{ sessions: Interview[] }>('/api/interview/history'),
}

// ── Progress ─────────────────────────────────────────────────────────────────

export const progress = {
  summary: () =>
    get<{ summary: { weakAreas: string[]; strongAreas: string[]; cvGaps: string[]; avgTechnical: number | null; totalObservations: number } }>(
      '/api/progress/summary'
    ),
  timeline: () => get<{ timeline: Array<{ interviewId: string; observations: unknown[] }> }>('/api/progress/timeline'),
  trend: (concept: string) =>
    get<{ concept: string; trend: Array<{ date: string; score: number; interviewId: string }> }>(
      `/api/progress/trend/${encodeURIComponent(concept)}`
    ),
  streak: () => get<{ streak: number }>('/api/progress/streak'),
  achievements: () => get<{ achievements: Achievement[] }>('/api/progress/achievements'),
  leaderboard: () => get<{ leaderboard: Interview[] }>('/api/progress/leaderboard'),
}

// ── Questions ────────────────────────────────────────────────────────────────

export const questions = {
  list: (params?: { role?: string; category?: string; difficulty?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.role) qs.set('role', params.role)
    if (params?.category) qs.set('category', params.category)
    if (params?.difficulty) qs.set('difficulty', params.difficulty)
    if (params?.limit) qs.set('limit', String(params.limit))
    return get<{ questions: Question[]; total: number }>(`/api/questions?${qs}`)
  },
  create: (q: Partial<Question> & { text: string; category: string }) =>
    post<{ question: Question }>('/api/questions', q),
  update: (id: string, q: Partial<Question>) => put<{ question: Question }>(`/api/questions/${id}`, q),
  deactivate: (id: string) => del(`/api/questions/${id}`),
  fromJd: (jobDescription: string, targetRole?: string, mode?: string) =>
    post<{ questions: Question[] }>('/api/questions/from-jd', { jobDescription, targetRole, mode }),
}
