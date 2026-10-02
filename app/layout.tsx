import type { Metadata } from "next";
import "./globals.css";
import "./recovery.css";

export const metadata: Metadata = {
  title: "SABI",
  description: "AI agent for the informal economy"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
