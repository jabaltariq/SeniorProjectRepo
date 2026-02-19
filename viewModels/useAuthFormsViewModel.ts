import { useState, useCallback } from 'react';
import { login, signUp } from '../services/authService';

/**
 * Form state for login/signup. Used by LoginView and SignUpView.
 * Calls authService, then onSuccess (from useAuthViewModel) to switch to main app.
 */
type AuthMode = 'login' | 'signup';

export function useAuthFormViewModel(mode: AuthMode, onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (email: string, password: string, confirmPassword?: string) => {
      setError(null);
      setLoading(true);
      try {
        if (mode === 'signup' && password !== (confirmPassword ?? '')) {
          // Signup only: validate passwords match
          throw new Error('Passwords do not match');
        }
        const result = mode === 'login' ? await login(email, password) : await signUp(email, password);
        if (result.success) onSuccess(); // triggers useAuthViewModel -> setAuthView(null)
        else throw new Error(result.error ?? `${mode === 'login' ? 'Login' : 'Sign up'} failed`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [mode, onSuccess]
  );

  return { error, loading, submit };
}

// Backwards-compatible exports
export const useLoginFormViewModel = (onSuccess: () => void) =>
  useAuthFormViewModel('login', onSuccess);
export const useSignUpFormViewModel = (onSuccess: () => void) =>
  useAuthFormViewModel('signup', onSuccess);
