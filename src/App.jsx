import React, { useEffect, useMemo, useRef, useState } from "react";
import { rulebook, NB } from "./sentiment";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import Lenis from "@studio-freight/lenis";
import Lottie from "lottie-react";

/* ========== Local Storage Hook ========== */
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initialValue; }
    catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

/* ========== Sounds (Web Audio) + tiny haptics ========== */
function useSFX(enabled) {
  const ctxRef = useRef(null);
  const unlockedRef = useRef(false);
  function ensureAudio() {
    if (!enabled) return;
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    unlockedRef.current = true;
  }
  function playTone({ freq = 880, type = "sine", dur = 0.15, vol = 0.12, decay = 0.95 }) {
    if (!enabled) return;
    ensureAudio();
    const ctx = ctxRef.current; if (!ctx || !unlockedRef.current) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination); o.start();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * decay + 0.05);
    o.stop(t0 + dur + 0.1);
  }
  function vibe(pattern = 40) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {} }
  function ding(){ playTone({ freq: 1046.5, type: "triangle", dur: 0.12, vol: 0.14 }); setTimeout(()=>playTone({ freq: 1318.5, type: "triangle", dur: 0.12, vol: 0.14 }), 80); vibe(20); }
  function buzz(){ playTone({ freq: 220, type: "square", dur: 0.2, vol: 0.11 }); vibe([40,40,40]); }
  function click(){ playTone({ freq: 650, type: "square", dur: 0.06, vol: 0.08 }); }
  function cheer(){ [880,988,1174,1318].forEach((f,i)=>setTimeout(()=>playTone({freq:f,type:"sine",dur:0.12,vol:0.12}), i*90)); vibe([30,50,30]); }
  useEffect(()=>{ const onFirst=()=>ensureAudio(); window.addEventListener("pointerdown", onFirst, {once:true}); return ()=>window.removeEventListener("pointerdown", onFirst); },[]);
  return { ding, buzz, click, cheer };
}

/* ========== Read Aloud (TTS) ========== */
function useTTS(enabled) {
  function speak(text){ if(!enabled || !("speechSynthesis" in window)) return; try{ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1; u.pitch=1.1; window.speechSynthesis.speak(u);}catch{} }
  function stop(){ if(!enabled) return; try{ window.speechSynthesis.cancel(); }catch{} }
  return { speak, stop };
}

