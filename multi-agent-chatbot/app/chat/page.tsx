"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { checkAuth, logout, type User } from "@/lib/auth"
import { API_URL } from "@/lib/config"
import ConversationSidebar from "@/components/ConversationSidebar"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog"

interface Message {
  id: string
  content: string
  sender: "user" | "agent"
  agent?: string
  timestamp: Date
  typing?: boolean
  streaming?: boolean
  type?: string
}

interface Agent {
  id: string
  name: string
  model: string
  port: number
  status: "online" | "offline" | "loading" | "thinking" | "active"
  description: string
  color: string
  role: string
  enabled: boolean
  teamMember: string
  performance: number
  messagesCount: number
}

interface TeamTemplate {
  id: string
  name: string
  icon: string
  agents: Partial<Agent>[]
}

// Neural Workspace agent display metadata
const AGENT_META: Record<string, { label: string; role: string; icon: string; color: string }> = {
  "agent-1": { label: "DeepSeek-R1",  role: "Challenger",    icon: "psychology",    color: "#78b0ff" },
  "agent-2": { label: "Qwen3-32b",    role: "Analyst",       icon: "storm",         color: "#4edea3" },
  "agent-3": { label: "R1-Scout",     role: "Edge-Case",     icon: "blur_on",       color: "#d0bcff" },
  "agent-4": { label: "Llama3-70b",   role: "Specialist",    icon: "auto_awesome",  color: "#FFBF00" },
  "manager": { label: "Manager",      role: "Safety Gate",   icon: "shield",        color: "#adc6ff" },
  "debate-synthesis": { label: "Synthesis", role: "Debate Result", icon: "hub",     color: "#ff8a65" },
}

function getAgentMeta(agentId?: string) {
  if (!agentId) return AGENT_META.manager
  return AGENT_META[agentId] ?? { label: agentId, role: "Agent", icon: "smart_toy", color: "#adc6ff" }
}

