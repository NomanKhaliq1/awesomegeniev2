import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato"
});

export const metadata: Metadata = {
  title: "Awesome Genie",
  description: "AwesomeTech AI onboarding chatbot"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={lato.variable}>{children}</body>
    </html>
  );
}
