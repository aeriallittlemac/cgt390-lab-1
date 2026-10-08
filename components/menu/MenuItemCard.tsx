"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { Deal, MenuItem } from "@/lib/types";
import { formatPrice } from "@/components/common/Price";
import { Badge } from "@/components/common/Badge";
import { DealPopover } from "./DealPopover";

/**
 * A menu card whose deal panel follows the disclosure pattern: the "Deal"
 * button toggles it (aria-expanded). It also opens on mouse hover and when
 * keyboard focus reaches the Customize button. Escape dismisses it without
 * moving focus (WCAG 1.4.13), and the Customize button is described by the
 * panel so screen readers announce the deal too.
 */
export function MenuItemCard({
  item,
  deals,
  onCustomize,
}: {
  item: MenuItem;
  deals: Deal[];
  onCustomize: (item: MenuItem) => void;
}) {
  const popoverId = useId();
  const cardRef = useRef<HTMLLIElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasDeals = deals.length > 0;
  const open = hasDeals && !dismissed && (hovered || focused || pinned);

  // A popover opened by tap/click closes when the user interacts elsewhere.
  useEffect(() => {
    if (!pinned) return;
    function handlePointerDown(e: PointerEvent) {
      if (!cardRef.current?.contains(e.target as Node)) setPinned(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pinned]);

  function toggle() {
    if (open) {
      setDismissed(true);
      setPinned(false);
    } else {
      setDismissed(false);
      setPinned(true);
    }
  }

  return (
    <li
      ref={cardRef}
      className="relative flex flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        setHovered(true);
        setDismissed(false);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovered(false);
      }}
      onFocus={(e) => {
        const enteringCard = !e.currentTarget.contains(e.relatedTarget);
        if (enteringCard) setDismissed(false);
        // Only keyboard focus opens it; a tap that focuses a button shouldn't.
        // The Deal button is excluded so Enter on it always toggles predictably.
        const target = e.target as Element;
        setFocused(
          target !== badgeRef.current && target.matches(":focus-visible"),
        );
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setFocused(false);
        setPinned(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setDismissed(true);
          setPinned(false);
        }
      }}
    >
      {hasDeals && (
        <>
          <button
            ref={badgeRef}
            type="button"
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={toggle}
            className="absolute right-3 top-3 z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <Badge>
              Deal<span className="sr-only"> details for {item.name}</span>
            </Badge>
          </button>
          <div
            id={popoverId}
            className={`absolute bottom-full left-0 z-50 mb-2 transition-opacity duration-150 ${
              open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
            }`}
          >
            <DealPopover deals={deals} />
          </div>
        </>
      )}

      {/* Sizes mirror MenuBrowser's grid: 1 col, 2 at sm, 3 at lg in a max-w-6xl container. */}
      <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={item.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 370px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <h3 className="font-semibold">{item.name}</h3>
      <p className="mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {formatPrice(item.basePrice)}
        </span>
        <button
          type="button"
          onClick={() => onCustomize(item)}
          aria-describedby={hasDeals ? popoverId : undefined}
          className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Customize
        </button>
      </div>
    </li>
  );
}
