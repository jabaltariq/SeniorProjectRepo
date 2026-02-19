import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AuthInputProps {
  label: string;
  type: 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  Icon: LucideIcon;
  required?: boolean;
  minLength?: number;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  Icon,
  required = true,
  minLength,
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-white placeholder-slate-500"
        required={required}
        minLength={minLength}
      />
    </div>
  </div>
);
