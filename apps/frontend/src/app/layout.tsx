import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "leaflet/dist/leaflet.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Ever After — Your celebration, beautifully together",
    template: "%s | Ever After",
  },
  description:
    "A thoughtful space for two families to plan wedding events, share wishlists, and celebrate every moment together.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
