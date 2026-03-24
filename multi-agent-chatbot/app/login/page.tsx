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

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed")
      }

      if (data.data.token) {
        setAuth(data.data.token, data.data.user)
      }

      router.push("/chat")
    } catch (err: any) {
      setError(err.message || "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-nw-primary/30"
      style={{ background: "#070e1e", color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* Header */}
      <header
        className="w-full sticky top-0 z-50"
        style={{ background: "#0c1323", boxShadow: "0 24px 40px rgba(77,142,255,0.06)" }}
      >
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
          <div className="text-xl font-bold tracking-tighter uppercase" style={{ color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}>
            Neural Workspace
          </div>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined p-2 rounded cursor-pointer transition-colors"
              style={{ color: "rgba(220,226,249,0.5)" }}
            >
              help
            </span>
            <span
              className="material-symbols-outlined p-2 rounded cursor-pointer transition-colors"
              style={{ color: "rgba(220,226,249,0.5)" }}
            >
              language
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient blobs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "25%", left: "25%",
            width: 384, height: 384,
            background: "rgba(173,198,255,0.05)",
            borderRadius: "50%",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "25%", right: "25%",
            width: 384, height: 384,
            background: "rgba(78,222,163,0.05)",
            borderRadius: "50%",
            filter: "blur(120px)",
          }}
        />

        {/* Card */}
        <div className="w-full max-w-md relative z-10">
          {/* Tactical accents */}
          <div className="flex justify-between items-end mb-2 px-1">
            <div
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "#adc6ff", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
            >
              System.Auth_Protocol_v4.2
            </div>
            <div className="h-px flex-1 mx-4 mb-1" style={{ background: "rgba(66,71,84,0.3)" }} />
            <div
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "#adc6ff", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
            >
              Secure_Node: 882-X
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden shadow-2xl"
            style={{
              backdropFilter: "blur(12px)",
              background: "rgba(50,57,75,0.6)",
              border: "1px solid rgba(66,71,84,0.2)",
            }}
          >
            {/* Biometric header */}
            <div
              className="p-8 pb-4 flex flex-col items-center"
              style={{ borderBottom: "1px solid rgba(66,71,84,0.1)" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 biometric-glow"
                style={{
                  background: "#2e3446",
                  border: "1px solid rgba(173,198,255,0.3)",
                }}
              >
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ color: "#adc6ff", fontVariationSettings: "'FILL' 1" }}
                >
                  fingerprint
                </span>
              </div>
              <h1
                className="font-bold text-2xl tracking-tight"
                style={{ color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}
              >
                Neural Access
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "rgba(194,198,214,0.7)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
              >
                IDENTITY VERIFICATION REQUIRED
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="p-8 space-y-6">
              {error && (
                <div
                  className="px-4 py-3 rounded-lg text-sm"
                  style={{
                    background: "rgba(147,0,10,0.2)",
                    border: "1px solid rgba(255,180,171,0.3)",
                    color: "#ffb4ab",
                    fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
                  }}
                >
                  ✗ {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label
                  className="block text-[10px] uppercase tracking-[0.1em] ml-1"
                  style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                >
                  Terminal Address
                </label>
                <div className="relative group">
                  <span
                    className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg transition-colors"
                    style={{ color: "#8c909f" }}
                  >
                    alternate_email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@neural.workspace"
                    required
                    className="w-full py-4 pl-12 pr-4 rounded-t-lg outline-none transition-all"
                    style={{
                      background: "#232a3b",
                      border: "none",
                      borderBottom: "2px solid transparent",
                      color: "#dce2f9",
                      fontFamily: "var(--font-inter), Inter, sans-serif",
                    }}
                    onFocus={(e) => { e.target.style.borderBottomColor = "#adc6ff" }}
                    onBlur={(e) => { e.target.style.borderBottomColor = "transparent" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label
                    className="block text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Encryption Key
                  </label>
                  <a
                    href="#"
                    className="text-[10px] uppercase tracking-[0.05em] transition-colors"
                    style={{ color: "#adc6ff", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="relative group">
                  <span
                    className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg"
                    style={{ color: "#8c909f" }}
                  >
                    lock
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full py-4 pl-12 pr-12 rounded-t-lg outline-none transition-all"
                    style={{
                      background: "#232a3b",
                      border: "none",
                      borderBottom: "2px solid transparent",
                      color: "#dce2f9",
                      fontFamily: "var(--font-inter), Inter, sans-serif",
                    }}
                    onFocus={(e) => { e.target.style.borderBottomColor = "#adc6ff" }}
                    onBlur={(e) => { e.target.style.borderBottomColor = "transparent" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center transition-colors"
                    style={{ color: "rgba(194,198,214,0.4)" }}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-lg font-bold text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
                style={{
                  background: "#00a572",
                  color: "#00311f",
                  fontFamily: "var(--font-inter), Inter, sans-serif",
                  boxShadow: isLoading ? "none" : "0 8px 30px rgba(0,165,114,0.2)",
                  textTransform: "uppercase",
                }}
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    AUTHENTICATE
                    <span className="material-symbols-outlined text-lg">security</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer link */}
            <div className="px-8 pb-8 text-center">
              <Link href="/signup" className="text-xs transition-colors group" style={{ color: "rgba(194,198,214,0.5)" }}>
                New to the Workspace?{" "}
                <span className="group-hover:underline underline-offset-4" style={{ color: "#adc6ff" }}>
                  Create an Account
                </span>
              </Link>
            </div>
          </div>

          {/* Decorative dots */}
          <div className="mt-4 flex justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#4edea3" }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#424754" }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#424754" }} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full"
        style={{ background: "#0c1323", borderTop: "1px solid rgba(220,226,249,0.15)" }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-6 gap-4 max-w-7xl mx-auto w-full">
          <span
            className="text-[10px] uppercase tracking-[0.05em]"
            style={{ color: "rgba(220,226,249,0.4)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
          >
            © 2024 Neural Workspace. Tactical Intelligence Systems.
          </span>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "Security Audit", "Support"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[10px] uppercase tracking-[0.05em] transition-colors hover:opacity-100"
                style={{
                  color: "rgba(220,226,249,0.4)",
                  fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
                }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
