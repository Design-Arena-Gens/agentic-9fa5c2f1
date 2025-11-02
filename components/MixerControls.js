"use client";
import { useCallback, useEffect, useRef, useState } from "react";

function createKick(audioCtx) {
  return (time, gainNode) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.9, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain).connect(gainNode);
    osc.start(time);
    osc.stop(time + 0.25);
  };
}

function createSnare(audioCtx) {
  const noiseBuffer = (() => {
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();

  return (time, gainNode) => {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 2000;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.8, time + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    noise.connect(noiseFilter).connect(noiseGain).connect(gainNode);
    noise.start(time);
    noise.stop(time + 0.15);
  };
}

function createHat(audioCtx) {
  return (time, gainNode) => {
    const noiseBuffer = audioCtx.createBuffer(1, 8000, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 8000;
    const hp = audioCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    noise.connect(bp).connect(hp).connect(gain).connect(gainNode);
    noise.start(time);
    noise.stop(time + 0.06);
  };
}

export default function MixerControls() {
  const [isRunning, setIsRunning] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [cross, setCross] = useState(0.5);
  const [levelA, setLevelA] = useState(0);
  const [levelB, setLevelB] = useState(0);

  const audioCtxRef = useRef(null);
  const masterRef = useRef(null);
  const gainARef = useRef(null);
  const gainBRef = useRef(null);
  const analyserARef = useRef(null);
  const analyserBRef = useRef(null);
  const schedulerTimerRef = useRef(null);
  const stepRef = useRef(0);
  const nextNoteTimeRef = useRef(0);

  const startAudio = useCallback(() => {
    if (isRunning) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    const master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);

    const gainA = audioCtx.createGain();
    const gainB = audioCtx.createGain();

    const analyserA = audioCtx.createAnalyser();
    const analyserB = audioCtx.createAnalyser();
    analyserA.fftSize = 256;
    analyserB.fftSize = 256;

    gainA.connect(analyserA).connect(master);
    gainB.connect(analyserB).connect(master);

    audioCtxRef.current = audioCtx;
    masterRef.current = master;
    gainARef.current = gainA;
    gainBRef.current = gainB;
    analyserARef.current = analyserA;
    analyserBRef.current = analyserB;

    stepRef.current = 0;
    nextNoteTimeRef.current = audioCtx.currentTime + 0.05;

    setIsRunning(true);
  }, [isRunning]);

  const stopAudio = useCallback(() => {
    setIsRunning(false);
    if (schedulerTimerRef.current) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      // Allow a small fade to avoid clicks
      const now = audioCtxRef.current.currentTime;
      if (masterRef.current) masterRef.current.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      setTimeout(() => {
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
      }, 120);
    }
  }, []);

  const updateCross = useCallback((x) => {
    setCross(x);
    const a = gainARef.current;
    const b = gainBRef.current;
    if (!a || !b) return;
    // equal-power crossfade
    const xa = Math.cos(x * 0.5 * Math.PI);
    const xb = Math.cos((1 - x) * 0.5 * Math.PI);
    a.gain.setTargetAtTime(xa, 0, 0.01);
    b.gain.setTargetAtTime(xb, 0, 0.01);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const audioCtx = audioCtxRef.current;
    const gainA = gainARef.current;
    const gainB = gainBRef.current;
    if (!audioCtx || !gainA || !gainB) return;

    const kickA = createKick(audioCtx);
    const snareA = createSnare(audioCtx);
    const hatA = createHat(audioCtx);

    const kickB = createKick(audioCtx);
    const snareB = createSnare(audioCtx);
    const hatB = createHat(audioCtx);

    const scheduleAheadTime = 0.15; // seconds
    const lookahead = 25; // ms

    const secondsPerBeat = 60.0 / bpm;
    const stepDur = secondsPerBeat / 4; // 16th notes

    const scheduleNote = (beatNumber, time) => {
      const step = beatNumber % 16;
      // Deck A pattern
      if (step % 4 === 0) kickA(time, gainA);
      if (step === 4 || step === 12) snareA(time, gainA);
      if (step % 2 === 0) hatA(time, gainA);
      // Deck B pattern (busier)
      if (step === 2 || step === 10) kickB(time, gainB);
      if (step === 6 || step === 14) snareB(time, gainB);
      if (step % 1 === 0 && step !== 4 && step !== 12) hatB(time, gainB);
    };

    const scheduler = () => {
      while (nextNoteTimeRef.current < audioCtx.currentTime + scheduleAheadTime) {
        scheduleNote(stepRef.current, nextNoteTimeRef.current);
        nextNoteTimeRef.current += stepDur;
        stepRef.current = (stepRef.current + 1) % 16;
      }
    };

    schedulerTimerRef.current = setInterval(scheduler, lookahead);

    // meters
    const analyserA = analyserARef.current;
    const analyserB = analyserBRef.current;
    const dataA = new Uint8Array(32);
    const dataB = new Uint8Array(32);

    let raf;
    const meterLoop = () => {
      analyserA.getByteFrequencyData(dataA);
      analyserB.getByteFrequencyData(dataB);
      const avgA = dataA.reduce((a, b) => a + b, 0) / dataA.length / 255;
      const avgB = dataB.reduce((a, b) => a + b, 0) / dataB.length / 255;
      setLevelA(avgA);
      setLevelB(avgB);
      raf = requestAnimationFrame(meterLoop);
    };
    raf = requestAnimationFrame(meterLoop);

    return () => {
      clearInterval(schedulerTimerRef.current);
      cancelAnimationFrame(raf);
    };
  }, [isRunning, bpm]);

  useEffect(() => {
    updateCross(cross);
  }, [cross, updateCross]);

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="primary" onClick={startAudio} disabled={isRunning}>????</button>
            <button className="ghost" onClick={stopAudio} disabled={!isRunning}>????</button>
          </div>
          <div className="badge"><span className="badge-dot"/> ????? ??????</div>
        </div>
        <div style={{ height: 8 }} />
        <div className="row" style={{ gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="label">BPM</div>
            <input
              className="slider"
              type="range"
              min={80}
              max={150}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            />
            <div className="value">{bpm}</div>
          </div>
          <div style={{ flex: 2 }}>
            <div className="label">?????????</div>
            <input
              className="slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={cross}
              onChange={(e) => updateCross(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="label">Deck A</div>
            <div className="meter"><span style={{ width: `${Math.min(1, levelA) * 100}%` }} /></div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="label">Deck B</div>
            <div className="meter"><span style={{ width: `${Math.min(1, levelB) * 100}%` }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
