"use client"

import { useState, useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Bot,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Settings,
  Zap,
  Activity,
  Sparkles,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface Message {
  id: string
  content: string
  sender: "user" | "agent"
  agent?: string
  timestamp: Date
  typing?: boolean
}

interface Agent {
  id: string
  name: string
  model: string
  port: number
  status: "online" | "offline" | "loading" | "active"
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
  color: string
  icon: string
  agents: Partial<Agent>[]
}

export default function MultiAgentChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [taskDescription, setTaskDescription] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [taskProgress, setTaskProgress] = useState(0)
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [selectedTarget, setSelectedTarget] = useState<"all" | string>("all")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const [agents, setAgents] = useState<Agent[]>([
    {
      id: "agent-1",
      name: "Agent 1",
      model: "llama3:latest",
      port: 3001,
      status: "online",
      description: "Team Member 1",
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
      role: "You are a helpful AI assistant. Provide detailed and accurate responses to help accomplish the given task.",
      enabled: true,
      teamMember: "Team Member 1",
      performance: 95,
      messagesCount: 0,
    },
    {
      id: "agent-2",
      name: "Agent 2",
      model: "mistral:latest",
      port: 3002,
      status: "online",
      description: "Team Member 2",
      color: "bg-gradient-to-r from-purple-500 to-purple-600",
      role: "You are a knowledgeable AI assistant. Analyze the task from your unique perspective and provide valuable insights.",
      enabled: true,
      teamMember: "Team Member 2",
      performance: 88,
      messagesCount: 0,
    },
    {
      id: "agent-3",
      name: "Agent 3",
      model: "phi3:latest",
      port: 3003,
      status: "online",
      description: "Team Member 3",
      color: "bg-gradient-to-r from-green-500 to-green-600",
      role: "You are an efficient AI assistant focused on practical solutions and implementation details.",
      enabled: false,
      teamMember: "Team Member 3",
      performance: 92,
      messagesCount: 0,
    },
    {
      id: "agent-4",
      name: "Agent 4",
      model: "qwen2.5-coder:latest",
      port: 3004,
      status: "online",
      description: "Team Member 4",
      color: "bg-gradient-to-r from-orange-500 to-orange-600",
      role: "You are a specialized AI assistant with expertise in technical analysis and problem-solving.",
      enabled: false,
      teamMember: "Team Member 4",
      performance: 90,
      messagesCount: 0,
    },
  ])

  const teamTemplates: TeamTemplate[] = [
    {
      id: "coding",
      name: "Coding Team",
      color: "from-blue-500 to-cyan-500",
      icon: "💻",
      agents: [
        {
          role: "You are a senior software architect. Design system architecture and provide technical leadership.",
          teamMember: "Senior Architect",
        },
        {
          role: "You are a full-stack developer. Implement features and write clean, maintainable code.",
          teamMember: "Full-Stack Developer",
        },
        {
          role: "You are a QA engineer. Test functionality and ensure code quality and reliability.",
          teamMember: "QA Engineer",
        },
        {
          role: "You are a DevOps engineer. Handle deployment, infrastructure, and CI/CD processes.",
          teamMember: "DevOps Engineer",
        },
      ],
    },
    {
      id: "research",
      name: "Research Team",
      color: "from-purple-500 to-pink-500",
      icon: "🔬",
      agents: [
        {
          role: "You are a research lead. Coordinate research efforts and synthesize findings.",
          teamMember: "Research Lead",
        },
        {
          role: "You are a data analyst. Analyze data patterns and extract meaningful insights.",
          teamMember: "Data Analyst",
        },
        {
          role: "You are a subject matter expert. Provide deep domain knowledge and expertise.",
          teamMember: "Domain Expert",
        },
        {
          role: "You are a research assistant. Gather information and support research activities.",
          teamMember: "Research Assistant",
        },
      ],
    },
    {
      id: "business",
      name: "Business Team",
      color: "from-green-500 to-emerald-500",
      icon: "📊",
      agents: [
        {
          role: "You are a business strategist. Develop strategic plans and business solutions.",
          teamMember: "Business Strategist",
        },
        {
          role: "You are a product manager. Define requirements and manage product development.",
          teamMember: "Product Manager",
        },
        {
          role: "You are a marketing specialist. Create marketing strategies and promotional content.",
          teamMember: "Marketing Specialist",
        },
        {
          role: "You are a financial analyst. Analyze costs, ROI, and financial implications.",
          teamMember: "Financial Analyst",
        },
      ],
    },
    {
      id: "creative",
      name: "Creative Team",
      color: "from-orange-500 to-red-500",
      icon: "🎨",
      agents: [
        {
          role: "You are a creative director. Lead creative vision and artistic direction.",
          teamMember: "Creative Director",
        },
        {
          role: "You are a UX/UI designer. Design user experiences and intuitive interfaces.",
          teamMember: "UX/UI Designer",
        },
        {
          role: "You are a content creator. Develop engaging content and compelling narratives.",
          teamMember: "Content Creator",
        },
        {
          role: "You are a brand strategist. Develop brand identity and messaging strategies.",
          teamMember: "Brand Strategist",
        },
      ],
    },
  ]

  useEffect(() => {
    const connectToBackend = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        if (response.ok) {
          setIsConnected(true);
          // Initialize Socket.IO connection when backend is available
          if (!socketRef.current) {
            initializeSocket();
          }
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Failed to connect to backend:', error);
        setIsConnected(false);
      }
    };
    
    connectToBackend();
    const interval = setInterval(connectToBackend, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(interval);
      // Cleanup socket on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [])

  const initializeSocket = () => {
    console.log('🔌 Initializing Socket.IO connection...');
    socketRef.current = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 60000,
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to backend via Socket.IO');
    });

    socketRef.current.on('conversation-update', (data) => {
      try {
        console.log('💬 Received conversation update:', data);
        if (data.message) {
          // Create a message first to check for duplicates
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            content: data.message.content,
            sender: data.message.from === 'user' ? 'user' : 'agent',
            agent: data.message.agentId || 'manager',
            timestamp: new Date(data.message.timestamp),
          };
          
          // Check for duplicate messages using messageId or content+agent+time
          setMessages((prevMessages) => {
            const messageId = data.message.messageId;
            let isDuplicate = false;
            
            if (messageId) {
              // Check by messageId if available
              isDuplicate = prevMessages.some(existingMsg => 
                existingMsg.id.includes(messageId)
              );
            } else {
              // Fallback to content+agent+time check
              isDuplicate = prevMessages.some(existingMsg => 
                existingMsg.content === newMessage.content && 
                existingMsg.agent === newMessage.agent &&
                Math.abs(existingMsg.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000
              );
            }
            
            if (isDuplicate) {
              console.log('🚫 Duplicate message detected, skipping:', newMessage.content.substring(0, 50));
              return prevMessages; // Return unchanged
            }
            
            // Use messageId in the frontend message ID if available
            if (messageId) {
              newMessage.id = `${messageId}-${Date.now()}`;
            }
            
            console.log('💬 Adding new message to chat:', newMessage);
            return [...prevMessages, newMessage];
          });

          // Update progress and agent status for non-user messages
          if (data.message.from !== 'user') {
            const agentId = data.message.agentId;
            if (agentId && agentId.startsWith('agent-')) {
              updateAgent(agentId, {
                status: data.message.type === 'manager-conclusion' ? 'online' : 'active',
                messagesCount: agents.find((a) => a.id === agentId)?.messagesCount + 1 || 1,
              });
              
              // Add to active agents if not already there
              setActiveAgents(prev => {
                if (!prev.includes(agentId)) {
                  return [...prev, agentId];
                }
                return prev;
              });
            }

            // Check if task is complete
            if (data.message.type === 'manager-conclusion') {
              console.log('🎯 Task completed!');
              setIsProcessing(false);
              setActiveAgents([]);
              setTaskProgress(100);
            }
          }
        }
      } catch (error) {
        console.error('Error handling conversation update:', error);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Disconnected from backend:', reason);
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const applyTeamTemplate = (template: TeamTemplate) => {
    setAgents((prevAgents) =>
      prevAgents.map((agent, index) => ({
        ...agent,
        role: template.agents[index]?.role || agent.role,
        teamMember: template.agents[index]?.teamMember || agent.teamMember,
        enabled: index < template.agents.length,
        status: index < template.agents.length ? "online" : "offline",
      })),
    )
  }

  const clearAll = () => {
    setAgents((prevAgents) =>
      prevAgents.map((agent) => ({
        ...agent,
        enabled: false,
        status: "offline",
        role: "You are a helpful AI assistant. Provide detailed and accurate responses to help accomplish the given task.",
        teamMember: `Team Member ${agent.id.split("-")[1]}`,
      })),
    )
  }

  const updateAgent = (agentId: string, updates: Partial<Agent>) => {
    setAgents((prevAgents) => prevAgents.map((agent) => (agent.id === agentId ? { ...agent, ...updates } : agent)))
  }

  const sendFollowUpMessage = async () => {
    if (!chatInput.trim() || !currentConversationId || !socketRef.current) {
      return
    }

    console.log('💬 Sending follow-up message:', chatInput)

    try {
      if (selectedTarget === "all") {
        // Send to all enabled agents - the backend will handle broadcasting
        const enabledAgents = agents.filter(agent => agent.enabled)
        
        const response = await fetch('http://localhost:3000/continue-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: currentConversationId,
            message: chatInput,
            participants: enabledAgents.map(agent => ({
              agentId: agent.id,
              agentName: agent.teamMember
            }))
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to continue conversation')
        }
        // Don't add user message here - it will come via Socket.IO
      } else {
        // Send to specific agent - the backend will handle broadcasting
        const targetAgent = agents.find(agent => agent.id === selectedTarget)
        if (!targetAgent) {
          throw new Error('Target agent not found')
        }

        const response = await fetch('http://localhost:3000/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: chatInput,
            agentId: selectedTarget,
            agentName: targetAgent.teamMember,
            conversationId: currentConversationId
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to send message')
        }
        // Don't add messages here - they will come via Socket.IO
      }

      setChatInput("")
    } catch (error) {
      console.error('Error sending follow-up message:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `Error sending message: ${error.message}`,
        sender: "agent",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const clearConversation = () => {
    setMessages([])
    setCurrentConversationId(null)
    setIsProcessing(false)
    setTaskProgress(0)
    setActiveAgents([])
    setChatInput("")
    console.log('🗑️ Conversation cleared')
  }

  const startTask = async () => {
    if (!taskDescription.trim()) return

    console.log('🚀 Starting task:', taskDescription)
    setIsProcessing(true)
    setMessages([])
    setTaskProgress(0)
    setActiveAgents([])

    // Add task description as initial message
    const taskMessage: Message = {
      id: Date.now().toString(),
      content: `Task: ${taskDescription}`,
      sender: "user",
      timestamp: new Date(),
    }
    setMessages([taskMessage])
    console.log('📝 Added user message:', taskMessage)

    try {
      // Prepare enabled agents for the API call
      const enabledAgents = agents.filter((agent) => agent.enabled)
      const agentData = enabledAgents.map(agent => ({
        agentId: agent.id,
        agentName: agent.teamMember,
        customPrompt: agent.role
      }))

      if (!socketRef.current || !socketRef.current.connected) {
        throw new Error('Socket.IO not connected. Please refresh the page and try again.')
      }

      const conversationId = `work-${Date.now()}`
      
      // Join the conversation room BEFORE starting the API call
      console.log('🔗 Joining conversation room:', conversationId)
      socketRef.current.emit('join-conversation', conversationId)

      // Call the flexible work session API
      console.log('📡 Calling API with agents:', agentData)
      const response = await fetch('http://localhost:3000/flexible-work-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: taskDescription,
          agents: agentData,
          conversationId: conversationId,
          managerRole: "Senior project manager who reviews all work and provides strategic guidance and final recommendations"
        })
      })

      console.log('📡 API Response status:', response.status)
      const result = await response.json()
      console.log('📡 API Response data:', result)

      if (result.success) {
        console.log('✅ Work session started successfully, waiting for real-time updates...')
        setCurrentConversationId(conversationId)
        
        // The socket connection is already set up and listening for updates
        // Progress will be updated via the conversation-update events
        
        // Set up a timeout to reset state if something goes wrong
        setTimeout(() => {
          if (isProcessing) {
            console.warn('⚠️ Work session timeout, resetting state')
            setIsProcessing(false)
            setActiveAgents([])
          }
        }, 180000) // 3 minute timeout

      } else {
        throw new Error(result.error || 'Failed to start task')
      }

    } catch (error) {
      console.error('Error starting task:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: `Error starting task: ${error.message}. Please make sure the backend server is running on localhost:3000.`,
        sender: "agent",
        timestamp: new Date(),
      }])
      setIsProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "active":
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case "loading":
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case "offline":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const enabledAgentsCount = agents.filter((a) => a.enabled).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <Sparkles className="inline h-8 w-8 mr-2 text-blue-500" />
              Flexible Multi-Agent Work System
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Define custom prompts for each agent and watch them collaborate in real-time!
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {isConnected ? "Connected" : "Connecting..."}
              </span>
            </div>
            {enabledAgentsCount > 0 && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                <Zap className="h-3 w-3 mr-1" />
                {enabledAgentsCount} Agents Ready
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Left Sidebar - Agent Configuration */}
        <div className="w-1/3 border-r bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 p-4 overflow-y-auto">
          {/* Connection Status */}
          {!isConnected && (
            <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">
                  Backend server not connected. Please start the backend server on port 3000.
                </p>
              </div>
            </div>
          )}

          {/* Team Templates */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Team Templates
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {teamTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTeamTemplate(template)}
                  className={`text-xs h-auto p-3 bg-gradient-to-r ${template.color} text-white border-0 hover:scale-105 transition-all duration-200 shadow-sm`}
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">{template.icon}</div>
                    <div className="font-medium">{template.name}</div>
                  </div>
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="w-full text-xs bg-slate-50 hover:bg-slate-100"
            >
              Clear All
            </Button>

            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mt-4 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="text-lg">💡</div>
                <div>
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium mb-1">Quick Start</p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                    Click a template above to get started, or create your own custom team setup!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Task Input */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Task Description
            </h3>
            <Textarea
              placeholder="Describe your task or project (e.g., 'Create a React web app for task management', 'Research the impact of AI on healthcare', 'Develop marketing strategy for a startup')"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="min-h-[100px] text-sm bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-700 rounded-xl shadow-sm"
            />
            <div className="mt-3 p-3 bg-slate-50/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">Project Manager Role:</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Senior project manager who reviews all work and provides strategic guidance and final recommendations
              </div>
            </div>
          </div>

          {/* Agent Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agent Configuration
            </h3>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`border rounded-xl p-4 transition-all duration-200 shadow-sm ${
                  agent.enabled
                    ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 shadow-md"
                    : "bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    checked={agent.enabled}
                    onCheckedChange={(checked) =>
                      updateAgent(agent.id, {
                        enabled: !!checked,
                        status: checked ? "online" : "offline",
                      })
                    }
                    className="data-[state=checked]:bg-blue-500"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`${agent.color} text-white text-xs font-bold`}>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{agent.name}</span>
                      {getStatusIcon(agent.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-xs text-slate-500">Performance:</div>
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${agent.performance}%` }}
                        />
                      </div>
                      <div className="text-xs font-medium text-green-600">{agent.performance}%</div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <Input
                    value={agent.teamMember}
                    onChange={(e) => updateAgent(agent.id, { teamMember: e.target.value })}
                    className="text-xs h-8 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                    placeholder="Team member role"
                  />
                </div>

                <Textarea
                  value={agent.role}
                  onChange={(e) => updateAgent(agent.id, { role: e.target.value })}
                  className="text-xs min-h-[80px] resize-none bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                  placeholder="Define the agent's role and behavior..."
                />

                {agent.messagesCount > 0 && (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {agent.messagesCount} messages sent
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Live Collaboration */}
        <div className="flex-1 flex flex-col bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
          {/* Task Header */}
          <div className="border-b p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Live Collaboration</h2>
                  {isProcessing && (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={taskProgress} className="w-32 h-2" />
                      <span className="text-xs text-slate-500">{Math.round(taskProgress)}%</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={startTask}
                  disabled={!taskDescription.trim() || isProcessing || !agents.some((a) => a.enabled) || !isConnected}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="h-4 w-4" />
                  {!isConnected ? "Backend Disconnected" : isProcessing ? "Processing..." : "Start Task"}
                </Button>
                {currentConversationId && (
                  <Button
                    onClick={clearConversation}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    🗑️ Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                    <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl inline-block mb-4">
                      <Bot className="h-16 w-16 mx-auto text-blue-500" />
                    </div>
                    <p className="text-xl font-semibold mb-2 text-slate-700 dark:text-slate-300">
                      Ready for Collaboration
                    </p>
                    <p className="text-sm text-slate-500">Configure your agents and describe a task to get started</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="space-y-2">
                      {message.sender === "user" ? (
                        <div className={`rounded-xl p-4 shadow-sm ${
                          message.content.startsWith('Task:') 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800'
                            : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800 ml-8'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1 rounded-full ${
                              message.content.startsWith('Task:') ? 'bg-blue-500' : 'bg-green-500'
                            }`}>
                              {message.content.startsWith('Task:') ? (
                                <Users className="h-3 w-3 text-white" />
                              ) : (
                                <MessageSquare className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className={`font-semibold ${
                              message.content.startsWith('Task:') 
                                ? 'text-blue-900 dark:text-blue-100' 
                                : 'text-green-900 dark:text-green-100'
                            }`}>
                              {message.content.startsWith('Task:') ? 'Task Assignment' : 'You'}
                            </span>
                          </div>
                          <p className={`font-medium ${
                            message.content.startsWith('Task:') 
                              ? 'text-blue-800 dark:text-blue-200' 
                              : 'text-green-800 dark:text-green-200'
                          }`}>{message.content}</p>
                        </div>
                      ) : (
                        <div
                          className={`bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm transition-all duration-200 ${
                            message.typing
                              ? "border-blue-300 dark:border-blue-700 animate-pulse"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={agents.find((a) => a.id === message.agent)?.color}>
                                <Bot className="h-4 w-4 text-white" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  {agents.find((a) => a.id === message.agent)?.teamMember}
                                </span>
                                {activeAgents.includes(message.agent || "") && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                    <Activity className="h-2 w-2 mr-1" />
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">{message.timestamp.toLocaleTimeString()}</span>
                            </div>
                          </div>
                          <div className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                            {message.typing ? (
                              <div className="flex items-center gap-2 text-blue-600">
                                <div className="flex gap-1">
                                  <div
                                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                    style={{ animationDelay: "0ms" }}
                                  />
                                  <div
                                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                    style={{ animationDelay: "150ms" }}
                                  />
                                  <div
                                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                    style={{ animationDelay: "300ms" }}
                                  />
                                </div>
                                {message.content}
                              </div>
                            ) : (
                              message.content
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input - Only show after task has started */}
            {currentConversationId && (
              <div className="border-t p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="flex flex-col gap-3">
                  {/* Target Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Send to:</span>
                    <select
                      value={selectedTarget}
                      onChange={(e) => setSelectedTarget(e.target.value)}
                      className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                    >
                      <option value="all">All Agents</option>
                      {agents.filter(agent => agent.enabled).map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.teamMember}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Continue the conversation, ask questions, or provide additional guidance..."
                      className="flex-1 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendFollowUpMessage()
                        }
                      }}
                    />
                    <Button
                      onClick={sendFollowUpMessage}
                      disabled={!chatInput.trim()}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Send
                    </Button>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    💡 You can now chat with your agents in real-time! Ask follow-up questions, provide clarifications, or discuss specific aspects of the task.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
