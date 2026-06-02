'use client';

import { useState } from 'react';

import Image from 'next/image';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@/lib/validations/auth';
import type { LoginFormData } from '@/lib/validations/auth';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginFormData) {
    setServerError(null);
    try {
      await signIn(data.email, data.password);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  }

  const fieldCls = (hasError: boolean) => cn(
    'block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm text-slate-900',
    'placeholder:text-slate-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
    hasError
      ? 'border-danger-400 focus:ring-danger-400'
      : 'border-slate-300 focus:border-primary-700 focus:ring-primary-700'
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* ── Logo ─────────────────────────────────────────── */}
        <div className="mb-4 flex flex-col items-center">
          <Image
            src="/logos/negozio-textogrueso-largo.png"
            alt="Negozio"
            width={200}
            height={40}
            className="object-contain"
            priority
          />
        </div>

        {/* ── Card ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Iniciar sesión</h2>

          {/* Error del servidor */}
          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-lg border border-danger-200
                         bg-danger-50 px-4 py-3 text-sm text-danger-700"
            >
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="nombre@tienda.com"
                  disabled={isSubmitting}
                  className={fieldCls(!!errors.email)}
                />
              </div>
              {errors.email && <p className="text-xs text-danger-600">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={cn(fieldCls(!!errors.password), 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger-600">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                mt-1 flex w-full items-center justify-center gap-2 rounded-lg
                bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white
                transition-colors hover:bg-primary-800 active:bg-primary-900
                focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando sesión…
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Negozio © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
