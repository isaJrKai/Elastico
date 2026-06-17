import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Play, RotateCcw, Volume2, VolumeX, ShieldCheck, Trophy, Zap, ArrowDown, ArrowUp } from "lucide-react";

interface SoccerSkillsAnimatorProps {
  onPreFillCredentials?: (email: string, pass: string) => void;
}

export default function SoccerSkillsAnimator({ onPreFillCredentials }: SoccerSkillsAnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Audio Context handling helper state
  const [audioMuted, setAudioMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Live states
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem("kickiq_highscore") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [cheatUnlocked, setCheatUnlocked] = useState(false);
  const [sysStatus, setSysStatus] = useState("SYS_STATUS: READY");

  // Dynamic system configuration settings
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [allowRegistrations, setAllowRegistrations] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          if (data.game_speed_multiplier !== undefined) setSpeedMultiplier(data.game_speed_multiplier);
          if (data.allow_registrations !== undefined) setAllowRegistrations(data.allow_registrations);
        }
      } catch (err) {
        console.warn("[KICK_ENGINE] Failed to fetch server config parameters:", err);
      }
    };
    fetchConfig();
  }, []);

  // Game Engine loops
  const requestRef = useRef<number | null>(null);
  const gameStateRef = useRef({
    player: {
      x: 40,
      y: 110,
      width: 18,
      height: 35,
      originalHeight: 35,
      duckHeight: 18,
      velocityY: 0,
      gravity: 0.6,
      isJumping: false,
      isDucking: false,
    },
    obstacles: [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      type: "cleat" | "ball";
      passed: boolean;
      speed: number;
    }>,
    particles: [] as Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
    }>,
    frameCount: 0,
    gameSpeed: 4.2,
    score: 0,
    gameActive: false,
  });

  // Persisted high score syncer
  const updateHighScore = (newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      try {
        localStorage.setItem("kickiq_highscore", newScore.toString());
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Sound Synth Synthesizer
  const playSound = (freq: number, type: OscillatorType, duration: number, endFreq: number | null = null) => {
    if (audioMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if ((window as any).__kickiq_audio_context__) {
            audioCtxRef.current = (window as any).__kickiq_audio_context__;
          } else {
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;
            (window as any).__kickiq_audio_context__ = ctx;
          }
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const triggerOscillator = () => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = type;
          const startTime = ctx.currentTime;
          osc.frequency.setValueAtTime(freq, startTime);
          if (endFreq && endFreq > 0) {
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
          }

          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration);
        } catch (e) {
          console.warn("Error running oscillator:", e);
        }
      };

      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          triggerOscillator();
        }).catch(() => {
          triggerOscillator();
        });
      } else {
        triggerOscillator();
      }
    } catch (err) {
      console.warn("Audio feedback error or blocked:", err);
    }
  };

  const playJumpSound = () => playSound(160, "triangle", 0.15, 380);
  const playScoreSound = () => playSound(520, "sine", 0.12, 780);
  const playCrashSound = () => playSound(220, "sawtooth", 0.35, 60);
  const playCheatSound = () => {
    playSound(440, "sine", 0.1, 554);
    setTimeout(() => playSound(554, "sine", 0.1, 659), 100);
    setTimeout(() => playSound(659, "sine", 0.1, 880), 200);
    setTimeout(() => playSound(880, "sine", 0.25, 1200), 300);
  };

  const ensureAudioResumed = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if ((window as any).__kickiq_audio_context__) {
            audioCtxRef.current = (window as any).__kickiq_audio_context__;
          } else {
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;
            (window as any).__kickiq_audio_context__ = ctx;
          }
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn("Audio Context init failed:", e);
    }
  };

  // Web Audio Context Autoplay Unlocking Effect for sandboxed environments
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            if ((window as any).__kickiq_audio_context__) {
              audioCtxRef.current = (window as any).__kickiq_audio_context__;
            } else {
              const ctx = new AudioContextClass();
              audioCtxRef.current = ctx;
              (window as any).__kickiq_audio_context__ = ctx;
            }
          }
        }
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume().then(() => {
            // Warm up audio channel with a micro-duration silent node to fully authorize hardware speakers
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(0);
            osc.stop(0.001);
            console.log("Audio context unlocked successfully!");
          }).catch((e) => console.log("Audio resume block:", e));
        }
      } catch (err) {
        console.warn("Audio unlock error:", err);
      }
    };

    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    document.addEventListener("click", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
  }, []);

  // Keyboard binding actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStateRef.current.gameActive) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        ensureAudioResumed();
        triggerJump();
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        ensureAudioResumed();
        triggerDuck(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        triggerDuck(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [audioMuted]);

  // Player action primitives
  const triggerJump = () => {
    ensureAudioResumed();
    const state = gameStateRef.current;
    if (!state.player.isJumping && !state.player.isDucking) {
      state.player.isJumping = true;
      state.player.velocityY = -8.5;
      playJumpSound();
    }
  };

  const triggerDuck = (isDucking: boolean) => {
    ensureAudioResumed();
    const state = gameStateRef.current;
    if (isDucking) {
      if (!state.player.isJumping) {
        state.player.isDucking = true;
        state.player.height = state.player.duckHeight;
        state.player.y = 150 - state.player.duckHeight - 5; // offset slightly above grass
      }
    } else {
      state.player.isDucking = false;
      state.player.height = state.player.originalHeight;
      state.player.y = 150 - state.player.originalHeight - 5;
    }
  };

  // Reset engine context
  const startGame = () => {
    ensureAudioResumed();
    const state = gameStateRef.current;
    state.obstacles = [];
    state.particles = [];
    state.frameCount = 0;
    state.gameSpeed = 4.2 * speedMultiplier;
    state.score = 0;
    state.player.y = 110;
    state.player.velocityY = 0;
    state.player.isJumping = false;
    state.player.isDucking = false;
    state.player.height = state.player.originalHeight;
    state.gameActive = true;

    setScore(0);
    setIsPlaying(true);
    setSysStatus("KICK_ENGINE: MATCH_ACTIVE");
    playSound(300, "sine", 0.2, 500);
  };

  const stopGame = () => {
    gameStateRef.current.gameActive = false;
    setIsPlaying(false);
  };

  // Run the core update frame & drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = () => {
      const state = gameStateRef.current;

      // Clear layout
      ctx.fillStyle = "#060913";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Retro Grid lines
      ctx.strokeStyle = "#131d30";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 15) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Draw Grass boundary baseline
      ctx.fillStyle = "#1e2d45";
      ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
      ctx.fillStyle = "#00e676";
      ctx.fillRect(0, canvas.height - 12, canvas.width, 2);

      if (state.gameActive) {
        state.frameCount++;

        // Speed ramp up slowly
        if (state.frameCount % 300 === 0) {
          state.gameSpeed += 0.5;
        }

        // Apply Player Physics
        if (state.player.isJumping) {
          state.player.velocityY += state.player.gravity;
          state.player.y += state.player.velocityY;

          // Ground floor collision check
          const groundY = canvas.height - state.player.height - 10;
          if (state.player.y >= groundY) {
            state.player.y = groundY;
            state.player.velocityY = 0;
            state.player.isJumping = false;
          }
        }

        // Handle Spawning Obstacles
        let spawnRate = Math.max(70, 130 - Math.floor(state.gameSpeed * 8));
        if (state.frameCount % spawnRate === 0) {
          const isBall = Math.random() > 0.5;
          if (isBall) {
            // High flying stadium ball obstacle floating in air
            state.obstacles.push({
              x: canvas.width,
              y: 85, // Float in middle
              width: 14,
              height: 14,
              type: "ball",
              passed: false,
              speed: state.gameSpeed,
            });
          } else {
            // Spiked Cleat on the grass
            state.obstacles.push({
              x: canvas.width,
              y: canvas.height - 25, // on ground
              width: 18,
              height: 14,
              type: "cleat",
              passed: false,
              speed: state.gameSpeed,
            });
          }
        }

        // Inside updating state: Obstacle routing & bounds checks
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
          const obs = state.obstacles[i];
          obs.x -= obs.speed;

          // Check score trigger
          if (!obs.passed && obs.x + obs.width < state.player.x) {
            obs.passed = true;
            state.score++;
            setScore(state.score);
            updateHighScore(state.score);
            playScoreSound();
          }

          // Cull out of bounds
          if (obs.x + obs.width < 0) {
            state.obstacles.splice(i, 1);
            continue;
          }

          // Axis-aligned bounding box collision tracking
          const isColliding =
            state.player.x < obs.x + obs.width &&
            state.player.x + state.player.width > obs.x &&
            state.player.y < obs.y + obs.height &&
            state.player.y + state.player.height > obs.y;

          if (isColliding) {
            // Play crash sound
            playCrashSound();

            // Spark particle explosion
            for (let p = 0; p < 15; p++) {
              state.particles.push({
                x: state.player.x + state.player.width / 2,
                y: state.player.y + state.player.height / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: Math.random() * 3 + 1,
                color: obs.type === "ball" ? "#ffd700" : "#ff3b3b",
                life: 1.0,
              });
            }

            state.gameActive = false;
            setIsPlaying(false);
            setSysStatus("SYS_STATUS: CRASHED");
          }
        }

        // Draw Player Sprite on canvas with neon styles
        ctx.fillStyle = state.player.isDucking ? "#2979ff" : "#00e676";
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        
        // Draw cute boxy pixel athlete
        ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
        
        // Draw head-up helmet/hair strip 
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(state.player.x + 3, state.player.y - 4, 12, 4);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(state.player.x + 11, state.player.y + 1, 6, 4); // Visor eye strip

        // Draw simple soccer jersey numbering
        ctx.fillStyle = "#0c0f1d";
        ctx.font = 'bold 10px monospace';
        ctx.fillText("IQ", state.player.x + 2, state.player.y + 16);

        // Reset shadow
        ctx.shadowBlur = 0;
      } else {
        // Draw static instructions or GameOver indicator 
        ctx.fillStyle = "rgba(10, 14, 26, 0.75)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        
        if (state.frameCount === 0) {
          ctx.fillText("TAP OR PRESS PLAY TO TRAIN KICKIQ AI", canvas.width / 2, canvas.height / 2 - 5);
          ctx.fillStyle = "#8892a4";
          ctx.font = "10px monospace";
          ctx.fillText("JUMP: SPACE/UP  |  DRIBBLE DUCK: DOWN", canvas.width / 2, canvas.height / 2 + 15);
        } else {
          ctx.fillStyle = "#ff3b3b";
          ctx.fillText("SESSION TERMINATED - STADIUM CRASH", canvas.width / 2, canvas.height / 2 - 15);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText(`TRAINED POWER INDEX: ${state.score} GOALS`, canvas.width / 2, canvas.height / 2 + 5);
          ctx.fillStyle = "#00e676";
          ctx.font = "9px monospace";
          ctx.fillText("PRESS RETRY BELOW TO PLAY AGAIN", canvas.width / 2, canvas.height / 2 + 22);
        }
      }

      // Draw all obstacles
      ctx.textAlign = "left";
      state.obstacles.forEach((obs) => {
        if (obs.type === "ball") {
          // Draw a glowing soccer ball
          ctx.fillStyle = "#ffffff";
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#ffd700";
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
          ctx.fill();
          
          // Pattern dots
          ctx.fillStyle = "#131929";
          ctx.fillRect(obs.x + 4, obs.y + 4, 3, 3);
          ctx.fillRect(obs.x + 8, obs.y + 6, 2, 2);
          
          ctx.shadowBlur = 0;
        } else {
          // Draw spiked soccer shoes/cleats
          ctx.fillStyle = "#ff3b3b";
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#ff3b3b";
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          // Draws spikes below cleat base
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(obs.x + 2, obs.y + obs.height, 2, 3);
          ctx.fillRect(obs.x + 8, obs.y + obs.height, 2, 3);
          ctx.fillRect(obs.x + 14, obs.y + obs.height, 2, 3);
          
          ctx.shadowBlur = 0;
        }
      });

      // Handle Particles Update & Render
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1.0;

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [audioMuted]);

  // Handle the automatic credentials injection cheat trigger
  const handleApplyBypassBait = () => {
    if (onPreFillCredentials) {
      onPreFillCredentials("analyst.pro@kickiq.ai", "KickIQ_Pro_2026!");
    }
  };

  return (
    <div className="w-full bg-[#131929] border border-[#1e2d45] rounded-2xl p-5 overflow-hidden shadow-2xl flex flex-col items-center">
      
      {/* Telemetry live system monitor row */}
      <div className="w-full font-mono text-[9px] text-[#00e676] bg-[#060913] border border-[#1e2d45] rounded-lg px-3 py-1.5 flex justify-between items-center mb-3.5">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-ping" />
          {sysStatus}
        </span>
        <button
          onClick={() => {
            const nextMuted = !audioMuted;
            setAudioMuted(nextMuted);
            if (!nextMuted) {
              ensureAudioResumed();
              setTimeout(() => playSound(520, "sine", 0.08), 50);
            }
          }}
          className="hover:text-amber-400 font-extrabold uppercase transition px-1.5 py-0.5 rounded border border-[#1e2d45] bg-[#0a0e1a]"
        >
          {audioMuted ? (
            <span className="flex items-center gap-1 text-[#ff3b3b]">
              <VolumeX className="w-3 h-3" />
              MUTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#ffd700]">
              <Volume2 className="w-3 h-3" />
              🔈 AUDIO ON
            </span>
          )}
        </button>
        <span className="text-[#ffd700] font-black flex items-center gap-1">
          <Trophy className="w-3 h-3 text-[#ffd700]" />
          RECORD: {highScore}
        </span>
      </div>

      {/* Canvas view stage frame */}
      <div className="w-full bg-[#060913] rounded-xl border-2 border-[#1e2d45] relative overflow-hidden group">
        <canvas
          ref={canvasRef}
          width={360}
          height={150}
          className="block w-full cursor-pointer h-36"
          onClick={triggerJump}
        />
        
        {/* On-canvas click overlay when game is inactive */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <button
              onClick={startGame}
              className="px-6 py-2.5 bg-[#00e676] text-[#0a0e1a] hover:bg-[#00c862] hover:scale-105 active:scale-95 transition font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 border border-[#060913]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Arcade Training Session
            </button>
          </div>
        )}
      </div>

      {/* Control Instruction Ticker */}
      <div className="text-[10px] text-[#8892a4] mt-2 text-center font-bold tracking-wide flex justify-center items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded bg-[#0a0e1a] border border-[#1e2d45]">SPACE/UP = Leap Cleats</span>
        <span className="text-[#4a5568]">|</span>
        <span className="px-1.5 py-0.5 rounded bg-[#0a0e1a] border border-[#1e2d45]">DOWN = Duck Balls</span>
      </div>

      {/* Dynamic mobile helper controls */}
      <div className="w-full mt-3 flex justify-center gap-3">
        <button
          onClick={triggerJump}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-[#1e2d45] hover:bg-[#2e3e57] transition flex items-center justify-center gap-1.5 text-slate-200 border border-[#2e3e57]"
        >
          <ArrowUp className="w-3.5 h-3.5 text-[#00e676]" />
          Jump Leap (Cleats)
        </button>
        <button
          onMouseDown={() => triggerDuck(true)}
          onMouseUp={() => triggerDuck(false)}
          onTouchStart={() => triggerDuck(true)}
          onTouchEnd={() => triggerDuck(false)}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-[#1e2d45] hover:bg-[#2e3e57] transition flex items-center justify-center gap-1.5 text-slate-200 border border-[#2e3e57]"
        >
          <ArrowDown className="w-3.5 h-3.5 text-[#2979ff]" />
          Dribble Duck (Balls)
        </button>
      </div>

      {/* High-Performance Training Metrics Board */}
      <div className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-lg p-3.5 mt-4 text-center">
        <div className="flex justify-between items-center text-[10px] font-mono mb-1 text-slate-400 font-bold uppercase tracking-wider">
          <span>KickIQ AI Model Training Progress</span>
          <span className="text-[#00e676]">{score} GOALS</span>
        </div>
        <div className="w-full bg-[#131929] border border-[#1e2d45] h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-[#00e676] transition-all duration-300"
            style={{ width: `${Math.min(100, (score / 15) * 100)}%` }}
          />
        </div>
        <p className="text-[9px] text-[#8892a4] font-mono mt-1.5 uppercase tracking-wide">
          ⚽ Play to feed the match outcome prediction model. Current Score: {score} | Record: {highScore}
        </p>
      </div>
    </div>
  );
}
