import { useState, useCallback } from 'react';
import { getSession, logout as logoutService } from '../services/authService';

/**
 * Holds which auth screen to show. App.tsx reads authView and renders:
 *   - 'login'  -> LoginView
 *   - 'signup' -> SignUpView
 *   - null     -> DashboardView (main app)
 */
export type AuthView = 'login' | 'signup' | null;

export function useAuthViewModel() {
  // null = already logged in (show main app), 'login' = show login form
  const [authView, setAuthView] = useState<AuthView>(() => (getSession() ? null : 'login'));

  const isAuthenticated = authView === null;

  const showLogin = useCallback(() => setAuthView('login'), []);
  const showSignUp = useCallback(() => setAuthView('signup'), []);
  // Called by useAuthFormViewModel after successful login/signup -> switch to main app
  const onLoginSuccess = useCallback(() => setAuthView(null), []);
  const onSignUpSuccess = useCallback(() => setAuthView(null), []);

  const logout = useCallback(() => {
    logoutService();
    setAuthView('login'); // back to login screen
  }, []);

  const userEmail = getSession();
  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '';

  return {
    authView,
    isAuthenticated,
    userEmail,
    userInitials,
    showLogin,
    showSignUp,
    onLoginSuccess,
    onSignUpSuccess,
    logout,
  };
}
