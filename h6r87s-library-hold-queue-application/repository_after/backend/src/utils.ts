export function isValidEmailSimple(email: unknown): email is string {
  return (
    typeof email === "string" && email.includes("@") && email.includes(".")
  );
}

export function asInt(x: unknown): number | null {
  const n = Number(x);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export function assertNever(_x: never): never {
  throw new Error("Unexpected value");
}
