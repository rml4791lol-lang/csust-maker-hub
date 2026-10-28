"use client";

import { useRouter } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-auth-provider";

export default function LoginPage() {
  const router = useRouter();
  return <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
    <AdminLoginForm onSuccess={() => router.replace("/admin")} />
  </div>;
}
