import type { IconComponent } from '../../icons';
import {
  BarChart3, Bell, BookOpen, Calendar, ClipboardCheck, Comments, Compass, Dashboard, FolderOpen, History, Layers,
  MessageSquare, Send, Settings, Sparkles, Users,
} from '../../icons';

export interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: Dashboard },
  { to: '/library', label: 'My Reviewers', icon: BookOpen },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/ai', label: 'AI Tools', icon: Sparkles },
  { to: '/chat', label: 'Study Chat', icon: MessageSquare },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/history', label: 'Study History', icon: History },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/messages', label: 'Messages', icon: Comments },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/feedback', label: 'Feedback', icon: Send },
  { to: '/settings', label: 'Settings', icon: Settings },
];
