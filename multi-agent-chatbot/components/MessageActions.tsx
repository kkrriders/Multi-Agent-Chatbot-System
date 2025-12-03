'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Copy,
  RefreshCw,
  Edit,
  Trash2,
  Share2,
  Check,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
  };
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  className?: string;
}

export function MessageActions({
  message,
  onCopy,
  onRegenerate,
  onEdit,
  onDelete,
  onShare,
  onFeedback,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    onFeedback?.(message.id, type);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Quick Actions - Always Visible on Hover */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        title="Copy message"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Regenerate - Only for Assistant Messages */}
      {message.role === 'assistant' && onRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRegenerate(message.id)}
          title="Regenerate response"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Feedback - Only for Assistant Messages */}
      {message.role === 'assistant' && onFeedback && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
              feedbackGiven === 'positive' && 'opacity-100 text-green-600'
            )}
            onClick={() => handleFeedback('positive')}
            title="Good response"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
              feedbackGiven === 'negative' && 'opacity-100 text-red-600'
            )}
            onClick={() => handleFeedback('negative')}
            title="Bad response"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="More actions"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy message
          </DropdownMenuItem>

          {message.role === 'user' && onEdit && (
            <DropdownMenuItem onClick={() => onEdit(message.id)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit message
            </DropdownMenuItem>
          )}

          {message.role === 'assistant' && onRegenerate && (
            <DropdownMenuItem onClick={() => onRegenerate(message.id)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate response
            </DropdownMenuItem>
          )}

          {onShare && (
            <DropdownMenuItem onClick={() => onShare(message.id)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share message
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(message.id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete message
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
