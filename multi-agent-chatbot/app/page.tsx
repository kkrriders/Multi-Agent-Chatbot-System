import Link from "next/link"

const features = [
  { icon: "hub",          color: "#78b0ff", title: "Multi-Agent Collaboration",  desc: "Multiple intelligence nodes work in parallel on your tasks, each contributing unique expertise and perspective." },
  { icon: "bolt",         color: "#4edea3", title: "Real-Time Streaming",        desc: "Watch agents generate responses token-by-token via WebSocket. See the thinking process unfold live." },
  { icon: "auto_awesome", color: "#FFBF00", title: "Intelligent Model Routing",  desc: "Tasks auto-route to the best model — LLaMA3, Mixtral, Gemma2, or LLaMA3-70b — based on query type." },
  { icon: "shield",       color: "#d0bcff", title: "Secure by Default",          desc: "JWT auth, HMAC-signed agent calls, LLM-based content moderation, and circuit breakers on every node." },
  { icon: "schema",       color: "#78b0ff", title: "Custom Agent Teams",         desc: "Define system prompts per agent. Use pre-built Coding, Research, Business, or Creative team templates." },
  { icon: "memory",       color: "#4edea3", title: "Persistent Context",         desc: "Conversation history in MongoDB with Jaccard-similarity memory retrieval keeps agents contextually aware." },
]

