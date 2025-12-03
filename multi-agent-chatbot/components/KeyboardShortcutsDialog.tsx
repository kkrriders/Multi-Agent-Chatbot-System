'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  category: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_CATEGORIES: Shortcut[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Create new conversation' },
      { keys: ['Ctrl', 'F'], description: 'Search conversations' },
      { keys: ['Ctrl', 'D'], description: 'Go to dashboard' },
      { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    category: 'Chat Actions',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: 'Send message' },
      { keys: ['Ctrl', 'I'], description: 'Focus message input' },
      { keys: ['Ctrl', 'L'], description: 'Clear current chat' },
      { keys: ['Esc'], description: 'Close dialog/modal' },
    ],
  },
  {
    category: 'Conversation Management',
    shortcuts: [
      { keys: ['Ctrl', 'E'], description: 'Archive conversation' },
      { keys: ['↑', '↓'], description: 'Navigate conversations' },
      { keys: ['Enter'], description: 'Open selected conversation' },
    ],
  },
  {
    category: 'Appearance',
    shortcuts: [
      { keys: ['Ctrl', 'T'], description: 'Toggle theme (light/dark)' },
    ],
  },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.category}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs px-2 py-0.5 bg-white dark:bg-gray-800"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Pro tip:</strong> Press <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border text-xs">/</kbd> anytime to view this help dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
