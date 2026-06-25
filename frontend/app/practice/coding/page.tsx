'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { useRequireAuth } from '@/hooks/useRequireAuth'

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false })

const PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.',
    constraints: 'O(n) time, O(n) space',
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Your solution here
};`,
      python: `def two_sum(nums: list[int], target: int) -> list[int]:
    # Your solution here
    pass`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your solution here
    }
}`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Your solution here
    }
};`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Your solution here
};`,
      go: `func twoSum(nums []int, target int) []int {
    // Your solution here
}`,
    },
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid. An input string is valid if brackets are closed in the correct order.',
    constraints: 'O(n) time, O(n) space',
    starterCode: {
      javascript: `function isValid(s) {
  // Your solution here
};`,
      python: `def is_valid(s: str) -> bool:
    # Your solution here
    pass`,
      java: `class Solution {
    public boolean isValid(String s) {
        // Your solution here
    }
}`,
      cpp: `class Solution {
public:
    bool isValid(string s) {
        // Your solution here
    }
};`,
      typescript: `function isValid(s: string): boolean {
  // Your solution here
};`,
      go: `func isValid(s string) bool {
    // Your solution here
}`,
    },
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index. Otherwise, return -1.',
    constraints: 'O(log n) time, O(1) space',
    starterCode: {
      javascript: `function search(nums, target) {
  // Your solution here
};`,
      python: `def search(nums: list[int], target: int) -> int:
    # Your solution here
    pass`,
      java: `class Solution {
    public int search(int[] nums, int target) {
        // Your solution here
    }
}`,
      cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Your solution here
    }
};`,
      typescript: `function search(nums: number[], target: number): number {
  // Your solution here
};`,
      go: `func search(nums []int, target int) int {
    // Your solution here
}`,
    },
  },
  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    description: 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
    constraints: 'O(n) time, O(1) space',
    starterCode: {
      javascript: `function reverseList(head) {
  // Your solution here
};`,
      python: `def reverse_list(head):
    # Your solution here
    pass`,
      java: `class Solution {
    public ListNode reverseList(ListNode head) {
        // Your solution here
    }
}`,
      cpp: `class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        // Your solution here
    }
};`,
      typescript: `function reverseList(head: ListNode | null): ListNode | null {
  // Your solution here
};`,
      go: `func reverseList(head *ListNode) *ListNode {
    // Your solution here
}`,
    },
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum. (Kadane\'s Algorithm)',
    constraints: 'O(n) time, O(1) space',
    starterCode: {
      javascript: `function maxSubArray(nums) {
  // Your solution here
};`,
      python: `def max_sub_array(nums: list[int]) -> int:
    # Your solution here
    pass`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Your solution here
    }
}`,
      cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Your solution here
    }
};`,
      typescript: `function maxSubArray(nums: number[]): number {
  // Your solution here
};`,
      go: `func maxSubArray(nums []int) int {
    // Your solution here
}`,
    },
  },
]

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Hard: 'text-red-600 bg-red-50 border-red-200',
}

type Language = 'javascript' | 'python' | 'java' | 'cpp' | 'typescript' | 'go'

export default function CodingPracticePage() {
  const { loading: authLoading } = useRequireAuth()
  const [selectedProblem, setSelectedProblem] = useState(PROBLEMS[0])
  const [language, setLanguage] = useState<Language>('javascript')
  const [output, setOutput] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const selectProblem = (p: typeof PROBLEMS[0]) => {
    setSelectedProblem(p)
    setOutput(null)
    setEditorKey(k => k + 1)
  }

  const handleRun = () => {
    setOutput(`// Output panel (execution not available in practice mode)\n// Tip: Walk through your solution mentally or paste into a local environment.\n\n// Selected language: ${language}\n// Problem: ${selectedProblem.title}`)
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
    </div>
  )

  return (
    <div className="bg-background text-on-background min-h-screen flex font-sans antialiased">
      <Sidebar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-6 pb-24 md:pb-8 w-full overflow-x-hidden flex flex-col" style={{ height: '100vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-slate-muted hover:text-primary text-xs font-medium flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Dashboard
              </Link>
              <span className="text-slate-muted text-xs">/</span>
              <span className="text-xs text-on-surface font-medium">Code Practice</span>
            </div>
            <h1 className="font-geist font-bold text-2xl md:text-3xl text-on-background">Code Practice</h1>
          </div>
          <Link
            href="/practice/system-design"
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-muted hover:text-primary hover:border-primary/40 transition-colors"
          >
            <span className="material-symbols-outlined text-base">schema</span>
            <span className="hidden sm:inline">Switch to System Design</span>
            <span className="sm:hidden">Design</span>
          </Link>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
          {/* Problem panel */}
          <div className="md:w-72 shrink-0 flex flex-col gap-3">
            {/* Problem list */}
            <div className="bg-white rounded-xl border border-outline-variant/15 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Problems</p>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {PROBLEMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProblem(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                      selectedProblem.id === p.id
                        ? 'bg-primary-container/10 text-primary'
                        : 'hover:bg-surface-container-lowest/50 text-on-surface'
                    }`}
                  >
                    <span className="text-sm font-medium">{p.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_COLOR[p.difficulty]}`}>
                      {p.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Problem description */}
            <div className="bg-white rounded-xl border border-outline-variant/15 p-4 shadow-sm flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-geist font-semibold text-base text-on-surface">{selectedProblem.title}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[selectedProblem.difficulty]}`}>
                  {selectedProblem.difficulty}
                </span>
              </div>
              <p className="text-sm text-slate-muted leading-relaxed mb-3">{selectedProblem.description}</p>
              {selectedProblem.constraints && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-surface-container-lowest rounded-lg px-3 py-2">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  {selectedProblem.constraints}
                </div>
              )}
            </div>
          </div>

          {/* Editor panel */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="bg-white rounded-xl border border-outline-variant/15 shadow-sm flex-1 p-4 flex flex-col min-h-0" style={{ minHeight: 400 }}>
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-bold text-slate-muted uppercase tracking-wider">Editor</p>
                <button
                  onClick={handleRun}
                  className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-emerald-deep transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Run
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  key={`${selectedProblem.id}-${editorKey}`}
                  starterCode={selectedProblem.starterCode[language] || selectedProblem.starterCode.javascript}
                  constraints={selectedProblem.constraints}
                  onChange={(_, lang) => setLanguage(lang as Language)}
                />
              </div>
            </div>

            {/* Output panel */}
            {output !== null && (
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-4 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Output</p>
                  <button
                    onClick={() => setOutput(null)}
                    className="ml-auto text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">{output}</pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