/* ========== Confetti + Animations + Soft Overlays ========== */
function useAnimations(enabled) {
  useEffect(() => {
    if (document.getElementById("safari-anims")) return;
    const style = document.createElement("style");
    style.id = "safari-anims";
    style.innerHTML = `
      @keyframes pop-in { 0%{transform:scale(.94); opacity:0} 100%{transform:scale(1); opacity:1} }
      @keyframes floaty { 0%{transform:translateY(0)} 50%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
      @keyframes shake { 0%,100% {transform: translateX(0)} 20% {transform: translateX(-6px)} 40% {transform: translateX(6px)} 60% {transform: translateX(-4px)} 80% {transform: translateX(4px)} }
      @keyframes rainbow { 0%{background-position:0% 50%} 100%{background-position:100% 50%} }
      .animate-pop { animation: pop-in .35s ease-out; }
      .animate-floaty { animation: floaty 2.4s ease-in-out infinite; }
      .animate-shake { animation: shake .35s ease-in-out; }
      .rainbow { background: linear-gradient(90deg, #14b8a6, #06b6d4, #38bdf8); background-size: 300% 100%; animation: rainbow 4s linear infinite; }
      .glass { backdrop-filter: blur(16px); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); }
      .sparkle { position:fixed; font-size:18px; pointer-events:none; animation: sparkle-fall 1.8s linear forwards; }
      @keyframes sparkle-fall { to { transform: translateY(110vh) rotate(360deg); opacity: .9; } }
      .overlay-soft{
        background:
          radial-gradient(1200px 600px at 25% 25%, rgba(20,184,166,.28), transparent 70%),
          radial-gradient(1000px 600px at 75% 75%, rgba(56,189,248,.24), transparent 60%),
          rgba(0,0,0,.45);
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-floaty, .animate-bounce, .rainbow { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  function confetti(n = 28) {
    if (!enabled) return;
    const EMOJIS = ["🎉","✨","🌟","😊","💥","🎈","⭐","🥳"];
    for (let i=0;i<n;i++){
      const d=document.createElement("div");
      d.className="sparkle";
      d.style.left=Math.random()*100+"vw";
      d.style.top="-10px";
      d.style.transform=`translateY(0) rotate(${Math.random()*360}deg)`;
      d.textContent=EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
      d.style.animationDuration=(1.4+Math.random()*1.2)+"s";
      document.body.appendChild(d);
      setTimeout(()=>d.remove(),2300);
    }
  }
  return { confetti };
}

/* ========== Settings & Stats ========== */
const defaultStats = {
  emoji: { plays: 0, highScore: 0, lastScore: 0, correct: 0, attempts: 0 },
  highlighter: { clears: 0 },
  tryitHistory: [],
  name: "",
};
const defaultPrefs = { soundOn: true, speakOn: false, fxOn: true };

function useSettings() {
  const [prefs, setPrefs] = useLocalStorage("sent-safari-prefs", defaultPrefs);
  const [stats, setStats] = useLocalStorage("sent-safari-stats", defaultStats);
  function patchPrefs(p){ setPrefs({...prefs, ...p}); }
  function patchStats(p){ setStats({...stats, ...p}); }
  return { prefs, patchPrefs, stats, patchStats, setStats };
}

/* ========== Progress (visited + completed) ========== */
const STEP_LIST = [
  { id: "story", label: "Story", icon: "📖" },
  { id: "learn", label: "Learn", icon: "💡" },
  { id: "play1", label: "Emoji", icon: "😊" },
  { id: "play2", label: "Highlight", icon: "🖍️" },
  { id: "tryit", label: "Try It", icon: "🧪" },
  { id: "compare", label: "Compare", icon: "⚖️" },
];
const STEP_IDS = STEP_LIST.map(s => s.id);

function useProgress() {
  const [progress, setProgress] = useLocalStorage("sent-safari-progress", { visited: {}, completed: {} });
  function visit(id) {
    if (!STEP_IDS.includes(id)) return;
    if (progress.visited[id]) return;
    setProgress({ ...progress, visited: { ...progress.visited, [id]: true } });
  }
  function complete(id) {
    if (!STEP_IDS.includes(id)) return;
    setProgress({
      visited: { ...progress.visited, [id]: true },
      completed: { ...progress.completed, [id]: true },
    });
  }
  return { progress, visit, complete };
}

/* ========== UI Helpers ========== */
function Header({ prefs, setPrefs, sfx }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 px-3 sm:px-4 py-2 flex items-center gap-2
      text-white bg-gradient-to-r from-teal-600 via-cyan-500 to-sky-500 shadow-lg">
      <div className="flex items-center gap-2 font-[Baloo_2] text-lg sm:text-xl font-extrabold">
        <div className="w-9 h-9 rounded-full bg-white/20 grid place-items-center shadow text-white animate-floaty">😊</div>
        Sentiment Safari
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Toggle on={prefs.soundOn} onClick={()=>setPrefs({soundOn:!prefs.soundOn})} title={prefs.soundOn?"Sound: On":"Sound: Off"}>🔊</Toggle>
        <Toggle on={prefs.speakOn} onClick={()=>setPrefs({speakOn:!prefs.speakOn})} title={prefs.speakOn?"Read Aloud: On":"Read Aloud: Off"}>🗣️</Toggle>
        <Toggle on={prefs.fxOn} onClick={()=>setPrefs({fxOn:!prefs.fxOn})} title={prefs.fxOn?"Sparkles: On":"Sparkles: Off"}>✨</Toggle>
        <button onClick={()=>{ sfx.click(); window.scrollTo({top:0, behavior:"smooth"}); }}
          className="px-3 py-1 rounded-full bg-white/20 backdrop-blur border border-white/30 font-bold hover:bg-white/30">
          Top ↑
        </button>
      </div>
    </header>
  );
}
function Toggle({ on, onClick, children, title }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-full grid place-items-center transition-all shadow
        backdrop-blur border border-white/30
        ${on ? "bg-emerald-400/80 text-neutral-900 ring-2 ring-emerald-200" : "bg-white/20 text-white hover:bg-white/30"}`}
    >
      <span className="text-lg">{children}</span>
    </button>
  );
}
function Glass({ children, className="" }) {
  return <div className={`glass rounded-3xl p-5 sm:p-7 text-white ${className}`}>{children}</div>;
}
function Reveal({ children, delay = 0.05 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
function MagneticButton({ children, className="", ...props }) {
  const ref = useRef(null);
  function onMove(e) {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    ref.current.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
  }
  function onLeave() { ref.current.style.transform = "translate(0,0)"; }
  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`px-5 py-3 rounded-xl bg-amber-400 text-neutral-900 font-extrabold shadow ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ========== DotNav (desktop only) ========== */
function DotNav({ sections = [] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const i = sections.findIndex(id => id === e.target.id);
          if (i >= 0) setActive(i);
        }
      });
    }, { threshold: 0.6 });
    sections.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);

  return (
    <div className="hidden md:flex fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3 select-none">
      {sections.map((id, i) => (
        <button
          key={id}
          aria-label={`Go to ${id}`}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
          className={`w-3 h-3 rounded-full transition-all ${i===active ? "bg-amber-400 ring-2 ring-amber-200 scale-125" : "bg-white/70 hover:bg-white"}`}
        />
      ))}
    </div>
  );
}

/* ========== Parallax Emojis/Words ========== */
function ParallaxEmojis() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  return (
    <>
      <motion.div style={{ y: y1 }} className="absolute inset-x-0 top-16 text-5xl select-none pointer-events-none text-white/60">
        <div className="max-w-5xl mx-auto flex justify-between px-4">😊 😟 😐 ✨ 🎈</div>
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute inset-x-0 bottom-16 select-none pointer-events-none">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-center px-4 text-white/80">
          {["love","awesome","great","okay","boring","hate","terrible","fun","cool","slow"].map((w,i)=>(
            <span key={i} className="px-3 py-1 rounded-full bg-white/15 border border-white/30">{w}</span>
          ))}
        </div>
      </motion.div>
    </>
  );
}

/* ========== Lottie via URL ========== */
function LottieByUrl({ url, className="", loop=true }) {
  const [data, setData] = useState(null);
  useEffect(()=>{
    let on=true;
    fetch(url).then(r=>r.json()).then(j=>{ if(on) setData(j); }).catch(()=>{});
    return ()=>{ on=false; };
  },[url]);
  if(!data) return null;
  return <Lottie animationData={data} loop={loop} className={className} />;
}

/* ========== Main App (one-page scroll) ========== */
export default function App() {
  const { prefs, patchPrefs, stats, patchStats, setStats } = useSettings();
  const { progress, visit, complete } = useProgress();
  const sfx = useSFX(prefs.soundOn);
  const { confetti } = useAnimations(prefs.fxOn);
  const tts = useTTS(prefs.speakOn);

  // Lenis smooth scrolling + cursor sparkle trail
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true, smoothTouch: false, lerp: 0.12, easing: t => 1 - Math.pow(1 - t, 2) });
    let rafId; const raf = (t) => { lenis.raf(t); rafId = requestAnimationFrame(raf); }; rafId = requestAnimationFrame(raf);
    const move = (e) => {
      const d = document.createElement("div");
      d.textContent = ["✨","🌟","⭐","💫"][Math.floor(Math.random()*4)];
      Object.assign(d.style, { position:"fixed", left: e.clientX+"px", top: e.clientY+"px", pointerEvents:"none",
        transform:"translate(-50%,-50%) scale(1)", transition:"transform .6s ease, opacity .6s ease", opacity:"0.9", zIndex: 99999,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" });
      document.body.appendChild(d);
      requestAnimationFrame(()=>{ d.style.transform="translate(-50%,-50%) scale(.3)"; d.style.opacity="0"; });
      setTimeout(()=>d.remove(), 600);
    };
    window.addEventListener("pointermove", move);
    return () => { cancelAnimationFrame(rafId); lenis.destroy(); window.removeEventListener("pointermove", move); };
  }, []);

  // Global scroll progress bar under header (no top tabs now)
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // Mark visited sections
  useEffect(() => {
    const map = {
      "sec-story": "story",
      "sec-learn": "learn",
      "sec-emoji": "play1",
      "sec-highlighter": "play2",
      "sec-tryit": "tryit",
      "sec-compare": "compare",
    };
    const io = new IntersectionObserver((entries) => entries.forEach(e => {
      if (e.isIntersecting) { const step = map[e.target.id]; if (step) visit(step); }
    }), { threshold: 0.5 });
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen w-full bg-neutral-900 text-white">
      <Header prefs={prefs} setPrefs={patchPrefs} sfx={sfx} />

      {/* Sticky scroll progress bar (just under header) */}
      <motion.div style={{ scaleX }} className="fixed top-[56px] left-0 right-0 h-1 rainbow origin-left z-30" />

      {/* Left dot nav (desktop only) */}
      <DotNav sections={["sec-story","sec-learn","sec-map","sec-emoji","sec-highlighter","sec-tryit","sec-compare","sec-badge"]} />

      {/* Sections */}
      <main>
        {/* Story */}
        <section id="sec-story" className="relative min-h-screen flex items-center justify-center">
          <img alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
               src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1920&auto=format&fit=crop" />
          <div className="absolute inset-0 overlay-soft" />
          <Reveal>
            <Glass className="max-w-3xl mx-4">
              <div className="flex items-center gap-3 mb-2">
                <LottieByUrl url="https://assets5.lottiefiles.com/packages/lf20_zrqthn6o.json" className="w-20 h-20" />
                <h1 className="font-[Baloo_2] text-3xl sm:text-4xl">Become a Mood Detective!</h1>
              </div>
              <p className="mt-1 text-white/90">Ever wondered how detectives spot feelings in words? Meet Sunny and Mo. Scroll to start your mission.</p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={()=>tts.speak("Ever wondered how detectives spot feelings in words? Meet Sunny and Mo. Scroll to start your mission.")} className="px-3 py-2 rounded-full bg-white/15 border border-white/30">🗣️ Read aloud</button>
                <MagneticButton onClick={()=>document.getElementById("sec-learn")?.scrollIntoView({behavior:"smooth"})}>Scroll ↓</MagneticButton>
              </div>
            </Glass>
          </Reveal>
        </section>

        {/* Learn */}
        <section id="sec-learn" className="relative min-h-screen flex items-center justify-center">
          <img alt="" className="absolute inset-0 w-full h-full object-cover"
               src="https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1920&auto=format&fit=crop" />
          <div className="absolute inset-0 overlay-soft" />
          <ParallaxEmojis />
          <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-3 gap-3">
            <Reveal><Glass><h3 className="font-[Baloo_2] text-2xl">Positive 😊</h3><ul className="list-disc ml-5"><li>“I love this game!”</li><li>“That pizza was awesome.”</li></ul></Glass></Reveal>
            <Reveal delay={0.1}><Glass><h3 className="font-[Baloo_2] text-2xl">Negative 😟</h3><ul className="list-disc ml-5"><li>“This level is terrible.”</li><li>“I hate waiting.”</li></ul></Glass></Reveal>
            <Reveal delay={0.2}><Glass><h3 className="font-[Baloo_2] text-2xl">Neutral 😐</h3><ul className="list-disc ml-5"><li>“My cat is sleeping.”</li><li>“I have math at 10.”</li></ul></Glass></Reveal>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <MagneticButton onClick={()=>document.getElementById("sec-map")?.scrollIntoView({behavior:"smooth"})} className="animate-bounce">See Your Map ↓</MagneticButton>
          </div>
        </section>

        {/* Map Progress */}
        <MapProgressSection id="sec-map" progress={progress} sfx={sfx} />

        {/* Emoji Sort */}
        <EmojiSection id="sec-emoji" sfx={sfx} tts={tts} stats={stats} patchStats={patchStats} onComplete={() => { complete("play1"); confetti(32); }} />

        {/* Word Highlighter */}
        <HighlighterSection id="sec-highlighter" sfx={sfx} tts={tts} stats={stats} patchStats={patchStats} onComplete={() => { complete("play2"); confetti(36); }} />

        {/* Try It (pinned panel) */}
        <PinnedPanel id="sec-tryit">
          <TryItPanel sfx={sfx} stats={stats} patchStats={patchStats} onAnalyze={() => complete("tryit")} />
        </PinnedPanel>

        {/* Compare */}
        <CompareSection id="sec-compare" sfx={sfx} onDone={() => complete("compare")} />

        {/* Badge */}
        <BadgeSection id="sec-badge" sfx={sfx} confetti={confetti} stats={stats} setStats={setStats} />
      </main>

      {/* Step chips overlay (bottom) */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-20 max-w-6xl w-[96%]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STEP_LIST.map(step => {
            const v = !!progress.visited[step.id];
            const c = !!progress.completed[step.id];
            return (
              <div key={step.id} className={`flex items-center gap-2 bg-white/90 rounded-xl border p-2 ${c ? "border-emerald-300" : v ? "border-amber-300" : "border-neutral-200"}`}>
                <span className="text-lg">{step.icon}</span>
                <span className="text-sm font-bold text-neutral-900">{step.label}</span>
                {c ? <span className="ml-auto text-emerald-600">★</span> : v ? <span className="ml-auto text-amber-500">•</span> : <span className="ml-auto text-neutral-300">○</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========== Pinned Panel Wrapper (adjusted for header only) ========== */
function PinnedPanel({ id, children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1.04]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.7, 1, 0.7]);

  return (
    <section id={id} ref={ref} className="min-h-[200vh] relative">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <div className="sticky top-[72px] h-[70vh] w-full flex items-center justify-center">
        <motion.div style={{ scale, opacity }} className="w-[min(92%,900px)]">
          {children}
        </motion.div>
      </div>
    </section>
  );
}

/* ========== Treasure Map Section ========== */
function MapProgressSection({ id, progress, sfx }) {
  const steps = [
    { id: "story", label: "Story", x: 8,  y: 70 },
    { id: "learn", label: "Learn", x: 23, y: 50 },
    { id: "play1", label: "Emoji", x: 38, y: 65 },
    { id: "play2", label: "Highlight", x: 55, y: 40 },
    { id: "tryit", label: "Try It", x: 72, y: 60 },
    { id: "compare", label: "Compare", x: 88, y: 45 },
  ];
  const pathD = steps.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");

  function go(stepId) {
    sfx.click();
    const target = {
      story: "sec-story",
      learn: "sec-learn",
      play1: "sec-emoji",
      play2: "sec-highlighter",
      tryit: "sec-tryit",
      compare: "sec-compare",
    }[stepId];
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  }

  const allDone = steps.every(s => progress.completed[s.id]);

  return (
    <section id={id} className="relative min-h-screen flex items-center justify-center">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1549880338-65ddcdfd017b?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <Reveal>
        <div className="relative w-[min(92%,1100px)] aspect-[16/9] bg-[url('https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center rounded-3xl border border-white/25 overflow-hidden">
          <div className="absolute inset-0 bg-amber-900/20 mix-blend-multiply" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path d={pathD} stroke="#fbbf24" strokeWidth="1.2" fill="none" strokeDasharray="2 2" />
          </svg>
          {steps.map((s)=> {
            const v = !!progress.visited[s.id];
            const c = !!progress.completed[s.id];
            return (
              <button
                key={s.id}
                onClick={()=>go(s.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 text-sm font-bold shadow
                  ${c ? "bg-emerald-400 text-neutral-900 ring-2 ring-emerald-200" :
                       v ? "bg-amber-300 text-neutral-900 ring-2 ring-amber-200" :
                           "bg-white/80 text-neutral-900"}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                title={s.label}
              >
                {s.label} {c ? "★" : v ? "•" : ""}
              </button>
            );
          })}
          <div className="absolute right-[4%] top-[20%]">
            <LottieByUrl url="https://assets4.lottiefiles.com/packages/lf20_3vbOcw.json" className="w-28 h-28" />
          </div>
        </div>
      </Reveal>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <MagneticButton onClick={()=>document.getElementById("sec-emoji")?.scrollIntoView({behavior:"smooth"})} className="animate-bounce">
          Start the Games ↓
        </MagneticButton>
      </div>
      {allDone && (
        <div className="absolute top-6 right-6">
          <LottieByUrl url="https://assets5.lottiefiles.com/packages/lf20_vfLq0f.json" className="w-28 h-28" />
        </div>
      )}
    </section>
  );
}

/* ========== Emoji Sort ========== */
function EmojiSection({ id, sfx, tts, stats, patchStats, onComplete }) {
  const data = useMemo(()=>[
    {t:"I love this book, it's awesome!", y:"pos"},
    {t:"This is the worst lunch ever.", y:"neg"},
    {t:"My brother is ten years old.", y:"neu"},
    {t:"The ride was super fun!", y:"pos"},
    {t:"I hate waking up early.", y:"neg"},
    {t:"The box is on the table.", y:"neu"},
    {t:"What a fantastic day!", y:"pos"},
    {t:"That movie made me sad.", y:"neg"},
    {t:"We have PE on Friday.", y:"neu"},
  ],[]);
  const [queue, setQueue] = useState([]);
  const [target, setTarget] = useState(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(()=>{
    const shuffled = [...data].sort(()=>Math.random()-0.5).slice(0,7);
    setQueue(shuffled);
    setTarget(shuffled[shuffled.length-1]);
  },[]);

  function next() {
    if (queue.length <= 1) return;
    const q = [...queue]; q.pop();
    setQueue(q);
    setTarget(q[q.length-1]);
    setFeedback(""); setShake(false);
  }
  function answer(ans) {
    if (!target) return;
    patchStats({ emoji: { ...stats.emoji, attempts: (stats.emoji.attempts||0) + 1 } });
    if (ans === target.y) {
      sfx.ding(); setScore(s => s+1);
      patchStats({ emoji: { ...stats.emoji, correct: (stats.emoji.correct||0) + 1 } });
      setFeedback("Nice! ✅");
      if (score + 1 >= 5) {
        setDone(true); sfx.cheer();
        const newHigh = Math.max(stats.emoji.highScore || 0, score + 1);
        patchStats({ emoji: { ...stats.emoji, highScore: newHigh, lastScore: score + 1, plays: (stats.emoji.plays||0)+1 } });
        onComplete && onComplete();
      } else {
        setTimeout(next, 650);
      }
    } else {
      sfx.buzz(); setShake(true); setFeedback("Oops! Try again."); setTimeout(next, 850);
    }
  }
  return (
    <section id={id} className="relative min-h-screen flex items-center justify-center">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <Reveal>
        <Glass className="max-w-3xl mx-4 w-[92%]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <LottieByUrl url="https://assets1.lottiefiles.com/packages/lf20_bdlrkrqv.json" className="w-14 h-14" />
              <h3 className="font-[Baloo_2] text-3xl">Emoji Sort</h3>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 font-bold">Score: {score}/5</div>
          </div>
          <p className="mt-1 text-white/90">Read it. Tap the right face: 😊 happy • 😐 okay • 😟 unhappy</p>
          <div className={`mt-3 p-4 rounded-2xl bg-white/10 border border-white/25 text-lg ${shake?"animate-shake":""}`}>{target?.t || "Loading..."}</div>
          <div className="flex gap-3 mt-3 flex-wrap">
            <BigEmoji onClick={()=>answer("pos")}>😊</BigEmoji>
            <BigEmoji onClick={()=>answer("neu")}>😐</BigEmoji>
            <BigEmoji onClick={()=>answer("neg")}>😟</BigEmoji>
            <button className="px-3 py-2 rounded-full bg-white/15 border border-white/30" onClick={()=>tts.speak(`Sentence: ${target?.t||""}`)}>🗣️ Read it</button>
          </div>
          <div className="text-sm mt-2" style={{color: feedback.startsWith("Oops") ? "#fecaca" : "#bbf7d0"}}>{feedback}</div>
          {done && <div className="mt-3 text-emerald-300 font-bold">Great job! Scroll for the next activity ↓</div>}
        </Glass>
      </Reveal>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <MagneticButton onClick={()=>document.getElementById("sec-highlighter")?.scrollIntoView({behavior:"smooth"})} className="animate-bounce">Next ↓</MagneticButton>
      </div>
    </section>
  );
}
function BigEmoji({ children, onClick }) {
  return (
    <button onClick={onClick} className="text-4xl sm:text-5xl px-5 py-4 bg-white/15 border border-white/30 rounded-2xl shadow transition active:scale-95 hover:scale-105 focus-visible:outline-none">
      {children}
    </button>
  );
}

/* ========== Highlighter ========== */
function HighlighterSection({ id, sfx, tts, stats, patchStats, onComplete }) {
  const rounds = [
    { sentence:"The pizza was tasty but the service was slow", feel:["tasty","slow"] },
    { sentence:"I am not happy about the messy room", feel:["happy","messy"] },
    { sentence:"The museum was okay and the weather was fine", feel:[] },
  ];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState({});
  const [feedback, setFeedback] = useState("");
  const [showHint, setShowHint] = useState(false);
  const cur = rounds[idx];
  const words = useMemo(()=>cur.sentence.split(/\s+/), [idx]);
  const clean = (w)=>w.replace(/[^\w'-]/g,"").toLowerCase();

  function toggle(i){ setPicked(p=>({...p, [i]: !p[i]})); }
  function reset(){ setPicked({}); setFeedback(""); setShowHint(false); }
  function check(){
    const chosen = Object.entries(picked).filter(([,v])=>v).map(([i])=>clean(words[+i]));
    const goal = cur.feel.map(w=>w.toLowerCase());
    const setEq = (a,b)=>a.length===b.length && a.every(x=>b.includes(x));
    const ok = setEq(chosen, goal);
    if(ok){
      sfx.ding(); setFeedback("Great! ✅ You found the feeling words.");
      if(idx < rounds.length-1){ setTimeout(()=>{ setIdx(i=>i+1); reset(); }, 700); }
      else { sfx.cheer(); patchStats({ highlighter: { clears: (stats.highlighter.clears||0)+1 } }); onComplete && onComplete(); }
    } else { sfx.buzz(); setFeedback("Close! Try again."); setShowHint(true); }
  }

  return (
    <section id={id} className="relative min-h-screen flex items-center justify-center">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <Reveal>
        <Glass className="max-w-3xl mx-4 w-[92%]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <LottieByUrl url="https://assets8.lottiefiles.com/packages/lf20_x62chJ.json" className="w-14 h-14" />
              <h3 className="font-[Baloo_2] text-3xl">Word Highlighter</h3>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 font-bold">Round {idx+1}/3</div>
          </div>
          <p className="mt-1 text-white/90">Tap the feeling words. Then press Check.</p>
          <div className="mt-2 p-4 rounded-2xl bg-white/10 border border-white/25 text-lg">“{cur.sentence}”</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {words.map((w,i)=>{
              const k = w.replace(/[^\w'-]/g,"");
              const on = !!picked[i];
              const cls = on ? "bg-indigo-200/60 border-indigo-300 scale-105" : "bg-white/15 border-white/20";
              return (
                <button key={i} onClick={()=>toggle(i)} className={`px-3 py-2 rounded-xl border transition active:scale-95 ${cls}`}>{k}</button>
              );
            })}
          </div>
          <div className="text-sm mt-2" style={{color: feedback.includes("Great") ? "#bbf7d0" : "#fecaca"}}>{feedback}</div>
          {showHint && <div className="text-xs text-white/80 mt-1">Hint: Feeling words here: {cur.feel.length ? cur.feel.join(", ") : "none (it’s neutral)"}.</div>}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="px-4 py-2 rounded-xl bg-white/15 border border-white/30" onClick={reset}>Reset</button>
            <MagneticButton onClick={check}>Check</MagneticButton>
            <button className="px-4 py-2 rounded-xl bg-white/15 border border-white/30" onClick={()=>tts.speak(`Sentence: ${cur.sentence}`)}>🗣️ Read it</button>
          </div>
        </Glass>
      </Reveal>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <MagneticButton onClick={()=>document.getElementById("sec-tryit")?.scrollIntoView({behavior:"smooth"})} className="animate-bounce">Next ↓</MagneticButton>
      </div>
    </section>
  );
}

/* ========== Try It Panel ========== */
function TryItPanel({ sfx, stats, patchStats, onAnalyze }) {
  const [text, setText] = useState("");
  const [rule, setRule] = useState(null);
  const [bayes, setBayes] = useState(null);
  function analyze(){
    if(!text.trim()) return;
    sfx.click();
    const r = rulebook(text); setRule(r);
    const b = NB.predict(text); setBayes(b);
    onAnalyze && onAnalyze();
    const item = { text, ruleLabel: r.label, ruleScore: +r.score.toFixed(2), bayesLabel: b.label, ts: Date.now() };
    const nextHistory = [item, ...(stats.tryitHistory||[])].slice(0,8);
    patchStats({ tryitHistory: nextHistory });
  }
  function randomExample(){
    const pool = ["I really love this class, it’s awesome!","The cake was okay but the line was slow.","I am not happy about the rain.","That trip was super fun!","This is the worst level ever!"];
    setText(pool[Math.floor(Math.random()*pool.length)]);
    setTimeout(analyze,0);
  }
  return (
    <Glass className="w-full">
      <div className="flex items-center gap-2">
        <LottieByUrl url="https://assets6.lottiefiles.com/packages/lf20_7p5T5M.json" className="w-14 h-14" />
        <h3 className="font-[Baloo_2] text-3xl">Try It — Your sentence</h3>
      </div>
      <p className="text-white/90">Type a sentence. Tap Analyze. Two judges guess the mood.</p>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder='Try: "I really love pizza!"'
        className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/30 outline-none" />
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <MagneticButton onClick={analyze}>Analyze</MagneticButton>
        <button className="px-5 py-3 rounded-xl bg-white/15 border border-white/30" onClick={randomExample}>Random</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl bg-white/10 border border-white/25 p-3">
          <div className="text-sm opacity-90 mb-1">Smiley Judge (Rulebook)</div>
          <div className="text-lg font-bold">{rule?.label || "—"}</div>
          <div className="text-xs opacity-80 mt-1">{rule?.score !== undefined ? `score: ${rule.score.toFixed(2)}` : ""}</div>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/25 p-3">
          <div className="text-sm opacity-90 mb-1">Robot Judge (Baby NB)</div>
          <div className="text-lg font-bold">{bayes?.label || "—"}</div>
          <div className="text-xs opacity-80 mt-1">
            {bayes ? `P(pos) ${(bayes.probs.pos*100|0)}% · P(neu) ${(bayes.probs.neu*100|0)}% · P(neg) ${(bayes.probs.neg*100|0)}%` : ""}
          </div>
        </div>
      </div>
    </Glass>
  );
}

/* ========== Compare ========== */
function CompareSection({ id, sfx, onDone }) {
  const items = [
    "I am not happy with this",
    "This game is really good",
    "The class was okay",
    "Super fun but the ending was bad",
    "I dislike the slow app",
    "We went to the park",
  ];
  const [checks, setChecks] = useState({});
  const rows = items.map(s => ({ s, r: rulebook(s).label, b: NB.predict(s).label }));
  function toggle(i){ sfx.click(); setChecks(c=>({ ...c, [i]: !c[i] })); }
  function checkAnswers(){
    sfx.click();
    const total = rows.length;
    let correct = 0;
    rows.forEach((row, i) => {
      const disagree = row.r !== row.b;
      if (!!checks[i] === !!disagree) correct++;
    });
    if (correct === total) onDone && onDone();
    alert(`You matched ${correct}/${total}${correct===total ? " — Perfect!" : ""}`);
  }
  return (
    <section id={id} className="relative min-h-screen flex items-center justify-center">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <Reveal>
        <Glass className="max-w-5xl mx-4 w-[92%]">
          <h3 className="font-[Baloo_2] text-3xl">Do the judges agree?</h3>
          <p className="text-white/90">Tick the lines where they DISAGREE. Then press Check.</p>
          <div className="mt-3 grid gap-2">
            {rows.map((row, i)=>(
              <div key={i} className="grid md:grid-cols-4 gap-2 bg-white/10 border border-white/25 p-3 rounded-xl">
                <div>{row.s}</div>
                <div className="text-sm opacity-90">Smiley: {row.r}</div>
                <div className="text-sm opacity-90">Robot: {row.b}</div>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={!!checks[i]} onChange={()=>toggle(i)} />
                  Disagree
                </label>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <MagneticButton onClick={checkAnswers}>Check</MagneticButton>
          </div>
        </Glass>
      </Reveal>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <MagneticButton onClick={()=>document.getElementById("sec-badge")?.scrollIntoView({behavior:"smooth"})} className="animate-bounce">Finish ↓</MagneticButton>
      </div>
    </section>
  );
}

/* ========== Badge ========== */
function BadgeSection({ id, sfx, confetti, stats, setStats }) {
  const [name, setName] = useState(stats.name || "");
  useEffect(()=>{ setStats({ ...stats, name }); }, [name]);
  return (
    <section id={id} className="relative min-h-screen flex items-center justify-center">
      <img alt="" className="absolute inset-0 w-full h-full object-cover"
           src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=1920&auto=format&fit=crop" />
      <div className="absolute inset-0 overlay-soft" />
      <Reveal>
        <Glass className="max-w-xl mx-4 w-[92%] text-center">
          <div className="flex justify-center">
            <LottieByUrl url="https://assets1.lottiefiles.com/packages/lf20_rnnlxazi.json" className="w-24 h-24" />
          </div>
          <h2 className="font-[Baloo_2] text-3xl">You’re a Mood Detective!</h2>
          <p className="text-white/90">Type your name and tap Celebrate.</p>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
                 className="mt-2 px-3 py-2 rounded-xl bg-white/10 border border-white/30 w-full outline-none" />
          <div className="inline-block bg-white/10 border border-white/25 rounded-xl p-4 mt-3 w-full">
            <div className="font-[Baloo_2] text-2xl">Sentiment Safari Badge</div>
            <div className="text-xl mt-1">{name || "Explorer"}</div>
            <div className="text-sm text-white/80">Completed: Story • Learn • Games • Try It • Compare</div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 mt-4">
            <MagneticButton onClick={()=>{ sfx.cheer(); confetti(48); }}>Celebrate! ✨</MagneticButton>
            <button className="px-5 py-3 rounded-xl bg-white/15 border border-white/30" onClick={()=>window.print()}>Print</button>
            <button className="px-5 py-3 rounded-xl bg-white/15 border border-white/30" onClick={()=>window.scrollTo({top:0, behavior:"smooth"})}>Back to Top ↑</button>
          </div>
        </Glass>
      </Reveal>
    </section>
  );
}