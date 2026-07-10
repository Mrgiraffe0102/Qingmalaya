/**
 * App shell — BrowserRouter with protected admin routes.
 * Routes are placeholders for Phase 7 (Tasks 26-33) buildout.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import UsersPage from '@/pages/Users';
import ClassesPage from '@/pages/Classes';
import PodcastsPage from '@/pages/Podcasts';
import CommentsPage from '@/pages/Comments';
import BannedKeywordsPage from '@/pages/BannedKeywords';
import TagsPage from '@/pages/Tags';
import BannersPage from '@/pages/Banners';
import CollectionsPage from '@/pages/Collections';
import UploadsPage from '@/pages/Uploads';
import AnnouncementsPage from '@/pages/Announcements';
import AdminsPage from '@/pages/Admins';
import SettingsPage from '@/pages/Settings';
import LogsPage from '@/pages/Logs';
import { isAuthenticated } from '@/store/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="podcasts" element={<PodcastsPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="banned-keywords" element={<BannedKeywordsPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="uploads" element={<UploadsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
