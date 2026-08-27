import { ReferenceApp } from "@/src/components/ReferenceApp";
import { getPublicAuthConfig } from "@/src/auth/config";

export default function SignInPage() {
  return <ReferenceApp config={getPublicAuthConfig()} />;
}
