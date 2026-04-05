"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { setAuth } from "@/lib/auth"
import { API_URL } from "@/lib/config"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Authentication failed")
      if (data.data?.user) setAuth('', data.data.user)
      router.push("/chat")
    } catch (err: any) {
      setError(err.message || "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(173,198,255,0.5)"
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(66,71,84,0.3)"
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#070e1e", color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(66,71,84,0.1)" }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tighter" style={{ color: "#dce2f9" }}>
          <span className="material-symbols-outlined text-base" style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>deployed_code</span>
          Neural Workspace
        </Link>
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(194,198,214,0.4)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
          Auth Protocol v3.1
        </span>
      </div>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute pointer-events-none" style={{ top: "20%", left: "20%", width: 320, height: 320, background: "rgba(173,198,255,0.04)", borderRadius: "50%", filter: "blur(100px)" }} />
        <div className="absolute pointer-events-none" style={{ bottom: "20%", right: "20%", width: 320, height: 320, background: "rgba(78,222,163,0.04)", borderRadius: "50%", filter: "blur(100px)" }} />

        <div className="w-full max-w-[380px] relative z-10">
          {/* Tactical accent line */}
          <div className="flex items-center gap-3 mb-3 px-0.5">
            <span className="text-[9px] uppercase tracking-widest font-mono whitespace-nowrap" style={{ color: "#adc6ff", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Auth_Protocol</span>
            <div className="flex-1 h-px" style={{ background: "rgba(66,71,84,0.3)" }} />
            <span className="text-[9px] uppercase tracking-widest font-mono whitespace-nowrap" style={{ color: "#adc6ff", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Node: 882-X</span>
          </div>

          {/* Card */}
          <div className="rounded-xl overflow-hidden shadow-2xl" style={{ background: "rgba(20,27,44,0.9)", border: "1px solid rgba(66,71,84,0.2)", backdropFilter: "blur(16px)" }}>

            {/* Card header */}
            <div className="px-6 pt-6 pb-5 flex flex-col items-center" style={{ borderBottom: "1px solid rgba(66,71,84,0.1)" }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: "#1e2840", border: "1px solid rgba(173,198,255,0.25)", boxShadow: "0 0 20px rgba(77,142,255,0.2)" }}>
                <span className="material-symbols-outlined" style={{ color: "#adc6ff", fontVariationSettings: "'FILL' 1", fontSize: "22px" }}>fingerprint</span>
              </div>
              <h1 className="font-bold text-lg tracking-tight" style={{ color: "#dce2f9" }}>Neural Access</h1>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(194,198,214,0.5)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                IDENTITY VERIFICATION REQUIRED
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "rgba(147,0,10,0.2)", border: "1px solid rgba(255,180,171,0.25)", color: "#ffb4ab", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                  ✗ {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[9px] uppercase tracking-widest ml-0.5" style={{ color: "rgba(194,198,214,0.5)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                  Terminal Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8c909f", fontSize: "16px" }}>alternate_email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@neural.workspace"
                    required
                    className="w-full py-2.5 pl-9 pr-3 rounded-lg outline-none text-sm transition-all"
                    style={{ background: "#232a3b", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-0.5">
                  <label className="block text-[9px] uppercase tracking-widest" style={{ color: "rgba(194,198,214,0.5)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    Encryption Key
                  </label>
                  <a href="#" className="text-[9px] uppercase tracking-widest transition-colors hover:text-[#adc6ff]" style={{ color: "rgba(173,198,255,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8c909f", fontSize: "16px" }}>lock</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full py-2.5 pl-9 pr-9 rounded-lg outline-none text-sm transition-all"
                    style={{ background: "#232a3b", border: "1px solid rgba(66,71,84,0.3)", color: "#dce2f9" }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "rgba(194,198,214,0.35)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg font-bold text-xs tracking-widest uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "#00a572", color: "#00311f", boxShadow: isLoading ? "none" : "0 4px 20px rgba(0,165,114,0.2)", marginTop: "8px" }}
              >
                {isLoading ? (
                  <><span className="material-symbols-outlined text-base animate-spin">autorenew</span>AUTHENTICATING...</>
                ) : (
                  <><span className="material-symbols-outlined text-base">security</span>AUTHENTICATE</>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div className="px-6 pb-5 text-center">
              <Link href="/signup" className="text-xs group" style={{ color: "rgba(194,198,214,0.4)" }}>
                New to the Workspace?{" "}
                <span className="group-hover:underline underline-offset-4" style={{ color: "#adc6ff" }}>Create an Account</span>
              </Link>
            </div>
          </div>

          {/* Status dots */}
          <div className="mt-3 flex justify-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#4edea3" }} />
            <div className="w-1 h-1 rounded-full" style={{ background: "#424754" }} />
            <div className="w-1 h-1 rounded-full" style={{ background: "#424754" }} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid rgba(66,71,84,0.08)" }}>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(220,226,249,0.25)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>© 2025 Neural Workspace</span>
        <div className="flex gap-5">
          {["Privacy", "Terms", "Security"].map((item) => (
            <a key={item} href="#" className="text-[9px] uppercase tracking-widest transition-colors hover:text-[#adc6ff]" style={{ color: "rgba(220,226,249,0.25)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{item}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