const steps = [
  { num: "01", icon: "manage_accounts", color: "#78b0ff", title: "Configure Your Nodes",   desc: "Enable agents and assign specialized system prompts or pick a pre-built team template." },
  { num: "02", icon: "terminal",        color: "#4edea3", title: "Deploy Your Task",        desc: "Describe your objective. The manager node routes work to the most capable agents automatically." },
  { num: "03", icon: "stream",          color: "#d0bcff", title: "Watch Them Execute",      desc: "Agents collaborate in real-time. Follow each response streaming live to the unified workspace." },
]

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#060e20", color: "#dee5ff", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 w-full"
        style={{ background: "rgba(6,14,32,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(64,72,93,0.2)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(78,222,163,0.15)", border: "1px solid rgba(78,222,163,0.3)" }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>
                deployed_code
              </span>
            </div>
            <div>
              <div className="text-base font-black tracking-tighter uppercase leading-none" style={{ color: "#dee5ff" }}>
                Neural Workspace
              </div>
              <div
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{ color: "rgba(78,222,163,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}
              >
                Synthetic Architect
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            {[["#features", "Features"], ["#how-it-works", "How It Works"], ["#models", "Models"]].map(([href, label]) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium transition-colors hover:text-[#78b0ff]"
                style={{ color: "#6d758c" }}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: "#a3aac4" }}
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-xl transition-all active:scale-95"
              style={{ background: "#4edea3", color: "#003824", boxShadow: "0 4px 20px rgba(78,222,163,0.2)" }}
            >
              Get Access
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            style={{
              position: "absolute", inset: 0, opacity: 0.025,
              backgroundImage: "radial-gradient(#4edea3 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50%", height: "60%", background: "rgba(120,176,255,0.06)", filter: "blur(120px)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: "45%", height: "55%", background: "rgba(78,222,163,0.06)", filter: "blur(120px)", borderRadius: "50%" }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-24 md:py-36 relative z-10 text-center">
          {/* Status badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.2)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4edea3" }} />
            <span
              className="text-[10px] uppercase tracking-wider font-bold"
              style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              Groq-Powered · 4 Specialized Nodes · Real-Time Streaming
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]" style={{ color: "#dee5ff" }}>
            Orchestrate AI Agents <br />
            <span style={{ color: "#78b0ff" }}>at Neural Speed</span>
          </h1>

          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: "#6d758c" }}>
            Deploy specialized intelligence nodes — code, analysis, creative, general — that collaborate in real-time to tackle any problem you throw at them.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl transition-all active:scale-95 text-base"
              style={{ background: "#4edea3", color: "#003824", boxShadow: "0 8px 30px rgba(78,222,163,0.2)" }}
            >
              Initialize Workspace
              <span className="material-symbols-outlined">rocket_launch</span>
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl transition-all text-base"
              style={{ background: "rgba(120,176,255,0.1)", color: "#78b0ff", border: "1px solid rgba(120,176,255,0.25)" }}
            >
              <span className="material-symbols-outlined">play_circle</span>
              Live Demo
            </Link>
          </div>

          {/* Stat row */}
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { val: "4",      unit: "Agent Nodes",         color: "#78b0ff" },
              { val: "<2s",    unit: "Avg Response",        color: "#4edea3" },
              { val: "32k",    unit: "Context Window",      color: "#d0bcff" },
              { val: "100%",   unit: "Open Source Models",  color: "#FFBF00" },
            ].map(({ val, unit, color }) => (
              <div key={unit} className="flex flex-col items-center">
                <div className="text-2xl font-black" style={{ color }}>{val}</div>
                <div
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "#40485d", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  {unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24" style={{ background: "rgba(9,19,40,0.5)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="text-[10px] uppercase tracking-widest font-bold mb-4"
              style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              System Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: "#dee5ff" }}>
              Built for Serious Workflows
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#6d758c" }}>
              Every component engineered for reliability, speed, and intelligence at scale.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon, color, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-xl transition-all duration-200 group"
                style={{
                  background: "rgba(15,25,48,0.6)",
                  border: "1px solid rgba(64,72,93,0.2)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                >
                  <span className="material-symbols-outlined" style={{ color }}>{icon}</span>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: "#dee5ff" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6d758c" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Models ───────────────────────────────────────────────────────── */}
      <section id="models" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="text-[10px] uppercase tracking-widest font-bold mb-4"
              style={{ color: "#78b0ff", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              Agent Registry
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: "#dee5ff" }}>
              Four Specialized Nodes
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "psychology",    color: "#78b0ff", label: "Llama3",     model: "llama3-8b-8192",     role: "General Logic",   desc: "Fast, versatile reasoning for everyday tasks and conversation." },
              { icon: "storm",         color: "#4edea3", label: "Mixtral",    model: "mixtral-8x7b-32768", role: "Analysis",        desc: "32k context window. Deep analysis, research, and long-form reasoning." },
              { icon: "blur_on",       color: "#d0bcff", label: "Gemma2",     model: "gemma2-9b-it",       role: "Creative",        desc: "Open-ended generation, storytelling, and imaginative problem solving." },
              { icon: "auto_awesome",  color: "#FFBF00", label: "Llama3-70b", model: "llama3-70b-8192",    role: "Developer",       desc: "Strongest code generation. Architecture design, debugging, algorithms." },
            ].map(({ icon, color, label, model, role, desc }) => (
              <div
                key={label}
                className="p-5 rounded-xl"
                style={{ background: "rgba(15,25,48,0.6)", border: `1px solid ${color}20` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                  >
                    <span className="material-symbols-outlined text-base" style={{ color }}>{icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color }}>{label}</div>
                    <div
                      className="text-[9px] uppercase tracking-widest"
                      style={{ color: `${color}70`, fontFamily: "var(--font-jetbrains-mono), monospace" }}
                    >
                      {role}
                    </div>
                  </div>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                </div>
                <div
                  className="text-[10px] px-2 py-1 rounded mb-3 font-mono"
                  style={{ background: `${color}08`, color: `${color}90`, fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  {model}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#6d758c" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24" style={{ background: "rgba(9,19,40,0.4)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div
              className="text-[10px] uppercase tracking-widest font-bold mb-4"
              style={{ color: "#d0bcff", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              Deployment Protocol
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: "#dee5ff" }}>
              Three Steps to Launch
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connector line */}
            <div
              className="absolute hidden md:block"
              style={{ top: 40, left: "16.67%", right: "16.67%", height: 1, background: "linear-gradient(to right, rgba(120,176,255,0.2), rgba(78,222,163,0.2), rgba(208,188,255,0.2))" }}
            />

            {steps.map(({ num, icon, color, title, desc }) => (
              <div key={num} className="flex flex-col items-center text-center relative">
                <div
                  className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center mb-6 relative z-10"
                  style={{ background: `${color}12`, border: `1px solid ${color}30` }}
                >
                  <span className="material-symbols-outlined text-2xl mb-1" style={{ color }}>{icon}</span>
                  <span
                    className="text-[9px] font-black"
                    style={{ color: `${color}60`, fontFamily: "var(--font-jetbrains-mono), monospace" }}
                  >
                    {num}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: "#dee5ff" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6d758c" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(78,222,163,0.06) 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "radial-gradient(#4edea3 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.2)" }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: "#4edea3" }}>verified</span>
            <span
              className="text-[10px] uppercase tracking-wider font-bold"
              style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              Free to deploy · No GPU required · Groq-powered
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6" style={{ color: "#dee5ff" }}>
            Ready to Command <br />
            <span style={{ color: "#4edea3" }}>Your Intelligence Network?</span>
          </h2>

          <p className="text-lg mb-10" style={{ color: "#6d758c" }}>
            Sign up, add your Groq API key, and have multi-agent collaboration running in under 5 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl transition-all active:scale-95 text-base"
              style={{ background: "#4edea3", color: "#003824", boxShadow: "0 8px 30px rgba(78,222,163,0.2)" }}
            >
              Initialize Deployment
              <span className="material-symbols-outlined">terminal</span>
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl transition-all text-base"
              style={{ background: "transparent", color: "#a3aac4", border: "1px solid rgba(64,72,93,0.4)" }}
            >
              Already have access? Login
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: "#070e1e", borderTop: "1px solid rgba(64,72,93,0.15)" }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(78,222,163,0.15)", border: "1px solid rgba(78,222,163,0.3)" }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>deployed_code</span>
                </div>
                <span className="font-black tracking-tighter uppercase text-sm" style={{ color: "#dee5ff" }}>Neural Workspace</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#40485d" }}>
                Multi-agent AI orchestration. Collaborative intelligence nodes working in real-time.
              </p>
            </div>

            {/* Links */}
            {[
              { heading: "Platform", links: ["Features", "Models", "Documentation", "Changelog"] },
              { heading: "Company",  links: ["About", "Blog", "Careers", "Contact"] },
              { heading: "Legal",    links: ["Privacy Policy", "Terms of Service", "Security", "Support"] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <h4
                  className="font-bold mb-4 text-xs uppercase tracking-widest"
                  style={{ color: "#a3aac4", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  {heading}
                </h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-xs transition-colors hover:text-[#78b0ff]"
                        style={{ color: "#40485d" }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3"
            style={{ borderTop: "1px solid rgba(64,72,93,0.15)" }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.05em]"
              style={{ color: "#40485d", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              © 2024 Neural Workspace. Tactical Intelligence Systems v4.2.0
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4edea3" }} />
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}
              >
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
