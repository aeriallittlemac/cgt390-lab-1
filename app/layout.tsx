import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { Providers } from "@/context/Providers";
import { Header } from "@/components/header/Header";
import { AuthMenu } from "@/components/header/AuthMenu";
import { LocationDrawer } from "@/components/location/LocationDrawer";
import { CartDrawer } from "@/components/cart/CartDrawer";

export const metadata: Metadata = {
  title: "Slice Society — Pizza, delivered or pickup",
  description:
    "Order pizza for delivery or pickup, browse the menu, grab a deal, and track your order.",
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-Y7R4RY5XRY";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <Header
            auth={
              // Reading the session waits on the request; don't hold up the rest of the page.
              <Suspense fallback={<span className="inline-block h-9 w-20" aria-hidden="true" />}>
                <AuthMenu />
              </Suspense>
            }
          />
          <main className="flex-1">{children}</main>
          {/* Overlays live at the root so any page can open them. */}
          <LocationDrawer />
          <CartDrawer />
        </Providers>
      </body>
      <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
    </html>
  );
}
