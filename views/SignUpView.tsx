import React from 'react';
import { Mail, Lock } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { AuthInput } from '../components/AuthInput';

interface SignUpViewProps {
  onSwitchToLogin: () => void;
  onSubmit: (email: string, password: string, confirmPassword: string) => void;
  error: string | null;
  loading: boolean;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onSwitchToLogin,
  onSubmit,
  error,
  loading,
}) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password, confirmPassword);
  };

  return (
    <AuthLayout title="Create account">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            Icon={Mail}
          />
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
            Icon={Lock}
            minLength={6}
          />
          <AuthInput
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
            Icon={Lock}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p className="mt-6 text-center text-slate-400 text-sm">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="text-blue-400 hover:text-blue-300 font-bold">
            Log in
          </button>
        </p>
      </form>
    </AuthLayout>
  );
};
