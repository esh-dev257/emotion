import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { rulebook, NB } from "./sentiment";

// Small helper: typewriter bubble
function Typewriter({ text, speed = 22, onDone }) {
  const [t, setT] = useState("");
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setT(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); onDone && onDone(); }
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return <span>{t}</span>;
}

function GlassCard({ children, className = "" }) {
  return (
    <div className={`backdrop-blur-xl bg-white/15 border border-white/30 shadow-2xl rounded-3xl p-5 sm:p-7 ${className}`}>
      {children}
    </div>
  );
}

// Optional camera “Detective ID”
function DetectiveID({ onSaved, sfx }) {
  const [streaming, setStreaming] = useState(false);
  const [photo, setPhoto] = useState(localStorage.getItem("sent-safari-photo") || "");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoRef.current.srcObject = stream;
      setStreaming(true);
    } catch (e) {
      alert("Camera blocked. You can skip this step.");
    }
  }
  function capture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = 320, h = 240;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const data = canvas.toDataURL("image/png");
    setPhoto(data);
    localStorage.setItem("sent-safari-photo", data);
    sfx?.ding();
    onSaved && onSaved(data);
  }
  function stop() {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStreaming(false);
  }

  return (
    <GlassCard className="max-w-lg mx-auto">
      <h3 className="font-[Baloo_2] text-2xl mb-2">Make your Detective ID</h3>
      <p className="text-neutral-100/90 mb-3">Take a quick photo or skip.</p>
      <div className="grid gap-3">
        {!streaming && !photo && (
          <button onClick={start} className="px-4 py-3 rounded-xl bg-amber-400 text-neutral-900 font-extrabold shadow">Start Camera</button>
        )}
        {streaming && (
          <>
            <video ref={videoRef} autoPlay playsInline className="rounded-2xl w-full max-w-md mx-auto border border-white/30" />
            <div className="flex gap-2">
              <button onClick={capture} className="px-4 py-3 rounded-xl bg-emerald-400 text-neutral-900 font-extrabold shadow">Capture</button>
              <button onClick={stop} className="px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white font-bold">Stop</button>
            </div>
          </>
        )}
        {photo && (
          <div className="grid place-items-center gap-2">
            <img alt="Your detective portrait" src={photo} className="w-64 h-48 object-cover rounded-2xl border border-white/30" />
            <button onClick={()=>{localStorage.removeItem("sent-safari-photo"); setPhoto("");}} className="px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white font-bold">Retake</button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </GlassCard>
  );
}

export default function ScrollAdventure({ go, sfx, tts }) {
  // page scroll progress for parallax
  const { scrollYProgress } = useScroll();
  const yEmoji = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const yWords = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);

  // mini analyzer state
  const [text, setText] = useState("");
  const [rule, setRule] = useState(null);
  const [bayes, setBayes] = useState(null);

  function analyze() {
    if (!text.trim()) return;
    sfx?.click();
    const r = rulebook(text);
    setRule(r);
    const b = NB.predict(text);
    setBayes(b);
    if (r.label === "Positive") sfx?.ding(); else if (r.label === "Negative") sfx?.buzz();
  }

  return (
    <div className="h-screen w-full overflow-y-auto snap-y snap-mandatory scroll-smooth bg-neutral-900 text-white">
      {/* Scene 1 — Detective board intro */}
      <section className="relative min-h-screen snap-start flex items-center justify-center">
        <img
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1920&auto=format&fit=crop"
        />
        <div className="absolute inset-0 bg-black/45" />
        <GlassCard className="max-w-2xl mx-4">
          <p className="text-lg leading-relaxed">
            <Typewriter
              text="Ever wondered how mood detectives solve language cases? Meet Sunny and Mo! Scroll to begin your mission."
              onDone={() => sfx?.ding()}
            />
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => tts?.speak("Ever wondered how mood detectives solve language cases? Meet Sunny and Mo! Scroll to begin your mission.")}
              className="px-3 py-2 rounded-full bg-white/20 border border-white/30"
            >
              🗣️ Read aloud
            </button>
          </div>
        </GlassCard>
        <button
          onClick={() => { sfx?.click(); document.querySelector("#scene-2")?.scrollIntoView({ behavior: "smooth" }); }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-amber-400 text-neutral-900 font-extrabold shadow animate-bounce"
        >
          Scroll ↓
        </button>
      </section>

      {/* Scene 2 — Parallax words + emojis */}
      <section id="scene-2" className="relative min-h-screen snap-start flex items-center justify-center">
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1920&auto=format&fit=crop"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black/30" />
        <motion.div style={{ y: yEmoji }} className="absolute inset-x-0 top-16 text-5xl select-none pointer-events-none text-white/60">
          <div className="max-w-5xl mx-auto flex justify-between px-4">😊 😟 😐 ✨ 🎈</div>
        </motion.div>
        <motion.div style={{ y: yWords }} className="absolute inset-x-0 bottom-16 select-none pointer-events-none">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-center px-4">
            {["love","awesome","great","okay","boring","hate","terrible","fun","cool","slow"].map((w,i)=>(
              <span key={i} className="px-3 py-1 rounded-full bg-white/15 border border-white/30">{w}</span>
            ))}
          </div>
        </motion.div>
        <GlassCard className="max-w-xl mx-4">
          <h3 className="font-[Baloo_2] text-3xl">What is Sentiment?</h3>
          <p className="text-neutral-100/90 mt-1">Words can feel happy, unhappy, or just okay. Let’s try a quick game!</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button onClick={()=>{ sfx?.click(); go("play1"); }} className="px-5 py-3 rounded-xl bg-amber-400 text-neutral-900 font-extrabold shadow">Play Emoji Sort</button>
            <button onClick={()=>{ sfx?.click(); document.querySelector("#scene-3")?.scrollIntoView({behavior:"smooth"}); }} className="px-5 py-3 rounded-xl bg-white/15 border border-white/30">Try Analyzer</button>
          </div>
        </GlassCard>
      </section>

      {/* Scene 3 — Mini Analyzer in-scroll */}
      <section id="scene-3" className="relative min-h-screen snap-start flex items-center justify-center">
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1920&auto=format&fit=crop"
        />
        <div className="absolute inset-0 bg-black/55" />
        <GlassCard className="max-w-2xl mx-4 w-full">
          <h3 className="font-[Baloo_2] text-3xl">Quick Analyzer</h3>
          <p className="text-neutral-100/90">Type a sentence. We’ll guess the mood two ways.</p>
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            rows={3}
            placeholder='Try: "I really love pizza!"'
            className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/30 outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={analyze} className="px-5 py-3 rounded-xl bg-amber-400 text-neutral-900 font-extrabold shadow">Analyze</button>
            <button onClick={()=>tts?.speak(text || "I really love pizza!")} className="px-4 py-3 rounded-xl bg-white/15 border border-white/30">🗣️ Read it</button>
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

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button onClick={()=>{ sfx?.click(); go("tryit"); }} className="px-5 py-3 rounded-xl bg-white/15 border border-white/30">Open Full Analyzer</button>
            <button onClick={()=>{ sfx?.click(); document.querySelector("#scene-4")?.scrollIntoView({behavior:"smooth"}); }} className="px-5 py-3 rounded-xl bg-emerald-400 text-neutral-900 font-extrabold">Make Detective ID</button>
          </div>
        </GlassCard>
      </section>

      {/* Scene 4 — Glass card + Camera (optional) */}
      <section id="scene-4" className="relative min-h-screen snap-start flex items-center justify-center">
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=1920&auto=format&fit=crop"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="mx-4 w-full">
          <DetectiveID sfx={sfx} onSaved={()=>sfx?.cheer()} />
          <div className="max-w-lg mx-auto mt-4 flex flex-col sm:flex-row gap-2">
            <button onClick={()=>{ sfx?.click(); go("play1"); }} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-400 text-neutral-900 font-extrabold shadow">Play Emoji Sort</button>
            <button onClick={()=>{ sfx?.click(); go("learn"); }} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/15 border border-white/30">Basics →</button>
          </div>
        </div>
      </section>
    </div>
  );
}