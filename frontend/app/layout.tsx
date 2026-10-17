import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmLink — Fresh from Tanzanian farms",
  description: "Shop crops, livestock, eggs and dairy directly from verified Tanzanian farmers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
