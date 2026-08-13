'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const SKILLS = ['React', 'Node.js', 'System Design', 'SQL']
const PHASE_DURATIONS = [1600, 2600, 2000, 2000]
const LINE_WIDTHS = ['70%', '45%', '85%', '60%', '75%', '40%']

function ResumeSheet() {
  return (
    <div className="w-24 sm:w-28 shrink-0 h-full rounded-lg bg-surface-container-lowest border border-outline-variant/30 shadow-sm p-3 flex flex-col gap-2 relative overflow-hidden">
      <div className="w-8 h-8 rounded-full bg-surface-container shrink-0" />
      <div className="h-1.5 rounded-full bg-surface-container w-4/5" />
      <div className="h-1.5 rounded-full bg-surface-container w-1/2 mb-1" />
      {LINE_WIDTHS.map((w, i) => (
        <div key={i} className="h-1 rounded-full bg-surface-container-high" style={{ width: w }} />
      ))}
      <motion.div
        className="absolute left-0 right-0 h-8 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent-warn) 25%, transparent), transparent)' }}
        initial={{ top: '-20%' }}
        animate={{ top: ['-20%', '110%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

export function CVParseDemo() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % PHASE_DURATIONS.length), PHASE_DURATIONS[phase])
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="w-full h-full min-h-56 flex items-stretch gap-4 px-2">
      <ResumeSheet />

      <div className="flex-1 flex flex-col justify-center relative overflow-hidden min-w-0">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-outline-variant/40 border-t-primary animate-spin" />
              <div className="tag"><span className="tag-dot" />Parsing your resume...</div>
              <p className="text-xs text-on-surface-variant">Extracting roles, tools, and years of experience.</p>
            </motion.div>
          )}

          {phase === 1 && (
            <motion.div key="skills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 w-full">
              <div className="tag"><span className="tag-dot" />Skills detected</div>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((s, i) => (
                  <motion.span
                    key={s}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.18 }}
                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface"
                  >
                    {s}
                  </motion.span>
                ))}
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: SKILLS.length * 0.18 }}
                  className="text-xs font-medium px-2.5 py-1 rounded-full text-on-surface-variant"
                >
                  +3 more
                </motion.span>
              </div>
              <p className="text-xs text-on-surface-variant">7 skills matched against your target role.</p>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div key="gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <div className="tag"><span className="tag-dot" />Gap analysis</div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 w-fit">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg">warning</span>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Gap flagged: <span className="font-mono">Kubernetes</span></span>
              </div>
              <p className="text-xs text-on-surface-variant">Shows up in 4 of 5 postings for this role.</p>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div key="strength" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <div className="tag"><span className="tag-dot" />Standout strength</div>
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-fit"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-accent-warn) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-accent-warn) 30%, transparent)',
                }}
              >
                <span className="material-symbols-outlined text-lg" style={{ color: 'var(--color-accent-warn)' }}>military_tech</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-accent-warn)' }}>Strength: <span className="font-mono">System Design</span></span>
              </div>
              <p className="text-xs text-on-surface-variant">We&apos;ll lean into this during your mock interview.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
