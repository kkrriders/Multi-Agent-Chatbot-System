import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

// Predefined shortcuts for easy reference
export const SHORTCUTS = {
  NEW_CONVERSATION: { key: 'k', ctrl: true, description: 'New Conversation' },
  SEARCH: { key: 'f', ctrl: true, description: 'Search Conversations' },
  SEND_MESSAGE: { key: 'Enter', ctrl: true, description: 'Send Message' },
  DASHBOARD: { key: 'd', ctrl: true, description: 'Go to Dashboard' },
  SETTINGS: { key: ',', ctrl: true, description: 'Open Settings' },
  HELP: { key: '/', ctrl: true, description: 'Show Shortcuts' },
  FOCUS_INPUT: { key: 'i', ctrl: true, description: 'Focus Message Input' },
  CLEAR_CHAT: { key: 'l', ctrl: true, description: 'Clear Current Chat' },
  TOGGLE_THEME: { key: 't', ctrl: true, description: 'Toggle Theme' },
  ARCHIVE: { key: 'e', ctrl: true, description: 'Archive Conversation' },
};
