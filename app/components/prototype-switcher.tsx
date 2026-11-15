import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PrototypeVariantOption {
  key: string;
  name: string;
}

interface PrototypeSwitcherProps {
  variants: PrototypeVariantOption[];
  current: string;
  extraControls?: React.ReactNode;
  stateSummary?: React.ReactNode;
}

export function PrototypeSwitcher({
  variants,
  current,
  extraControls,
  stateSummary,
}: PrototypeSwitcherProps) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );
  const activeVariant = variants[currentIndex] ?? variants[0];

  function selectVariant(nextKey: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("variant", nextKey);
    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true }
    );
  }

  function cycle(delta: number) {
    const nextIndex =
      (currentIndex + delta + variants.length) % variants.length;
    selectVariant(variants[nextIndex].key);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycle(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        cycle(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
      {stateSummary && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/95 px-3.5 py-1 text-[11px] text-zinc-300 shadow-lg backdrop-blur-md">
          {stateSummary}
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-2xl ring-1 ring-white/10">
        <span className="rounded bg-violet-600/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 border border-violet-500/40">
          Prototype
        </span>
        <button
          type="button"
          onClick={() => cycle(-1)}
          title="Previous variant (←)"
          className="flex size-6 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-[230px] text-center font-mono text-xs">
          <span className="font-bold text-violet-400">{activeVariant.key}</span>{" "}
          <span className="font-sans text-zinc-200">
            ({activeVariant.name})
          </span>
        </div>
        <button
          type="button"
          onClick={() => cycle(1)}
          title="Next variant (→)"
          className="flex size-6 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ChevronRight className="size-4" />
        </button>
        {extraControls && (
          <div className="ml-1 flex items-center gap-1.5 border-l border-zinc-800 pl-2.5">
            {extraControls}
          </div>
        )}
      </div>
    </div>
  );
}
