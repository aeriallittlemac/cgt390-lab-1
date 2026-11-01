import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { safeNext } from "@/lib/safeNext";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create account — Slice Society" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Create an account</h1>
      <AuthForm mode="signup" next={next} />
    </div>
  );
}