export default function MultiAgentChatbot() {
  const router = useRouter()
  const [user, setUser]                         = useState<User | null>(null)
  const [isCheckingAuth, setIsCheckingAuth]     = useState(true)
  const [messages, setMessages]                 = useState<Message[]>([])
  const [taskDescription, setTaskDescription]   = useState("")
  const [isConnected, setIsConnected]           = useState(false)
  const [isProcessing, setIsProcessing]         = useState(false)
  const [taskProgress, setTaskProgress]         = useState(0)
  const [activeAgents, setActiveAgents]         = useState<string[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [chatInput, setChatInput]               = useState("")
  const [selectedTarget, setSelectedTarget]     = useState<"all" | string>("all")
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [leftTab, setLeftTab]                   = useState<"threads" | "agents">("threads")
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const messagesEndRef            = useRef<HTMLDivElement>(null)
  const socketRef                 = useRef<Socket | null>(null)
  const chatInputRef              = useRef<HTMLTextAreaElement>(null)
  const currentConversationIdRef  = useRef<string | null>(null)

  // ── Debate mode state ────────────────────────────────────────────────────
  const [isDebateMode, setIsDebateMode]         = useState(false)
  const [debatePhase, setDebatePhase]           = useState<string | null>(null)
  const [debateChallenges, setDebateChallenges] = useState<Record<string, { challengeId: string; fromAgent: string; claim: string; critique: string }[]>>({})
  const [debateDefenses, setDebateDefenses]     = useState<Record<string, { challengeId: string; stance: string }[]>>({})

  // Keep ref in sync so socket disconnect handler always reads the current conversationId
  useEffect(() => { currentConversationIdRef.current = currentConversationId }, [currentConversationId])

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const verifyAuth = async () => {
      const authUser = await checkAuth()
      if (!authUser) { router.push("/login"); return }
      setUser(authUser)
      setIsCheckingAuth(false)
    }
    verifyAuth()
  }, [router])

  const [agents, setAgents] = useState<Agent[]>([
    { id: "agent-1", name: "Agent 1", model: "llama3-8b-8192",     port: 3005, status: "online",  description: "General Logic",   color: "bg-blue-500",   role: "You are a helpful AI assistant. Provide detailed and accurate responses.",                                enabled: true,  teamMember: "Team Member 1", performance: 95, messagesCount: 0 },
    { id: "agent-2", name: "Agent 2", model: "mixtral-8x7b-32768", port: 3006, status: "online",  description: "Analysis",        color: "bg-green-500",  role: "You are a knowledgeable AI assistant. Analyze the task from your unique perspective.",                   enabled: true,  teamMember: "Team Member 2", performance: 88, messagesCount: 0 },
    { id: "agent-3", name: "Agent 3", model: "gemma2-9b-it",       port: 3007, status: "offline", description: "Creative",        color: "bg-purple-500", role: "You are an efficient AI assistant focused on practical solutions and implementation details.",             enabled: false, teamMember: "Team Member 3", performance: 92, messagesCount: 0 },
    { id: "agent-4", name: "Agent 4", model: "llama3-70b-8192",    port: 3008, status: "offline", description: "Developer",       color: "bg-amber-500",  role: "You are a specialized AI assistant with expertise in technical analysis and problem-solving.",             enabled: false, teamMember: "Team Member 4", performance: 90, messagesCount: 0 },
  ])

  const teamTemplates: TeamTemplate[] = [
    { id: "coding",   name: "Coding Team",   icon: "code",     agents: [{ role: "You are a senior software architect.",                             teamMember: "Architect" }, { role: "You are a full-stack developer.", teamMember: "Developer" }, { role: "You are a QA engineer.", teamMember: "QA Eng" }, { role: "You are a DevOps engineer.", teamMember: "DevOps" }] },
    { id: "research", name: "Research Team", icon: "biotech",  agents: [{ role: "You are a research lead. Coordinate research efforts.",            teamMember: "Research Lead" }, { role: "You are a data analyst.", teamMember: "Data Analyst" }, { role: "You are a subject matter expert.", teamMember: "Domain Expert" }, { role: "You are a research assistant.", teamMember: "Assistant" }] },
    { id: "business", name: "Business Team", icon: "trending_up", agents: [{ role: "You are a business strategist.",                               teamMember: "Strategist" }, { role: "You are a product manager.", teamMember: "PM" }, { role: "You are a marketing specialist.", teamMember: "Marketing" }, { role: "You are a financial analyst.", teamMember: "Finance" }] },
    { id: "creative", name: "Creative Team", icon: "palette",  agents: [{ role: "You are a creative director. Lead creative vision.",              teamMember: "Creative Dir" }, { role: "You are a UX/UI designer.", teamMember: "UX/UI" }, { role: "You are a content creator.", teamMember: "Content" }, { role: "You are a brand strategist.", teamMember: "Brand" }] },
  ]

  // ── Backend health + Socket ───────────────────────────────────────────────
  useEffect(() => {
    const connectToBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`)
        if (response.ok) {
          setIsConnected(true)
          if (!socketRef.current) initializeSocket()
        } else {
          setIsConnected(false)
        }
      } catch {
        setIsConnected(false)
      }
    }

    connectToBackend()
    const interval = setInterval(connectToBackend, 30000)
    return () => {
      clearInterval(interval)
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [])

  const initializeSocket = () => {
    socketRef.current = io(API_URL, {
      transports: ["websocket", "polling"],
      timeout: 60000,
      withCredentials: true,
    })

    socketRef.current.on("connect", () => { setIsConnected(true) })

    socketRef.current.on("conversation-update", (data) => {
      try {
        if (data.message) {
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            content: data.message.content,
            sender: data.message.from === "user" ? "user" : "agent",
            agent: data.message.agentId || "manager",
            timestamp: new Date(data.message.timestamp),
          }
          setMessages((prev) => {
            const messageId = data.message.messageId
            const isDuplicate = messageId
              ? prev.some((m) => m.id.includes(messageId))
              : prev.some((m) => m.content === newMessage.content && m.agent === newMessage.agent && Math.abs(m.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000)
            if (isDuplicate) return prev
            if (messageId) newMessage.id = `${messageId}-${Date.now()}`
            return [...prev, newMessage]
          })
          if (data.message.from !== "user") {
            const agentId = data.message.agentId
            if (agentId?.startsWith("agent-")) {
              updateAgent(agentId, {
                status: data.message.type === "manager-conclusion" ? "online" : "active",
                messagesCount: (agents.find((a) => a.id === agentId)?.messagesCount ?? 0) + 1,
              })
              setActiveAgents((prev) => (prev.includes(agentId) ? prev : [...prev, agentId]))
            }
            if (data.message.type === "manager-conclusion") {
              setIsProcessing(false)
              setActiveAgents([])
              setTaskProgress(100)
            }
          }
        }
      } catch { /* ignore */ }
    })

    socketRef.current.on("agent-thinking", (data: { agentId: string; conversationId: string }) => {
      if (!data.agentId?.startsWith("agent-")) return
      updateAgent(data.agentId, { status: "thinking" })
      setActiveAgents((prev) => (prev.includes(data.agentId) ? prev : [...prev, data.agentId]))
      const thinkingId = `thinking-${data.agentId}`
      setMessages((prev) => {
        if (prev.some((m) => m.id === thinkingId)) return prev
        return [...prev, { id: thinkingId, content: "", sender: "agent", agent: data.agentId, timestamp: new Date(), typing: true }]
      })
    })

    socketRef.current.on("stream-start", (data: { messageId: string; agentId: string; conversationId: string }) => {
      const streamingMessage: Message = { id: data.messageId, content: "", sender: "agent", agent: data.agentId, timestamp: new Date(), streaming: true }
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === `thinking-${data.agentId}`)
        if (idx !== -1) { const u = [...prev]; u[idx] = streamingMessage; return u }
        return [...prev, streamingMessage]
      })
      if (data.agentId.startsWith("agent-")) {
        updateAgent(data.agentId, { status: "active" })
        setActiveAgents((prev) => (prev.includes(data.agentId) ? prev : [...prev, data.agentId]))
      }
    })

    socketRef.current.on("stream-token", (data: { messageId: string; token: string }) => {
      setMessages((prev) => prev.map((msg) => msg.id === data.messageId ? { ...msg, content: msg.content + data.token } : msg))
    })

    socketRef.current.on("stream-end", (data: { messageId: string; agentId: string; content: string; timestamp: number; type?: string }) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === data.messageId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], content: data.content, streaming: false, type: data.type }
          return updated
        }
        // debate-synthesis arrives as a new message (no stream-start preceded it)
        // I-2: on socket reconnect the messageId changes (Date.now()-based) so we must also
        // check if a synthesis already exists — update it rather than inserting a duplicate
        if (data.type === "debate-synthesis") {
          const existingIdx = prev.findIndex(m => m.type === "debate-synthesis")
          if (existingIdx !== -1) {
            const updated = [...prev]
            updated[existingIdx] = { ...updated[existingIdx], content: data.content, streaming: false }
            return updated
          }
          return [...prev, {
            id: data.messageId,
            content: data.content,
            sender: "agent" as const,
            agent: data.agentId || "debate-synthesis",
            timestamp: new Date(data.timestamp),
            type: data.type,
          }]
        }
        return prev
      })
      if (data.agentId?.startsWith("agent-")) {
        setAgents((prev) => prev.map((a) => a.id === data.agentId ? { ...a, status: "online", messagesCount: a.messagesCount + 1 } : a))
        setActiveAgents((prev) => prev.filter((id) => id !== data.agentId))
      }
      // C-1: also clear processing on debate-synthesis in case debate-complete is dropped
      if (data.type === "manager-conclusion" || data.type === "debate-synthesis") {
        setIsProcessing(false)
        setActiveAgents([])
        setTaskProgress(100)
      }
    })

    socketRef.current.on("stream-error", (data: { agentId: string; conversationId: string }) => {
      if (!data.agentId) return
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== `thinking-${data.agentId}`)
        const meta = getAgentMeta(data.agentId)
        return [...filtered, {
          id: `error-${data.agentId}-${Date.now()}`,
          content: `${meta.label} failed to respond — continuing without their input.`,
          sender: "agent" as const,
          agent: data.agentId,
          timestamp: new Date(),
          type: "stream-error",
        }]
      })
      if (data.agentId.startsWith("agent-")) {
        setAgents((prev) => prev.map((a) => a.id === data.agentId ? { ...a, status: "online" } : a))
        setActiveAgents((prev) => prev.filter((id) => id !== data.agentId))
      } else {
        // manager/planner failure — clear processing state
        setIsProcessing(false)
        setActiveAgents([])
      }
    })

    // ── Debate event handlers ────────────────────────────────────────────────
    socketRef.current.on("debate-phase", (data: { phase: string }) => {
      setDebatePhase(data.phase)
    })

    socketRef.current.on("debate-challenge", (data: { fromAgent: string; toAgent: string; challengeId: string; claim: string; critique: string }) => {
      setDebateChallenges((prev) => {
        const existing = prev[data.toAgent] || []
        // N-4: deduplicate by challengeId — prevents duplicate badges on socket reconnect
        if (existing.some((ch) => ch.challengeId === data.challengeId)) return prev
        return {
          ...prev,
          [data.toAgent]: [...existing, { challengeId: data.challengeId, fromAgent: data.fromAgent, claim: data.claim, critique: data.critique }],
        }
      })
    })

    socketRef.current.on("debate-defense", (data: { agentId: string; challengeId: string; stance: string }) => {
      setDebateDefenses((prev) => {
        const existing = prev[data.agentId] || []
        // I-1: deduplicate by challengeId — mirrors the debate-challenge fix; prevents duplicate
        // defense badges on socket reconnect
        if (existing.some((d) => d.challengeId === data.challengeId)) return prev
        return { ...prev, [data.agentId]: [...existing, { challengeId: data.challengeId, stance: data.stance }] }
      })
    })

    socketRef.current.on("debate-complete", () => {
      setDebatePhase(null)
      setIsProcessing(false)
      setActiveAgents([])
      setTaskProgress(100)
    })

    // N-1: surface synthesis errors and reset the banner — without this the "SYNTHESIZING…"
    // spinner hangs forever if the synthesis LLM call fails before debate-complete fires
    socketRef.current.on("debate-error", (data: { phase: string; error: string }) => {
      setDebatePhase(null)
      setIsProcessing(false)
      setActiveAgents([])
      setMessages((prev) => [...prev, {
        id: `debate-error-${Date.now()}`,
        content: `Debate ${data.phase} failed: ${data.error}`,
        sender: "agent" as const,
        agent: "debate-synthesis",
        timestamp: new Date(),
        type: "debate-error",
      }])
    })

    socketRef.current.on("connect_error", (error) => { console.error("Socket error:", error); setIsConnected(false) })
    socketRef.current.on("disconnect", (reason) => {
      console.log("Disconnected:", reason)
      setIsConnected(false)
      // Use ref (not state closure) so we always rejoin the current conversation
      socketRef.current?.once("connect", () => {
        const convId = currentConversationIdRef.current
        if (convId) socketRef.current?.emit("join-conversation", convId)
      })
    })
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const applyTeamTemplate = (template: TeamTemplate) => {
    setAgents((prev) => prev.map((agent, i) => ({
      ...agent,
      role: template.agents[i]?.role || agent.role,
      teamMember: template.agents[i]?.teamMember || agent.teamMember,
      enabled: i < template.agents.length,
      status: i < template.agents.length ? "online" : "offline",
    })))
  }

  const clearAll = () => {
    setAgents((prev) => prev.map((agent) => ({
      ...agent, enabled: false, status: "offline",
      role: "You are a helpful AI assistant.",
      teamMember: `Team Member ${agent.id.split("-")[1]}`,
    })))
  }

  const updateAgent = (agentId: string, updates: Partial<Agent>) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a)))
  }

  const sendFollowUpMessage = async () => {
    if (!chatInput.trim() || !currentConversationId || !socketRef.current) return
    try {
      if (isProcessing) {
        const response = await fetch(`${API_URL}/inject-context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ conversationId: currentConversationId, message: chatInput }),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || "Failed to inject context")
        setMessages((prev) => [...prev, {
          id: `inject-${Date.now()}`,
          content: `[Context added]: ${chatInput}`,
          sender: "user" as const,
          timestamp: new Date(),
          type: "user-injection",
        }])
        setChatInput("")
        return
      }
      if (selectedTarget === "all") {
        const enabledAgents = agents.filter((a) => a.enabled)
        const response = await fetch(`${API_URL}/continue-conversation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ conversationId: currentConversationId, message: chatInput, participants: enabledAgents.map((a) => ({ agentId: a.id, agentName: a.teamMember })) }),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || "Failed to continue conversation")
      } else {
        const targetAgent = agents.find((a) => a.id === selectedTarget)
        if (!targetAgent) throw new Error("Target agent not found")
        const response = await fetch(`${API_URL}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: chatInput, agentId: selectedTarget, agentName: targetAgent.teamMember, conversationId: currentConversationId }),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || "Failed to send message")
      }
      setChatInput("")
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, content: `Error: ${(error as Error).message}`, sender: "agent", timestamp: new Date() }])
    }
  }

  const clearConversation = () => {
    setMessages([]); setCurrentConversationId(null)
    setIsProcessing(false); setTaskProgress(0)
    setActiveAgents([]); setChatInput("")
    // S-6: reset debate state so stale badges don't bleed into the next session
    setDebateChallenges({}); setDebateDefenses({}); setDebatePhase(null)
  }

  const startTask = async () => {
    if (!taskDescription.trim()) return
    setIsProcessing(true); setMessages([]); setTaskProgress(0); setActiveAgents([])
    setMessages([{ id: Date.now().toString(), content: `Task: ${taskDescription}`, sender: "user", timestamp: new Date() }])

    try {
      const enabledAgents = agents.filter((a) => a.enabled)
      const agentData = enabledAgents.map((a) => ({ agentId: a.id, agentName: a.teamMember, customPrompt: a.role }))

      if (!socketRef.current?.connected) throw new Error("Socket.IO not connected. Please refresh the page.")

      // Create a MongoDB conversation document so it appears in the sidebar
      const convCreateRes = await fetch(`${API_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: taskDescription.slice(0, 60), agentType: "manager" }),
      })
      if (!convCreateRes.ok) throw new Error("Failed to create conversation")
      const convCreateData = await convCreateRes.json()
      const conversationId: string = convCreateData.data._id

      socketRef.current.emit("join-conversation", conversationId)
      setSidebarRefreshKey((k) => k + 1)

      // Reset debate state for new session
      setDebateChallenges({})
      setDebateDefenses({})
      setDebatePhase(null)

      const endpoint = isDebateMode ? `${API_URL}/debate-session` : `${API_URL}/flexible-work-session`
      const body = isDebateMode
        ? { task: taskDescription, participants: enabledAgents.map((a) => ({ agentId: a.id, agentName: a.teamMember })), conversationId }
        : { task: taskDescription, agents: agentData, conversationId, managerRole: "Senior project manager who reviews all work and provides strategic guidance and final recommendations" }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (result.success) {
        setCurrentConversationId(conversationId)
        setTimeout(() => {
          // S-3: also reset debatePhase so the phase banner doesn't linger after timeout
          setIsProcessing((prev) => { if (prev) { setActiveAgents([]); setDebatePhase(null) } return prev ? false : prev })
        }, 180000)
      } else {
        throw new Error(result.error || "Failed to start task")
      }
    } catch (error) {
      const errMsg = (error as Error).message
      // C-1: synthesis failures in debate mode are already surfaced via the debate-error socket
      // event; suppress the HTTP 500 error append to avoid a duplicate message in the list
      const isSynthesisErrorAlreadyShown = isDebateMode && /proposals were generated/i.test(errMsg)
      if (!isSynthesisErrorAlreadyShown) {
        setMessages((prev) => [...prev, { id: `error-${Date.now()}`, content: `Error: ${errMsg}`, sender: "agent", timestamp: new Date() }])
      }
      setIsProcessing(false)
    }
  }

  const handleLogout = async () => { await logout(); router.push("/login") }

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}`, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to load conversation")
      const data = await response.json()
      const conversation = data.data
      setMessages([]); setCurrentConversationId(conversationId)
      if (conversation.messages?.length > 0) {
        setMessages(conversation.messages.map((msg: any, i: number) => ({ id: `${conversationId}-${i}`, content: msg.content, sender: msg.role === "user" ? "user" : "agent", agent: msg.agentId || "manager", timestamp: new Date(msg.timestamp) })))
      }
      if (socketRef.current) socketRef.current.emit("join-conversation", conversationId)
    } catch { /* ignore */ }
  }

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  const handleShareMessage = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    if (message) { try { await navigator.clipboard.writeText(message.content) } catch { /* ignore */ } }
  }

  const enabledCount = agents.filter((a) => a.enabled).length

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts([
    { key: "/", ctrl: true, description: "Show keyboard shortcuts", action: () => setShowShortcutsDialog(true) },
    { key: "d", ctrl: true, description: "Go to dashboard",        action: () => router.push("/dashboard") },
    { key: "i", ctrl: true, description: "Focus message input",    action: () => chatInputRef.current?.focus() },
    { key: "l", ctrl: true, description: "Clear current chat",     action: () => { if (currentConversationId) clearConversation() } },
  ])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060e20" }}>
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-5xl" style={{ color: "#4edea3" }}>
            autorenew
          </span>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(220,226,249,0.4)", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
            Verifying credentials...
          </p>
        </div>
      </div>
    )
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const inputValue  = currentConversationId ? chatInput : taskDescription
  const setInput    = currentConversationId ? setChatInput : setTaskDescription
  const handleSubmit = currentConversationId ? sendFollowUpMessage : startTask
  // N-2: debate mode requires ≥ 2 agents — catch it client-side before a 400 round-trip
  const canSubmit   = currentConversationId
    ? !!chatInput.trim()
    : !!taskDescription.trim() && !isProcessing && isConnected &&
      (isDebateMode ? enabledCount >= 2 : enabledCount > 0)

  return (
    <div
      className="overflow-hidden"
      style={{ height: "100vh", background: "#060e20", color: "#dee5ff", fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 h-16 w-full"
        style={{ background: "#091328", boxShadow: "0 24px 24px -4px rgba(0,0,0,0.4)" }}
      >
        {/* Left: brand + nav */}
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter" style={{ color: "#78b0ff" }}>
            Synthetic Architect
          </span>
          <nav className="hidden md:flex gap-6">
            {["Workspaces", "Models", "Analytics"].map((item, i) => (
              <a
                key={item}
                className="font-medium text-sm pb-1 transition-colors"
                style={{
                  color: i === 0 ? "#78b0ff" : "#40485d",
                  borderBottom: i === 0 ? "2px solid #78b0ff" : "2px solid transparent",
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "#141f38", border: "1px solid rgba(64,72,93,0.15)" }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: "#4edea3" }}>dns</span>
            <span
              className="text-xs font-mono"
              style={{ color: "#a3aac4", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              SYSTEM: {isConnected ? "OPTIMAL" : "OFFLINE"}
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full ml-1"
              style={{ background: isConnected ? "#4edea3" : "#ff716c", boxShadow: isConnected ? "0 0 6px rgba(78,222,163,0.6)" : "none" }}
            />
          </div>

          <button
            onClick={() => setShowShortcutsDialog(true)}
            className="material-symbols-outlined p-2 transition-colors"
            style={{ color: "#40485d" }}
          >
            keyboard
          </button>

          <button
            onClick={handleLogout}
            className="material-symbols-outlined p-2 transition-colors"
            style={{ color: "#40485d" }}
          >
            logout
          </button>

          {/* User avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold"
            style={{ background: "#232a3b", borderColor: "rgba(173,198,255,0.2)", color: "#78b0ff" }}
          >
            {user?.fullName?.[0]?.toUpperCase() ?? "U"}
          </div>
        </div>
      </header>

      <main className="pt-16 h-screen flex overflow-hidden">
        {/* ── Left Sidebar ───────────────────────────────────────────────── */}
        <aside
          className="fixed left-0 top-0 pt-16 h-full flex flex-col z-40"
          style={{ width: 260, background: "#060e20", borderRight: "1px solid rgba(64,72,93,0.1)" }}
        >
          {/* Header */}
          <div className="px-6 py-4">
            <div
              className="text-xs uppercase tracking-widest mb-4"
              style={{ color: "#78b0ff", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              Neural Workspace
            </div>
            <button
              onClick={() => { clearConversation(); setLeftTab("threads") }}
              className="w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: "#5ba2ff", color: "#002347", boxShadow: "0 4px 20px rgba(91,162,255,0.1)" }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Session
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex px-4 mb-2 gap-1">
            {(["threads", "agents"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className="flex-1 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-all"
                style={{
                  background: leftTab === tab ? "rgba(120,176,255,0.1)" : "transparent",
                  color: leftTab === tab ? "#78b0ff" : "#40485d",
                  borderBottom: leftTab === tab ? "1px solid #78b0ff" : "1px solid transparent",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {leftTab === "threads" ? (
              /* Conversation history */
              <div className="flex flex-col h-full">
                <ConversationSidebar
                  onSelectConversation={handleSelectConversation}
                  currentConversationId={currentConversationId || undefined}
                  refreshTrigger={sidebarRefreshKey}
                />
              </div>
            ) : (
              /* Agent configuration */
              <div className="px-3 pb-4 space-y-3">
                {/* Team templates */}
                <div className="px-1 mt-2">
                  <div
                    className="text-[9px] uppercase tracking-widest font-bold mb-2"
                    style={{ color: "#6d758c", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                  >
                    Team Templates
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {teamTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTeamTemplate(t)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors"
                        style={{ background: "rgba(20,31,56,0.6)", border: "1px solid rgba(64,72,93,0.2)" }}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ color: "#78b0ff" }}>{t.icon}</span>
                        <span className="text-[10px] font-medium" style={{ color: "#a3aac4" }}>{t.name.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={clearAll}
                    className="w-full text-[10px] py-1 rounded transition-colors text-center"
                    style={{ background: "rgba(20,31,56,0.4)", color: "#6d758c", border: "1px solid rgba(64,72,93,0.2)" }}
                  >
                    Reset All
                  </button>
                </div>

                {/* Task description */}
                <div className="px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className="text-[9px] uppercase tracking-widest font-bold"
                      style={{ color: "#6d758c", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                    >
                      Task Description
                    </div>
                    {/* Debate Mode toggle */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="debate-mode-toggle"
                        checked={isDebateMode}
                        onChange={(e) => setIsDebateMode(e.target.checked)}
                        className="w-3 h-3 cursor-pointer"
                        style={{ accentColor: "#ff8a65" }}
                      />
                      <label
                        htmlFor="debate-mode-toggle"
                        className="text-[9px] uppercase tracking-widest font-bold cursor-pointer"
                        style={{
                          color: isDebateMode ? "#ff8a65" : "#6d758c",
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                        }}
                      >
                        Debate
                      </label>
                    </div>
                  </div>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe your task..."
                    className="w-full resize-none text-xs rounded-lg p-2 outline-none transition-all"
                    style={{ background: "#0f1930", border: "1px solid rgba(64,72,93,0.3)", color: "#dee5ff", fontFamily: "var(--font-inter), Inter, sans-serif" }}
                  />
                </div>

                {/* Agents */}
                {agents.map((agent) => {
                  const meta = getAgentMeta(agent.id)
                  return (
                    <div
                      key={agent.id}
                      className="rounded-lg p-3 transition-all"
                      style={{
                        background: agent.enabled ? "rgba(20,31,56,0.8)" : "rgba(15,25,48,0.5)",
                        border: `1px solid ${agent.enabled ? "rgba(120,176,255,0.2)" : "rgba(64,72,93,0.15)"}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={agent.enabled}
                          onChange={(e) => updateAgent(agent.id, { enabled: e.target.checked, status: e.target.checked ? "online" : "offline" })}
                          className="w-3 h-3 cursor-pointer"
                          style={{ accentColor: "#4edea3" }}
                        />
                        <span className="material-symbols-outlined text-base" style={{ color: meta.color }}>{meta.icon}</span>
                        <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                        {(agent.status === "thinking" || agent.status === "active") && (
                          <span className="text-[9px] animate-pulse" style={{ color: "#FFBF00", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                            {agent.status === "thinking" ? "thinking…" : "active…"}
                          </span>
                        )}
                      </div>
                      <input
                        value={agent.teamMember}
                        onChange={(e) => updateAgent(agent.id, { teamMember: e.target.value })}
                        className="w-full text-[11px] px-2 py-1 rounded mb-1.5 outline-none"
                        style={{ background: "#192540", border: "1px solid rgba(64,72,93,0.3)", color: "#dee5ff" }}
                        placeholder="Role name"
                      />
                      <textarea
                        value={agent.role}
                        onChange={(e) => updateAgent(agent.id, { role: e.target.value })}
                        rows={2}
                        className="w-full text-[10px] px-2 py-1 rounded resize-none outline-none"
                        style={{ background: "#192540", border: "1px solid rgba(64,72,93,0.3)", color: "#a3aac4" }}
                        placeholder="System prompt..."
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="p-4" style={{ borderTop: "1px solid rgba(64,72,93,0.1)" }}>
            {[{ icon: "dns", label: "System Status" }, { icon: "help_outline", label: "Help" }].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-2 py-2 transition-colors cursor-pointer" style={{ color: "#40485d" }}>
                <span className="material-symbols-outlined text-sm">{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Center Chat ─────────────────────────────────────────────────── */}
        <section
          className="flex flex-col relative"
          style={{ marginLeft: 260, marginRight: 260, background: "#060e20", flex: 1 }}
        >
          {/* Backend offline banner */}
          {!isConnected && (
            <div
              className="flex items-center gap-2 px-6 py-2 text-xs"
              style={{ background: "rgba(159,5,25,0.15)", borderBottom: "1px solid rgba(255,113,108,0.2)", color: "#ff716c", fontFamily: "var(--font-jetbrains-mono), monospace" }}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              Backend offline — start the server on port 3000
            </div>
          )}

          {/* Debate phase banner */}
          {debatePhase && (
            <div className="debate-phase-banner flex items-center gap-2 px-6 py-2 text-xs">
              <span className="material-symbols-outlined text-sm">psychology_alt</span>
              <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                {/* S-5: synthesis phase shows spinner + "SYNTHESIZING…" to indicate LLM work in progress */}
                DEBATE — {debatePhase === "synthesis" ? "SYNTHESIZING…" : `${debatePhase.toUpperCase()} PHASE`}
              </span>
              {debatePhase === "synthesis"
                ? <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                : <span className="debate-phase-dot" />}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 pb-44">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(120,176,255,0.1)", border: "1px solid rgba(120,176,255,0.2)" }}
                >
                  <span className="material-symbols-outlined text-5xl" style={{ color: "#78b0ff" }}>psychology_alt</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: "#dee5ff" }}>Neural Workspace Ready</h2>
                  <p className="text-sm" style={{ color: "#6d758c" }}>
                    {enabledCount > 0
                      ? `${enabledCount} agent${enabledCount > 1 ? "s" : ""} active — describe your task below`
                      : "Enable agents in the Agents tab, then describe your task below"}
                  </p>
                </div>
                {isProcessing && (
                  <div className="flex items-center gap-2" style={{ color: "#4edea3" }}>
                    <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                    <span className="text-xs" style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>Initializing session...</span>
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => {
                const meta = getAgentMeta(message.agent)
                if (message.sender === "user") {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div
                        className="max-w-2xl rounded-xl rounded-tr-sm p-4"
                        style={{ background: "#141f38", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
                      >
                        <p className="text-sm leading-relaxed" style={{ color: "#dee5ff" }}>{message.content}</p>
                        <p
                          className="text-[10px] mt-2 text-right"
                          style={{ color: "#40485d", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={message.id} className="flex gap-4">
                    {/* Agent avatar */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ color: meta.color }}>{meta.icon}</span>
                    </div>

                    {/* Message body */}
                    <div className="max-w-3xl space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-tight" style={{ color: meta.color }}>{meta.label}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}
                        >
                          {meta.role.toUpperCase()}
                        </span>
                        {(activeAgents.includes(message.agent ?? "") || message.streaming || message.typing) && (
                          <span className="text-[10px] animate-pulse" style={{ color: "#FFBF00", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                            {message.typing ? "thinking…" : "typing…"}
                          </span>
                        )}
                        {/* Debate challenge badges — shown when this agent was challenged */}
                        {/* I-4: guard with truthiness so empty-string key never matches */}
                        {message.agent && debateChallenges[message.agent]?.map((ch, i) => (
                          <span key={i} className="debate-challenge-badge" title={`${ch.fromAgent}: ${ch.critique}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>flag</span>
                            ← {ch.fromAgent.replace("agent-", "A")}
                          </span>
                        ))}
                        {/* Debate defense badges */}
                        {message.agent && debateDefenses[message.agent]?.map((d, i) => (
                          <span key={i} className={`debate-defense-badge debate-defense-badge--${d.stance}`}>
                            {d.stance === "defend" ? "defended" : d.stance === "concede" ? "conceded" : "partial"}
                          </span>
                        ))}
                      </div>

                      <div
                        className={`rounded-xl rounded-tl-sm p-5 ${message.streaming ? "streaming-bubble" : ""}`}
                        style={{ background: "#091328", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
                      >
                        {message.typing ? (
                          <div className="flex items-center gap-1 py-1">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="typing-dot w-2 h-2 rounded-full" style={{ background: meta.color }} />
                            ))}
                          </div>
                        ) : message.streaming ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#dee5ff" }}>
                            {message.content}
                            <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-text-bottom" style={{ background: "#4edea3" }} />
                          </p>
                        ) : message.type === "debate-synthesis" ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#dee5ff" }}>
                            {message.content.split(/(\[agent-[1-4]\])/g).map((part, i) => {
                              const m = part.match(/^\[agent-([1-4])\]$/)
                              if (m) {
                                const attrMeta = getAgentMeta(`agent-${m[1]}`)
                                return (
                                  <span key={i} className="attribution-badge"
                                    style={{ background: `${attrMeta.color}20`, color: attrMeta.color, border: `1px solid ${attrMeta.color}40` }}>
                                    {attrMeta.label}
                                  </span>
                                )
                              }
                              return <span key={i}>{part}</span>
                            })}
                          </p>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#dee5ff" }}>
                            {message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Chat Input ──────────────────────────────────────────────── */}
          <div
            className="absolute bottom-0 left-0 w-full p-6"
            style={{ background: "linear-gradient(to top, #060e20 60%, transparent)" }}
          >
            <div className="max-w-4xl mx-auto space-y-2">
              {/* Target selector (only when in conversation) */}
              {currentConversationId && (
                <div className="flex items-center gap-2 px-2">
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: "#6d758c", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    Route to:
                  </span>
                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="text-xs px-2 py-1 rounded outline-none"
                    style={{ background: "#0f1930", border: "1px solid rgba(64,72,93,0.3)", color: "#a3aac4", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                  >
                    <option value="all">All Agents</option>
                    {agents.filter((a) => a.enabled).map((a) => (
                      <option key={a.id} value={a.id}>{a.teamMember}</option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className="rounded-2xl p-2 shadow-2xl transition-all duration-300 glass-panel"
                style={{ border: "1px solid rgba(64,72,93,0.2)" }}
              >
                <textarea
                  ref={chatInputRef}
                  value={inputValue}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={currentConversationId ? (isProcessing ? "Add context for the next agent…" : "Send a follow-up message…") : "Define your neural task — describe what you need the agents to accomplish…"}
                  rows={2}
                  className="w-full bg-transparent border-none outline-none text-sm resize-none p-4"
                  style={{ color: "#dee5ff", fontFamily: "var(--font-inter), Inter, sans-serif" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
                      e.preventDefault()
                      if (canSubmit) handleSubmit()
                    }
                  }}
                />

                <div className="flex items-center justify-between px-2 pb-2">
                  <div className="flex gap-1">
                    {/* Agent selector shortcut */}
                    <button
                      onClick={() => setLeftTab("agents")}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: "#192540", border: "1px solid rgba(64,72,93,0.2)", color: "#a3aac4" }}
                    >
                      <span className="material-symbols-outlined text-sm">smart_toy</span>
                      {enabledCount > 0 ? `${enabledCount} Agents` : "No Agents"}
                      <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                    </button>

                    {currentConversationId && (
                      <button
                        onClick={clearConversation}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ background: "#192540", border: "1px solid rgba(64,72,93,0.2)", color: "#6d758c" }}
                        title="Clear conversation"
                      >
                        <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: canSubmit ? "#78b0ff" : "#192540",
                      color: canSubmit ? "#002f5c" : "#40485d",
                      boxShadow: canSubmit ? "0 4px 20px rgba(120,176,255,0.2)" : "none",
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                        RUNNING
                      </>
                    ) : currentConversationId ? (
                      <>
                        EXECUTE
                        <span className="material-symbols-outlined text-sm">send</span>
                      </>
                    ) : (
                      <>
                        DEPLOY
                        <span className="material-symbols-outlined text-sm">rocket_launch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-center gap-6">
                <span
                  className="text-[10px] uppercase tracking-widest font-bold"
                  style={{ color: "#40485d", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  Shift+Enter to submit
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest font-bold"
                  style={{ color: "#40485d", fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  ⌘K shortcuts
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right Sidebar — Agent Registry ──────────────────────────────── */}
        <aside
          className="fixed right-0 top-0 pt-16 h-full flex flex-col z-40"
          style={{ width: 260, background: "#060e20", borderLeft: "1px solid rgba(64,72,93,0.1)", fontFamily: "var(--font-jetbrains-mono), monospace" }}
        >
          {/* Header */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-sm font-bold" style={{ color: "#dee5ff" }}>Agent Registry</div>
                <div className="text-[10px]" style={{ color: "#6d758c" }}>
                  {enabledCount} Active Instance{enabledCount !== 1 ? "s" : ""}
                </div>
              </div>
              <span
                className="material-symbols-outlined text-lg animate-pulse"
                style={{ color: "#4edea3", fontVariationSettings: "'FILL' 1" }}
              >
                shield
              </span>
            </div>
          </div>

          {/* Agent list */}
          <nav className="flex-1 space-y-1 mt-2 overflow-y-auto">
            {agents.map((agent) => {
              const meta = getAgentMeta(agent.id)
              const isActive = agent.status === "active" || agent.status === "thinking"
              return (
                <div
                  key={agent.id}
                  className="pl-4 py-4 flex items-center justify-between pr-4 cursor-pointer transition-colors"
                  style={{
                    color: agent.enabled ? meta.color : "#40485d",
                    background: isActive ? `${meta.color}10` : "transparent",
                    borderRadius: isActive ? "0 0.5rem 0.5rem 0" : "0",
                    marginLeft: isActive ? 8 : 0,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{meta.label}</span>
                      <span className="text-[9px]" style={{ color: agent.enabled ? `${meta.color}70` : "#6d758c" }}>
                        {agent.status === "thinking" ? "thinking…" : agent.status === "active" ? "generating…" : meta.role}
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: agent.status === "active" ? meta.color : agent.status === "thinking" ? "#FFBF00" : agent.enabled ? "transparent" : "transparent",
                      border: (!agent.enabled || agent.status === "online") ? `1px solid ${agent.enabled ? meta.color : "#40485d"}` : "none",
                      boxShadow: isActive ? `0 0 8px ${meta.color}80` : agent.status === "thinking" ? "0 0 8px rgba(255,191,0,0.6)" : "none",
                      animation: agent.status === "thinking" ? "pulse 1s ease-in-out infinite" : "none",
                    }}
                  />
                </div>
              )
            })}

            {/* Manager */}
            <div
              className="pl-6 py-4 flex items-center justify-between pr-4"
              style={{ color: "#40485d" }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg">shield</span>
                <div className="flex flex-col">
                  <span className="font-bold text-xs">Manager</span>
                  <span className="text-[9px]" style={{ color: "#6d758c" }}>Safety Gate</span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ border: "1px solid #40485d" }} />
            </div>
          </nav>

          {/* Metrics */}
          <div className="p-6">
            <div
              className="rounded-xl p-4"
              style={{ background: "#0f1930", border: "1px solid rgba(64,72,93,0.1)" }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold" style={{ color: "#6d758c" }}>Compute Load</span>
                <span className="text-[10px] font-mono" style={{ color: "#4edea3" }}>
                  {isProcessing ? "RUNNING" : `${enabledCount * 6}%`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#192540" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isProcessing ? "68%" : `${enabledCount * 6}%`,
                    background: "#4edea3",
                    boxShadow: "0 0 8px rgba(78,222,163,0.4)",
                  }}
                />
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold" style={{ color: "#6d758c" }}>Status</span>
                <span className="text-[10px] font-mono" style={{ color: "#78b0ff" }}>
                  {isConnected ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog} />
    </div>
  )
}
