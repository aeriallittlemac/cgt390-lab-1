import type { Metadata } from "next";
import { MenuBrowser } from "@/components/menu/MenuBrowser";

export const metadata: Metadata = { title: "Menu — Slice Society" };

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Menu</h1>
      <MenuBrowser />
    </div>
  );
}
