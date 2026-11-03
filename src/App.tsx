import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/AuthRecoveryPages';
import DashboardPage from './pages/DashboardPage';
import LibraryPage from './pages/LibraryPage';
import UploadPage from './pages/UploadPage';
import ReviewerDetailPage from './pages/ReviewerDetailPage';
import CollectionsPage from './pages/CollectionsPage';
import FriendsPage from './pages/FriendsPage';
import MessagesPage from './pages/MessagesPage';
import CalendarPage from './pages/CalendarPage';
import FlashcardsPage from './pages/FlashcardsPage';
import DeckPage from './pages/DeckPage';
import QuizzesPage from './pages/QuizzesPage';
import AIToolsPage from './pages/AIToolsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import StudyChatPage from './pages/StudyChatPage';
import FeedbackPage from './pages/FeedbackPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/reviewers/:id" element={<ReviewerDetailPage />} />
        <Route path="/discover" element={<LibraryPage mode="discover" />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/flashcards/:deckId" element={<DeckPage />} />
        <Route path="/quizzes" element={<QuizzesPage />} />
        <Route path="/ai" element={<AIToolsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/chat" element={<StudyChatPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
