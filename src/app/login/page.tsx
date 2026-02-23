import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  checkCredentials,
  createSessionCookie,
  SESSION_COOKIE_NAME,
  COOKIE_OPTIONS,
} from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function loginAction(formData: FormData) {
    'use server';
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const valid = await checkCredentials(username, password);
    if (!valid) {
      redirect('/login?error=1');
    }

    const token = await createSessionCookie();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 p-8 bg-background rounded-lg border shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Roofing CRM</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">Invalid username or password.</p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
