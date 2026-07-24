"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        await signOut();
        startTransition(() => {
          router.refresh();
          router.push("/");
        });
      }}
    >
      Sair
    </Button>
  );
}
