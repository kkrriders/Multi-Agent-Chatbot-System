"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { setAuth } from "@/lib/auth"
import { API_URL } from "@/lib/config"

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (formData.password !== formData.confirmPassword) { setError("Access keys do not match"); return }
    if (!agreedToTerms) { setError("You must confirm compliance with Security Protocols"); return }
    if (formData.password.length < 8) { setError("Access key must be at least 8 characters"); return }
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName: formData.name, email: formData.email, password: formData.password, confirmPassword: formData.confirmPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Initialization failed")
      if (data.data?.user) setAuth('', data.data.user)
      router.push("/chat")
    } catch (err: any) {
      setError(err.message || "Initialization failed")
    } finally {
      setIsLoading(false)
    }
  }

  const update = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }))

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(78,222,163,0.5)"
    e.target.style.boxShadow = "0 0 0 1px rgba(78,222,163,0.1)"
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(66,71,84,0.3)"
    e.target.style.boxShadow = "none"
  }

  const pwStrength = formData.password.length === 0 ? 0 : formData.password.length < 8 ? 1 : formData.password.length < 12 ? 3 : 4
  const pwLabel = ["—", "Weak", "Weak", "Moderate", "Tactical"][pwStrength]

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0c1323", color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(66,71,84,0.1)" }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tighter" style={{ color: "#dce2f9" }}>
          <span className="material-symbols-outlined text-base" style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>deployed_code</span>
          Neural Workspace
        </Link>
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(194,198,214,0.4)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
          Initialization Protocol
        </span>
      </div>

      <main className="flex-grow flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute" style={{ inset: 0, opacity: 0.02, backgroundImage: "radial-gradient(#4edea3 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="absolute" style={{ top: "-20%", right: "-10%", width: "55%", height: "55%", background: "rgba(173,198,255,0.07)", filter: "blur(130px)", borderRadius: "50%" }} />
          <div className="absolute" style={{ bottom: "-20%", left: "-10%", width: "55%", height: "55%", background: "rgba(78,222,163,0.07)", filter: "blur(130px)", borderRadius: "50%" }} />
        </div>

        {/* Two-column card */}
        <div
          className="w-full max-w-[920px] grid md:grid-cols-2 rounded-xl overflow-hidden shadow-2xl relative z-10"
          style={{ backdropFilter: "blur(20px)", background: "rgba(20,27,44,0.85)", border: "1px solid rgba(66,71,84,0.2)" }}
        >
          {/* Left branding panel */}
          <div
            className="hidden md:flex flex-col justify-between p-8 relative overflow-hidden"
            style={{ background: "rgba(9,19,40,0.5)", borderRight: "1px solid rgba(66,71,84,0.1)" }}
          >
            <div className="scanline" />
            <div className="relative z-10">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(78,222,163,0.15)", border: "1px solid rgba(78,222,163,0.25)" }}>
                  <span className="material-symbols-outlined" style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1", fontSize: "20px" }}>deployed_code</span>
                </div>
                <div>
                  <h1 className="text-base font-black tracking-tighter uppercase leading-none" style={{ color: "#dce2f9" }}>Neural</h1>
                  <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: "rgba(78,222,163,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Workspace</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.15)" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4edea3" }} />
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}>System Ready: Protocol 01-A</span>
                </div>

                <h2 className="text-2xl font-extrabold leading-tight tracking-tight" style={{ color: "#dce2f9" }}>
                  Orchestrate your next <br />
                  high-performance <br />
                  <span style={{ color: "#4edea3" }}>intelligence workflow.</span>
                </h2>

                <p className="text-xs leading-relaxed max-w-xs" style={{ color: "#c2c6d6" }}>
                  Join the high-density ecosystem designed for orchestrating complex agentic workflows and neural automation.
                </p>
              </div>
            </div>

            {/* Bottom card */}
            <div className="relative z-10 mt-auto">
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: "rgba(35,42,59,0.8)", border: "1px solid rgba(66,71,84,0.1)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#232a3b", border: "1px solid rgba(66,71,84,0.3)" }}>
                  <span className="material-symbols-outlined" style={{ color: "#4edea3", fontSize: "20px" }}>person_pin</span>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Initialization Phase</p>
                  <p className="text-xs font-bold" style={{ color: "#dce2f9" }}>Registration Authority</p>
                  <p className="text-[9px]" style={{ color: "#c2c6d6", fontFamily: "var(--font-jetbrains-mono), monospace" }}>ID: 0x82...FC21</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="p-7 md:p-9 flex flex-col justify-center" style={{ background: "rgba(20,27,44,0.3)" }}>
            <div className="max-w-sm mx-auto w-full space-y-5">
              <div>
                <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "#dce2f9" }}>
                  Initialize Account
                  <span className="material-symbols-outlined text-base" style={{ color: "#4edea3" }}>verified</span>
                </h3>
                <p className="text-xs" style={{ color: "#c2c6d6" }}>Create your secure credentials to access the command center.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3.5">
                {error && (
                  <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "rgba(147,0,10,0.2)", border: "1px solid rgba(255,180,171,0.25)", color: "#ffb4ab", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    ✗ {error}
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest ml-0.5" style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Identity Tag</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(194,198,214,0.35)", fontSize: "16px" }}>person</span>
                    <input
                      type="text" value={formData.name} onChange={(e) => update("name", e.target.value)}
                      placeholder="Full Name" required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm transition-all"
                      style={{ background: "rgba(35,42,59,0.6)", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest ml-0.5" style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Intelligence Endpoint</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(194,198,214,0.35)", fontSize: "16px" }}>alternate_email</span>
                    <input
                      type="email" value={formData.email} onChange={(e) => update("email", e.target.value)}
                      placeholder="you@neural.workspace" required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm transition-all"
                      style={{ background: "rgba(35,42,59,0.6)", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest ml-0.5" style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Access Key</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(194,198,214,0.35)", fontSize: "16px" }}>lock</span>
                    <input
                      type="password" value={formData.password} onChange={(e) => update("password", e.target.value)}
                      placeholder="••••••••••••" required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm transition-all"
                      style={{ background: "rgba(35,42,59,0.6)", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                  {/* Strength bar */}
                  <div className="flex items-center gap-2 px-0.5">
                    <div className="flex gap-1 flex-1 h-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex-1 rounded-full transition-all" style={{ background: i < pwStrength ? (pwStrength === 1 ? "#ff8a65" : "#4edea3") : "#2e3446" }} />
                      ))}
                    </div>
                    <span className="text-[9px] font-mono whitespace-nowrap" style={{ color: pwStrength === 1 ? "#ff8a65" : "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                      {pwLabel}
                    </span>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest ml-0.5" style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Verify Access Key</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(194,198,214,0.35)", fontSize: "16px" }}>security</span>
                    <input
                      type="password" value={formData.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="••••••••••••" required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm transition-all"
                      style={{ background: "rgba(35,42,59,0.6)", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-2.5 py-0.5">
                  <input
                    type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-3.5 h-3.5 rounded cursor-pointer mt-0.5 flex-shrink-0"
                    style={{ accentColor: "#4edea3" }}
                  />
                  <label htmlFor="terms" className="text-[10px] leading-relaxed cursor-pointer select-none" style={{ color: "#c2c6d6" }}>
                    I confirm strict compliance with the{" "}
                    <a href="#" className="underline underline-offset-2" style={{ color: "#4edea3", textDecorationColor: "rgba(78,222,163,0.3)" }}>Security Protocols</a>
                    {" "}and{" "}
                    <a href="#" className="underline underline-offset-2" style={{ color: "#4edea3", textDecorationColor: "rgba(78,222,163,0.3)" }}>Engagement Terms</a>.
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={isLoading}
                  className="w-full py-3 rounded-lg font-bold text-xs tracking-widest uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: "#4edea3", color: "#003824", boxShadow: "0 4px 20px rgba(78,222,163,0.15)", fontWeight: 900 }}
                >
                  {isLoading ? (
                    <><span className="material-symbols-outlined text-base animate-spin">autorenew</span>INITIALIZING...</>
                  ) : (
                    <><span className="material-symbols-outlined text-base">terminal</span>Create Account</>
                  )}
                </button>

                <p className="text-center text-xs" style={{ color: "#c2c6d6" }}>
                  Already authorized?{" "}
                  <Link href="/login" className="font-bold hover:underline underline-offset-4" style={{ color: "#4edea3" }}>Initiate Login</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid rgba(66,71,84,0.08)" }}>
        <div className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full" style={{ background: "#4edea3" }} />
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(194,198,214,0.35)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
            Node Status: <span style={{ color: "rgba(78,222,163,0.6)" }}>Optimal</span>
          </span>
        </div>
        <div className="flex gap-5">
          {["Privacy", "Terms", "Security"].map((item) => (
            <a key={item} href="#" className="text-[9px] uppercase tracking-widest transition-colors hover:text-[#adc6ff]" style={{ color: "rgba(220,226,249,0.25)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{item}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
