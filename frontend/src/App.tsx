import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { LoginCallback } from './pages/LoginCallback';
import { AppLayout } from './pages/AppLayout';
import { Chat } from './pages/Chat';
import { Profile } from './pages/Profile';
import { Albums } from './pages/Albums';
import { Friends } from './pages/Friends';
import { Settings } from './pages/Settings';
import { Home } from './pages/Home';
import { Nearby } from './pages/Nearby';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login/callback" element={<LoginCallback />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="chat/:userId" element={<Chat />} />
        <Route path="profile" element={<Profile />} />
        <Route path="albums" element={<Albums />} />
        <Route path="friends" element={<Friends />} />
        <Route path="nearby" element={<Nearby />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
