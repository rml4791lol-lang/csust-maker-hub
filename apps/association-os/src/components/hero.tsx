"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProductPreview, type PreviewProject } from "./product-preview";
import { GeometryMark } from "./geometry-mark";

const HeroScene = dynamic(() => import("./hero-scene").then((module) => module.HeroScene), { ssr: false });
const sceneQuery = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
function subscribe(callback: () => void) {
  const query = window.matchMedia(sceneQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function Hero({ activeProjectCount, projects }: { activeProjectCount: number; projects: PreviewProject[] }) {
  const ref = useRef<HTMLElement>(null);
  const showScene = useSyncExternalStore(subscribe, () => window.matchMedia(sceneQuery).matches, () => false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 60, damping: 18, mass: 0.4 });
  const smoothY = useSpring(pointerY, { stiffness: 60, damping: 18, mass: 0.4 });
  const x = useTransform(smoothX, [-1, 1], [-10, 10]);
  const y = useTransform(smoothY, [-1, 1], [-6, 6]);
  const scroll = useMotionValue(0);
  const scrollY = useTransform(scroll, [0, 1], ["0%", "12%"]);
  const scale = useTransform(scroll, [0, 1], [1, 1.04]);

  useEffect(() => {
    const hero = ref.current;
    const container = hero?.closest("main");
    if (!showScene || !hero || !container) return;
    // The app scrolls inside main, not the window.
    const update = () => scroll.set(Math.min(1, Math.max(0,
      (container.getBoundingClientRect().top - hero.getBoundingClientRect().top) / hero.offsetHeight)));
    update();
    container.addEventListener("scroll", update, { passive: true });
    return () => container.removeEventListener("scroll", update);
  }, [scroll, showScene]);

  return (
    <section ref={ref} onPointerMove={(event) => {
      if (!showScene || event.pointerType === "touch") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      pointerX.set((event.clientX - bounds.left) / bounds.width * 2 - 1);
      pointerY.set((event.clientY - bounds.top) / bounds.height * 2 - 1);
    }} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }} className="hero-stage grain relative isolate -mx-4 -mt-6 overflow-hidden border-b border-border md:-mx-8 md:-mt-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {showScene ? <motion.div className="absolute inset-0" style={{ y: scrollY, scale }}>
          <motion.div className="absolute inset-0" style={{ x, y }}><HeroScene /></motion.div>
        </motion.div> : <GeometryMark className="absolute right-0 top-1/2 h-[360px] w-[360px] -translate-y-1/2 text-primary/70 md:right-[38%] md:h-[600px] md:w-[600px]" />}
        <div className="hero-halo absolute inset-0" />
        <div className="hero-grid absolute inset-0" />
      </div>
      <div aria-hidden="true" className="hero-legibility pointer-events-none absolute inset-0" />
      <div className="pointer-events-none relative z-10 grid min-h-[260px] items-center gap-10 px-4 py-8 md:min-h-[400px] md:px-8 md:py-10 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <h1 className="hero-reveal text-[32px] font-bold leading-[1.16] tracking-tight sm:text-[44px] xl:text-[52px]">把想法，<br />做成<span className="text-accent">下一件</span>作品。</h1>
          <p style={{ animationDelay: "60ms" }} className="hero-reveal mt-5 max-w-md text-base leading-relaxed text-foreground-secondary"><span className="text-foreground">{activeProjectCount} 个项目</span>正在推进，记录每一步探索。</p>
          <div style={{ animationDelay: "140ms" }} className="hero-reveal mt-4 flex flex-wrap items-center gap-4 md:mt-6">
            <Link href="/projects" className="pointer-events-auto inline-flex min-h-12 items-center gap-3 rounded-md bg-foreground px-4 text-base font-semibold text-background transition-colors hover:bg-white">进入项目工作台<ArrowRight className="h-4 w-4" /></Link>
            <Link href="/footprints" className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-4 text-base text-foreground-secondary backdrop-blur-sm hover:border-primary/60 hover:text-foreground">记录足迹</Link>
          </div>
        </div>
        <div style={{ animationDelay: "220ms" }} className="hero-reveal pointer-events-auto hidden xl:block"><ProductPreview projects={projects} activeProjectCount={activeProjectCount} /></div>
      </div>
    </section>
  );
}
