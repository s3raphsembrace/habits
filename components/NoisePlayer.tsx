"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dependency-free sleep-sound generator using the Web Audio API.
 * Brown noise is synthesized (integrated white noise, low-pass rolled off),
 * so no audio files need to be shipped or downloaded.
 */
export default function NoisePlayer() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);

  function stop() {
    nodesRef.current?.src.stop();
    nodesRef.current = null;
    setPlaying(false);
  }

  function start() {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;

    // 4 seconds of brown noise, looped seamlessly.
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0.15;

    src.connect(gain).connect(ctx.destination);
    src.start();
    nodesRef.current = { src, gain };
    setPlaying(true);
  }

  useEffect(() => {
    return () => {
      nodesRef.current?.src.stop();
      ctxRef.current?.close();
    };
  }, []);

  return (
    <div className="card noise-player">
      <div>
        <h3>Brown noise</h3>
        <p className="muted">Deep, steady noise that masks sudden sounds while you fall asleep.</p>
      </div>
      <button className="button" onClick={playing ? stop : start}>
        {playing ? "⏹ Stop" : "▶ Play"}
      </button>
    </div>
  );
}
