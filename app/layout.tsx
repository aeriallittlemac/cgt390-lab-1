import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/context/Providers";
import { Header } from "@/components/header/Header";
import { LocationDrawer } from "@/components/location/LocationDrawer";
import { CartDrawer } from "@/components/cart/CartDrawer";

export const metadata: Metadata = {
  title: "Slice Society — Pizza, delivered or pickup",
  description:
    "Order pizza for delivery or pickup, browse the menu, grab a deal, and track your order.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          {/* Overlays live at the root so any page can open them. */}
          <LocationDrawer />
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
