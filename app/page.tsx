import { ReferenceApp } from "@/src/components/ReferenceApp";
import { getPublicAuthConfig } from "@/src/auth/config";

export default function HomePage() {
  return <ReferenceApp config={getPublicAuthConfig()} />;
}
