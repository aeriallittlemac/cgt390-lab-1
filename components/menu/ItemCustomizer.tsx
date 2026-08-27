"use client";

import { useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/lib/types";
import { formatPrice } from "@/components/common/Price";

export function ItemCustomizer({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={item !== null}
      onClose={onClose}
      side="right"
      title={item?.name ?? "Customize"}
    >
      {/* Keyed so each item opens with a fresh form — no reset effect needed. */}
      {item && <CustomizerForm key={item.id} item={item} onClose={onClose} />}
    </Drawer>
  );
}

function CustomizerForm({
  item,
  onClose,
}: {
  item: MenuItem;
  onClose: () => void;
}) {
  const { addItem, openCart } = useCart();
  const [size, setSize] = useState(0);
  const [crust, setCrust] = useState(0);
  const [toppings, setToppings] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const unitPrice =
    item.basePrice + (item.sizes[size]?.priceDelta ?? 0) + toppings.length * 1.5;

  function toggleTopping(t: string) {
    setToppings((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function handleAdd() {
    addItem({
      menuItemId: item.id,
      name: item.name,
      size: item.sizes[size]?.label ?? "",
      crust: item.crusts[crust] ?? "",
      toppings,
      qty,
      unitPrice: +unitPrice.toFixed(2),
    });
    onClose();
    openCart();
  }

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-zinc-500">{item.description}</p>

      {item.sizes.length > 0 && (
        <Field label="Size">
          <div className="flex flex-wrap gap-2">
            {item.sizes.map((s, i) => (
              <Chip key={s.label} active={i === size} onClick={() => setSize(i)}>
                {s.label}
                {s.priceDelta > 0 ? ` +${formatPrice(s.priceDelta)}` : ""}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      {item.crusts.length > 0 && (
        <Field label="Crust">
          <div className="flex flex-wrap gap-2">
            {item.crusts.map((c, i) => (
              <Chip key={c} active={i === crust} onClick={() => setCrust(i)}>
                {c}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      {item.toppings.length > 0 && (
        <Field label="Add-ons (+$1.50 each)">
          <div className="flex flex-wrap gap-2">
            {item.toppings.map((t) => (
              <Chip
                key={t}
                active={toppings.includes(t)}
                onClick={() => toggleTopping(t)}
              >
                {t}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="Quantity">
        <div className="inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-700">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-1.5"
          >
            −
          </button>
          <span className="min-w-8 text-center">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-1.5"
          >
            +
          </button>
        </div>
      </Field>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700"
      >
        Add {qty} to cart · {formatPrice(unitPrice * qty)}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{label}</h3>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
