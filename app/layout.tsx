import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "What Now?",
  description: "Problem resolution engine",
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