"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Sparkles, Zap, Users, Shield, Globe, Check } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Multi-Agent AI
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                How It Works
              </a>
              <a href="#pricing" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Pricing
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-700 dark:text-slate-300">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 md:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-950 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Powered by Advanced AI Models
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Collaborate with AI Agents Like Never Before
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Harness the power of multiple specialized AI agents working together to solve complex problems,
            generate creative solutions, and accelerate your workflow.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="lg" variant="outline" className="border-2 border-slate-300 dark:border-slate-700 text-lg px-8 py-6 hover:bg-slate-100 dark:hover:bg-slate-800">
                Try Demo
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>14-day free trial</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
              Powerful Features for Modern Teams
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Everything you need to build, collaborate, and innovate with AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl w-fit mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Multi-Agent Collaboration</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Multiple AI agents work together on your tasks, each bringing unique perspectives and expertise.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl w-fit mb-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Real-Time Responses</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Get instant feedback and see agents collaborating in real-time through WebSocket technology.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl w-fit mb-4">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Specialized AI Models</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Choose from LLaMA3, Mistral, Phi3, and Qwen2.5-Coder for different expertise areas.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl w-fit mb-4">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Secure & Private</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Your data stays protected with enterprise-grade security and content moderation.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl w-fit mb-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Custom Teams</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Create specialized teams for coding, research, business, or creative projects.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-700">
              <div className="p-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl w-fit mb-4">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Smart Memory</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Agents remember context and learn from conversations for better assistance over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Configure Your Team</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Select AI agents and customize their roles to match your project needs
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Describe Your Task</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Tell the AI what you want to accomplish - no technical expertise required
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Watch Them Collaborate</h3>
              <p className="text-slate-600 dark:text-slate-400">
                See agents work together in real-time and get comprehensive solutions
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of teams already using Multi-Agent AI to accelerate their projects
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-xl text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Multi-Agent AI</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Collaborative AI that works together to solve complex problems.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3 text-slate-900 dark:text-white">Product</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600">Features</a></li>
                <li><a href="#" className="hover:text-blue-600">Pricing</a></li>
                <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3 text-slate-900 dark:text-white">Company</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600">About</a></li>
                <li><a href="#" className="hover:text-blue-600">Blog</a></li>
                <li><a href="#" className="hover:text-blue-600">Careers</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3 text-slate-900 dark:text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
                <li><a href="#" className="hover:text-blue-600">Terms</a></li>
                <li><a href="#" className="hover:text-blue-600">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-600 dark:text-slate-400">
            <p>© 2025 Multi-Agent AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
