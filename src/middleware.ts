import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("kf_session")?.value;
  const valid = token ? await isValid(token) : false;

  if (pathname.startsWith("/login")) {
    if (valid) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!valid) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete("kf_session");
    return response;
  }
  return NextResponse.next();
}

async function isValid(token: string) {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|uploads/).*)"],
};
