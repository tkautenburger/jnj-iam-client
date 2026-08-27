import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polyphonic IAM Client",
  description: "Reference implementation for Polyphonic IAM frontend authentication"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
