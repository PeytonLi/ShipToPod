import { ControlCenter } from "@/components/dashboard/control-center";

export default function HomePage() {
  return (
    <>
      <section className="relative border-b border-white/[0.06] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-serif text-4xl text-white sm:text-5xl lg:text-6xl">
            Distill code mastery
            <br />
            <span className="text-zinc-500">into small models</span>
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            ShipToPod finds a small code model&apos;s blind spots, verifies them
            by running real tests, and distills a DeepSeek teacher&apos;s fixes
            into it via LoRA on real GPUs &mdash; all live, all autonomous.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span className="live-dot text-zinc-400">
              Code test-run audits
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span className="live-dot text-zinc-400">
              Discriminative pair filtering
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span className="live-dot text-zinc-400">Live LoRA training</span>
          </div>
        </div>
      </section>

      <ControlCenter />
    </>
  );
}
