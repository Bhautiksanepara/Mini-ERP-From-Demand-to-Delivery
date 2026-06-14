import { useEffect, useState } from 'react';
import { getAccessToken } from '../services/apiClient';
import { fetchCurrentUser, login, logout, signup } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setIsBooting(false);
      return;
    }

    fetchCurrentUser()
      .then(setUser)
      .catch(logout)
      .finally(() => setIsBooting(false));
  }, []);

  async function signIn(credentials) {
    const nextUser = await login(credentials);
    setUser(nextUser);
  }

  async function signUp(form) {
    const nextUser = await signup(form);
    setUser(nextUser);
  }

  function signOut() {
    logout();
    setUser(null);
  }

  function updateUser(patch) {
    setUser((current) => ({ ...current, ...patch }));
  }

  return {
    isBooting,
    user,
    signIn,
    signOut,
    signUp,
    updateUser
  };
}
