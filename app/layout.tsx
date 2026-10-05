import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paano — AI-powered problem resolution",
  description: "Paano helps you understand problems, investigate possibilities, and figure out what to do next.",
  icons: {
    icon: "/what-now-favicon.png",
    shortcut: "/what-now-favicon.png",
    apple: "/what-now-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}