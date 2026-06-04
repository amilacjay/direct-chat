import React from 'react';
import { useAuthStore } from '../store/auth';

export const Home: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Welcome{user ? `, ${user.display_name}` : ''}!
        </h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Select someone from the online users panel to start chatting.
          Messages go peer-to-peer when possible.
        </p>
      </div>
    </div>
  );
};
