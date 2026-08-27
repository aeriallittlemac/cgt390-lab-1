const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatPrice(value: number): string {
  return formatter.format(value);
}

export function Price({ value }: { value: number }) {
  return <span>{formatPrice(value)}</span>;
}
