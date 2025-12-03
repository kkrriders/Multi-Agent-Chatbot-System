'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, Archive, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Message {
  role: string;
  content: string;
  timestamp: Date;
}

interface Conversation {
  _id: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  metadata?: {
    totalMessages: number;
    lastMessageAt: string;
  };
}

interface ConversationSidebarProps {
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export default function ConversationSidebar({
  onSelectConversation,
  currentConversationId,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    fetchConversations();
  }, [activeTab]);

  useEffect(() => {
    filterConversations();
  }, [searchQuery, conversations]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch(
        `http://localhost:3000/api/conversations?status=${activeTab}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterConversations = () => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
    setFilteredConversations(filtered);
  };

  const createNewConversation = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'New Conversation',
          agentType: 'manager',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const data = await response.json();
      onSelectConversation(data.data._id);
      fetchConversations();
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const archiveConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const token = localStorage.getItem('token');

      await fetch(`http://localhost:3000/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'archived' }),
      });

      fetchConversations();
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');

      await fetch(`http://localhost:3000/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Conversations
          </h2>
          <Button
            size="sm"
            onClick={createNewConversation}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-gray-800"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'archived'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Archive className="h-4 w-4 inline mr-1" />
            Archived
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => onSelectConversation(conversation._id)}
                className={`group p-3 mb-2 rounded-lg cursor-pointer transition-all ${
                  currentConversationId === conversation._id
                    ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {conversation.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {activeTab === 'active' && (
                      <button
                        onClick={(e) => archiveConversation(conversation._id, e)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteConversation(conversation._id, e)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatDate(conversation.updatedAt)}
                  </span>
                  {conversation.metadata?.totalMessages && (
                    <Badge variant="secondary" className="text-xs">
                      {conversation.metadata.totalMessages} messages
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
