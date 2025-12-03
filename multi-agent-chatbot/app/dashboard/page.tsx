'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, type User } from '@/lib/auth';
import {
  User as UserIcon,
  MessageSquare,
  Calendar,
  Activity,
  Settings,
  Download,
  Archive,
  TrendingUp,
  Clock,
  Bot,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ConversationStats {
  total: number;
  active: number;
  archived: number;
  thisWeek: number;
  thisMonth: number;
}

interface AgentUsage {
  agentId: string;
  agentName: string;
  count: number;
  percentage: number;
}

interface RecentActivity {
  id: string;
  type: 'conversation' | 'message' | 'export';
  title: string;
  timestamp: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationStats, setConversationStats] = useState<ConversationStats>({
    total: 0,
    active: 0,
    archived: 0,
    thisWeek: 0,
    thisMonth: 0,
  });
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
  });

  useEffect(() => {
    const verifyAuth = async () => {
      const authUser = await checkAuth();
      if (!authUser) {
        router.push('/login');
        return;
      }
      setUser(authUser);
      setProfileData({
        fullName: authUser.fullName,
        email: authUser.email,
      });
      setIsLoading(false);
      fetchDashboardData();
    };

    verifyAuth();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch conversations
      const conversationsRes = await fetch('http://localhost:3000/api/conversations?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (conversationsRes.ok) {
        const data = await conversationsRes.json();
        const conversations = data.data || [];

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const stats: ConversationStats = {
          total: conversations.length,
          active: conversations.filter((c: any) => c.status === 'active').length,
          archived: conversations.filter((c: any) => c.status === 'archived').length,
          thisWeek: conversations.filter((c: any) => new Date(c.createdAt) > weekAgo).length,
          thisMonth: conversations.filter((c: any) => new Date(c.createdAt) > monthAgo).length,
        };

        setConversationStats(stats);

        // Calculate agent usage (mock data for now)
        setAgentUsage([
          { agentId: 'agent-1', agentName: 'LLaMA3', count: 45, percentage: 35 },
          { agentId: 'agent-2', agentName: 'Mistral', count: 38, percentage: 30 },
          { agentId: 'agent-3', agentName: 'Phi3', count: 25, percentage: 20 },
          { agentId: 'agent-4', agentName: 'Qwen2.5', count: 20, percentage: 15 },
        ]);

        // Recent activity
        const activities: RecentActivity[] = conversations
          .slice(0, 5)
          .map((c: any) => ({
            id: c._id,
            type: 'conversation' as const,
            title: c.title,
            timestamp: c.updatedAt,
          }));

        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:3000/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: profileData.fullName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
        setIsEditingProfile(false);
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Welcome back, {user?.fullName}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={() => router.push('/chat')} className="bg-blue-600 hover:bg-blue-700">
              <MessageSquare className="h-4 w-4 mr-2" />
              Go to Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white dark:bg-slate-800">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="profile">
              <UserIcon className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversationStats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {conversationStats.active} active, {conversationStats.archived} archived
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversationStats.thisWeek}</div>
                  <p className="text-xs text-muted-foreground">New conversations created</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversationStats.thisMonth}</div>
                  <p className="text-xs text-muted-foreground">Conversations this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversationStats.active}</div>
                  <p className="text-xs text-muted-foreground">Ongoing conversations</p>
                </CardContent>
              </Card>
            </div>

            {/* Agent Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Usage</CardTitle>
                <CardDescription>Your most frequently used AI agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentUsage.map((agent) => (
                  <div key={agent.agentId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{agent.agentName}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{agent.count} uses</span>
                    </div>
                    <Progress value={agent.percentage} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest conversations and actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => router.push('/chat')}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Manage your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-2xl">
                      {user?.fullName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{user?.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <Badge variant="secondary" className="mt-2">Active Account</Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      className="bg-gray-100 dark:bg-gray-800"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-2">
                    {isEditingProfile ? (
                      <>
                        <Button onClick={handleUpdateProfile}>Save Changes</Button>
                        <Button variant="outline" onClick={() => {
                          setIsEditingProfile(false);
                          setProfileData({
                            fullName: user?.fullName || '',
                            email: user?.email || '',
                          });
                        }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setIsEditingProfile(true)}>Edit Profile</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Statistics</CardTitle>
                <CardDescription>Your usage and activity summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="text-lg font-semibold">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Login</p>
                    <p className="text-lg font-semibold">
                      {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Track your recent actions and conversations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</p>
                        </div>
                        <Badge variant="outline">{activity.type}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how the app looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Configure your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive updates about your conversations</p>
                  </div>
                  <Badge>Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">Auto-save conversations</p>
                  <Badge variant="secondary">Enabled</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Contact support to delete your account
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
