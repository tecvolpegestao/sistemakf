"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import type { FormState } from "@/lib/types";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await signIn(email, password);
  if (!user) return { error: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
