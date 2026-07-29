import type { IntegritySignals } from './api'

// Turns the raw behavioral signals into plain-language lines — shown wherever
// an integrity flag is displayed, so a flag is never just a bare number.
export function describeIntegritySignals(signals: IntegritySignals | null | undefined): string[] {
  if (!signals) return []
  const lines: string[] = []

  const total = signals.pastedChars + signals.typedChars
  if (signals.pastedChars > 0 && total > 0) {
    const pct = Math.round((signals.pastedChars / total) * 100)
    lines.push(`${pct}% of this answer was pasted`)
  }
  if (signals.tabSwitchCount > 0) {
    const secs = signals.tabSwitchSeconds ? ` (${signals.tabSwitchSeconds}s total)` : ''
    lines.push(`Switched away from the tab ${signals.tabSwitchCount} time${signals.tabSwitchCount === 1 ? '' : 's'}${secs}`)
  }
  if (signals.focusLossCount > 0) {
    const secs = signals.focusLossSeconds ? ` (${signals.focusLossSeconds}s total)` : ''
    lines.push(`Lost window focus ${signals.focusLossCount} time${signals.focusLossCount === 1 ? '' : 's'}${secs} — possibly another window`)
  }

  return lines
}
