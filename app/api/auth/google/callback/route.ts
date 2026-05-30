import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/calendar', req.url))

  const { tokens } = await oauth2Client.getToken(code)

  const res = NextResponse.redirect(new URL('/calendar', req.url))

  res.cookies.set('g_access_token', tokens.access_token ?? '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    maxAge: 3600, path: '/'
  })
  if (tokens.refresh_token) {
    res.cookies.set('g_refresh_token', tokens.refresh_token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, path: '/'
    })
  }

  return res
}
