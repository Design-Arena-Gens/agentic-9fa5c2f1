"use client";
import { useEffect, useRef } from "react";

export default function DJCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animationFrameId;
    let start = performance.now();

    const onResize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor((rect.height || 380) * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height || 380}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawTurntable = (x, y, r, angle, highlight) => {
      ctx.save();
      ctx.translate(x, y);
      // platter
      ctx.fillStyle = "#0e1220";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // grooves
      ctx.strokeStyle = "#1b2240";
      for (let i = r - 6; i > r - 36; i -= 3) {
        ctx.beginPath();
        ctx.arc(0, 0, i, 0, Math.PI * 2);
        ctx.stroke();
      }
      // label
      ctx.fillStyle = highlight ? "#6C5CE7" : "#243061";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // spindle
      ctx.fillStyle = "#cbd3ff";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      // tonearm
      ctx.rotate(angle);
      ctx.strokeStyle = "#b4bbdd";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, 0);
      ctx.lineTo(r + 32, 0);
      ctx.stroke();
      ctx.restore();
    };

    const drawVU = (x, y, w, h, level) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#121626";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#222b4a";
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#00E5A8");
      grad.addColorStop(0.5, "#34d1f9");
      grad.addColorStop(1, "#6C5CE7");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, Math.max(2, w * level), h);
      ctx.restore();
    };

    const drawDJ = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);

      // deck base
      ctx.fillStyle = "#0d111d";
      ctx.fillRect(16, H - 220, W - 32, 200);
      ctx.strokeStyle = "#1f263f";
      ctx.strokeRect(16.5, H - 219.5, W - 33, 199);

      // turntables
      const spin = (t / 1000) * 1.2;
      drawTurntable(160, H - 120, 80, spin, true);
      drawTurntable(W - 160, H - 120, 80, -spin * 1.1, false);

      // mixer
      ctx.fillStyle = "#13192b";
      ctx.fillRect(W / 2 - 90, H - 210, 180, 190);
      ctx.strokeStyle = "#232a46";
      ctx.strokeRect(W / 2 - 90.5, H - 209.5, 181, 191);

      // VU meters animated to beat
      const beat = (Math.sin(t / 250) + 1) / 2; // 0..1
      drawVU(W / 2 - 80, H - 200, 70, 10, beat * 0.9);
      drawVU(W / 2 + 10, H - 200, 70, 10, (1 - beat) * 0.8);

      // fader
      const xf = (Math.sin(t / 1500) + 1) / 2; // auto-pan visual
      ctx.fillStyle = "#0f1424";
      ctx.fillRect(W / 2 - 70, H - 80, 140, 6);
      ctx.fillStyle = "#cfd6ff";
      ctx.fillRect(W / 2 - 70 + xf * 130 - 6, H - 86, 12, 18);

      // DJ silhouette
      const sway = Math.sin(t / 900) * 8;
      ctx.save();
      ctx.translate(W / 2, H - 260);
      ctx.rotate((sway * Math.PI) / 1800);
      // head
      ctx.fillStyle = "#2a335a";
      ctx.beginPath();
      ctx.arc(0, -20, 16, 0, Math.PI * 2);
      ctx.fill();
      // headphones band
      ctx.strokeStyle = "#5f6bd1";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, -20, 20, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();
      // body
      ctx.fillStyle = "#1a2038";
      ctx.fillRect(-12, -10, 24, 60);
      // arms to decks
      ctx.strokeStyle = "#2a335a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-80, 70);
      ctx.moveTo(12, 0);
      ctx.lineTo(80, 70);
      ctx.stroke();
      ctx.restore();

      // crowd equalizer bars
      const bars = Math.floor(W / 14);
      for (let i = 0; i < bars; i++) {
        const x = i * 14 + 6;
        const h = 30 + (Math.sin(t / 300 + i * 0.45) + 1) * 22;
        ctx.fillStyle = `rgba(108,92,231,${0.25 + (i % 6) / 10})`;
        ctx.fillRect(x, H - 12 - h, 8, h);
      }
    };

    const frame = (ts) => {
      drawDJ(ts - start);
      animationFrameId = requestAnimationFrame(frame);
    };

    onResize();
    animationFrameId = requestAnimationFrame(frame);

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="canvas-wrap">
      <div className="badge" style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
        <span className="badge-dot" />
        ???? ??????
      </div>
      <canvas ref={canvasRef} className="canvas" />
    </div>
  );
}
