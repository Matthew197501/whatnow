import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paano — AI-powered problem resolution",
  description:
    "Paano helps you understand problems, investigate possibilities, and figure out what to do next.",
  icons: {
    icon: "/what-now-favicon.png",
    shortcut: "/what-now-favicon.png",
    apple: "/what-now-favicon.png",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Paano",
  url: "https://paanoai.vercel.app/",
  description:
    "Paano helps you understand problems, investigate possibilities, and figure out what to do next.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  creator: {
    "@type": "Person",
    name: "Samuel Mallo",
    url: "https://samuelmallo.vercel.app/",
    sameAs: [
      "https://www.linkedin.com/in/samuel-mallo-37aa322a4/",
      "https://github.com/Matthew197501",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script
          id="paano-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        {children}
      </body>
    </html>
  );
}