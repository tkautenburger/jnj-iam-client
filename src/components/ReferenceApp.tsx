import { AuthProvider } from "@/src/auth/AuthProvider";
import type { PublicAuthConfig } from "@/src/auth/types";
import { AuthStatusPanel } from "./AuthStatusPanel";

export function ReferenceApp({ config }: { config: PublicAuthConfig }) {
  return (
    <AuthProvider config={config}>
      <AuthStatusPanel config={config} />
    </AuthProvider>
  );
}
