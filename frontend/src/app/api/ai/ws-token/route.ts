import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SignJWT } from 'jose';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const wsToken = await new SignJWT({ sub: session.user.email, type: 'ws' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('60s')
    .sign(secret);

  return NextResponse.json({ token: wsToken });
}
