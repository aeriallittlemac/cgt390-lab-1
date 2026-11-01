import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { safeNext } from "@/lib/safeNext";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in — Slice Society" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
