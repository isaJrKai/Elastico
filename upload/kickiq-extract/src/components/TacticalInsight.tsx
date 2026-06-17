import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { Sparkles, Users, RefreshCw, Zap, Sliders, Info, Shield, HelpCircle, Activity } from "lucide-react";
import { Match, LineupPlayer } from "../types";
import { triggerHaptic } from "../utils/haptics";

interface TacticalInsightProps {
  match: Match;
}

interface PlayerNode extends d3.SimulationNodeDatum {
  name: string;
  role: string;
  posName: string;
  rating: number;
  initialX: number;
  initialY: number;
  color: string;
  isHome: boolean;
}

interface PassLink extends d3.SimulationLinkDatum<PlayerNode> {
  source: string | PlayerNode;
  target: string | PlayerNode;
  weight: number;
}

// Fallback rosters if not defined
const defaultTeamRosters: Record<string, { starters: { name: string; role: string; posName: string; rating: number; x: number; y: number }[] }> = {
  Brazil: {
    starters: [
      { name: "Alisson", role: "GK", posName: "GK", rating: 89, x: 50, y: 88 },
      { name: "Danilo", role: "DEF", posName: "RB", rating: 81, x: 80, y: 72 },
      { name: "Marquinhos", role: "DEF", posName: "CB", rating: 87, x: 62, y: 72 },
      { name: "Gabriel", role: "DEF", posName: "CB", rating: 86, x: 38, y: 72 },
      { name: "Arana", role: "DEF", posName: "LB", rating: 80, x: 20, y: 72 },
      { name: "Casemiro", role: "MID", posName: "DM", rating: 84, x: 50, y: 55 },
      { name: "Guimaraes", role: "MID", posName: "CM", rating: 85, x: 32, y: 48 },
      { name: "Paqueta", role: "MID", posName: "AM", rating: 83, x: 68, y: 48 },
      { name: "Rodrygo", role: "FWD", posName: "RW", rating: 86, x: 78, y: 25 },
      { name: "Richarlison", role: "FWD", posName: "ST", rating: 82, x: 50, y: 18 },
      { name: "Vinicius Jr", role: "FWD", posName: "LW", rating: 90, x: 22, y: 25 },
    ]
  },
  Germany: {
    starters: [
      { name: "ter Stegen", role: "GK", posName: "GK", rating: 89, x: 50, y: 88 },
      { name: "Kimmich", role: "DEF", posName: "RB", rating: 86, x: 80, y: 72 },
      { name: "Rudiger", role: "DEF", posName: "CB", rating: 88, x: 62, y: 72 },
      { name: "Tah", role: "DEF", posName: "CB", rating: 84, x: 38, y: 72 },
      { name: "Mittelstadt", role: "DEF", posName: "LB", rating: 81, x: 20, y: 72 },
      { name: "Andrich", role: "MID", posName: "CM", rating: 82, x: 35, y: 56 },
      { name: "Kroos", role: "MID", posName: "CM", rating: 87, x: 65, y: 56 },
      { name: "Gundogan", role: "MID", posName: "AM", rating: 85, x: 50, y: 38 },
      { name: "Sane", role: "FWD", posName: "RW", rating: 84, x: 78, y: 32 },
      { name: "Musiala", role: "FWD", posName: "LW", rating: 88, x: 22, y: 32 },
      { name: "Fullkrug", role: "FWD", posName: "ST", rating: 82, x: 50, y: 16 },
    ]
  },
  Argentina: {
    starters: [
      { name: "E. Martinez", role: "GK", posName: "GK", rating: 88, x: 50, y: 88 },
      { name: "Molina", role: "DEF", posName: "RB", rating: 82, x: 80, y: 72 },
      { name: "Romero", role: "DEF", posName: "CB", rating: 87, x: 62, y: 72 },
      { name: "Otamendi", role: "DEF", posName: "CB", rating: 83, x: 38, y: 72 },
      { name: "Tagliafico", role: "DEF", posName: "LB", rating: 81, x: 20, y: 72 },
      { name: "Fernandez", role: "MID", posName: "DM", rating: 84, x: 50, y: 55 },
      { name: "De Paul", role: "MID", posName: "CM", rating: 84, x: 68, y: 48 },
      { name: "Mac Allister", role: "MID", posName: "CM", rating: 86, x: 32, y: 48 },
      { name: "Messi", role: "FWD", posName: "RW", rating: 92, x: 78, y: 25 },
      { name: "Alvarez", role: "FWD", posName: "ST", rating: 85, x: 50, y: 18 },
      { name: "Gonzalez", role: "FWD", posName: "LW", rating: 80, x: 22, y: 25 },
    ]
  },
  France: {
    starters: [
      { name: "Maignan", role: "GK", posName: "GK", rating: 87, x: 50, y: 88 },
      { name: "Kounde", role: "DEF", posName: "RB", rating: 84, x: 80, y: 72 },
      { name: "Saliba", role: "DEF", posName: "CB", rating: 88, x: 62, y: 72 },
      { name: "Upamecano", role: "DEF", posName: "CB", rating: 83, x: 38, y: 72 },
      { name: "Hernandez", role: "DEF", posName: "LB", rating: 85, x: 20, y: 72 },
      { name: "Tchouameni", role: "MID", posName: "DM", rating: 84, x: 50, y: 55 },
      { name: "Griezmann", role: "MID", posName: "AM", rating: 86, x: 50, y: 38 },
      { name: "Rabiot", role: "MID", posName: "CM", rating: 82, x: 28, y: 48 },
      { name: "Dembele", role: "FWD", posName: "RW", rating: 84, x: 78, y: 25 },
      { name: "Mbappe", role: "FWD", posName: "LW", rating: 91, x: 22, y: 22 },
      { name: "Thuram", role: "FWD", posName: "ST", rating: 81, x: 50, y: 16 },
    ]
  }
};

