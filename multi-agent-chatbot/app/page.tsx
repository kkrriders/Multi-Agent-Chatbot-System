import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: "#0c1323", color: "#dce2f9", fontFamily: "var(--font-inter), Inter, sans-serif" }}>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 w-full z-50" style={{ background: "rgba(12,19,35,0.6)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(46,52,70,0.15)", boxShadow: "0 24px 40px rgba(77,142,255,0.06)" }}>
        <div className="flex justify-between items-center w-full px-6 py-3 max-w-screen-2xl mx-auto">
          <div className="text-base font-bold tracking-tighter" style={{ color: "#dce2f9" }}>Neural Workspace</div>
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <a className="transition-colors hover:text-[#dce2f9]" href="#models" style={{ color: "rgba(220,226,249,0.7)" }}>Models</a>
            <a className="transition-colors hover:text-[#dce2f9]" href="#infrastructure" style={{ color: "rgba(220,226,249,0.7)" }}>Infrastructure</a>
            <a className="transition-colors hover:text-[#dce2f9]" href="#features" style={{ color: "rgba(220,226,249,0.7)" }}>Security</a>
          </div>
          <div className="flex items-center space-x-3">
            <a href="#" className="px-3 py-1.5 text-xs font-mono transition-colors hover:text-[#dce2f9]" style={{ color: "rgba(220,226,249,0.7)" }}>Documentation</a>
            <Link href="/signup" className="px-4 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 hover:shadow-[0_0_12px_rgba(0,165,114,0.4)]" style={{ background: "#00a572", color: "#00311f" }}>
              Launch Console
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-14">

        {/* ── Hero ── */}
        <section className="relative flex items-center overflow-hidden px-6 py-16 md:py-24" style={{ minHeight: "680px" }}>
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom right, #0c1323, #070e1e, #0c1323)", opacity: 0.9 }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 600, height: 600, background: "rgba(173,198,255,0.08)", filter: "blur(100px)" }} />
          </div>
          <div className="relative z-10 max-w-screen-2xl mx-auto w-full grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full ghost-border" style={{ background: "#232a3b" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4edea3" }} />
                <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}>System Online: v3.1.0</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: "#dce2f9", lineHeight: "1" }}>
                The Neural Workspace: <br />
                <span style={{ color: "#adc6ff" }}>High-Performance</span> <br />
                Multi-Agent Orchestration
              </h1>
              <p className="text-sm max-w-md leading-relaxed" style={{ color: "#c2c6d6" }}>
                Orchestrate, monitor, and direct specialized intelligence agents with the precision of a tactical flight deck. Built for Groq-powered, low-latency cognitive operations.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className="px-6 py-2.5 rounded-lg font-black text-sm tracking-tight transition-all hover:shadow-[0_0_20px_rgba(0,165,114,0.3)]" style={{ background: "#00a572", color: "#00311f" }}>
                  Open Workspace
                </Link>
                <Link href="/login" className="px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ghost-border" style={{ background: "#232a3b", color: "#dce2f9" }}>
                  Sign In
                </Link>
              </div>
            </div>
            <div className="hidden md:block relative hero-float">
              <div className="aspect-square rounded-xl overflow-hidden relative hero-glow" style={{ background: "rgba(50,57,75,0.6)", backdropFilter: "blur(12px)" }}>

                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: 0.75 }}
                  alt="Abstract 3D crystalline neural network structures with neon blue and emerald light paths"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6vtUQEefDRK4ZFXWZ1PKRG_aUpREtkRbV-g0supfjpp3llY6ttZK_py4f8EnLuIYRM6tZHplScDtyfruInRMFhAOLw6LEygMUUl-GLN4AZfKAX-4IeqXF8tQVUAPc7KKfMfxLZhnGaYxmotVFfXQ6AYlInOd2T4JpSWjsxL1xzyuZzkSrj5xynx5gXf-keI_VRKwpH3aAj8qv6JcBkuDmX4Jhp_dqXqw-sre_MdOA8hHZsFnHoPxRpEnOUJs-nHMMb9PbuxnKMkiC"
                />

                {/* Colour tint overlay */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(173,198,255,0.06) 0%, transparent 50%, rgba(78,222,163,0.04) 100%)" }} />

                {/* Bottom fade so log panel blends in */}
                <div className="absolute bottom-0 left-0 right-0 h-2/5" style={{ background: "linear-gradient(to top, rgba(20,27,44,0.95), transparent)" }} />

                {/* Scanline sweep */}
                <div className="scanline" />

                {/* HUD corner brackets */}
                <div className="hud-corner absolute top-3 left-3 w-4 h-4" style={{ borderTop: "1.5px solid #4edea3", borderLeft: "1.5px solid #4edea3" }} />
                <div className="hud-corner absolute top-3 right-3 w-4 h-4" style={{ borderTop: "1.5px solid #4edea3", borderRight: "1.5px solid #4edea3", animationDelay: "0.75s" }} />
                <div className="hud-corner absolute bottom-3 left-3 w-4 h-4" style={{ borderBottom: "1.5px solid #4edea3", borderLeft: "1.5px solid #4edea3", animationDelay: "1.5s" }} />
                <div className="hud-corner absolute bottom-3 right-3 w-4 h-4" style={{ borderBottom: "1.5px solid #4edea3", borderRight: "1.5px solid #4edea3", animationDelay: "2.25s" }} />

                {/* Log overlay */}
                <div className="absolute bottom-4 left-4 right-4 p-3 rounded-lg" style={{ background: "rgba(12,19,35,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(78,222,163,0.12)" }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-mono" style={{ color: "rgba(220,226,249,0.5)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>LATEST LOGS</span>
                    <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: "#4edea3", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                      <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    <p style={{ color: "rgba(173,198,255,0.9)", animation: "log-appear 0.4s ease forwards", animationDelay: "0.3s", opacity: 0 }}>&gt; AGENT READY: LLAMA3_8B</p>
                    <p style={{ color: "rgba(194,198,214,0.7)", animation: "log-appear 0.4s ease forwards", animationDelay: "1.2s", opacity: 0 }}>&gt; ROUTING TO GROQ ENDPOINT...</p>
                    <p style={{ color: "rgba(78,222,163,0.9)", animation: "log-appear 0.4s ease forwards", animationDelay: "2.1s", opacity: 0 }}>&gt; RESPONSE RECEIVED: 12ms LATENCY</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Infrastructure Status ── */}
        <section id="infrastructure" className="py-6" style={{ background: "#070e1e", borderTop: "1px solid rgba(66,71,84,0.1)", borderBottom: "1px solid rgba(66,71,84,0.1)" }}>
          <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: "dns",    color: "#4edea3", label: "Node Status",   value: "OPTIMAL", valueColor: "#4edea3" },
              { icon: "memory", color: "#adc6ff", label: "System Load",   value: "24%",     valueColor: "#dce2f9" },
              { icon: "hub",    color: "#d0bcff", label: "Active Agents", value: "4 / 4",   valueColor: "#dce2f9" },
            ].map(({ icon, color, label, value, valueColor }) => (
              <div key={label} className="flex items-center space-x-4 p-3 rounded-xl transition-colors hover:bg-[#181f30]">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1A` }}>
                  <span className="material-symbols-outlined text-base" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(194,198,214,0.6)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{label}</p>
                  <h4 className="text-base font-black" style={{ color: valueColor }}>{value}</h4>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── System Overview (Agent Cards) ── */}
        <section id="models" className="py-20 px-6 max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <div className="max-w-xl">
              <h2 className="text-[9px] font-mono uppercase mb-2" style={{ color: "#adc6ff", letterSpacing: "0.4em", fontFamily: "var(--font-jetbrains-mono), monospace" }}>The Orchestration Core</h2>
              <h3 className="text-2xl font-black tracking-tighter" style={{ color: "#dce2f9" }}>Specialized Neural Units</h3>
            </div>
            <p className="max-w-sm text-xs" style={{ color: "#c2c6d6" }}>Each agent is isolated in a secure container, optimized for specific cognitive workloads within the tactical cluster.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Llama3 — wide */}
            <div className="md:col-span-2 group relative p-5 rounded-xl overflow-hidden transition-all ghost-border hover:bg-[#181f30]" style={{ background: "#141b2c" }}>
              <div className="absolute top-0 right-0 w-28 h-28 rounded-full" style={{ background: "rgba(173,198,255,0.08)", filter: "blur(50px)" }} />
              <span className="text-[9px] font-mono mb-3 block" style={{ color: "#adc6ff", letterSpacing: "0.2em", fontFamily: "var(--font-jetbrains-mono), monospace" }}>ROUTING / GENERAL</span>
              <h4 className="text-xl font-black mb-2" style={{ color: "#dce2f9" }}>Llama3</h4>
              <p className="mb-4 leading-relaxed text-xs" style={{ color: "#c2c6d6" }}>The primary coordinator for multi-agent reasoning. Handles instruction following, routing, and meta-cognitive oversight with ultra-low latency.</p>
              <button className="flex items-center space-x-1 text-xs font-bold transition-transform hover:translate-x-1" style={{ color: "#adc6ff" }}>
                <span>View Detail</span>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
              </button>
            </div>

            {/* Mixtral */}
            <div className="group relative p-5 rounded-xl transition-all ghost-border hover:bg-[#181f30]" style={{ background: "#141b2c" }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full" style={{ background: "rgba(78,222,163,0.08)", filter: "blur(35px)" }} />
              <span className="text-[9px] font-mono mb-3 block" style={{ color: "#4edea3", letterSpacing: "0.2em", fontFamily: "var(--font-jetbrains-mono), monospace" }}>CODE / LOGIC</span>
              <h4 className="text-lg font-black mb-2" style={{ color: "#dce2f9" }}>Mixtral</h4>
              <p className="mb-4 text-xs leading-relaxed" style={{ color: "#c2c6d6" }}>High-precision syntax parsing and algorithmic generation. 32k context window for complex reasoning tasks.</p>
              <button className="w-full py-2 rounded-lg font-bold text-xs transition-all ghost-border hover:opacity-80" style={{ background: "rgba(78,222,163,0.05)", color: "#4edea3" }}>View Detail</button>
            </div>

            {/* Gemma2 */}
            <div className="group relative p-5 rounded-xl transition-all ghost-border hover:bg-[#181f30]" style={{ background: "#141b2c" }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full" style={{ background: "rgba(245,158,11,0.08)", filter: "blur(35px)" }} />
              <span className="text-[9px] font-mono mb-3 block" style={{ color: "#f59e0b", letterSpacing: "0.2em", fontFamily: "var(--font-jetbrains-mono), monospace" }}>ANALYSIS / DATA</span>
              <h4 className="text-lg font-black mb-2" style={{ color: "#dce2f9" }}>Gemma2</h4>
              <p className="mb-4 text-xs leading-relaxed" style={{ color: "#c2c6d6" }}>Specialized in context-dense retrieval, analytical research, and data synthesis.</p>
              <button className="w-full py-2 rounded-lg font-bold text-xs transition-all ghost-border hover:opacity-80" style={{ background: "rgba(245,158,11,0.05)", color: "#f59e0b" }}>View Detail</button>
            </div>

            {/* Llama3-70b — full width */}
            <div className="md:col-span-4 group relative p-5 rounded-xl transition-all ghost-border flex flex-col md:flex-row items-center gap-8 hover:bg-[#181f30]" style={{ background: "#141b2c" }}>
              <div className="md:w-1/2 relative">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-40 h-40 rounded-full" style={{ background: "rgba(208,188,255,0.08)", filter: "blur(60px)" }} />
                <span className="text-[9px] font-mono mb-3 block uppercase" style={{ color: "#d0bcff", letterSpacing: "0.2em", fontFamily: "var(--font-jetbrains-mono), monospace" }}>Developer / Power</span>
                <h4 className="text-2xl font-black mb-2" style={{ color: "#dce2f9" }}>Llama3-70b</h4>
                <p className="mb-4 text-xs leading-relaxed" style={{ color: "#c2c6d6" }}>The most capable node for creative synthesis and complex developer tasks. Optimized for architecture design, debugging, and algorithmic generation at scale.</p>
                <button className="px-6 py-2 rounded-lg font-black text-xs transition-all hover:opacity-90" style={{ background: "#a078ff", color: "#340080" }}>View Detail</button>
              </div>
              <div className="md:w-1/2 flex justify-center">
                <div className="relative w-full max-w-sm overflow-hidden rounded-lg ghost-border" style={{ aspectRatio: "16/9", background: "#232a3b" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    style={{ opacity: 0.6 }}
                    alt="Abstract fluid wave shapes in violet and purple gradients"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNuI5pH0TF_yRcJiYzJXxfyg9HTODn1PK12yjjMDIvyq2KBOI670QMk0_VBjPMVi72Ga87S7eaW3J6bXvUI2EM17R3XNDDVs-mDo8Zhs2kdtxEvKtOar_AB-aMzkvSOQtBkvPcU9d1CQexHGFEyqZnutDRqkRStOO3G53wMq3f6H5PbHULBZ2hVzl33wzXhf9aUGVxAX0YZFrHxnsxvc9R_TLzZfJhnwGs18NlFvFAn4emNQ-hA7r2Or49V9yXnCBpEidEg0HjBVFA"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #141b2c, transparent)" }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Key Features (Bento Grid) ── */}
        <section id="features" className="py-20" style={{ background: "#070e1e" }}>
          <div className="max-w-screen-2xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-black tracking-tight mb-2" style={{ color: "#dce2f9" }}>Enterprise-Grade Performance</h2>
              <p className="max-w-xl mx-auto text-sm" style={{ color: "#c2c6d6" }}>Tactical tools for modern intelligence orchestration, built with security and observability at the core.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px" style={{ background: "rgba(66,71,84,0.1)" }}>
              {[
                { icon: "security",    color: "#adc6ff", title: "Secure Authentication",   desc: "JWT + HMAC-signed agent calls, LLM-based content moderation, and circuit breakers on every node." },
                { icon: "bolt",        color: "#4edea3", title: "Real-time Orchestration", desc: "Low-latency token streaming between specialized model nodes via Socket.IO WebSocket." },
                { icon: "database",    color: "#d0bcff", title: "Semantic Memory",         desc: "Persistent MongoDB conversation history with relevance-based retrieval keeps agents contextually aware." },
                { icon: "query_stats", color: "#f59e0b", title: "Distributed Tracing",     desc: "Full-stack observability for every inference token and reasoning step taken." },
              ].map(({ icon, color, title, desc }) => (
                <div key={title} className="p-7 transition-all hover:bg-[#232a3b]" style={{ background: "#181f30" }}>
                  <span className="material-symbols-outlined mb-4 text-3xl block" style={{ color }}>{icon}</span>
                  <h5 className="text-sm font-bold mb-2" style={{ color: "#dce2f9" }}>{title}</h5>
                  <p className="text-xs leading-relaxed" style={{ color: "#c2c6d6" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: "rgba(173,198,255,0.04)" }} />
          <div className="max-w-3xl mx-auto relative z-10 text-center space-y-7">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter" style={{ color: "#dce2f9" }}>
              Ready to command your <br />intelligence network?
            </h2>
            <div className="flex flex-col md:flex-row justify-center items-center gap-4">
              <Link href="/signup" className="w-full md:w-auto px-10 py-3.5 rounded-lg font-black tracking-tight transition-all hover:scale-105" style={{ background: "#00a572", color: "#00311f", boxShadow: "0 0 30px rgba(0,165,114,0.2)" }}>
                Register Now
              </Link>
              <Link href="/login" className="w-full md:w-auto px-10 py-3.5 rounded-lg font-bold transition-all ghost-border" style={{ background: "#181f30", color: "#dce2f9" }}>
                Log In
              </Link>
            </div>
            <div className="flex justify-center items-center gap-8" style={{ opacity: 0.35 }}>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>GROQ POWERED</span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>SELF-HOSTED</span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>OPEN-SOURCE CORE</span>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer style={{ background: "#0c1323", borderTop: "1px solid rgba(46,52,70,0.15)" }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-8 w-full max-w-screen-2xl mx-auto">
          <div className="mb-4 md:mb-0">
            <div className="font-black text-sm mb-1" style={{ color: "#dce2f9" }}>Neural Workspace</div>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(220,226,249,0.4)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
              © 2025 Neural Workspace. Tactical Intelligence Orchestration.
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {["System Status", "Privacy Policy", "Security Terms", "API Docs"].map((link) => (
              <a key={link} href="#" className="text-[9px] uppercase tracking-widest transition-colors hover:text-[#3b82f6]" style={{ color: "rgba(220,226,249,0.4)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
