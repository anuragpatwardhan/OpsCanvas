import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <Logo size={36} showWordmark={false} />
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-ink">Nothing here</h1>
        <p className="mt-2 text-[13px] text-ink-muted max-w-sm">
          The page you're looking for doesn't exist — or was deep-linked to a thread that has been resolved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-gradient-to-br from-brand to-brand-deep text-white text-[13px] font-medium hover:from-brand-glow hover:to-brand transition-colors"
        >
          Back to Canvas
        </Link>
      </div>
    </div>
  );
}