const defaultList = [
  { name: "Striker 1", role: "FWD", posName: "ST", rating: 84, x: 50, y: 18 },
  { name: "Winger Left", role: "FWD", posName: "LW", rating: 82, x: 20, y: 25 },
  { name: "Winger Right", role: "FWD", posName: "RW", rating: 83, x: 80, y: 25 },
  { name: "Midfielder Cent", role: "MID", posName: "CM", rating: 85, x: 50, y: 45 },
  { name: "Midfielder Left", role: "MID", posName: "LM", rating: 81, x: 25, y: 48 },
  { name: "Midfielder Right", role: "MID", posName: "RM", rating: 82, x: 75, y: 48 },
  { name: "Center Back L", role: "DEF", posName: "CB", rating: 85, x: 35, y: 72 },
  { name: "Center Back R", role: "DEF", posName: "CB", rating: 84, x: 65, y: 72 },
  { name: "Fullback Left", role: "DEF", posName: "LB", rating: 80, x: 15, y: 68 },
  { name: "Fullback Right", role: "DEF", posName: "RB", rating: 81, x: 85, y: 68 },
  { name: "Goal Keeper", role: "GK", posName: "GK", rating: 86, x: 50, y: 88 },
];

export default function TacticalInsight({ match }: TacticalInsightProps) {
  const [activeTab, setActiveTab] = useState<"network" | "heatmap">("network");
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");
  
  // Controls / Modifiers
  const [passingStyle, setPassingStyle] = useState<"possession" | "direct" | "counter">("possession");
  const [tempo, setTempo] = useState<number>(65); // Speed multiplier
  const [heatmapType, setHeatmapType] = useState<"touches" | "shots" | "defends">("touches");
  
  // Focus state
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerNode | null>(null);
  const [isD3Simulating, setIsD3Simulating] = useState(true);

  // References
  const d3ContainerRef = useRef<SVGSVGElement | null>(null);

  const getTeamRoster = (teamName: string, isHome: boolean, color: string): PlayerNode[] => {
    const list = defaultTeamRosters[teamName]?.starters || defaultList;
    return list.map((p, idx) => ({
      name: p.name,
      role: p.role,
      posName: p.posName,
      rating: p.rating,
      initialX: p.x,
      initialY: p.y,
      color,
      isHome,
    }));
  };

  const getRosters = () => {
    const hColor = match.home_jersey_color || "#10b981";
    const aColor = match.away_jersey_color || "#14b8a6";
    const homePlayers = getTeamRoster(match.home_team, true, hColor);
    const awayPlayers = getTeamRoster(match.away_team, false, aColor);
    return { homePlayers, awayPlayers };
  };

  // Generate mock passing lines based on positions and rating synergy
  const generatePassLinks = (nodes: PlayerNode[]): PassLink[] => {
    const links: PassLink[] = [];
    // Only connect logical neighbors or key patterns to avoid excessive clutter
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = nodes[i];
        const p2 = nodes[j];

        // GK mostly passes only to DEF or DMs
        if (p1.role === "GK" && p2.role === "FWD") continue;
        if (p2.role === "GK" && p1.role === "FWD") continue;

        const distance = Math.sqrt(
          Math.pow(p1.initialX - p2.initialX, 2) + Math.pow(p1.initialY - p2.initialY, 2)
        );

        // Standard proximity link or playmaking connection
        if (distance < 45) {
          // Calculate weight
          let baseWeight = (p1.rating + p2.rating) / 40;
          if (passingStyle === "possession") {
            baseWeight *= 1.4;
          } else if (passingStyle === "direct" && (p1.role === "MID" || p1.role === "DEF") && p2.role === "FWD") {
            baseWeight *= 1.8; // Boost direct passes
          } else if (passingStyle === "counter" && distance > 30) {
            baseWeight *= 1.3;
          }

          // Add a simple deterministic variation
          const hashId = (p1.name.length * p2.name.length) % 5;
          const weight = Math.max(1.5, baseWeight + hashId - (distance / 15));

          links.push({
            source: p1.name,
            target: p2.name,
            weight: parseFloat(weight.toFixed(1)),
          });
        }
      }
    }
    return links;
  };

  // Complement Poisson parameters
  // Returns tactical multipliers that visualizes alignment to expected goals
  const getPoissonInfluence = () => {
    const isTargetHome = selectedTeam === "home";
    const baseMu = isTargetHome ? (match.mu_home || 1.35) : (match.mu_away || 1.15);
    
    // Calculate passing index score
    let passVolumeMultiplier = 1.0;
    let attackRatio = 0.5;

    if (passingStyle === "possession") {
      passVolumeMultiplier = 1.25;
      attackRatio = 0.45;
    } else if (passingStyle === "direct") {
      passVolumeMultiplier = 0.9;
      attackRatio = 0.70;
    } else if (passingStyle === "counter") {
      passVolumeMultiplier = 1.1;
      attackRatio = 0.60;
    }

    const tempoFactor = 0.8 + (tempo / 150);
    const resultPoissonGoals = baseMu * passVolumeMultiplier * tempoFactor;
    const completenessRatio = Math.min(99, Math.round(70 + (tempo / 5) * passVolumeMultiplier));

    return {
      compliedGoals: resultPoissonGoals.toFixed(2),
      completenessRatio,
      possessionPct: passingStyle === "possession" ? 58 : passingStyle === "counter" ? 44 : 49,
      directnessIndex: passingStyle === "direct" ? "HI-THRUST" : "ORGANIZED",
    };
  };

  // Main D3 lifecycle renderer
  useEffect(() => {
    if (!d3ContainerRef.current) return;

    // Clear previous elements
    d3.select(d3ContainerRef.current).selectAll("*").remove();

    const svg = d3.select(d3ContainerRef.current);
    const width = 400;
    const height = 500;

    // Responsive attributes
    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%");

    // Fetch players
    const { homePlayers, awayPlayers } = getRosters();
    const currTeamPlayers = selectedTeam === "home" ? homePlayers : awayPlayers;
    
    // Map initial positions onto actual coordinates
    const nodes: PlayerNode[] = currTeamPlayers.map(p => ({
      ...p,
      x: (p.initialX / 100) * width,
      y: (p.initialY / 100) * height,
    }));

    if (activeTab === "network") {
      // 1. RENDER PASSING NETWORK
      const links = generatePassLinks(nodes);

      // Link definitions
      const linkGroup = svg.append("g").attr("class", "links-group");
      const nodeGroup = svg.append("g").attr("class", "nodes-group");

      // Draw links
      const linkElements = linkGroup
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", selectedTeam === "home" ? "#10b981" : "#14b8a6")
        .attr("stroke-opacity", (d) => {
          if (selectedPlayer) {
            const isRelated = d.source === selectedPlayer.name || d.target === selectedPlayer.name;
            return isRelated ? 0.85 : 0.08;
          }
          return 0.35;
        })
        .attr("stroke-width", (d) => Math.max(1, d.weight * 0.95))
        .attr("class", "transition-all duration-300");

      // Draw node g wrappers
      const nodeElements = nodeGroup
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "cursor-pointer group")
        .on("click", (event, d) => {
          triggerHaptic("light");
          setSelectedPlayer(d === selectedPlayer ? null : d);
        });

      // Nodes glows
      nodeElements
        .append("circle")
        .attr("r", (d) => (selectedPlayer?.name === d.name ? 16 : 11))
        .attr("fill", "#090d16")
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", (d) => (selectedPlayer?.name === d.name ? 3 : 1.5))
        .attr("class", "transition-all duration-300 shadow-xl");

      // Inner glowing core
      nodeElements
        .append("circle")
        .attr("r", 3)
        .attr("fill", (d) => d.color)
        .attr("opacity", 0.7);

      // Player names inside network
      nodeElements
        .append("text")
        .text((d) => `${d.posName} ${d.name.split(" ").pop()}`)
        .attr("dx", 0)
        .attr("dy", (d) => (selectedPlayer?.name === d.name ? -22 : -15))
        .attr("text-anchor", "middle")
        .attr("font-size", "7.5px")
        .attr("font-family", "monospace")
        .attr("fill", (d) => (selectedPlayer?.name === d.name ? "#ffffff" : "#64748b"))
        .attr("font-weight", (d) => (selectedPlayer?.name === d.name ? "bold" : "normal"));

      // Set force-directed simulation
      if (isD3Simulating) {
        const simulation = d3
          .forceSimulation<PlayerNode>(nodes)
          .force("link", d3.forceLink<PlayerNode, PassLink>(links).id((d) => d.name).distance(75))
          .force("charge", d3.forceManyBody().strength(-220))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide(25));

        // Let simulation tick
        simulation.on("tick", () => {
          linkElements
            .attr("x1", (d) => (d.source as PlayerNode).x ?? 0)
            .attr("y1", (d) => (d.source as PlayerNode).y ?? 0)
            .attr("x2", (d) => (d.target as PlayerNode).x ?? 0)
            .attr("y2", (d) => (d.target as PlayerNode).y ?? 0);

          nodeElements.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
        });

        // Drag node interactions
        nodeElements.call(
          d3.drag<SVGGElement, PlayerNode>()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.2).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );
      } else {
        // Direct tactical projection view without simulation
        nodeElements.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
        linkElements
          .attr("x1", (d) => {
            const srcNode = nodes.find(n => n.name === d.source);
            return srcNode ? srcNode.x ?? 0 : 0;
          })
          .attr("y1", (d) => {
            const srcNode = nodes.find(n => n.name === d.source);
            return srcNode ? srcNode.y ?? 0 : 0;
          })
          .attr("x2", (d) => {
            const targetNode = nodes.find(n => n.name === (d.target as any).name || n.name === d.target);
            return targetNode ? targetNode.x ?? 0 : 0;
          })
          .attr("y2", (d) => {
            const targetNode = nodes.find(n => n.name === (d.target as any).name || n.name === d.target);
            return targetNode ? targetNode.y ?? 0 : 0;
          });
      }

    } else {
      // 2. RENDER SPATIAL HEATMAP USING D3 GRID INJECTIONS
      const heatmapGroup = svg.append("g").attr("class", "heatmap-group");
      
      // Determine hot spots coordinates depending on the selected heatmapType
      const totalPoints = 90;
      const points: { cx: number; cy: number; weight: number }[] = [];

      nodes.forEach((pl) => {
        // Generate coordinates around player base
        const count = heatmapType === "touches" ? 8 : heatmapType === "shots" && pl.role === "FWD" ? 12 : 5;
        const spread = heatmapType === "touches" ? 45 : heatmapType === "shots" ? 30 : 60;

        for (let idx = 0; idx < count; idx++) {
          const angle = (idx / count) * Math.PI * 2;
          // Displace forward depending on role
          const offsetForward = pl.role === "FWD" ? -25 : pl.role === "DEF" ? 15 : 0;
          const r = Math.random() * spread;
          const cx = pl.x + Math.cos(angle) * r;
          const cy = pl.y + Math.sin(angle) * r + offsetForward;

          // Constraints to stay inside field boundaries
          const finalX = Math.max(15, Math.min(width - 15, cx));
          const finalY = Math.max(15, Math.min(height - 15, cy));

          // Base factor based on stats
          let w = pl.rating / 100;
          if (heatmapType === "shots" && pl.role !== "FWD") w *= 0.15;
          if (heatmapType === "defends" && pl.role !== "DEF") w *= 0.35;

          points.push({ cx: finalX, cy: finalY, weight: w });
        }
      });

      // Define radial color gradients
      const defs = svg.append("defs");
      const grad = defs
        .append("radialGradient")
        .attr("id", "heat-radial")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");

      const teamColor = selectedTeam === "home" ? "#10b981" : "#14b8a6";

      grad.append("stop").attr("offset", "0%").attr("stop-color", teamColor).attr("stop-opacity", 0.45);
      grad.append("stop").attr("offset", "100%").attr("stop-color", teamColor).attr("stop-opacity", 0.0);

      // Render glowing soft heat points
      heatmapGroup
        .selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", (d) => d.cx)
        .attr("cy", (d) => d.cy)
        .attr("r", (d) => Math.max(20, d.weight * 52))
        .attr("fill", "url(#heat-radial)")
        .attr("class", "animate-pulse transition-all duration-[3000ms]")
        .attr("opacity", 0.8);

      // Render smaller dense hot-point anchors
      heatmapGroup
        .selectAll(".core-point")
        .data(points.filter((_, i) => i % 3 === 0))
        .enter()
        .append("circle")
        .attr("class", "core-point")
        .attr("cx", (d) => d.cx)
        .attr("cy", (d) => d.cy)
        .attr("r", 1.5)
        .attr("fill", teamColor)
        .attr("opacity", 0.25);
        
      // Overlay player tags lightly in heatmap
      const pinsGroup = svg.append("g").attr("class", "pins-group");
      pinsGroup
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .append("text")
        .text((d) => d.posName)
        .attr("dy", 3)
        .attr("text-anchor", "middle")
        .attr("font-size", "7px")
        .attr("font-family", "monospace")
        .attr("fill", "#94a3b8")
        .attr("opacity", 0.5)
        .attr("font-weight", "black");
    }

  }, [activeTab, selectedTeam, passingStyle, tempo, heatmapType, isD3Simulating, match]);

  const pInfluence = getPoissonInfluence();

  return (
    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-5" id="tactical-d3-insight-card">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <h4 className="text-[10.5px] font-black uppercase text-slate-200 tracking-wider font-mono">
              Tactical Network & Deep Analysis
            </h4>
            <p className="text-[9px] text-slate-500 font-sans">
              Dynamic physical modeling using D3 spatial vectors & head-to-head metrics
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-850 rounded-xl max-w-[200px] shrink-0">
          <button
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("network");
              setSelectedPlayer(null);
            }}
            className={`py-1 rounded-[7px] text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "network"
                ? "bg-slate-900 border border-slate-800 text-emerald-400 font-extrabold shadow-sm"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            🕸️ Network
          </button>
          <button
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("heatmap");
              setSelectedPlayer(null);
            }}
            className={`py-1 rounded-[7px] text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "heatmap"
                ? "bg-slate-900 border border-slate-800 text-teal-400 font-extrabold shadow-sm"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            🔥 Heatmap
          </button>
        </div>
      </div>

      {/* Main Grid: D3 Pitch Board on left, controls & Poisson metrics on right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Pitch canvas (MD cols 7) */}
        <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-850 p-4 relative overflow-hidden h-[380px] sm:h-[450px]">
          
          {/* Subtle field markings watermark backdrop */}
          <div className="absolute inset-4 border border-dashed border-slate-850/45 pointer-events-none rounded-lg flex flex-col justify-between">
            <div className="w-full border-b border-slate-850/45 h-1/2 relative">
              {/* Half center circle */}
              <div className="absolute bottom-[-25px] left-1/2 -translate-x-1/2 w-[50px] h-[50px] rounded-full border border-slate-850/45" />
              {/* Penalty Box Up */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[45px] border-b border-x border-slate-850/45" />
            </div>
            <div className="w-full relative h-1/2">
              {/* Penalty Box Down */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120px] h-[45px] border-t border-x border-slate-850/45" />
            </div>
          </div>

          <svg 
            ref={d3ContainerRef} 
            className="w-full h-full relative z-10 select-none"
          />

          {/* Overlay hints inside canvas screen */}
          <div className="absolute bottom-3 right-3 bg-slate-950/70 border border-slate-850/60 rounded-lg px-2 py-1 text-[7.5px] font-mono text-slate-500 z-25 flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-500 shrink-0" />
            <span>
              {activeTab === "network" ? "Drag nodes or click player to highlight" : "D3 Kernel Density view active"}
            </span>
          </div>
        </div>

        {/* Dashboard variables card (MD cols 5) */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-4 text-left">
          
          {/* Section 1: Team switch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest leading-none">
                Select Focused Roster
              </span>
              <span className="text-[8px] px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md font-mono font-black animate-pulse">
                D3 ENGINE
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  triggerHaptic("light");
                  setSelectedTeam("home");
                  setSelectedPlayer(null);
                }}
                className={`flex-1 py-2 text-center rounded-xl text-[10.5px] uppercase font-bold border transition cursor-pointer ${
                  selectedTeam === "home"
                    ? "bg-slate-850 border-emerald-500/30 text-emerald-400 font-extrabold shadow-sm"
                    : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200"
                }`}
              >
                🏠 {match.home_team}
              </button>
              <button
                onClick={() => {
                  triggerHaptic("light");
                  setSelectedTeam("away");
                  setSelectedPlayer(null);
                }}
                className={`flex-1 py-2 text-center rounded-xl text-[10.5px] uppercase font-bold border transition cursor-pointer ${
                  selectedTeam === "away"
                    ? "bg-slate-850 border-teal-500/30 text-teal-400 font-extrabold shadow-sm"
                    : "bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200"
                }`}
              >
                🚀 {match.away_team}
              </button>
            </div>
          </div>

          {/* Section 2: Tab based parameter adjustments */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4 flex-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[9.5px] font-black uppercase tracking-wider border-b border-slate-900 pb-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tactical Configurations</span>
            </div>

            {activeTab === "network" ? (
              // NETWORK CONFS
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Passing Layout Format</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-850/60">
                    {(["possession", "direct", "counter"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => {
                          triggerHaptic("light");
                          setPassingStyle(style);
                        }}
                        className={`py-1 rounded text-[8px] font-bold uppercase cursor-pointer transition ${
                          passingStyle === style
                            ? "bg-slate-800 text-emerald-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-350"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>BUILD PASSING SPEED</span>
                    <span className="text-emerald-400 font-bold">{tempo}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="99"
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-900 rounded-lg cursor-pointer h-1"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                  <span className="text-[8.5px] font-mono text-slate-400">D3 Force-Directed Simulation</span>
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      setIsD3Simulating(!isD3Simulating);
                    }}
                    className={`px-2.5 py-1 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider border transition ${
                      isD3Simulating 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    {isD3Simulating ? "⚡ LIVE FORCES" : "📐 STATIC POSITION"}
                  </button>
                </div>
              </div>
            ) : (
              // HEATMAP CONFS
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Heat Density Event focus</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-850/60">
                    {(["touches", "shots", "defends"] as const).map((ht) => (
                      <button
                        key={ht}
                        onClick={() => {
                          triggerHaptic("light");
                          setHeatmapType(ht);
                        }}
                        className={`py-1 rounded text-[8px] font-bold uppercase cursor-pointer transition ${
                          heatmapType === ht
                            ? "bg-slate-800 text-teal-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-350"
                        }`}
                      >
                        📬 {ht}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/50 p-2.5 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[8px] font-mono text-slate-400 font-extrabold uppercase tracking-widest block text-teal-400">
                    D3 Heatmap interpolation
                  </span>
                  <p className="text-[8px] text-slate-500 leading-normal">
                    This spatial system maps the relative event density of {selectedTeam === "home" ? match.home_team : match.away_team} across coordinate buckets. Ideal for pinpointing positioning asymmetry!
                  </p>
                </div>
              </div>
            )}

            {/* Selected Player profile focus inside the chart panel */}
            {selectedPlayer && (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="space-y-0.5">
                  <span className="text-[7px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded font-black uppercase block w-max">
                    ACTIVE NODE STATS
                  </span>
                  <p className="text-[11px] font-extrabold text-slate-100 font-sans tracking-tight">
                    {selectedPlayer.name} ({selectedPlayer.posName})
                  </p>
                  <p className="text-[8.5px] text-slate-400 font-mono">
                    Rating OVR: <span className="text-slate-200 font-extrabold">{selectedPlayer.rating}</span> • Key Pass Ratio: {(((selectedPlayer.rating - 50) * 1.5) + (tempo / 10)).toFixed(0)}%
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-[9px] font-mono text-slate-500 hover:text-slate-300 font-bold uppercase bg-slate-950 px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Section 3: POISSON CORRELATOR complementary stats */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">
                ⚽ Poisson Math Correlator
              </span>
              <span className="text-[7px] font-mono text-slate-500">
                BASED ON MOVEMENT DATA
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block tracking-wider">
                  Poisson Expected Intensity (xG)
                </span>
                <span className="text-[15px] font-mono font-black text-emerald-400 flex items-center gap-1">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  {pInfluence.compliedGoals}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block tracking-wider">
                  Attack Sequence Pace
                </span>
                <span className="text-[11px] font-mono font-black text-slate-300 uppercase">
                  {pInfluence.directnessIndex}
                </span>
              </div>
            </div>

            {/* Progress bar visualizing tactical synergy */}
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                <span>TACTICAL COMPLETION RATIO</span>
                <span>{pInfluence.completenessRatio}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850/50">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${pInfluence.completenessRatio}%` }}
                />
              </div>
            </div>

            <p className="text-[7px] text-slate-650 font-mono text-left leading-normal">
              *Poisson correlator measures tactical speed, team connectivity (nodes completeness) and movement hot spots mapping directly to simulated attacking ratios (λ / μ parameters).
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
