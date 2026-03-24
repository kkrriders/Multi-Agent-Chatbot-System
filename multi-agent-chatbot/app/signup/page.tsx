"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { setAuth } from "@/lib/auth"
import { API_URL } from "@/lib/config"

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Access keys do not match")
      return
    }
    if (!agreedToTerms) {
      setError("You must confirm compliance with Security Protocols")
      return
    }
    if (formData.password.length < 6) {
      setError("Access key must be at least 6 characters")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Initialization failed")
      }

      if (data.data.token) {
        setAuth(data.data.token, data.data.user)
      }

      router.push("/chat")
    } catch (err: any) {
      setError(err.message || "Initialization failed")
    } finally {
      setIsLoading(false)
    }
  }

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const inputClass =
    "w-full py-3.5 pl-12 pr-4 rounded-xl outline-none transition-all"
  const inputStyle = {
    background: "rgba(35,42,59,0.5)",
    border: "1px solid rgba(66,71,84,0.3)",
    color: "#dce2f9",
    fontFamily: "var(--font-inter), Inter, sans-serif",
  }
  const onFocusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#4edea3"
    e.target.style.boxShadow = "0 0 0 1px rgba(78,222,163,0.2)"
  }
  const onBlurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(66,71,84,0.3)"
    e.target.style.boxShadow = "none"
  }

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-nw-primary/30"
      style={{ background: "#0c1323", color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      <main className="flex-grow flex items-center justify-center p-4 md:p-12 relative">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute"
            style={{
              inset: 0,
              opacity: 0.03,
              backgroundImage: "radial-gradient(#4edea3 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            className="absolute"
            style={{ top: "-20%", right: "-10%", width: "60%", height: "60%", background: "rgba(173,198,255,0.1)", filter: "blur(150px)", borderRadius: "50%" }}
          />
          <div
            className="absolute"
            style={{ bottom: "-20%", left: "-10%", width: "60%", height: "60%", background: "rgba(78,222,163,0.1)", filter: "blur(150px)", borderRadius: "50%" }}
          />
        </div>

        {/* Two-column card */}
        <div
          className="w-full max-w-[1100px] grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl relative z-10"
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(24,31,48,0.7)",
            border: "1px solid rgba(66,71,84,0.2)",
          }}
        >
          {/* Left branding panel */}
          <div
            className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
            style={{ background: "rgba(9,19,40,0.5)", borderRight: "1px solid rgba(66,71,84,0.1)" }}
          >
            <div className="scanline" />

            <div className="relative z-10">
              {/* Logo */}
              <div className="flex items-center gap-4 mb-16">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(78,222,163,0.2)", border: "1px solid rgba(78,222,163,0.3)" }}
                >
                  <span
                    className="material-symbols-outlined text-3xl"
                    style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}
                  >
                    deployed_code
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: "#dce2f9" }}>
                    Neural
                  </h1>
                  <p
                    className="text-[10px] uppercase tracking-[0.4em]"
                    style={{ color: "rgba(78,222,163,0.7)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Workspace
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{ background: "rgba(78,222,163,0.1)", border: "1px solid rgba(78,222,163,0.2)" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-nw-green animate-pulse" style={{ background: "#4edea3" }} />
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    System Ready: Protocol 01-A
                  </span>
                </div>

                <h2 className="text-5xl font-extrabold leading-[1.1] tracking-tight" style={{ color: "#dce2f9" }}>
                  Deploy your next <br />
                  high-performance <br />
                  <span style={{ color: "#4edea3" }}>intelligence node.</span>
                </h2>

                <p className="text-lg leading-relaxed max-w-sm" style={{ color: "#c2c6d6" }}>
                  Join the high-density ecosystem designed for orchestrating complex agentic workflows and neural automation.
                </p>
              </div>
            </div>

            {/* Bottom card */}
            <div className="relative z-10 mt-auto">
              <div
                className="flex items-center gap-4 p-5 rounded-xl"
                style={{
                  background: "rgba(35,42,59,0.8)",
                  border: "1px solid rgba(66,71,84,0.1)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ background: "#232a3b", border: "1px solid rgba(66,71,84,0.3)" }}
                >
                  <span className="material-symbols-outlined text-3xl" style={{ color: "#4edea3" }}>
                    person_pin
                  </span>
                </div>
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Initialization Phase
                  </p>
                  <p className="text-sm font-bold" style={{ color: "#dce2f9" }}>
                    Registration Authority
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "#c2c6d6", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    ID: 0x82...FC21
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="p-8 md:p-16 flex flex-col justify-center" style={{ background: "rgba(20,27,44,0.3)" }}>
            <div className="max-w-md mx-auto w-full space-y-8">
              <div>
                <h3 className="text-3xl font-bold mb-3 flex items-center gap-3" style={{ color: "#dce2f9" }}>
                  Initialize Account
                  <span className="material-symbols-outlined" style={{ color: "#4edea3" }}>
                    verified
                  </span>
                </h3>
                <p className="text-sm font-medium" style={{ color: "#c2c6d6" }}>
                  Create your secure credentials to access the command center.
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-6">
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

                {/* Full Name */}
                <div className="space-y-2">
                  <label
                    className="block text-[10px] uppercase tracking-[0.2em] ml-1"
                    style={{ color: "rgba(194,198,214,0.8)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Identity Tag (Full Name)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "rgba(194,198,214,0.4)" }}>
                      person
                    </span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="ERIK LARSSON"
                      required
                      className={inputClass}
                      style={{ ...inputStyle, textTransform: "uppercase" } as React.CSSProperties}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label
                    className="block text-[10px] uppercase tracking-[0.2em] ml-1"
                    style={{ color: "rgba(194,198,214,0.8)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Intelligence Endpoint (Email)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "rgba(194,198,214,0.4)" }}>
                      alternate_email
                    </span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="ARCHITECT@NEURAL.WORKSPACE"
                      required
                      className={inputClass}
                      style={{ ...inputStyle, textTransform: "uppercase" } as React.CSSProperties}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label
                    className="block text-[10px] uppercase tracking-[0.2em] ml-1"
                    style={{ color: "rgba(194,198,214,0.8)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Access Key (Password)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "rgba(194,198,214,0.4)" }}>
                      lock
                    </span>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className={inputClass}
                      style={inputStyle as React.CSSProperties}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                  </div>
                  {/* Password strength */}
                  <div className="mt-2 px-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                      >
                        Security Grade: {formData.password.length === 0 ? "—" : formData.password.length < 8 ? "Weak" : formData.password.length < 12 ? "Moderate" : "Tactical"}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "#c2c6d6", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                      >
                        {formData.password.length === 0 ? "0%" : formData.password.length < 8 ? "33%" : formData.password.length < 12 ? "66%" : "100%"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 h-1.5 w-full">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full transition-all"
                          style={{
                            background: formData.password.length === 0
                              ? "#2e3446"
                              : formData.password.length < 8
                              ? (i < 1 ? "#ff8a65" : "#2e3446")
                              : formData.password.length < 12
                              ? (i < 3 ? "#4edea3" : "#2e3446")
                              : "#4edea3",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label
                    className="block text-[10px] uppercase tracking-[0.2em] ml-1"
                    style={{ color: "rgba(194,198,214,0.8)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
                  >
                    Verify Access Key
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "rgba(194,198,214,0.4)" }}>
                      security
                    </span>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className={inputClass}
                      style={inputStyle as React.CSSProperties}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 py-1">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: "#4edea3" }}
                    />
                  </div>
                  <label htmlFor="terms" className="text-[11px] leading-relaxed cursor-pointer select-none" style={{ color: "#c2c6d6" }}>
                    I confirm strict compliance with the{" "}
                    <a href="#" className="underline underline-offset-4" style={{ color: "#4edea3", textDecorationColor: "rgba(78,222,163,0.3)" }}>
                      Security Protocols
                    </a>{" "}
                    and{" "}
                    <a href="#" className="underline underline-offset-4" style={{ color: "#4edea3", textDecorationColor: "rgba(78,222,163,0.3)" }}>
                      Engagement Terms
                    </a>{" "}
                    of the Neural Workspace environment.
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden disabled:opacity-60 active:scale-[0.98]"
                  style={{
                    background: "#4edea3",
                    color: "#003824",
                    fontFamily: "var(--font-inter), Inter, sans-serif",
                    boxShadow: "0 8px 30px rgba(78,222,163,0.15)",
                    textTransform: "uppercase",
                    fontSize: "0.75rem",
                    letterSpacing: "0.2em",
                    fontWeight: "900",
                  }}
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
                      INITIALIZING...
                    </>
                  ) : (
                    <>
                      Initialize Deployment
                      <span className="material-symbols-outlined text-lg">terminal</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: "#c2c6d6" }}>
                    Already authorized?{" "}
                    <Link href="/login" className="font-bold hover:underline underline-offset-4" style={{ color: "#4edea3" }}>
                      Initiate Login
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full py-8 mt-auto relative overflow-hidden"
        style={{ background: "rgba(7,14,30,0.8)", borderTop: "1px solid rgba(66,71,84,0.1)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-[1200px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="flex flex-col gap-2">
            <div
              className="text-[9px] uppercase tracking-[0.2em] flex items-center gap-2"
              style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4edea3" }} />
              Node Status: <span style={{ color: "#4edea3" }}>Optimal</span>
            </div>
            <div
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
            >
              © 2024 Neural Workspace. Tactical Intelligence Systems v4.2.0
            </div>
          </div>
          <div className="flex items-center gap-12">
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-[9px] uppercase tracking-widest"
                style={{ color: "rgba(194,198,214,0.4)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
              >
                Session Encryption
              </span>
              <span
                className="text-[10px]"
                style={{ color: "rgba(78,222,163,0.8)", fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace" }}
              >
                AES-256-GCM / TLS 1.3
              </span>
            </div>
            <div className="h-8 w-px" style={{ background: "rgba(66,71,84,0.2)" }} />
            <div className="flex gap-8">
              {["Privacy", "Terms", "Security"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="text-[10px] uppercase tracking-widest transition-colors hover:opacity-100"
                  style={{
                    color: "rgba(194,198,214,0.6)",
                    fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
