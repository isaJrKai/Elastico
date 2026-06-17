import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { 
  Play, Zap, RefreshCw, Layers, Calendar, MapPin, Award, 
  Timer, Volume2, ShieldAlert, CheckCircle, Info, Radio, 
  HelpCircle, Sparkles, TrendingUp, ChevronRight, BarChart2,
  Bell, BellOff, VolumeX, Trash2, Activity, ChevronDown, ChevronUp,
  Users, ArrowLeftRight, Search, AlertCircle, Scale
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Match, MatchEvent, User, LineupPlayer } from "../types";
import ChatPanel from "./ChatPanel";
import TacticalInsight from "./TacticalInsight";
import NotificationSettings, { NotificationSettingsConfig } from "./NotificationSettings";
import { useHalftimeMonitor } from "../hooks/useHalftimeMonitor";
import { triggerHaptic } from "../utils/haptics";
import LiveScoreboard from "./LiveScoreboard";
import TournamentBracket from "./TournamentBracket";
import PredictionCard from "./PredictionCard";
import TeamIntelligence from "./TeamIntelligence";
import GoldenBootLeaderboard from "./GoldenBootLeaderboard";
import PersonalizedDashboard from "./PersonalizedDashboard";
import PredictorsLeaderboard from "./PredictorsLeaderboard";

interface DashboardViewProps {
  user: User;
  authToken: string;
  onOpenUpgrade: () => void;
  onProfileUpdated?: (u: User) => void;
  matches: Match[];
  onRefreshMatches: () => void;
  selectedMatch: Match | null;
  onSelectMatch: (m: Match) => void;
}

interface SportArticle {
  id: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  time: string;
  thumbnail: string;
  category: "Local" | "Global" | "Transfer" | "Tactics";
  region?: string;
  flag?: string;
}

const newsArticles: SportArticle[] = [
  {
    id: "nbs-1",
    source: "NBS Sport",
    title: "Uganda Cranes Intensify Tactical Drills Ahead of High-Stakes African Qualifiers",
    summary: "National coach introduces critical transition game-plans to master defensive structure against elite international high-press.",
    url: "https://nbssport.co.ug/",
    time: "4m ago",
    thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop",
    category: "Local",
  },
  {
    id: "nbs-2",
    source: "NBS Sport",
    title: "National Basketball League: City Oilers Register Explosive Victory",
    summary: "Commanding screen rotations and offensive transitions secure a vital win for the local basketball division leaders.",
    url: "https://nbssport.co.ug/",
    time: "2h ago",
    thumbnail: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=300&auto=format&fit=crop",
    category: "Local",
  },
  {
    id: "nbs-3",
    source: "NBS Sport",
    title: "NSSF KAVC International: Volleyball Clubs Sync Tactical Roations",
    summary: "Ugandan teams lock down defensive defense formations to counter incoming regional Eastern African volleyball squads.",
    url: "https://nbssport.co.ug/",
    time: "5h ago",
    thumbnail: "https://images.unsplash.com/photo-1547347298-4074fc308ac9?q=80&w=300&auto=format&fit=crop",
    category: "Local",
  },
  {
    id: "espn-1",
    source: "ESPN",
    title: "World Cup Tactical Preview: Poisson Models Pinpoint Midfield Overloads",
    summary: "Advanced sports forecasts examine ELO progress ratios, showcasing clash predictions against standard physical models.",
    url: "https://www.espn.com/soccer/",
    time: "15m ago",
    thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop",
    category: "Global",
  },
  {
    id: "bbc-1",
    source: "BBC Sport",
    title: "Slick Transfer Market: Power Clubs Unleash Massive Swaps",
    summary: "Top scouts trigger high-stakes negotiations as star performers dominate key defensive matrices.",
    url: "https://www.bbc.com/sport/football",
    time: "45m ago",
    thumbnail: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=300&auto=format&fit=crop",
    category: "Transfer",
  },
  {
    id: "sky-1",
    source: "Sky Sports",
    title: "The Genius of Zonal Pressing: Dissecting Positional Football Formations",
    summary: "Pundits analyze half-space overloads, modern counter-pressing styles, and inverted fullback utility.",
    url: "https://www.skysports.com/football",
    time: "1h ago",
    thumbnail: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=300&auto=format&fit=crop",
    category: "Tactics",
  },
];

const playersByTeam: Record<string, string[]> = {
  Brazil: ["Alisson", "Marquinhos", "Casemiro", "Vinicius Jr", "Rodrygo"],
  Germany: ["ter Stegen", "Rudiger", "Gundogan", "Musiala", "Fullkrug"],
  Argentina: ["E. Martinez", "Romero", "Mac Allister", "Messi", "Alvarez"],
  France: ["Maignan", "Saliba", "Tchouameni", "Mbappe", "Griezmann"],
  England: ["Pickford", "Stones", "Rice", "Bellingham", "Kane"],
  Spain: ["Simon", "Laporte", "Rodri", "Yamal", "Morata"],
  Portugal: ["Costa", "Dias", "Fernandes", "Leao", "Ronaldo"],
  Netherlands: ["Verbruggen", "van Dijk", "de Jong", "Gakpo", "Depay"],
};



const defaultRosters: Record<string, { starters: Omit<LineupPlayer, "id">[]; subs: Omit<LineupPlayer, "id">[] }> = {
  Brazil: {
    starters: [
      { name: "Alisson", role: "GK", posName: "GK", rating: 89, x: 50, y: 88, goals: 0, assists: 1, tackles: 42 },
      { name: "Danilo", role: "DEF", posName: "RB", rating: 81, x: 85, y: 72, goals: 1, assists: 4, tackles: 52 },
      { name: "Marquinhos", role: "DEF", posName: "CB", rating: 87, x: 62, y: 72, goals: 2, assists: 1, tackles: 68 },
      { name: "Gabriel", role: "DEF", posName: "CB", rating: 86, x: 38, y: 72, goals: 3, assists: 0, tackles: 74 },
      { name: "Arana", role: "DEF", posName: "LB", rating: 80, x: 15, y: 72, goals: 0, assists: 3, tackles: 48 },
      { name: "Casemiro", role: "MID", posName: "DM", rating: 84, x: 50, y: 52, goals: 4, assists: 3, tackles: 74 },
      { name: "Guimaraes", role: "MID", posName: "CM", rating: 85, x: 28, y: 48, goals: 3, assists: 5, tackles: 62 },
      { name: "Paqueta", role: "MID", posName: "AM", rating: 83, x: 72, y: 48, goals: 5, assists: 6, tackles: 40 },
      { name: "Rodrygo", role: "FWD", posName: "RW", rating: 86, x: 80, y: 22, goals: 13, assists: 8, tackles: 18 },
      { name: "Richarlison", role: "FWD", posName: "ST", rating: 82, x: 50, y: 18, goals: 11, assists: 2, tackles: 12 },
      { name: "Vinicius Jr", role: "FWD", posName: "LW", rating: 90, x: 20, y: 22, goals: 18, assists: 11, tackles: 21 },
    ],
    subs: [
      { name: "Ederson", role: "GK", posName: "GK", rating: 88, x: 0, y: 0, goals: 0, assists: 0, tackles: 10 },
      { name: "Militao", role: "DEF", posName: "CB", rating: 85, x: 0, y: 0, goals: 2, assists: 1, tackles: 58 },
      { name: "Joao Gomes", role: "MID", posName: "CM", rating: 80, x: 0, y: 0, goals: 1, assists: 2, tackles: 50 },
      { name: "Martinelli", role: "FWD", posName: "LW", rating: 84, x: 0, y: 0, goals: 6, assists: 4, tackles: 15 },
      { name: "Endrick", role: "FWD", posName: "ST", rating: 81, x: 0, y: 0, goals: 4, assists: 1, tackles: 8 },
    ]
  },
  Germany: {
    starters: [
      { name: "ter Stegen", role: "GK", posName: "GK", rating: 89, x: 50, y: 88, goals: 0, assists: 0, tackles: 38 },
      { name: "Kimmich", role: "DEF", posName: "RB", rating: 86, x: 85, y: 72, goals: 2, assists: 8, tackles: 65 },
      { name: "Rudiger", role: "DEF", posName: "CB", rating: 88, x: 62, y: 72, goals: 1, assists: 1, tackles: 72 },
      { name: "Tah", role: "DEF", posName: "CB", rating: 84, x: 38, y: 72, goals: 1, assists: 0, tackles: 64 },
      { name: "Mittelstadt", role: "DEF", posName: "LB", rating: 81, x: 15, y: 72, goals: 1, assists: 3, tackles: 50 },
      { name: "Andrich", role: "MID", posName: "CM", rating: 82, x: 35, y: 56, goals: 2, assists: 1, tackles: 78 },
      { name: "Kroos", role: "MID", posName: "CM", rating: 87, x: 65, y: 56, goals: 3, assists: 12, tackles: 46 },
      { name: "Gundogan", role: "MID", posName: "AM", rating: 85, x: 50, y: 38, goals: 6, assists: 9, tackles: 48 },
      { name: "Sane", role: "FWD", posName: "RW", rating: 84, x: 80, y: 32, goals: 8, assists: 7, tackles: 14 },
      { name: "Musiala", role: "FWD", posName: "LW", rating: 88, x: 20, y: 32, goals: 12, assists: 10, tackles: 25 },
      { name: "Fullkrug", role: "FWD", posName: "ST", rating: 82, x: 50, y: 16, goals: 15, assists: 4, tackles: 10 },
    ],
    subs: [
      { name: "Neuer", role: "GK", posName: "GK", rating: 86, x: 0, y: 0, goals: 0, assists: 0, tackles: 12 },
      { name: "Schlotterbeck", role: "DEF", posName: "CB", rating: 83, x: 0, y: 0, goals: 1, assists: 1, tackles: 52 },
      { name: "Gross", role: "MID", posName: "CM", rating: 81, x: 0, y: 0, goals: 2, assists: 3, tackles: 40 },
      { name: "Wirtz", role: "MID", posName: "AM", rating: 87, x: 0, y: 0, goals: 11, assists: 11, tackles: 22 },
      { name: "Havertz", role: "FWD", posName: "ST", rating: 84, x: 0, y: 0, goals: 12, assists: 6, tackles: 18 },
    ]
  },
  Argentina: {
    starters: [
      { name: "E. Martinez", role: "GK", posName: "GK", rating: 88, x: 50, y: 88, goals: 0, assists: 0, tackles: 45 },
      { name: "Molina", role: "DEF", posName: "RB", rating: 82, x: 85, y: 72, goals: 1, assists: 3, tackles: 50 },
      { name: "Romero", role: "DEF", posName: "CB", rating: 87, x: 62, y: 72, goals: 2, assists: 0, tackles: 80 },
      { name: "Otamendi", role: "DEF", posName: "CB", rating: 83, x: 38, y: 72, goals: 4, assists: 1, tackles: 62 },
      { name: "Tagliafico", role: "DEF", posName: "LB", rating: 81, x: 15, y: 72, goals: 1, assists: 2, tackles: 56 },
      { name: "Fernandez", role: "MID", posName: "DM", rating: 84, x: 50, y: 52, goals: 3, assists: 4, tackles: 68 },
      { name: "De Paul", role: "MID", posName: "CM", rating: 84, x: 72, y: 48, goals: 2, assists: 5, tackles: 85 },
      { name: "Mac Allister", role: "MID", posName: "CM", rating: 86, x: 28, y: 48, goals: 5, assists: 7, tackles: 56 },
      { name: "Messi", role: "FWD", posName: "RW", rating: 92, x: 80, y: 22, goals: 22, assists: 16, tackles: 12 },
      { name: "Alvarez", role: "FWD", posName: "ST", rating: 85, x: 50, y: 18, goals: 14, assists: 6, tackles: 34 },
      { name: "Gonzalez", role: "FWD", posName: "LW", rating: 80, x: 20, y: 22, goals: 4, assists: 3, tackles: 28 },
    ],
    subs: [
      { name: "Rulli", role: "GK", posName: "GK", rating: 80, x: 0, y: 0, goals: 0, assists: 0, tackles: 8 },
      { name: "Lisandro Martinez", role: "DEF", posName: "CB", rating: 84, x: 0, y: 0, goals: 1, assists: 1, tackles: 60 },
      { name: "Paredes", role: "MID", posName: "CM", rating: 81, x: 0, y: 0, goals: 2, assists: 2, tackles: 45 },
      { name: "Di Maria", role: "FWD", posName: "RW", rating: 83, x: 0, y: 0, goals: 8, assists: 9, tackles: 15 },
      { name: "Lautaro Martinez", role: "FWD", posName: "ST", rating: 87, x: 0, y: 0, goals: 16, assists: 3, tackles: 11 },
    ]
  },
  France: {
    starters: [
      { name: "Maignan", role: "GK", posName: "GK", rating: 87, x: 50, y: 88, goals: 0, assists: 0, tackles: 40 },
      { name: "Kounde", role: "DEF", posName: "RB", rating: 84, x: 85, y: 72, goals: 1, assists: 3, tackles: 55 },
      { name: "Saliba", role: "DEF", posName: "CB", rating: 88, x: 62, y: 72, goals: 1, assists: 1, tackles: 75 },
      { name: "Upamecano", role: "DEF", posName: "CB", rating: 83, x: 38, y: 72, goals: 1, assists: 0, tackles: 60 },
      { name: "Hernandez", role: "DEF", posName: "LB", rating: 85, x: 15, y: 72, goals: 3, assists: 6, tackles: 58 },
      { name: "Tchouameni", role: "MID", posName: "CM", rating: 85, x: 35, y: 56, goals: 3, assists: 2, tackles: 70 },
      { name: "Rabiot", role: "MID", posName: "CM", rating: 83, x: 65, y: 56, goals: 4, assists: 3, tackles: 52 },
      { name: "Griezmann", role: "MID", posName: "AM", rating: 86, x: 50, y: 38, goals: 11, assists: 14, tackles: 45 },
      { name: "Dembele", role: "FWD", posName: "RW", rating: 84, x: 80, y: 32, goals: 6, assists: 10, tackles: 15 },
      { name: "Mbappe", role: "FWD", posName: "LW", rating: 91, x: 20, y: 32, goals: 28, assists: 9, tackles: 8 },
      { name: "Thuram", role: "FWD", posName: "ST", rating: 82, x: 50, y: 16, goals: 10, assists: 5, tackles: 14 },
    ],
    subs: [
      { name: "Samba", role: "GK", posName: "GK", rating: 80, x: 0, y: 0, goals: 0, assists: 0, tackles: 5 },
      { name: "Konate", role: "DEF", posName: "CB", rating: 83, x: 0, y: 0, goals: 1, assists: 0, tackles: 54 },
      { name: "Camavinga", role: "MID", posName: "CM", rating: 84, x: 0, y: 0, goals: 2, assists: 4, tackles: 64 },
      { name: "Coman", role: "FWD", posName: "RW", rating: 81, x: 0, y: 0, goals: 4, assists: 5, tackles: 12 },
      { name: "Giroud", role: "FWD", posName: "ST", rating: 80, x: 0, y: 0, goals: 8, assists: 2, tackles: 6 },
    ]
  },
  England: {
    starters: [
      { name: "Pickford", role: "GK", posName: "GK", rating: 84, x: 50, y: 88, goals: 0, assists: 0, tackles: 35 },
      { name: "Walker", role: "DEF", posName: "RB", rating: 85, x: 85, y: 72, goals: 0, assists: 3, tackles: 62 },
      { name: "Stones", role: "DEF", posName: "CB", rating: 86, x: 62, y: 72, goals: 2, assists: 2, tackles: 58 },
      { name: "Guehi", role: "DEF", posName: "CB", rating: 82, x: 38, y: 72, goals: 0, assists: 1, tackles: 55 },
      { name: "Trippier", role: "DEF", posName: "LB", rating: 81, x: 15, y: 72, goals: 1, assists: 5, tackles: 46 },
      { name: "Rice", role: "MID", posName: "CM", rating: 87, x: 35, y: 56, goals: 5, assists: 6, tackles: 82 },
      { name: "Mainoo", role: "MID", posName: "CM", rating: 80, x: 65, y: 56, goals: 1, assists: 2, tackles: 44 },
      { name: "Bellingham", role: "MID", posName: "AM", rating: 89, x: 50, y: 38, goals: 16, assists: 10, tackles: 52 },
      { name: "Saka", role: "FWD", posName: "RW", rating: 87, x: 80, y: 32, goals: 14, assists: 9, tackles: 20 },
      { name: "Foden", role: "FWD", posName: "LW", rating: 88, x: 20, y: 32, goals: 15, assists: 11, tackles: 18 },
      { name: "Kane", role: "FWD", posName: "ST", rating: 90, x: 50, y: 16, goals: 26, assists: 8, tackles: 15 },
    ],
    subs: [
      { name: "Ramsdale", role: "GK", posName: "GK", rating: 81, x: 0, y: 0, goals: 0, assists: 0, tackles: 6 },
      { name: "Konsa", role: "DEF", posName: "CB", rating: 80, x: 0, y: 0, goals: 0, assists: 0, tackles: 42 },
      { name: "Gallagher", role: "MID", posName: "CM", rating: 81, x: 0, y: 0, goals: 3, assists: 1, tackles: 56 },
      { name: "Palmer", role: "FWD", posName: "LW", rating: 86, x: 0, y: 0, goals: 18, assists: 11, tackles: 24 },
      { name: "Watkins", role: "FWD", posName: "ST", rating: 83, x: 0, y: 0, goals: 14, assists: 5, tackles: 10 },
    ]
  },
  Spain: {
    starters: [
      { name: "Simon", role: "GK", posName: "GK", rating: 85, x: 50, y: 88, goals: 0, assists: 0, tackles: 36 },
      { name: "Carvajal", role: "DEF", posName: "RB", rating: 86, x: 85, y: 72, goals: 2, assists: 5, tackles: 70 },
      { name: "Le Normand", role: "DEF", posName: "CB", rating: 82, x: 62, y: 72, goals: 1, assists: 0, tackles: 58 },
      { name: "Laporte", role: "DEF", posName: "CB", rating: 84, x: 38, y: 72, goals: 2, assists: 1, tackles: 64 },
      { name: "Cucurella", role: "DEF", posName: "LB", rating: 82, x: 15, y: 72, goals: 0, assists: 4, tackles: 66 },
      { name: "Rodri", role: "MID", posName: "DM", rating: 90, x: 50, y: 52, goals: 7, assists: 8, tackles: 86 },
      { name: "Ruiz", role: "MID", posName: "CM", rating: 83, x: 28, y: 48, goals: 4, assists: 4, tackles: 50 },
      { name: "Olmo", role: "MID", posName: "AM", rating: 85, x: 72, y: 48, goals: 8, assists: 6, tackles: 38 },
      { name: "Yamal", role: "FWD", posName: "RW", rating: 87, x: 80, y: 22, goals: 9, assists: 12, tackles: 22 },
      { name: "Morata", role: "FWD", posName: "ST", rating: 83, x: 50, y: 18, goals: 12, assists: 4, tackles: 18 },
      { name: "Williams", role: "FWD", posName: "LW", rating: 86, x: 20, y: 22, goals: 10, assists: 8, tackles: 30 },
    ],
    subs: [
      { name: "Raya", role: "GK", posName: "GK", rating: 83, x: 0, y: 0, goals: 0, assists: 0, tackles: 7 },
      { name: "Vivian", role: "DEF", posName: "CB", rating: 80, x: 0, y: 0, goals: 0, assists: 0, tackles: 46 },
      { name: "Zubimendi", role: "MID", posName: "CM", rating: 84, x: 0, y: 0, goals: 2, assists: 1, tackles: 62 },
      { name: "Pedri", role: "MID", posName: "AM", rating: 86, x: 0, y: 0, goals: 5, assists: 8, tackles: 34 },
      { name: "Oyarzabal", role: "FWD", posName: "ST", rating: 82, x: 0, y: 0, goals: 9, assists: 3, tackles: 14 },
    ]
  },
  Portugal: {
    starters: [
      { name: "Costa", role: "GK", posName: "GK", rating: 85, x: 50, y: 88, goals: 0, assists: 0, tackles: 39 },
      { name: "Cancelo", role: "DEF", posName: "RB", rating: 84, x: 85, y: 72, goals: 3, assists: 6, tackles: 52 },
      { name: "Dias", role: "DEF", posName: "CB", rating: 89, x: 62, y: 72, goals: 1, assists: 1, tackles: 70 },
      { name: "Pepe", role: "DEF", posName: "CB", rating: 82, x: 38, y: 72, goals: 1, assists: 0, tackles: 60 },
      { name: "Mendes", role: "DEF", posName: "LB", rating: 83, x: 15, y: 72, goals: 2, assists: 4, tackles: 48 },
      { name: "Joao Neves", role: "MID", posName: "CM", rating: 81, x: 35, y: 56, goals: 1, assists: 3, tackles: 58 },
      { name: "Vitinha", role: "MID", posName: "CM", rating: 85, x: 65, y: 56, goals: 3, assists: 5, tackles: 54 },
      { name: "Fernandes", role: "MID", posName: "AM", rating: 87, x: 50, y: 38, goals: 10, assists: 15, tackles: 46 },
      { name: "Bernardo Silva", role: "FWD", posName: "RW", rating: 87, x: 80, y: 32, goals: 8, assists: 9, tackles: 32 },
      { name: "Leao", role: "FWD", posName: "LW", rating: 86, x: 20, y: 32, goals: 9, assists: 7, tackles: 12 },
      { name: "Ronaldo", role: "FWD", posName: "ST", rating: 88, x: 50, y: 16, goals: 20, assists: 3, tackles: 6 },
    ],
    subs: [
      { name: "Jose Sa", role: "GK", posName: "GK", rating: 79, x: 0, y: 0, goals: 0, assists: 0, tackles: 4 },
      { name: "Inacio", role: "DEF", posName: "CB", rating: 82, x: 0, y: 0, goals: 1, assists: 1, tackles: 48 },
      { name: "Palhinha", role: "MID", posName: "CM", rating: 84, x: 0, y: 0, goals: 2, assists: 1, tackles: 76 },
      { name: "Jota", role: "FWD", posName: "LW", rating: 84, x: 0, y: 0, goals: 10, assists: 4, tackles: 18 },
      { name: "Ramos", role: "FWD", posName: "ST", rating: 81, x: 0, y: 0, goals: 7, assists: 2, tackles: 10 },
    ]
  },
  Netherlands: {
    starters: [
      { name: "Verbruggen", role: "GK", posName: "GK", rating: 82, x: 50, y: 88, goals: 0, assists: 0, tackles: 32 },
      { name: "de Vrij", role: "DEF", posName: "CB", rating: 83, x: 75, y: 75, goals: 1, assists: 0, tackles: 58 },
      { name: "van Dijk", role: "DEF", posName: "CB", rating: 88, x: 50, y: 75, goals: 3, assists: 2, tackles: 68 },
      { name: "Ake", role: "DEF", posName: "CB", rating: 84, x: 25, y: 75, goals: 2, assists: 1, tackles: 62 },
      { name: "Dumfries", role: "MID", posName: "RM", rating: 83, x: 88, y: 52, goals: 3, assists: 7, tackles: 56 },
      { name: "Reijnders", role: "MID", posName: "CM", rating: 82, x: 62, y: 52, goals: 4, assists: 4, tackles: 44 },
      { name: "Schouten", role: "MID", posName: "CM", rating: 81, x: 38, y: 52, goals: 1, assists: 2, tackles: 60 },
      { name: "Simons", role: "MID", posName: "LM", rating: 85, x: 12, y: 52, goals: 6, assists: 10, tackles: 32 },
      { name: "Frimpong", role: "FWD", posName: "RW", rating: 84, x: 80, y: 26, goals: 8, assists: 8, tackles: 42 },
      { name: "Depay", role: "FWD", posName: "ST", rating: 83, x: 50, y: 18, goals: 12, assists: 7, tackles: 14 },
      { name: "Gakpo", role: "FWD", posName: "LW", rating: 84, x: 20, y: 26, goals: 10, assists: 6, tackles: 22 },
    ],
    subs: [
      { name: "Flekken", role: "GK", posName: "GK", rating: 80, x: 0, y: 0, goals: 0, assists: 0, tackles: 5 },
      { name: "de Ligt", role: "DEF", posName: "CB", rating: 83, x: 0, y: 0, goals: 1, assists: 1, tackles: 50 },
      { name: "de Jong", role: "MID", posName: "CM", rating: 86, x: 0, y: 0, goals: 4, assists: 6, tackles: 54 },
      { name: "Malen", role: "FWD", posName: "LW", rating: 82, x: 0, y: 0, goals: 7, assists: 5, tackles: 15 },
      { name: "Weghorst", role: "FWD", posName: "ST", rating: 79, x: 0, y: 0, goals: 9, assists: 1, tackles: 8 },
    ]
  }
};

const getInitialLineupAndSubs = (teamName: string, side: "home" | "away"): { starters: LineupPlayer[]; subs: LineupPlayer[] } => {
  const normalized = teamName || "Brazil";
  const matchedKey = Object.keys(defaultRosters).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  ) || "Brazil";
  
  const data = defaultRosters[matchedKey];
  
  const starters = data.starters.map((p, idx) => ({
    ...p,
    id: `${side}-starter-${idx}`
  }));

  const subs = data.subs.map((p, idx) => ({
    ...p,
    id: `${side}-sub-${idx}`
  }));

  return { starters, subs };
};

const getTeamColors = (teamName: string) => {
  const name = teamName ? teamName.toLowerCase() : "";
  if (name.includes("brazil")) {
    return {
      primary: "#22c55e", 
      secondary: "#eab308", 
      gradient: "from-yellow-400/20 to-green-500/20",
      borderHover: "hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.25)]",
      glowBg: "rgba(234,179,8,0.06)",
      glowColor: "rgba(234,179,8,0.3)"
    };
  }
  if (name.includes("germany")) {
    return {
      primary: "#ffffff", 
      secondary: "#000000", 
      gradient: "from-slate-100/10 to-rose-600/15",
      borderHover: "hover:border-slate-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]",
      glowBg: "rgba(255,255,255,0.04)",
      glowColor: "rgba(255,255,255,0.25)"
    };
  }
  if (name.includes("argentina")) {
    return {
      primary: "#38bdf8", 
      secondary: "#ffffff", 
      gradient: "from-sky-400/25 to-slate-100/10",
      borderHover: "hover:border-sky-400 hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]",
      glowBg: "rgba(56,189,248,0.06)",
      glowColor: "rgba(56,189,248,0.3)"
    };
  }
  if (name.includes("france")) {
    return {
      primary: "#2563eb", 
      secondary: "#ef4444", 
      gradient: "from-blue-600/20 to-rose-600/15",
      borderHover: "hover:border-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]",
      glowBg: "rgba(37,99,235,0.06)",
      glowColor: "rgba(37,99,235,0.25)"
    };
  }
  if (name.includes("england")) {
    return {
      primary: "#ffffff", 
      secondary: "#1e3a8a", 
      gradient: "from-slate-100/10 to-blue-900/20",
      borderHover: "hover:border-blue-400 hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]",
      glowBg: "rgba(255,255,255,0.04)",
      glowColor: "rgba(255,255,255,0.2)"
    };
  }
  if (name.includes("spain")) {
    return {
      primary: "#dc2626", 
      secondary: "#facc15", 
      gradient: "from-rose-600/20 to-yellow-500/15",
      borderHover: "hover:border-rose-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]",
      glowBg: "rgba(239,68,68,0.06)",
      glowColor: "rgba(239,68,68,0.3)"
    };
  }
  if (name.includes("portugal")) {
    return {
      primary: "#b91c1c", 
      secondary: "#15803d", 
      gradient: "from-red-600/25 to-emerald-600/15",
      borderHover: "hover:border-red-500 hover:shadow-[0_0_20px_rgba(185,28,28,0.3)]",
      glowBg: "rgba(185,28,28,0.06)",
      glowColor: "rgba(185,28,28,0.3)"
    };
  }
  if (name.includes("netherlands")) {
    return {
      primary: "#f97316", 
      secondary: "#ffffff", 
      gradient: "from-orange-500/25 to-slate-100/10",
      borderHover: "hover:border-orange-500 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      glowBg: "rgba(249,115,22,0.06)",
      glowColor: "rgba(249,115,22,0.3)"
    };
  }
  return {
    primary: "#10b981", 
    secondary: "#14b8a6", 
    gradient: "from-emerald-500/10 to-teal-500/10",
    borderHover: "hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    glowBg: "rgba(16,185,129,0.04)",
    glowColor: "rgba(16,185,129,0.2)"
  };
};

const getPlayerStatsMap = (teamName: string, playerName: string) => {
  const stats: Record<string, { attacking: number; defending: number; playmaking: number; retention: number; physical: number; workrate: number; goals: number; assists: number; tackles: number }> = {
    // Brazil
    "Alisson": { attacking: 5, defending: 95, playmaking: 45, retention: 30, physical: 85, workrate: 75, goals: 0, assists: 1, tackles: 42 },
    "Marquinhos": { attacking: 40, defending: 92, playmaking: 65, retention: 55, physical: 88, workrate: 80, goals: 2, assists: 1, tackles: 68 },
    "Casemiro": { attacking: 60, defending: 88, playmaking: 70, retention: 62, physical: 90, workrate: 85, goals: 4, assists: 3, tackles: 74 },
    "Vinicius Jr": { attacking: 95, defending: 35, playmaking: 85, retention: 96, physical: 78, workrate: 82, goals: 18, assists: 11, tackles: 21 },
    "Rodrygo": { attacking: 88, defending: 38, playmaking: 82, retention: 90, physical: 72, workrate: 84, goals: 13, assists: 8, tackles: 18 },
    // Germany
    "ter Stegen": { attacking: 8, defending: 92, playmaking: 55, retention: 35, physical: 80, workrate: 70, goals: 0, assists: 0, tackles: 38 },
    "Rudiger": { attacking: 45, defending: 94, playmaking: 60, retention: 50, physical: 95, workrate: 88, goals: 1, assists: 1, tackles: 72 },
    "Gundogan": { attacking: 78, defending: 65, playmaking: 92, retention: 84, physical: 70, workrate: 86, goals: 6, assists: 9, tackles: 48 },
    "Musiala": { attacking: 86, defending: 40, playmaking: 88, retention: 98, physical: 68, workrate: 82, goals: 12, assists: 10, tackles: 25 },
    "Fullkrug": { attacking: 90, defending: 25, playmaking: 60, retention: 70, physical: 92, workrate: 80, goals: 15, assists: 4, tackles: 10 },
    // Argentina
    "E. Martinez": { attacking: 5, defending: 96, playmaking: 40, retention: 25, physical: 90, workrate: 85, goals: 0, assists: 0, tackles: 45 },
    "Romero": { attacking: 42, defending: 93, playmaking: 58, retention: 52, physical: 94, workrate: 90, goals: 2, assists: 0, tackles: 80 },
    "Mac Allister": { attacking: 75, defending: 72, playmaking: 86, retention: 82, physical: 78, workrate: 88, goals: 5, assists: 7, tackles: 56 },
    "Messi": { attacking: 98, defending: 20, playmaking: 99, retention: 95, physical: 60, workrate: 65, goals: 22, assists: 16, tackles: 12 },
    "Alvarez": { attacking: 85, defending: 55, playmaking: 78, retention: 80, physical: 76, workrate: 95, goals: 14, assists: 6, tackles: 34 },
    // France
    "Maignan": { attacking: 10, defending: 94, playmaking: 52, retention: 32, physical: 86, workrate: 78, goals: 0, assists: 0, tackles: 40 },
    "Saliba": { attacking: 35, defending: 95, playmaking: 68, retention: 60, physical: 90, workrate: 85, goals: 1, assists: 1, tackles: 75 },
    "Tchouameni": { attacking: 62, defending: 86, playmaking: 75, retention: 74, physical: 88, workrate: 86, goals: 3, assists: 2, tackles: 70 },
    "Mbappe": { attacking: 99, defending: 22, playmaking: 84, retention: 97, physical: 80, workrate: 72, goals: 28, assists: 9, tackles: 8 },
    "Griezmann": { attacking: 84, defending: 62, playmaking: 94, retention: 86, physical: 74, workrate: 96, goals: 11, assists: 14, tackles: 45 },
    // England
    "Pickford": { attacking: 12, defending: 91, playmaking: 62, retention: 28, physical: 82, workrate: 80, goals: 0, assists: 0, tackles: 35 },
    "Stones": { attacking: 45, defending: 90, playmaking: 78, retention: 76, physical: 84, workrate: 82, goals: 2, assists: 2, tackles: 58 },
    "Rice": { attacking: 68, defending: 91, playmaking: 80, retention: 78, physical: 91, workrate: 94, goals: 5, assists: 6, tackles: 82 },
    "Bellingham": { attacking: 91, defending: 70, playmaking: 88, retention: 89, physical: 86, workrate: 92, goals: 16, assists: 10, tackles: 52 },
    "Kane": { attacking: 96, defending: 45, playmaking: 85, retention: 78, physical: 85, workrate: 84, goals: 26, assists: 8, tackles: 15 },
    // Spain
    "Simon": { attacking: 6, defending: 93, playmaking: 50, retention: 30, physical: 82, workrate: 72, goals: 0, assists: 0, tackles: 36 },
    "Laporte": { attacking: 38, defending: 91, playmaking: 64, retention: 58, physical: 87, workrate: 80, goals: 2, assists: 1, tackles: 64 },
    "Rodri": { attacking: 74, defending: 93, playmaking: 90, retention: 85, physical: 92, workrate: 91, goals: 7, assists: 8, tackles: 86 },
    "Yamal": { attacking: 89, defending: 42, playmaking: 91, retention: 97, physical: 65, workrate: 80, goals: 9, assists: 12, tackles: 22 },
    "Morata": { attacking: 84, defending: 48, playmaking: 65, retention: 72, physical: 82, workrate: 88, goals: 12, assists: 4, tackles: 18 },
    // Portugal
    "Costa": { attacking: 8, defending: 94, playmaking: 48, retention: 32, physical: 84, workrate: 74, goals: 0, assists: 0, tackles: 39 },
    "Dias": { attacking: 32, defending: 94, playmaking: 62, retention: 56, physical: 91, workrate: 85, goals: 1, assists: 1, tackles: 70 },
    "Fernandes": { attacking: 85, defending: 58, playmaking: 96, retention: 82, physical: 72, workrate: 95, goals: 10, assists: 15, tackles: 46 },
    "Leao": { attacking: 87, defending: 30, playmaking: 80, retention: 95, physical: 83, workrate: 75, goals: 9, assists: 7, tackles: 12 },
    "Ronaldo": { attacking: 94, defending: 15, playmaking: 74, retention: 80, physical: 88, workrate: 78, goals: 20, assists: 3, tackles: 6 },
    // Netherlands
    "Verbruggen": { attacking: 5, defending: 90, playmaking: 48, retention: 28, physical: 80, workrate: 72, goals: 0, assists: 0, tackles: 32 },
    "van Dijk": { attacking: 48, defending: 96, playmaking: 66, retention: 62, physical: 96, workrate: 84, goals: 3, assists: 2, tackles: 68 },
    "de Jong": { attacking: 70, defending: 76, playmaking: 91, retention: 94, physical: 78, workrate: 86, goals: 4, assists: 6, tackles: 54 },
    "Gakpo": { attacking: 86, defending: 42, playmaking: 82, retention: 88, physical: 80, workrate: 85, goals: 10, assists: 6, tackles: 22 },
    "Depay": { attacking: 85, defending: 32, playmaking: 84, retention: 86, physical: 76, workrate: 78, goals: 12, assists: 7, tackles: 14 }
  };
  const defaultStats = { attacking: 60, defending: 60, playmaking: 60, retention: 60, physical: 60, workrate: 60, goals: 2, assists: 2, tackles: 20 };
  return stats[playerName] || defaultStats;
};

interface CredibilityAlert {
  id: string;
  source: string;
  raw_text: string;
  credibility_rating: "Highly Credible" | "Suspicious / Unverified" | "Discredited Rumor";
  credibility_score: number;
  gemini_rationale: string;
  estimated_impact: string;
  created_at: string;
}

export default function DashboardView({
  user,
  authToken,
  onOpenUpgrade,
  onProfileUpdated,
  matches,
  onRefreshMatches,
  selectedMatch,
  onSelectMatch,
}: DashboardViewProps) {
  const [filter, setFilter] = useState<"all" | "scheduled" | "live" | "finished">("all");
  const [matchDetails, setMatchDetails] = useState<{ match: Match; events: MatchEvent[] } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [pollingLive, setPollingLive] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareMatchIds, setCompareMatchIds] = useState<number[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedIntelTeam, setSelectedIntelTeam] = useState<string | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [dashboardCenterTab, setDashboardCenterTab] = useState<"overview" | "bracket" | "scorers" | "predictors">("overview");

  const handleToggleCompare = (mId: number) => {
    setCompareMatchIds((prev) => {
      if (prev.includes(mId)) {
        return prev.filter((id) => id !== mId);
      }
      if (prev.length >= 2) {
        return [prev[1], mId]; // replace oldest
      }
      return [...prev, mId];
    });
  };

  // Triggers client-side PDF generation of currently selected match analytics reports
  const exportMatchPdf = () => {
    if (!matchDetails) return;
    const m = matchDetails.match;
    const events = matchDetails.events;

    const doc = new jsPDF();

    // Slate header background banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, "F");

    // Title and Metadata Header
    doc.setTextColor(16, 185, 129); // emerald green
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("KICKIQ FORECAST ANALYTICS", 14, 18);

    doc.setTextColor(148, 163, 184); // slate gray
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Powered by Poisson Predictive Algorithms`, 14, 25);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("Helvetica", "bold");
    doc.text(`Match Profile: ${m.home_team} vs ${m.away_team}`, 14, 34);

    let y = 52;

    // SECTION 1: Fixture Setup Details
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.text("1. GENERAL MATCH SPECIFICATIONS", 14, y);
    doc.setDrawColor(226, 232, 240); // slate-200 border
    doc.line(14, y + 2, 196, y + 2);

    y += 10;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    
    doc.text(`Active Status: ${m.status.toUpperCase()}`, 14, y);
    doc.text(`Stadium Arena: ${m.stadium}`, 75, y);
    doc.text(`Competition Stage: ${m.stage}`, 140, y);

    y += 6;
    doc.text(`Scheduled Date: ${m.date}`, 14, y);
    doc.text(`Game Minute: ${m.status === "finished" ? "Full Time" : m.simulation_minute + "'"}`, 75, y);
    doc.text(`Current Score: ${m.home_score} - ${m.away_score}`, 140, y);

    // SECTION 2: Algorithmic Expectations
    y += 14;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("2. POISSON EXPECTATION MODEL MATRIX", 14, y);
    doc.line(14, y + 2, 196, y + 2);

    y += 10;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    doc.text(`${m.home_team} ELO Rating: ${m.home_elo} PTS`, 14, y);
    doc.text(`Home Goal Expectancy (Lambda): ${m.mu_home || 1.35} expected goals`, 90, y);

    y += 6;
    doc.text(`${m.away_team} ELO Rating: ${m.away_elo} PTS`, 14, y);
    doc.text(`Away Goal Expectancy (Mu): ${m.mu_away || 1.15} expected goals`, 90, y);

    y += 8;
    const probHome = m.win_probability?.home ? (m.win_probability.home * 100).toFixed(1) : "45.0";
    const probDraw = m.win_probability?.draw ? (m.win_probability.draw * 100).toFixed(1) : "25.0";
    const probAway = m.win_probability?.away ? (m.win_probability.away * 100).toFixed(1) : "30.0";

    doc.setFont("Helvetica", "bold");
    doc.text("Algorithmic Advantage Probability Distribution:", 14, y);
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.text(`- Home Victory Probability: ${probHome}%`, 18, y);
    doc.text(`- Expected Draw Probability: ${probDraw}%`, 80, y);
    doc.text(`- Away Victory Probability: ${probAway}%`, 140, y);

    // SECTION 3: AI Halftime Analytics
    if (m.halftime_custom_analysis) {
      y += 15;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("3. AI DEEP ANALYTICAL INSIGHTS", 14, y);
      doc.line(14, y + 2, 196, y + 2);

      y += 10;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      
      const splitAnalysis = doc.splitTextToSize(m.halftime_custom_analysis, 180);
      doc.text(splitAnalysis, 14, y);
      y += (splitAnalysis.length * 4.5);
    } else {
      y += 4;
    }

    // SECTION 4: Events Registry Log
    y += 14;
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("4. FIELD ACTION EVENTS LOG", 14, y);
    doc.line(14, y + 2, 196, y + 2);

    y += 10;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);

    if (events && events.length > 0) {
      events.slice(0, 8).forEach((ev) => {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }
        const squadActor = ev.team_id === m.home_team_id ? m.home_team : ev.team_id === m.away_team_id ? m.away_team : "REGISTRY";
        doc.setFont("Helvetica", "bold");
        doc.text(`[${ev.minute}'] ${ev.event_type.toUpperCase()} - ${ev.player_name || ""} (${squadActor})`, 14, y);
        y += 4.5;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`      Note: ${ev.description}`, 14, y);
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        y += 5.5;
      });
    } else {
      doc.text("No significant field events registered during this analytical window.", 14, y);
      y += 10;
    }

    // Report Footer
    if (y > 260) {
      doc.addPage();
      y = 20;
    } else {
      y += 12;
    }

    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("DISCLAIMER: KICKIQ represents an advanced simulation model based on standard Poisson matrices and historical ELO records.", 14, y);
    y += 4;
    doc.text("All probabilities are simulated and calculated for entertainment and analytical research purposes.", 14, y);

    doc.save(`KICKIQ-Match-Report-${m.home_team}-vs-${m.away_team}.pdf`);
  };
  
  // Custom interactive state items
  const [alerts, setAlerts] = useState<CredibilityAlert[]>([]);
  const [fetchingAlert, setFetchingAlert] = useState(false);
  const [votedChoice, setVotedChoice] = useState<"home" | "draw" | "away" | null>(null);
  const [meetingsLimit, setMeetingsLimit] = useState<number>(6);
  const [h2hGraphTab, setH2hGraphTab] = useState<"performance" | "elo">("elo");
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingHT, setSubmittingHT] = useState(false);
  const [crowdVolume, setCrowdVolume] = useState<number>(30); // Cinematic ambient feedback slider
  const [soundMode, setSoundMode] = useState<"anticipation" | "analysis" | "crowd">("anticipation");
  const [predictiveTab, setPredictiveTab] = useState<"outcomes" | "elo">("outcomes");

  const getPredictiveTrendData = () => {
    if (!matchDetails) return [];
    const m = matchDetails.match;
    const hTeam = m.home_team;
    const aTeam = m.away_team;
    const muH = m.mu_home || 1.35;
    const muA = m.mu_away || 1.15;

    return [1, 2, 3, 4, 5].map((step) => {
      // Create some variance based on team name, ELO, and step
      const hSeed = hTeam.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + step;
      const aSeed = aTeam.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + step;
      
      const hEloTarget = m.home_elo;
      const aEloTarget = m.away_elo;
      
      // Interpolate towards target ELO
      const hElo = Math.round(hEloTarget - (5 - step) * 12 + (hSeed % 16));
      const aElo = Math.round(aEloTarget - (5 - step) * 10 + (aSeed % 16));

      // Interpolate goal expectancy rate
      const stepMuH = Math.max(0.6, muH - (5 - step) * 0.08 + (hSeed % 8) * 0.01);
      const stepMuA = Math.max(0.6, muA - (5 - step) * 0.06 + (aSeed % 8) * 0.01);

      // Poisson probability of scoring >= 2 goals: 1 - P(0) - P(1) = 1 - e^-mu * (1 + mu)
      const hPoissonWinProb = Math.min(95, Math.round((1 - Math.exp(-stepMuH) * (1 + stepMuH)) * 100));
      const aPoissonWinProb = Math.min(95, Math.round((1 - Math.exp(-stepMuA) * (1 + stepMuA)) * 100));

      const labels = [
        "Sim Match 1",
        "Sim Match 2",
        "Sim Match 3",
        "Sim Match 4",
        "Forecasted Map"
      ];

      return {
        stepLabel: labels[step - 1],
        homeElo: hElo,
        awayElo: aElo,
        homePoissonWinProb: hPoissonWinProb,
        awayPoissonWinProb: aPoissonWinProb,
      };
    });
  };

  const getRivalryIntensityData = () => {
    if (!matchDetails?.match) return [];
    const m = matchDetails.match;
    const hElo = m.home_elo;
    const aElo = m.away_elo;
    const muH = m.mu_home || 1.35;
    const muA = m.mu_away || 1.15;

    const homeSeed = m.home_team.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const awaySeed = m.away_team.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const attackingHome = Math.min(95, Math.round((muH / 2.8) * 100));
    const attackingAway = Math.min(95, Math.round((muA / 2.8) * 100));

    const defensiveHome = Math.min(95, Math.max(45, Math.round((hElo / 2000) * 105)));
    const defensiveAway = Math.min(95, Math.max(45, Math.round((aElo / 2000) * 105)));

    const midfieldHome = Math.min(95, Math.max(40, Math.round(50 + (hElo - aElo) / 8)));
    const midfieldAway = Math.min(95, Math.max(40, Math.round(50 + (aElo - hElo) / 8)));

    const agilityHome = 60 + (homeSeed % 35);
    const agilityAway = 60 + (awaySeed % 35);

    const physicalHome = 50 + ((homeSeed * 3) % 45);
    const physicalAway = 50 + ((awaySeed * 3) % 45);

    const diff = Math.abs(hElo - aElo);
    const volatility = Math.min(100, Math.max(25, Math.round(100 - diff / 3.5)));

    return [
      { metric: "Attacking Pressure", [m.home_team]: attackingHome, [m.away_team]: attackingAway, fullMark: 100 },
      { metric: "Defensive Block", [m.home_team]: defensiveHome, [m.away_team]: defensiveAway, fullMark: 100 },
      { metric: "Midfield Control", [m.home_team]: midfieldHome, [m.away_team]: midfieldAway, fullMark: 100 },
      { metric: "Tactical Execution", [m.home_team]: agilityHome, [m.away_team]: agilityAway, fullMark: 100 },
      { metric: "Physical Durability", [m.home_team]: physicalHome, [m.away_team]: physicalAway, fullMark: 100 },
      { metric: "Clash Volatility", [m.home_team]: volatility, [m.away_team]: volatility, fullMark: 100 },
    ];
  };

  // Custom Halftime predictive analysis state
  const [showHalftimePromptInvite, setShowHalftimePromptInvite] = useState(false);
  const [halftimeCustomPrompt, setHalftimeCustomPrompt] = useState("");
  const [analyzingHalftime, setAnalyzingHalftime] = useState(false);
  const [halftimeCustomAnalysisResult, setHalftimeCustomAnalysisResult] = useState<string | null>(null);

  // Key Player Comparison and Poisson Predictive States
  const [homePlayer, setHomePlayer] = useState<string>("");
  const [awayPlayer, setAwayPlayer] = useState<string>("");
  const [poissonHomeAttack, setPoissonHomeAttack] = useState<number>(1.0);
  const [poissonAwayAttack, setPoissonAwayAttack] = useState<number>(1.0);

  // Tactical Lineup Visualizer States
  const [activeLineupHome, setActiveLineupHome] = useState<LineupPlayer[]>([]);
  const [activeSubsHome, setActiveSubsHome] = useState<LineupPlayer[]>([]);
  const [activeLineupAway, setActiveLineupAway] = useState<LineupPlayer[]>([]);
  const [activeSubsAway, setActiveSubsAway] = useState<LineupPlayer[]>([]);
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<LineupPlayer | null>(null);
  const [pitchTeamToggle, setPitchTeamToggle] = useState<"home" | "away">("home");

  // Real-Time Banned Player & Sidebar News States
  const [activeSidebarTab, setActiveSidebarTab] = useState<"fixtures" | "news" | "alerts">("fixtures");
  const [processedEventIds, setProcessedEventIds] = useState<number[]>([]);
  const [banReplacements, setBanReplacements] = useState<Record<string, string>>({});
  const [newsSearch, setNewsSearch] = useState("");
  const [selectedNewsSource, setSelectedNewsSource] = useState<string>("All Feeds");
  
  // Real-time Soccer News Feed States and dynamic two-minute update engine
  const [newsList, setNewsList] = useState<SportArticle[]>(newsArticles);
  const [isTikTokScrollMode, setIsTikTokScrollMode] = useState<boolean>(() => {
    const saved = sessionStorage.getItem("kickiq_tiktok_scroll");
    return saved ? saved === "true" : true; // default to true
  });
  const [isAutoscrolling, setIsAutoscrolling] = useState<boolean>(true);
  const [tiktokCurrentIndex, setTiktokCurrentIndex] = useState<number>(0);
  const [likedNewsIds, setLikedNewsIds] = useState<string[]>([]);

  // Fetch real-time news from our API
  const fetchSoccerNews = async () => {
    try {
      const res = await fetch("/api/soccer-news");
      const data = await res.json();
      if (res.ok && data.success && data.news) {
        setNewsList(data.news);
      }
    } catch (err) {
      console.warn("[news-feed] Failed to fetch live soccer news", err);
    }
  };

  useEffect(() => {
    fetchSoccerNews();
    // Refresh after every two minutes
    const interval = setInterval(fetchSoccerNews, 120000);
    return () => clearInterval(interval);
  }, []);

  // Autoplay TikTok cards index shift
  useEffect(() => {
    if (!isTikTokScrollMode || !isAutoscrolling || newsList.length === 0) return;
    const scrollInterval = setInterval(() => {
      setTiktokCurrentIndex((prev) => (prev + 1) % newsList.length);
    }, 6000); // Cycle every 6 seconds for high comfort reading
    return () => clearInterval(scrollInterval);
  }, [isTikTokScrollMode, isAutoscrolling, newsList.length]);

  // Filter red carded players in current active match events
  const liveBannedPlayers = React.useMemo(() => {
    if (!matchDetails?.events) return [];
    const redCards = matchDetails.events.filter(ev => ev.event_type === "red_card");
    return redCards.map(ev => ({
      name: ev.player_name || "",
      minute: ev.minute,
      team_id: ev.team_id,
      player_name: ev.player_name || ""
    }));
  }, [matchDetails?.events]);

  useEffect(() => {
    if (matchDetails?.match) {
      const homeTeamName = matchDetails.match.home_team;
      const awayTeamName = matchDetails.match.away_team;
      const homeList = playersByTeam[homeTeamName] || [];
      const awayList = playersByTeam[awayTeamName] || [];
      setHomePlayer(homeList[3] || homeList[0] || "");
      setAwayPlayer(awayList[3] || awayList[0] || "");
      setPoissonHomeAttack(1.0);
      setPoissonAwayAttack(1.0);

      // Initialize tactical lineups
      const hData = getInitialLineupAndSubs(homeTeamName, "home");
      const aData = getInitialLineupAndSubs(awayTeamName, "away");
      setActiveLineupHome(hData.starters);
      setActiveSubsHome(hData.subs);
      setActiveLineupAway(aData.starters);
      setActiveSubsAway(aData.subs);
      setSelectedPitchPlayer(null);
      setPitchTeamToggle("home");
      setBanReplacements({});
    }
  }, [matchDetails?.match?.id]);

  // Instantiates our custom hook which listens to halftime pauses
  useHalftimeMonitor(matchDetails?.match || null, (matchId) => {
    setShowHalftimePromptInvite(true);
    setHalftimeCustomPrompt(`Based on ${matchDetails?.match.home_team} vs ${matchDetails?.match.away_team} scores (${matchDetails?.match.home_score}-${matchDetails?.match.away_score}), will we see a second-half defensive tactical block or aggressive long-range shootouts?`);
    setHalftimeCustomAnalysisResult(null);
  });

  const handleSubstitution = (starterId: string, subId: string) => {
    const starters = pitchTeamToggle === "home" ? activeLineupHome : activeLineupAway;
    const subs = pitchTeamToggle === "home" ? activeSubsHome : activeSubsAway;

    const starterIndex = starters.findIndex(p => p.id === starterId);
    const subIndex = subs.findIndex(p => p.id === subId);

    if (starterIndex !== -1 && subIndex !== -1) {
      const starter = starters[starterIndex];
      const sub = subs[subIndex];

      const updatedStarters = [...starters];
      const updatedSubs = [...subs];

      const originalX = starter.x;
      const originalY = starter.y;

      updatedStarters[starterIndex] = {
        ...sub,
        x: originalX,
        y: originalY,
        id: `${pitchTeamToggle}-starter-${Date.now()}`
      };

      updatedSubs[subIndex] = {
        ...starter,
        x: 0,
        y: 0,
        id: `${pitchTeamToggle}-sub-${Date.now()}`
      };

      // Register live banned player replacements
      const isStarterBanned = liveBannedPlayers.some(
        (bp) => bp.player_name.toLowerCase() === starter.name.toLowerCase()
      );
      if (isStarterBanned) {
        setBanReplacements(prev => ({
          ...prev,
          [starter.name]: sub.name
        }));

        setNotificationHistory(prev => [
          {
            id: `ban-replaced-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: "follow",
            title: "Disciplinary Fix Active",
            body: `🔴 Banned Player ${starter.name} successfully replaced by sub ${sub.name} on the field!`
          },
          ...prev
        ]);
      }

      if (pitchTeamToggle === "home") {
        setActiveLineupHome(updatedStarters);
        setActiveSubsHome(updatedSubs);
      } else {
        setActiveLineupAway(updatedStarters);
        setActiveSubsAway(updatedSubs);
      }

      setSelectedPitchPlayer(updatedStarters[starterIndex]);
    }
  };

  // Followed matches state, sync to/from localStorage
  const [followedMatchIds, setFollowedMatchIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("followed_matches");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track live feed section expansion view
  const [liveFeedExpanded, setLiveFeedExpanded] = useState<boolean>(true);
  const [muteSound, setMuteSound] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("kickiq_mute_sound");
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Notification history feed State
  interface LiveFeedEvent {
    id: string;
    timestamp: string;
    type: "live" | "system" | "follow";
    title: string;
    body: string;
    matchId?: number;
  }

  const [notificationHistory, setNotificationHistory] = useState<LiveFeedEvent[]>(() => {
    try {
      const stored = localStorage.getItem("kickiq_notif_history");
      return stored ? JSON.parse(stored) : [
        {
          id: "welcome-system",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: "system",
          title: "Alert Center Initialized",
          body: "Bell-follow a fixture to log real-time Poisson interval transitions.",
        }
      ];
    } catch {
      return [];
    }
  });

  // Sync feed & sound to localStorage
  useEffect(() => {
    localStorage.setItem("kickiq_notif_history", JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  useEffect(() => {
    localStorage.setItem("kickiq_mute_sound", String(muteSound));
  }, [muteSound]);

  const addFeedEvent = (type: "live" | "system" | "follow", title: string, body: string, matchId?: number) => {
    const newEvent: LiveFeedEvent = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      title,
      body,
      matchId,
    };
    setNotificationHistory((prev) => [newEvent, ...prev].slice(0, 40));
  };

  const handleToggleFollow = (matchId: number) => {
    const matchObj = matches.find((m) => m.id === matchId);
    const mName = matchObj ? `${matchObj.home_team} vs ${matchObj.away_team}` : `Match #${matchId}`;

    setFollowedMatchIds((prev) => {
      let updated;
      if (prev.includes(matchId)) {
        updated = prev.filter((id) => id !== matchId);
        addFeedEvent("follow", "Unfollowed Fixture", `Stopped monitoring live ticker feed for ${mName}.`);
      } else {
        updated = [...prev, matchId];
        addFeedEvent("follow", "Followed Fixture", `Active notification listener bound to telemetry for ${mName}.`);
        
        // Request Web notifications permission when they follow
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      }
      localStorage.setItem("followed_matches", JSON.stringify(updated));
      return updated;
    });
  };

  const handleTriggerTestAlert = () => {
    const testTitle = "🚨 TEST KICKIQ LIVE SIGNAL";
    const testBody = "Demo alert: Match status telemetry successfully parsed by background workers.";
    addFeedEvent("system", "Test Alert Fired", "User initiated push alert diagnostics successfully.");

    setLiveTriggers((prev) => [
      ...prev,
      {
        id: -99 - Math.random() - prev.length,
        home_team: "GERMANY",
        away_team: "SCOTLAND",
        time: new Date().toLocaleTimeString(),
      }
    ]);

    if (!muteSound) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // high ping
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        console.warn("Audio Context init disabled or restricted", e);
      }
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(testTitle, {
            body: testBody,
            icon: "/favicon.ico",
          });
        } catch (e) {
          console.warn("Notification system iframe restrictions sandbox warning", e);
        }
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  };

  // Followed Match state triggers
  const [liveTriggers, setLiveTriggers] = useState<{ id: number; home_team: string; away_team: string; time: string }[]>([]);
  const [previousStates, setPreviousStates] = useState<Record<number, "scheduled" | "live" | "finished">>(() => {
    const initial: Record<number, "scheduled" | "live" | "finished"> = {};
    matches.forEach((m) => {
      initial[m.id] = m.status;
    });
    return initial;
  });

  // Track state transitions to Trigger Alerts!
  useEffect(() => {
    const nextStates = { ...previousStates };
    const newTriggers: typeof liveTriggers = [];

    matches.forEach((m) => {
      const prevStatus = previousStates[m.id];
      const currentStatus = m.status;

      if (prevStatus === undefined) {
        nextStates[m.id] = currentStatus;
      } else if (prevStatus !== currentStatus) {
        nextStates[m.id] = currentStatus;

        if (followedMatchIds.includes(m.id)) {
          if (currentStatus === "live" && prevStatus !== "live") {
            newTriggers.push({
              id: m.id,
              home_team: m.home_team,
              away_team: m.away_team,
              time: new Date().toLocaleTimeString(),
            });
            addFeedEvent(
              "live",
              "Fixture Transition: Live!",
              `${m.home_team} vs ${m.away_team} has kicked off! Poisson simulation clocks are ticking.`,
              m.id
            );
          } else if (currentStatus === "finished" && prevStatus !== "finished") {
            addFeedEvent(
              "system",
              "Fixture Final Whistle",
              `${m.home_team} vs ${m.away_team} has finished! ELO outputs have updated.`,
              m.id
            );
          }
        }
      }
    });

    setPreviousStates(nextStates);

    if (newTriggers.length > 0) {
      setLiveTriggers((prev) => [...prev, ...newTriggers]);

      if (!muteSound) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 chord note
          gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.25);
        } catch (e) {
          console.warn(e);
        }
      }

      newTriggers.forEach((trig) => {
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            try {
              new Notification(`⚽ KICKIQ LIVE Alert!`, {
                body: `${trig.home_team} vs ${trig.away_team} is now LIVE!`,
                icon: "/favicon.ico",
              });
            } catch (e) {
              console.warn("Notification system iframe restrictions sandbox warning", e);
            }
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      });
    }
  }, [matches, followedMatchIds, muteSound]);

  // General fixtures catalog background polling interval (every 7 seconds) to catch transitions
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshMatches();
    }, 7000);
    return () => clearInterval(interval);
  }, [onRefreshMatches]);

  // Sync selected match details
  useEffect(() => {
    if (selectedMatch) {
      setProcessedEventIds([]);
      loadDetailedMatch(selectedMatch.id);
      // Retrieve initial mock alerts or clear
      setAlerts([]);
    } else {
      setMatchDetails(null);
    }
  }, [selectedMatch?.id, matches]);

  // Set up live simulation polling effects
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;

    if (selectedMatch && selectedMatch.status === "live") {
      setPollingLive(true);
      pollingInterval = setInterval(() => {
        loadDetailedMatch(selectedMatch.id);
        onRefreshMatches(); // Keeps main listing score synced in real-time
      }, 2500);
    } else {
      setPollingLive(false);
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [selectedMatch?.id, selectedMatch?.status]);

  const loadDetailedMatch = async (id: number) => {
    try {
      const res = await fetch(`/matches/${id}`, {
        headers: { "Authorization": `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMatchDetails(data);
        
        // Sync voter preference locally to reflect backend db state
        if (data.match.voted_users && data.match.voted_users[String(user.id)]) {
          setVotedChoice(data.match.voted_users[String(user.id)]);
        } else {
          setVotedChoice(null);
        }

        // Process Match Events for alert dispatches
        if (data.events && Array.isArray(data.events)) {
          setProcessedEventIds((prev) => {
            // First load or empty: pre-fill so we don't spam historical states on load
            if (prev.length === 0) {
              return data.events.map((e: any) => e.id);
            }

            const unresolved = data.events.filter((e: any) => !prev.includes(e.id));
            if (unresolved.length > 0) {
              try {
                const cfgStr = localStorage.getItem("kickiq_notif_config");
                const config = cfgStr ? JSON.parse(cfgStr) : null;
                const isPremium = user.plan === "pro" || user.plan === "elite";

                if (isPremium && config) {
                  unresolved.forEach((ev: any) => {
                    const homeTeam = data.match.home_team;
                    const awayTeam = data.match.away_team;
                    
                    // Match squad filters (empty filters means ALL squads)
                    const matchesTeamFilter = config.favoriteTeams.length === 0 ||
                      config.favoriteTeams.includes(homeTeam) ||
                      config.favoriteTeams.includes(awayTeam);

                    if (matchesTeamFilter) {
                      let shouldTrigger = false;
                      let title = "";

                      if (ev.event_type === "goal" && config.goals) {
                        shouldTrigger = true;
                        title = `⚽ GOAL! ${ev.player_name || "Team Score"} in ${ev.minute}'`;
                      } else if (ev.event_type === "red_card" && config.redCards) {
                        shouldTrigger = true;
                        title = `🟥 RED CARD! Dismissal at ${ev.minute}'`;
                      } else if (ev.event_type === "substitution" && config.subs) {
                        shouldTrigger = true;
                        title = `🔄 SUBSTITUTION in ${ev.minute}'`;
                      }

                      if (shouldTrigger) {
                        // 1. Add to ticker feed
                        addFeedEvent("live", title, ev.description, data.match.id);

                        // 2. Trigger browser native notification
                        if (config.browserPush && typeof window !== "undefined" && "Notification" in window) {
                          if (Notification.permission === "granted") {
                            try {
                              new Notification(title, {
                                body: ev.description,
                                icon: "/favicon.ico"
                              });
                            } catch (err) {
                              console.warn("Iframe notification error", err);
                            }
                          }
                        }

                        // 3. Audio chordclaxons
                        if (config.soundChime && !muteSound) {
                          try {
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const osc = audioCtx.createOscillator();
                            const gainNode = audioCtx.createGain();
                            osc.connect(gainNode);
                            gainNode.connect(audioCtx.destination);
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(ev.event_type === "red_card" ? 330 : 523.25, audioCtx.currentTime);
                            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.35);
                          } catch (audioErr) {
                            console.warn("Audio Context init block", audioErr);
                          }
                        }
                      }
                    }
                  });
                }
              } catch (cfgErr) {
                console.error("Failed telemetry config processing", cfgErr);
              }

              return [...prev, ...unresolved.map((e: any) => e.id)];
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.error("Match detail loading issue", e);
    }
  };

  const checkPlanSimPermission = (): boolean => {
    if (user.plan === "free" && user.free_match_used) {
      alert("Recruit plan limits: You have exhausted your 1-simulation quota. Please upgrade your plan in the pricing deck to unlock infinite forecasts!");
      onOpenUpgrade();
      return false;
    }
    return true;
  };

  const handleStartSimulation = async (type: "quick" | "ticking") => {
    if (!selectedMatch) return;
    if (!checkPlanSimPermission()) return;

    setSimulating(true);
    try {
      const endpoint = type === "quick" ? `/simulation/quick/${selectedMatch.id}` : `/simulation/start/${selectedMatch.id}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation error");

      onRefreshMatches();
      loadDetailedMatch(selectedMatch.id);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  // Lock user's pre-match vote
  const handleCastVote = async (choice: "home" | "draw" | "away") => {
    if (!selectedMatch || !matchDetails) return;
    setSubmittingVote(true);
    try {
      const res = await fetch(`/matches/${selectedMatch.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ vote: choice }),
      });
      const data = await res.json();
      if (res.ok) {
        setVotedChoice(choice);
        loadDetailedMatch(selectedMatch.id);
      } else {
        alert(data.error || "Failed to catalog prediction");
      }
    } catch (e) {
      console.error("Voting issue", e);
    } finally {
      setSubmittingVote(false);
    }
  };

  // Lock user's halftime prediction
  const handleLockHalftimeForecast = async (option: "over15" | "homeScoreNext" | "awayScoreNext" | "under15") => {
    if (!selectedMatch || !matchDetails) return;
    setSubmittingHT(true);
    try {
      const res = await fetch(`/matches/${selectedMatch.id}/halftime-prediction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prediction: option }),
      });
      const data = await res.json();
      if (res.ok) {
        loadDetailedMatch(selectedMatch.id);
        onRefreshMatches();
      } else {
        alert(data.error || "Halftime commitment sequence aborted");
      }
    } catch (e) {
      console.error("Halftime forecasting issue", e);
    } finally {
      setSubmittingHT(false);
    }
  };

  // Ask Gemini Custom Halftime Predictive analysis
  const handleGenerateCustomAnalysis = async () => {
    if (!selectedMatch || !halftimeCustomPrompt.trim()) return;
    setAnalyzingHalftime(true);
    try {
      const res = await fetch(`/matches/${selectedMatch.id}/halftime-custom-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prompt: halftimeCustomPrompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setHalftimeCustomAnalysisResult(data.analysis);
        loadDetailedMatch(selectedMatch.id);
        onRefreshMatches();
      } else {
        alert(data.error || "Failed to generate custom predictive analysis");
      }
    } catch (e) {
      console.error("Halftime custom analysis issue", e);
    } finally {
      setAnalyzingHalftime(false);
    }
  };

  // Call Gemini analyzed open source change bulletin
  const handleListenToOpenSources = async () => {
    if (!selectedMatch || !matchDetails) return;
    setFetchingAlert(true);
    try {
      const res = await fetch(`/matches/${selectedMatch.id}/alerts/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        }
      });
      const data = await res.json();
      if (res.ok && data.alert) {
        setAlerts((prev) => [data.alert, ...prev].slice(0, 5)); // Keep latest 5 alerts
      }
    } catch (e) {
      console.error("Alert generation issue", e);
    } finally {
      setFetchingAlert(false);
    }
  };

  const activeMatches = matches.filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const getFlagEmoji = (teamName: string): string => {
    const flags: Record<string, string> = {
      "USA": "🇺🇸", "Mexico": "🇲🇽", "Canada": "🇨🇦", "Argentina": "🇦🇷", "Brazil": "🇧🇷", "France": "🇫🇷",
      "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Spain": "🇪🇸", "Germany": "🇩🇪", "Portugal": "🇵🇹", "Nigeria": "🇳🇬", "Japan": "🇯🇵",
      "Morocco": "🇲🇦", "Croatia": "🇭🇷", "Senegal": "🇸🇳", "South Korea": "🇰🇷", "Netherlands": "🇳🇱"
    };
    return flags[teamName] || "⚽";
  };

  // Filter trend meeting matches (2, 3, 4, 5, or 6 past matches)
  const getHistoricalClashesTrends = () => {
    if (!matchDetails || !matchDetails.match.historical_clashes) return [];
    return matchDetails.match.historical_clashes.slice(0, meetingsLimit);
  };

  const getPoissonProbabilities = () => {
    if (!matchDetails?.match) return { homeWin: 33, draw: 33, awayWin: 34, expectedGoalsHome: 1.2, expectedGoalsAway: 1.2, likelyScores: [] };

    const baseHome = matchDetails.match.mu_home || 1.35;
    const baseAway = matchDetails.match.mu_away || 1.15;

    const lambda = baseHome * poissonHomeAttack;
    const mu = baseAway * poissonAwayAttack;

    const factorial = (n: number): number => {
      if (n <= 1) return 1;
      let res = 1;
      for (let i = 2; i <= n; i++) res *= i;
      return res;
    };
    
    const poissonProb = (k: number, mean: number): number => {
      return (Math.exp(-mean) * Math.pow(mean, k)) / factorial(k);
    };

    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    
    const scoreGrid: { score: string; prob: number }[] = [];

    for (let h = 0; h <= 6; h++) {
      const hP = poissonProb(h, lambda);
      for (let a = 0; a <= 6; a++) {
        const aP = poissonProb(a, mu);
        const p = hP * aP;
        
        if (h > a) homeWin += p;
        else if (h === a) draw += p;
        else awayWin += p;

        if (h <= 3 && a <= 3) {
          scoreGrid.push({ score: `${h}-${a}`, prob: p });
        }
      }
    }

    const total = homeWin + draw + awayWin;
    const homeWinPercent = total > 0 ? (homeWin / total) * 100 : 33.3;
    const drawPercent = total > 0 ? (draw / total) * 100 : 33.3;
    const awayWinPercent = total > 0 ? (awayWin / total) * 100 : 33.4;

    const likelyScores = scoreGrid
      .sort((s1, s2) => s2.prob - s1.prob)
      .slice(0, 4)
      .map(s => ({
        score: s.score,
        percentage: s.prob * 100
      }));

    return {
      homeWin: homeWinPercent,
      draw: drawPercent,
      awayWin: awayWinPercent,
      expectedGoalsHome: lambda,
      expectedGoalsAway: mu,
      likelyScores
    };
  };

  const getRadarChartData = (homePlayerName: string, awayPlayerName: string) => {
    if (!matchDetails?.match) return [];
    const homeStats = getPlayerStatsMap(matchDetails.match.home_team, homePlayerName);
    const awayStats = getPlayerStatsMap(matchDetails.match.away_team, awayPlayerName);
    
    return [
      { subject: "Attacking Strength", A: homeStats.attacking, B: awayStats.attacking, fullMark: 100 },
      { subject: "Defensive Rigor", A: homeStats.defending, B: awayStats.defending, fullMark: 100 },
      { subject: "Playmaking Vision", A: homeStats.playmaking, B: awayStats.playmaking, fullMark: 100 },
      { subject: "Ball Retention", A: homeStats.retention, B: awayStats.retention, fullMark: 100 },
      { subject: "Physical Dominance", A: homeStats.physical, B: awayStats.physical, fullMark: 100 },
      { subject: "Tactical Workrate", A: homeStats.workrate, B: awayStats.workrate, fullMark: 100 }
    ];
  };

  const getProjectedPlayerPerformance = () => {
    if (!matchDetails?.match) return [];
    
    const m = matchDetails.match;
    const poissonData = getPoissonProbabilities();
    
    const homeTeamName = m.home_team;
    const awayTeamName = m.away_team;
    
    const homeRoster = defaultRosters[homeTeamName]?.starters || [];
    const awayRoster = defaultRosters[awayTeamName]?.starters || [];
    
    const homeList = homeRoster.length > 0 
      ? homeRoster.map(p => ({ ...p, isHome: true, teamName: homeTeamName, color: m.home_jersey_color || "#10b981" }))
      : (playersByTeam[homeTeamName] || []).map((name, idx) => ({
          name,
          role: idx === 0 ? "GK" : idx === 1 ? "DEF" : idx === 2 ? "MID" : ("FWD" as const),
          rating: 80 + (idx * 3),
          isHome: true,
          teamName: homeTeamName,
          color: m.home_jersey_color || "#10b981"
        }));

    const awayList = awayRoster.length > 0
      ? awayRoster.map(p => ({ ...p, isHome: false, teamName: awayTeamName, color: m.away_jersey_color || "#14b8a6" }))
      : (playersByTeam[awayTeamName] || []).map((name, idx) => ({
          name,
          role: idx === 0 ? "GK" : idx === 1 ? "DEF" : idx === 2 ? "MID" : ("FWD" as const),
          rating: 80 + (idx * 3),
          isHome: false,
          teamName: awayTeamName,
          color: m.away_jersey_color || "#14b8a6"
        }));

    const allPlayersInput = [...homeList, ...awayList];
    
    const muH = poissonData.expectedGoalsHome;
    const muA = poissonData.expectedGoalsAway;
    
    const hWinProb = poissonData.homeWin / 100;
    const aWinProb = poissonData.awayWin / 100;

    const ratedPlayers = allPlayersInput.map(player => {
      let roleWeightOff = 0.1;
      let roleWeightDef = 0.1;
      
      switch (player.role) {
        case "FWD":
          roleWeightOff = 0.95;
          roleWeightDef = 0.05;
          break;
        case "MID":
          roleWeightOff = 0.65;
          roleWeightDef = 0.35;
          break;
        case "DEF":
          roleWeightOff = 0.15;
          roleWeightDef = 0.85;
          break;
        case "GK":
          roleWeightOff = 0.02;
          roleWeightDef = 0.98;
          break;
      }
      
      let score = 0;
      const teamMu = player.isHome ? muH : muA;
      const oppMu = player.isHome ? muA : muH;
      const teamWinMultiplier = player.isHome ? hWinProb : aWinProb;
      
      const offContribution = player.rating * roleWeightOff * teamMu * 2.0;
      const defContribution = player.rating * roleWeightDef * Math.max(0.1, 3.5 - oppMu) * 1.5;
      
      score = (offContribution + defContribution) * (0.5 + teamWinMultiplier);
      const nameHash = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      score += (nameHash % 5) * 1.2;
      
      return {
        name: player.name,
        role: player.role,
        rating: player.rating,
        isHome: player.isHome,
        teamName: player.teamName,
        color: player.color,
        calculatedScore: score,
        projectedContribution: (roleWeightOff * teamMu).toFixed(2),
      };
    });
    
    const sumScores = ratedPlayers.reduce((acc, p) => acc + p.calculatedScore, 0) || 1;
    
    const normalized = ratedPlayers.map(p => ({
      ...p,
      probability: Math.min(95, Math.max(2, Math.round((p.calculatedScore / sumScores) * 100)))
    }));
    
    return normalized.sort((a, b) => b.probability - a.probability).slice(0, 3);
  };

  // Calculate detailed mock stats on finish state
  const getMatchDebriefStats = () => {
    if (!matchDetails) return { possession: { home: 50, away: 50 }, shots: { home: 0, away: 0 }, passes: { home: 80, away: 80 } };
    const m = matchDetails.match;
    const diffElo = m.home_elo - m.away_elo;
    
    // Possession centered around ELO bias
    const homePoss = Math.min(65, Math.max(35, Math.round(50 + diffElo / 15)));
    const awayPoss = 100 - homePoss;

    // Shots proportional to mu values plus scorelines
    const homeShots = Math.round(m.mu_home * 4 + m.home_score * 2 + Math.random() * 3);
    const awayShots = Math.round(m.mu_away * 4 + m.away_score * 2 + Math.random() * 3);

    const homePasses = Math.min(94, Math.max(76, 85 + Math.round(diffElo / 60)));
    const awayPasses = Math.min(94, Math.max(76, 85 - Math.round(diffElo / 60)));

    return {
      possession: { home: homePoss, away: awayPoss },
      shots: { home: homeShots, away: awayShots },
      passes: { home: homePasses, away: awayPasses }
    };
  };

  const debriefStats = getMatchDebriefStats();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[82vh] relative select-none">
      
      {/* FLOATING HALFTIME AI TACTICAL PROMPT NOTIFICATION TOAST */}
      {showHalftimePromptInvite && matchDetails?.match && (
        <div id="halftime-banner" className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-emerald-500/40 p-5 rounded-2xl shadow-3xl text-left animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Intelligence Intercept
            </span>
            <button 
              onClick={() => setShowHalftimePromptInvite(false)} 
              className="text-xs text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide">
            🚨 HALFTIME CRITICAL DESPATCH
          </h4>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
            The referee has whistled for halftime in <strong>{matchDetails.match.home_team} vs {matchDetails.match.away_team}</strong>! 
            Submit a custom tactical prediction instruction to Gemini to forecast the second half dynamic!
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setShowHalftimePromptInvite(false);
                const el = document.getElementById("halftime-custom-prompt-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="py-1 px-3 bg-emerald-550 hover:bg-emerald-450 text-slate-950 font-bold text-[10px] uppercase rounded-lg transition-all cursor-pointer"
            >
              Configure Prompt
            </button>
            <button
              onClick={() => setShowHalftimePromptInvite(false)}
              className="py-1 px-3 bg-slate-800 hover:bg-slate-750 text-slate-350 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* FLOATING LIVE MATCH FOLLOW BANNER NOTIFICATION TOAST */}
      {liveTriggers.length > 0 && (
        <div id="follow-toast-container" className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-auto">
          {liveTriggers.map((trig) => (
            <div 
              key={trig.id} 
              className="bg-slate-950 border-2 border-emerald-500 p-5 rounded-2xl shadow-3xl text-left animate-in fade-in slide-in-from-left-5 duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.3)_0,transparent_100%)] pointer-events-none animate-pulse" />
              
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  SYSTEM DESPATCH: GOING LIVE
                </span>
                <button 
                  type="button"
                  onClick={() => setLiveTriggers((prev) => prev.filter((t) => t.id !== trig.id))} 
                  className="text-xs text-slate-400 hover:text-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-1 relative z-10">
                <h4 className="text-xs font-black text-rose-400 uppercase tracking-wide flex items-center gap-1">
                  🚨 MATCH NOW ONLINE • {trig.time}
                </h4>
                <p className="text-[11px] text-slate-200 leading-relaxed font-sans mt-1">
                  Your followed fixture <strong className="text-emerald-400 font-extrabold uppercase">{trig.home_team} vs {trig.away_team}</strong> has shifted to <strong className="text-emerald-400">LIVE</strong> state! 
                  Poisson parameters and Gemini tactical analytics are now active!
                </p>
              </div>
              
              <div className="mt-4 flex gap-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    const matchObj = matches.find((m) => m.id === trig.id);
                    if (matchObj) {
                      onSelectMatch(matchObj);
                    }
                    setLiveTriggers((prev) => prev.filter((t) => t.id !== trig.id));
                  }}
                  className="py-1 px-3 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black text-[10px] uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-slate-950" /> Join Arena
                </button>
                <button
                  type="button"
                  onClick={() => setLiveTriggers((prev) => prev.filter((t) => t.id !== trig.id))}
                  className="py-1 px-3 bg-slate-900 border border-slate-805 hover:bg-slate-800 text-slate-400 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* COLUMN 1: Sidebar Dashboard Desk */}
      <div className="lg:col-span-1 space-y-4 flex flex-col max-h-[82vh] overflow-hidden text-left">
        
        {/* CHIC SIDEBAR TAB SELECTOR */}
        <div className="p-1 border border-slate-900 rounded-2xl shrink-0 flex items-center bg-slate-950">
          <button
            onClick={() => setActiveSidebarTab("fixtures")}
            className={`flex-1 py-1.5 text-center text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeSidebarTab === "fixtures"
                ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-500 hover:text-slate-350 border border-transparent"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Fixtures
          </button>
          <button
            onClick={() => setActiveSidebarTab("news")}
            className={`flex-1 py-1.5 text-center text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 relative ${
              activeSidebarTab === "news"
                ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-500 hover:text-slate-350 border border-transparent"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            News
            <span className="absolute top-1 right-1.5 w-1.2 h-1.2 rounded-full bg-rose-500 border border-slate-950 animate-ping" />
          </button>
          <button
            onClick={() => setActiveSidebarTab("alerts")}
            className={`flex-1 py-1.5 text-center text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeSidebarTab === "alerts"
                ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 border border-emerald-500/20 shadow-md"
                : "text-slate-500 hover:text-slate-350 border border-transparent"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Alarms
          </button>
        </div>

        {activeSidebarTab === "fixtures" ? (
          <>
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 shrink-0 backdrop-blur-md shadow-2xl relative">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Fixtures Deck
                </h3>
                <button
                  onClick={onRefreshMatches}
                  title="Refresh indices"
                  className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-950/60 border border-slate-850 rounded-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter switches */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-850 rounded-xl">
                {[
                  { id: "all" as const, name: "All Matches" },
                  { id: "live" as const, name: "🔴 Live Track" },
                  { id: "scheduled" as const, name: "Scheduled" },
                  { id: "finished" as const, name: "Finished" },
                ].map((bt) => (
                  <button
                    key={bt.id}
                    onClick={() => {
                      triggerHaptic("light");
                      setFilter(bt.id);
                    }}
                    className={`py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      filter === bt.id 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md font-extrabold" 
                        : "text-slate-500 hover:text-slate-350 border border-transparent"
                    }`}
                  >
                    {bt.name}
                  </button>
                ))}
              </div>

              {/* Compare Mode Toggler */}
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  setCompareMode(!compareMode);
                  if (!compareMode) {
                    setCompareMatchIds([]);
                  }
                }}
                className={`w-full py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                  compareMode
                    ? "bg-teal-500/15 text-teal-350 border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.15)] animate-pulse"
                    : "bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
                id="matches-comparison-mode-btn"
              >
                <Scale className="w-3.5 h-3.5 text-teal-400" />
                {compareMode ? "Comparing Mode Active" : "⚖️ Compare Matches"}
              </button>
            </div>

            {/* Dynamic Matches List Scroll View */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {activeMatches.map((m) => {
                const isSelected = selectedMatch?.id === m.id;
                const isLive = m.status === "live";
                const isFinished = m.status === "finished";
                const isCompared = compareMatchIds.includes(m.id);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      triggerHaptic("light");
                      if (compareMode) {
                        handleToggleCompare(m.id);
                      } else {
                        onSelectMatch(m);
                      }
                    }}
                    style={{
                      "--home-jersey": m.home_jersey_color || "#10b981",
                      "--away-jersey": m.away_jersey_color || "#14b8a6",
                      borderColor: isSelected && !compareMode ? "var(--home-jersey)" : undefined,
                      boxShadow: isSelected && !compareMode ? "0 0 15px -3px var(--home-jersey)" : undefined,
                    } as React.CSSProperties}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[150px] group ${
                      compareMode
                        ? isCompared
                          ? "border-teal-500 bg-teal-950/10 shadow-[0_0_15px_-3px_rgba(20,184,166,0.2)] ring-1 ring-teal-500/20"
                          : "border-slate-850/80 bg-slate-900/10 hover:border-slate-700 opacity-60"
                        : isSelected
                        ? "bg-slate-950/20 ring-1 ring-white/10"
                        : "border-slate-850 bg-slate-900/35 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    {/* Visual Glass Edge Glow on Select */}
                    {isSelected && !compareMode && (
                      <div className="absolute top-0 left-0 w-[4px] h-full bg-[var(--home-jersey)] transition-all" />
                    )}
                    {isCompared && compareMode && (
                      <div className="absolute top-0 left-0 w-[4px] h-full bg-teal-400 animate-pulse" />
                    )}

                    {/* Stage metadata */}
                    <div className="flex items-center justify-between text-[8px] text-slate-500 mb-2 font-mono font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFollow(m.id);
                          }}
                          className={`p-1 rounded-md border transition-all cursor-pointer ${
                            followedMatchIds.includes(m.id)
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse"
                              : "bg-slate-950/80 border-slate-850 text-slate-550 hover:text-slate-300 hover:border-slate-700"
                          }`}
                          title={followedMatchIds.includes(m.id) ? "Unfollow match alerts" : "Follow match for push status notifications"}
                        >
                          <Bell className={`w-3 h-3 ${followedMatchIds.includes(m.id) ? "fill-emerald-400/25" : ""}`} />
                        </button>
                        {compareMode ? (
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider ${
                            isCompared 
                              ? "bg-teal-500 text-slate-950 font-black" 
                              : "bg-slate-900/50 text-slate-550 border border-slate-850"
                          }`}>
                            {isCompared ? `MATCHED #${compareMatchIds.indexOf(m.id) + 1}` : "Compare [ ]"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-emerald-500/60" />
                            {m.stage}
                          </span>
                        )}
                      </div>
                      {isLive && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/25 text-rose-455 font-extrabold flex items-center gap-1 animate-pulse">
                          <Timer className="w-2.5 h-2.5 animate-spin" />
                          LIVE {m.simulation_minute}'
                        </span>
                      )}
                      {isFinished && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-450">
                          FINISHED
                        </span>
                      )}
                    </div>

                    {/* Main countries layout */}
                    <div className="space-y-2 py-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-205">
                        <span className="flex items-center gap-2 group-hover:text-[var(--home-jersey)] transition-all">
                          <span className="text-sm leading-none">{getFlagEmoji(m.home_team)}</span>
                          <span className="truncate max-w-[85px] uppercase tracking-wider">{m.home_team}</span>
                          <span className="w-1.5 h-1.5 rounded-full ring-2 ring-slate-950 shadow-sm" style={{ backgroundColor: "var(--home-jersey)" }} />
                        </span>
                        <span 
                          className="font-mono bg-slate-950 px-2.5 py-0.5 rounded border text-xs font-black transition-all"
                          style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}
                        >
                          {m.home_score}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-205">
                        <span className="flex items-center gap-2 group-hover:text-[var(--away-jersey)] transition-all">
                          <span className="text-sm leading-none">{getFlagEmoji(m.away_team)}</span>
                          <span className="truncate max-w-[85px] uppercase tracking-wider">{m.away_team}</span>
                          <span className="w-1.5 h-1.5 rounded-full ring-2 ring-slate-950 shadow-sm" style={{ backgroundColor: "var(--away-jersey)" }} />
                        </span>
                        <span 
                          className="font-mono bg-slate-950 px-2.5 py-0.5 rounded border text-xs font-black transition-all"
                          style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}
                        >
                          {m.away_score}
                        </span>
                      </div>
                    </div>

                    {/* Footer and datetime */}
                    <div className="mt-3 pt-2.5 border-t border-slate-850/66 text-[8px] text-slate-500 font-mono font-semibold flex items-center justify-between">
                      <span className="truncate max-w-[95px] flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-slate-600" />
                        {m.stadium}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-slate-600" />
                        {m.date.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : activeSidebarTab === "news" ? (
          /* NEW SPORTS NEWSROOM LAYOUT BLOCK - CHIC, COOL, NOT OVERCROWDED, PINNED NBS SPORT */
          <div className="flex-1 flex flex-col gap-4 overflow-hidden text-left">
            
            {/* TOPBAR CONTROLS AND TIKTOK FLOW TOGGLE */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-slate-950/60 border border-slate-850 p-3 rounded-2xl shrink-0 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
                <h3 className="text-[10px] font-black uppercase text-teal-400 font-mono tracking-widest flex items-center gap-1">
                  🔮 GLOBAL NEWSROOM
                </h3>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3.5">
                <span className="text-[8px] text-slate-500 font-mono font-bold flex items-center gap-1.5" title="Refreshing automatically every 2 minutes">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  Live Sync (2m)
                </span>
                
                {/* TikTok Scroll Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isTikTokScrollMode;
                    setIsTikTokScrollMode(nextMode);
                    sessionStorage.setItem("kickiq_tiktok_scroll", String(nextMode));
                    triggerHaptic();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[8.5px] font-black uppercase transition-all duration-300 flex items-center gap-1 cursor-pointer font-mono border ${
                    isTikTokScrollMode 
                      ? "bg-gradient-to-r from-teal-500 to-indigo-500 text-slate-950 border-teal-400" 
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-250 hover:border-slate-750"
                  }`}
                >
                  🎬 TikTok Scroll: {isTikTokScrollMode ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            </div>

            {isTikTokScrollMode ? (
              /* DYNAMIC TIKTOK SNAP-SCROLL VIEW */
              <div className="flex-1 flex flex-col gap-3 overflow-hidden select-none">
                
                {/* NEWS FILTERS WHILE IN TIKTOK MODE */}
                <div className="flex gap-1 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
                  {["All Feeds", "Uganda", "Kenya", "Tanzania", "Nigeria", "South Africa", "Ghana", "Congo", "Europe", "Brazil", "America"].map((regionName) => {
                    const isActive = selectedNewsSource === regionName;
                    return (
                      <button
                        key={regionName}
                        onClick={() => {
                          setSelectedNewsSource(regionName);
                          setTiktokCurrentIndex(0);
                          triggerHaptic();
                        }}
                        className={`text-[8px] font-bold px-2 py-1 rounded-lg shrink-0 border transition-all cursor-pointer font-mono ${
                          isActive
                            ? "bg-teal-500 border-teal-400 text-slate-950 font-extrabold"
                            : "bg-slate-950 border-slate-900 text-slate-550 hover:text-slate-300 hover:border-slate-800"
                        }`}
                      >
                        {regionName}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const filtered = newsList.filter((art) => {
                    const matchesSource = selectedNewsSource === "All Feeds" || 
                      (art.region && art.region.toLowerCase() === selectedNewsSource.toLowerCase());
                    const matchesSearch = art.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
                      art.summary.toLowerCase().includes(newsSearch.toLowerCase());
                    return matchesSource && matchesSearch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900/30 border border-slate-850 border-dashed rounded-3xl text-center">
                        <p className="text-[10px] text-slate-550 font-mono uppercase tracking-wider mb-2">
                          No matching TikTok feeds
                        </p>
                        <p className="text-[8.5px] text-slate-500 leading-normal max-w-xs font-sans">
                          Try searching for a different term or select another country/region pill at the top.
                        </p>
                      </div>
                    );
                  }

                  // Sanitized active index
                  const clampedIdx = tiktokCurrentIndex >= filtered.length ? 0 : tiktokCurrentIndex;
                  const activeArt = filtered[clampedIdx];
                  const totalCount = filtered.length;
                  const isLiked = likedNewsIds.includes(activeArt.id);

                  return (
                    <div className="flex-1 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl relative overflow-hidden flex flex-col justify-end shadow-2xl p-5 group min-h-[360px]">
                      
                      {/* Full-bleed responsive image background with deep overlay */}
                      <div className="absolute inset-0 z-0">
                        <img 
                          src={activeArt.thumbnail} 
                          alt="TikTok background" 
                          className="w-full h-full object-cover opacity-30 transition-transform duration-700 scale-103 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/10 z-1" />
                      </div>

                      {/* Floating Indicator with region flag at top */}
                      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                        <span className="p-1 px-2.5 bg-slate-900/90 border border-slate-800 rounded-full text-[9px] font-bold text-slate-205 flex items-center gap-1.5 font-mono shadow-md backdrop-blur-sm">
                          <span className="text-sm">{activeArt.flag || "🌍"}</span>
                          {activeArt.region || "Global"}
                        </span>
                        <span className="p-1 px-2.5 bg-slate-900/90 border border-slate-800 rounded-full text-[8px] font-mono text-slate-450 shadow-md backdrop-blur-sm">
                          {activeArt.time}
                        </span>
                      </div>

                      {/* Right bar interaction shortcuts */}
                      <div className="absolute right-4 bottom-24 z-10 flex flex-col items-center gap-4">
                        {/* Like Button */}
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => {
                              const alreadyLiked = likedNewsIds.includes(activeArt.id);
                              setLikedNewsIds(prev => 
                                alreadyLiked ? prev.filter(id => id !== activeArt.id) : [...prev, activeArt.id]
                              );
                              triggerHaptic();
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                              isLiked 
                                ? "bg-rose-505 bg-rose-500 border-rose-400 text-slate-100 scale-110" 
                                : "bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span className="text-sm font-bold">{isLiked ? "🔥" : "🤍"}</span>
                          </button>
                          <span className="text-[8px] text-slate-500 font-mono mt-1 font-bold">
                            {isLiked ? "Liked" : "Like"}
                          </span>
                        </div>

                        {/* Autoplay Play/Pause */}
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAutoscrolling(!isAutoscrolling);
                              triggerHaptic();
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                              isAutoscrolling 
                                ? "bg-teal-500/20 border-teal-500/50 text-teal-400" 
                                : "bg-slate-900/90 border-slate-800 text-slate-500"
                            }`}
                            title={isAutoscrolling ? "Pause Auto-Scroller per session" : "Enable Auto-Scroller per session"}
                          >
                            <span className="text-xs font-black font-mono">
                              {isAutoscrolling ? "⏸" : "▶"}
                            </span>
                          </button>
                          <span className="text-[8px] text-slate-500 font-mono mt-1 font-bold">
                            {isAutoscrolling ? "Looping" : "Paused"}
                          </span>
                        </div>
                      </div>

                      {/* Content block overlay overlay */}
                      <div className="relative z-10 space-y-3 pr-10 text-left w-full">
                        <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                          {activeArt.source} • {activeArt.category} index
                        </span>
                        
                        <h4 className="text-[13px] font-black text-slate-100 leading-snug tracking-normal uppercase font-sans">
                          {activeArt.title}
                        </h4>

                        <p className="text-[9.5px] text-slate-350 leading-relaxed font-sans max-w-sm line-clamp-3">
                          {activeArt.summary}
                        </p>

                        {/* Autoplay remaining line index metric indicator */}
                        {isAutoscrolling && (
                          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden relative border border-slate-850/50">
                            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-500 to-indigo-500 h-full animate-progress-tiktok" style={{ width: '100%' }} />
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-slate-900/60 pb-1">
                          {/* Navigation buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setTiktokCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
                                triggerHaptic();
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[9px] text-slate-300 font-mono font-bold transition cursor-pointer"
                            >
                              &larr; Prev
                            </button>
                            <span className="text-[9px] font-mono font-semibold text-slate-500 px-1">
                              {clampedIdx + 1}/{totalCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTiktokCurrentIndex((prev) => (prev + 1) % totalCount);
                                triggerHaptic();
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[9px] text-slate-300 font-mono font-bold transition cursor-pointer"
                            >
                              Next &rarr;
                            </button>
                          </div>

                          {/* Live link out launcher */}
                          <a 
                            href={activeArt.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-[9.5px] uppercase rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-103"
                          >
                            🔗 GO TO CHANNEL &rarr;
                          </a>
                        </div>
                      </div>

                    </div>
                  );
                })()}

              </div>
            ) : (
              /* TRADITIONAL ACCORDION SPORT ARTICLE LIST LAYOUT */
              <>
                {/* LIVE REGISTER NEWS SEARCH BAR */}
                <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-2xl shrink-0 space-y-2.5 relative">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1.5 border border-slate-805 rounded-xl">
                    <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search articles..."
                      value={newsSearch}
                      onChange={(e) => setNewsSearch(e.target.value)}
                      className="bg-transparent text-[9.5px] font-mono text-slate-300 w-full focus:outline-none placeholder-slate-600"
                    />
                  </div>

                  {/* Horizontal Pill Filters with Regional Flags */}
                  <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0 scrollbar-thin">
                    {["All Feeds", "Uganda", "Kenya", "Tanzania", "Nigeria", "South Africa", "Ghana", "Congo", "Europe", "Brazil", "America"].map((regionName) => {
                      const isActive = selectedNewsSource === regionName;
                      return (
                        <button
                          key={regionName}
                          onClick={() => {
                            setSelectedNewsSource(regionName);
                            triggerHaptic();
                          }}
                          className={`text-[8.5px] font-bold px-2 py-0.5 rounded-lg shrink-0 border transition-all cursor-pointer font-mono ${
                            isActive
                              ? "bg-slate-200 border-slate-350 text-slate-950 font-black shadow-sm"
                              : "bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300 hover:border-slate-800"
                          }`}
                        >
                          {regionName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FLOWING LEGIT NEWS ARTICLES LIST */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-medium">
                  {(() => {
                    const filtered = newsList.filter((art) => {
                      const matchesSource = selectedNewsSource === "All Feeds" || 
                        (art.region && art.region.toLowerCase() === selectedNewsSource.toLowerCase());
                      const matchesSearch = art.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
                        art.summary.toLowerCase().includes(newsSearch.toLowerCase()) ||
                        art.source.toLowerCase().includes(newsSearch.toLowerCase());
                      return matchesSource && matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center p-6 bg-slate-900/30 border border-slate-850 border-dashed rounded-2xl">
                          <p className="text-[9px] text-slate-500 font-mono uppercase">
                            No articles match search filters
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((art) => (
                      <div 
                        key={art.id}
                        className="bg-slate-900/35 border border-slate-850/60 p-3 rounded-2xl flex flex-col justify-between hover:bg-slate-900/70 hover:border-slate-700 transition group relative"
                      >
                        <div className="flex gap-2.5 items-start">
                          {/* Image Thumbnail with Direct Official Link */}
                          <a 
                            href={art.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-950 bg-slate-950 relative block hover:opacity-80 transition"
                          >
                            <img 
                              src={art.thumbnail} 
                              alt={art.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 flex items-center justify-center py-0.5">
                              <span className="text-[5px] font-black text-slate-300 tracking-wider font-mono">
                                LAUNCH &nearr;
                              </span>
                            </div>
                          </a>

                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                {art.source} {art.flag}
                              </span>
                              <span className="text-[7.5px] text-slate-500 font-mono">
                                {art.time}
                              </span>
                            </div>
                            <h5 className="text-[10px] font-extrabold text-slate-205 leading-snug tracking-wide group-hover:text-emerald-400 transition font-sans">
                              <a href={art.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {art.title}
                              </a>
                            </h5>
                          </div>
                        </div>

                        <p className="text-[8.5px] text-slate-400 leading-relaxed font-sans mt-2">
                          {art.summary}
                        </p>

                        <div className="flex items-center justify-between border-t border-slate-950 mt-2.5 pt-2">
                          <span className="text-[6px] uppercase font-bold tracking-widest text-slate-500 font-mono">
                            📁 {art.category} • {art.region || "Global"}
                          </span>
                          <a 
                            href={art.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[7.5px] text-slate-400 hover:text-white transition flex items-center gap-1 font-mono hover:scale-103"
                          >
                            Read On site &rarr;
                          </a>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
            
            {/* FOOTER METRIC NOTE */}
            <div className="text-center p-2.5 bg-slate-950/40 border border-slate-850/40 rounded-xl shrink-0 font-mono">
              <p className="text-[8px] text-slate-550 leading-relaxed">
                Authorized regional sports updates synchronized with legal directories.
              </p>
            </div>
          </div>
        ) : (
          <NotificationSettings
            user={user}
            onOpenUpgrade={onOpenUpgrade}
            matches={matches}
            onTriggerDemoAlert={(title, body, type) => {
              addFeedEvent(type, title, body, -99);
            }}
          />
        )}

        {/* PERSISTENT LIVE MATCH FEED & ALERTS TRACKER */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 shrink-0 backdrop-blur-md shadow-2xl relative transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${followedMatchIds.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                Live Match Feed {followedMatchIds.length > 0 && `(${followedMatchIds.length})`}
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLiveFeedExpanded(!liveFeedExpanded)}
                className="p-1 hover:text-slate-200 text-slate-500 rounded hover:bg-slate-800/50 transition cursor-pointer"
                title={liveFeedExpanded ? "Collapse Feed" : "Expand Feed"}
              >
                {liveFeedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {liveFeedExpanded && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Quick controls row: mute alerts, test signal, clear log */}
              <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-850 gap-2">
                <div className="flex items-center gap-1 zoom-90">
                  <button
                    type="button"
                    onClick={() => setMuteSound(!muteSound)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      muteSound 
                        ? "bg-rose-500/10 text-rose-450 border-rose-500/20" 
                        : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                    title={muteSound ? "Unmute sound alerts" : "Mute sound alerts"}
                  >
                    {muteSound ? (
                      <VolumeX className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerTestAlert}
                    className="py-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-350 rounded-lg text-[8px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                    title="Send system test notification to verify browser push & audio"
                  >
                    <Activity className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    Test Signal
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNotificationHistory([
                      {
                        id: "welcome-system",
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: "system",
                        title: "Feed Cleared",
                        body: "Live telemetry logging restarted."
                      }
                    ]);
                  }}
                  className="p-1 px-2 rounded-lg border border-transparent text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition text-[8px] font-black uppercase font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Clear
                </button>
              </div>

              {/* Feed items array */}
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {notificationHistory.length === 0 ? (
                  <p className="text-[9px] text-slate-500 italic text-center py-4 font-mono">
                    No recent alert despatches.
                  </p>
                ) : (
                  notificationHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.matchId && item.matchId !== -99) {
                          const target = matches.find((m) => m.id === item.matchId);
                          if (target) onSelectMatch(target);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        item.matchId && item.matchId !== -99
                          ? "bg-slate-950/60 border-slate-850 hover:bg-slate-950 cursor-pointer hover:border-emerald-500/30" 
                          : "bg-slate-950/20 border-slate-900/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <span className="text-[7px] font-mono text-slate-500 font-bold">
                          🕒 {item.timestamp}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[6px] font-black uppercase font-mono tracking-wider ${
                          item.type === 'live' 
                            ? "bg-rose-500/10 text-rose-455 border border-rose-500/20 animate-pulse" 
                            : item.type === 'follow'
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {item.type}
                        </span>
                      </div>
                      <h5 className="text-[9px] font-extrabold text-slate-250 uppercase tracking-wide truncate">
                        {item.title}
                      </h5>
                      <p className="text-[8px] text-slate-450 leading-normal font-sans mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
              
              {followedMatchIds.length === 0 && (
                <div className="text-center p-2.5 bg-slate-950/40 border border-slate-850/40 rounded-xl">
                  <p className="text-[8px] text-slate-500 leading-normal">
                    💡 <strong className="text-slate-400">Pro-Tip:</strong> Click the <span className="text-emerald-400">Bell icon</span> on any fixture in the registry to receive real-time updates and trigger push notifications!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 2 & 3: Selected Match Analytical Core Panel */}
      <div className={`${isSidebarOpen ? "lg:col-span-2" : "lg:col-span-3"} space-y-6 max-h-[82vh] overflow-y-auto pr-1 transition-all duration-300`}>
        {compareMode ? (
          // RENDER MATCH COMPARISON COMPONENT
          (() => {
            const compMatch1 = matches.find((m) => m.id === compareMatchIds[0]);
            const compMatch2 = matches.find((m) => m.id === compareMatchIds[1]);

            if (compareMatchIds.length === 0) {
              return (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-4 min-h-[500px]">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-teal-400 text-2xl font-bold mb-4 shadow-xl z-10 animate-pulse">
                    ⚖️
                  </div>
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">No matches selected</h3>
                  <p className="text-[10px] text-slate-500 mt-2 max-w-[290px] leading-relaxed z-10">
                    Select the first World Cup fixture card from the list on the left to start your side-by-side forecast comparison matrix.
                  </p>
                </div>
              );
            }

            if (compareMatchIds.length === 1) {
              return (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-4 min-h-[500px]">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-teal-400 text-2xl font-bold mb-4 shadow-xl z-10 animate-bounce">
                    ⚖️
                  </div>
                  <span className="text-[9px] font-mono text-teal-400 uppercase bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                    Fixture 1 Active: {compMatch1?.home_team} vs {compMatch1?.away_team}
                  </span>
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">Select a second fixture</h3>
                  <p className="text-[10px] text-slate-500 mt-2 max-w-[290px] leading-relaxed z-10">
                    Select one more World Cup fixture card from the left side list, and we will overlay forecasting algorithms and statistics side-by-side.
                  </p>
                </div>
              );
            }

            return (
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-5 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider flex items-center gap-1.5 font-mono">
                      <Scale className="w-4 h-4 text-teal-400" /> SIDE-BY-SIDE FORECAST MATRIX
                    </h3>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                      Dual Poisson algorithms mapped seamlessly across both fixtures.
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => setCompareMatchIds([])}
                    className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-xl transition cursor-pointer hover:bg-rose-500/20"
                  >
                    Clear Comparison
                  </button>
                </div>

                {/* Dual Team Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Match 1 Header */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-1 left-2 text-[7px] font-mono text-teal-450 font-bold uppercase">MATCH 1</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getFlagEmoji(compMatch1!.home_team)}</span>
                      <span className="text-xs font-extrabold uppercase text-slate-205">{compMatch1!.home_team}</span>
                      <span className="text-xs font-mono text-slate-550">vs</span>
                      <span className="text-xs font-extrabold uppercase text-slate-205">{compMatch1!.away_team}</span>
                      <span className="text-2xl">{getFlagEmoji(compMatch1!.away_team)}</span>
                    </div>
                    <div className="text-[8.5px] font-mono text-slate-500 uppercase">
                      Stadium: {compMatch1!.stadium}
                    </div>
                  </div>

                  {/* Match 2 Header */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-1 left-2 text-[7px] font-mono text-cyan-455 font-bold uppercase">MATCH 2</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getFlagEmoji(compMatch2!.home_team)}</span>
                      <span className="text-xs font-extrabold uppercase text-slate-205">{compMatch2!.home_team}</span>
                      <span className="text-xs font-mono text-slate-550">vs</span>
                      <span className="text-xs font-extrabold uppercase text-slate-205">{compMatch2!.away_team}</span>
                      <span className="text-2xl">{getFlagEmoji(compMatch2!.away_team)}</span>
                    </div>
                    <div className="text-[8.5px] font-mono text-slate-500 uppercase">
                      Stadium: {compMatch2!.stadium}
                    </div>
                  </div>
                </div>

                {/* Metrics Side-by-Side Comparison Table */}
                <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300 font-mono">
                    <thead className="bg-slate-900 border-b border-slate-850 text-slate-400 text-[8px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 w-1/3 border-r border-slate-850">Analytic Vector</th>
                        <th className="py-2.5 px-4 w-1/3 border-r border-slate-850 text-teal-400">Match 1 Forecasts</th>
                        <th className="py-2.5 px-4 w-1/3 text-cyan-400">Match 2 Forecasts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-[10px]">
                      
                      {/* STAGE & LOCATION */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Stage / Group</td>
                        <td className="py-2 px-4 border-r border-slate-850">{compMatch1!.stage}</td>
                        <td className="py-2 px-4">{compMatch2!.stage}</td>
                      </tr>

                      {/* STATUS */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Active Status</td>
                        <td className="py-2 px-4 border-r border-slate-850">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            compMatch1!.status === 'live' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            compMatch1!.status === 'finished' ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}>
                            {compMatch1!.status} {compMatch1!.status === 'live' ? `(${compMatch1!.simulation_minute}')` : ''}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            compMatch2!.status === 'live' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            compMatch2!.status === 'finished' ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}>
                            {compMatch2!.status} {compMatch2!.status === 'live' ? `(${compMatch2!.simulation_minute}')` : ''}
                          </span>
                        </td>
                      </tr>

                      {/* CURRENT SCORES */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Goals Registered</td>
                        <td className="py-2 px-4 border-r border-slate-850 font-sans text-xs font-black text-slate-100">
                          {compMatch1!.home_score} - {compMatch1!.away_score}
                        </td>
                        <td className="py-2 px-4 font-sans text-xs font-black text-slate-100">
                          {compMatch2!.home_score} - {compMatch2!.away_score}
                        </td>
                      </tr>

                      {/* STRENGTH RATING (ELO) */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Strength Rating (Home / Away)</td>
                        <td className="py-2 px-4 border-r border-slate-850">
                          <span className="text-slate-100">{compMatch1!.home_elo} ELO</span> / <span className="text-slate-400">{compMatch1!.away_elo} ELO</span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-slate-100">{compMatch2!.home_elo} ELO</span> / <span className="text-slate-400">{compMatch2!.away_elo} ELO</span>
                        </td>
                      </tr>

                      {/* ELO DIFFERENTIAL */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">ELO Advantage Delta</td>
                        <td className="py-2 px-4 border-r border-slate-850">
                          {compMatch1!.home_elo - compMatch1!.away_elo > 0 ? (
                            <span className="text-emerald-400 font-bold">+{compMatch1!.home_elo - compMatch1!.away_elo} ({compMatch1!.home_team})</span>
                          ) : (
                            <span className="text-amber-400 font-bold">+{compMatch1!.away_elo - compMatch1!.home_elo} ({compMatch1!.away_team})</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {compMatch2!.home_elo - compMatch2!.away_elo > 0 ? (
                            <span className="text-emerald-400 font-bold">+{compMatch2!.home_elo - compMatch2!.away_elo} ({compMatch2!.home_team})</span>
                          ) : (
                            <span className="text-amber-400 font-bold">+{compMatch2!.away_elo - compMatch2!.home_elo} ({compMatch2!.away_team})</span>
                          )}
                        </td>
                      </tr>

                      {/* POISSON EXPECTATION (LAMBDA / MU) */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Expected Goals ($\lambda, \mu$)</td>
                        <td className="py-2 px-4 border-r border-slate-850">
                          H: <strong className="text-emerald-450">{compMatch1!.mu_home || 1.35}</strong> | A: <strong className="text-teal-450">{compMatch1!.mu_away || 1.15}</strong>
                        </td>
                        <td className="py-2 px-4">
                          H: <strong className="text-emerald-450">{compMatch2!.mu_home || 1.35}</strong> | A: <strong className="text-teal-450">{compMatch2!.mu_away || 1.15}</strong>
                        </td>
                      </tr>

                      {/* WIN PROBABILITY (HOME) */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Probability: Home Win</td>
                        <td className="py-2 px-4 border-r border-slate-850 bg-emerald-500/5 font-extrabold text-emerald-400">
                          {(compMatch1!.win_probability?.home ? compMatch1!.win_probability.home * 100 : 45).toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 bg-teal-500/5 font-extrabold text-teal-400">
                          {(compMatch2!.win_probability?.home ? compMatch2!.win_probability.home * 100 : 45).toFixed(1)}%
                        </td>
                      </tr>

                      {/* WIN PROBABILITY (AWAY) */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Probability: Away Win</td>
                        <td className="py-2 px-4 border-r border-slate-850 font-semibold text-slate-350">
                          {(compMatch1!.win_probability?.away ? compMatch1!.win_probability.away * 100 : 30).toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 font-semibold text-slate-350">
                          {(compMatch2!.win_probability?.away ? compMatch2!.win_probability.away * 100 : 30).toFixed(1)}%
                        </td>
                      </tr>

                      {/* DECK CROWD PERCENTAGES */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Deck Votes Cast Distribution</td>
                        <td className="py-2 px-4 border-r border-slate-850">
                          H: <strong className="text-emerald-400">{Math.round((compMatch1!.votes_distribution?.percentages?.home || 45))}%</strong>{" | "}
                          A: <strong className="text-teal-400">{Math.round((compMatch1!.votes_distribution?.percentages?.away || 30))}%</strong>
                        </td>
                        <td className="py-2 px-4">
                          H: <strong className="text-emerald-400">{Math.round((compMatch2!.votes_distribution?.percentages?.home || 45))}%</strong>{" | "}
                          A: <strong className="text-teal-400">{Math.round((compMatch2!.votes_distribution?.percentages?.away || 30))}%</strong>
                        </td>
                      </tr>

                      {/* WILSON INTERVALS */}
                      <tr>
                        <td className="py-2 px-4 font-bold text-slate-500 border-r border-slate-850">Wilson 95% Expected Boundaries</td>
                        <td className="py-2 px-4 border-r border-slate-850 text-slate-400">
                          {compMatch1!.confidence_intervals?.home ? `${compMatch1!.confidence_intervals.home[0].toFixed(2)} - ${compMatch1!.confidence_intervals.home[1].toFixed(2)} goal expectancy` : "1.05 - 2.15 bounds"}
                        </td>
                        <td className="py-2 px-4 text-slate-400">
                          {compMatch2!.confidence_intervals?.home ? `${compMatch2!.confidence_intervals.home[0].toFixed(2)} - ${compMatch2!.confidence_intervals.home[1].toFixed(2)} goal expectancy` : "0.95 - 2.05 bounds"}
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* EXCLUSIVE PREMIUM NOTE WITH DIRECT TIERS BYPASS ADAPTABILITY */}
                <div className="bg-gradient-to-r from-teal-950/20 via-slate-900 to-teal-950/10 border border-teal-500/25 p-3 rounded-xl text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-teal-300 font-mono">
                      KICKIQ Dual Poisson Expectations Model Overlaid
                    </span>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-normal max-w-xl mx-auto font-sans font-medium">
                    This dual Poisson expectations feed correlates ELO vectors, squad form ratios and confidence thresholds side-by-side. 
                    {user.role === "admin" ? (
                      <span className="text-emerald-400 font-extrabold ml-1 uppercase font-mono">★ Admin Privilege Activated: All Forecast Access Granted For Free ★</span>
                    ) : user.plan === "elite" ? (
                      <span className="text-teal-300 font-extrabold ml-1 uppercase font-mono">★ Elite Plan Active ★</span>
                    ) : (
                      <span className="text-slate-400 ml-1">Unlock live coordinate trackers with <strong className="hover:text-emerald-400 cursor-pointer text-emerald-400 hover:underline" onClick={onOpenUpgrade}>Pro / Elite Passes</strong>.</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })()
        ) : selectedMatch && matchDetails ? (
          <>
            {/* CINEMATIC HUD SCOREBOARD PANEL */}
            <div className="relative p-5 bg-slate-900 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center gap-5">
              {/* Green turf lighting background beam */}
              <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.4)_0,transparent_100%)] pointer-events-none" />
              
              <div className="absolute top-2 left-3 text-[8px] font-mono font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                Live Feed Intel Pipeline
              </div>

              {/* Actions built in top-right area */}
              <div className="absolute top-2 right-3 z-10 animate-fade-in flex items-center gap-2">
                {/* Export Analytics Button */}
                <button
                  type="button"
                  onClick={exportMatchPdf}
                  className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border border-teal-500/30 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 cursor-pointer transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(20,184,166,0.15)]"
                  title="Export detailed PDF analytics match report"
                  id="btn-export-match-analytics"
                >
                  <span>📥 Export Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleFollow(matchDetails.match.id)}
                  className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center gap-1.5 ${
                    followedMatchIds.includes(matchDetails.match.id)
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-pulse"
                      : "bg-slate-950/80 text-slate-500 border-slate-850 hover:text-slate-300 hover:border-slate-700"
                  }`}
                  title={followedMatchIds.includes(matchDetails.match.id) ? "Unfollow match live status ticker" : "Follow match for push overlay alarms"}
                >
                  <Bell className={`w-3 h-3 ${followedMatchIds.includes(matchDetails.match.id) ? "fill-emerald-400/25 text-emerald-400" : ""}`} />
                  <span>
                    {followedMatchIds.includes(matchDetails.match.id) ? "Following Alerts" : "Follow Alerts"}
                  </span>
                </button>
              </div>

               {/* Match Header Roster & Real-time digits */}
              <div className="w-full relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 px-2">
               {/* Match Header Roster & Real-time digits */}
              {(() => {
                const homeColors = getTeamColors(matchDetails.match.home_team);
                const awayColors = getTeamColors(matchDetails.match.away_team);
                return (
                  <div className="w-full relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 px-2">
                    {/* Home Team profile */}
                    <div 
                      className={`text-center sm:text-left flex-1 p-4 rounded-2xl bg-slate-950/20 border border-slate-850/80 transition-all duration-300 relative group overflow-hidden ${homeColors.borderHover}`}
                      style={{ contentVisibility: "auto" }}
                    >
                      <div className={`absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${homeColors.gradient} blur-xl -z-10`} />
                      <div className="relative z-10 space-y-1">
                        <span className="text-4xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">{getFlagEmoji(matchDetails.match.home_team)}</span>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 font-sans mt-1.5">{matchDetails.match.home_team}</h2>
                        <div className="flex flex-col items-center sm:items-start gap-1">
                          <p className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-0.5 rounded-full inline-block">
                            ELO rating: {matchDetails.match.home_elo}
                          </p>
                          {matchDetails.match.home_form && matchDetails.match.home_form.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5" title="Recent rolling match form (oldest to newest)">
                              <span className="text-[7.5px] font-mono font-black text-slate-500 uppercase tracking-widest">FORM:</span>
                              <div className="flex items-center gap-0.5">
                                {matchDetails.match.home_form.map((result, idx) => (
                                  <span
                                    key={idx}
                                    className={`w-4 h-4 flex items-center justify-center rounded-md border text-[8px] font-black font-mono transition-transform hover:scale-115 ${
                                      result === "W"
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-[0_0_4px_rgba(16,185,129,0.15)]"
                                        : result === "D"
                                        ? "bg-amber-500/15 text-amber-500 border-amber-500/25 shadow-[0_0_4px_rgba(245,158,11,0.15)]"
                                        : "bg-rose-500/15 text-rose-400 border-rose-500/25 shadow-[0_0_4px_rgba(239,68,68,0.15)]"
                                    }`}
                                  >
                                    {result}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Giant Digital HUD Scoreboard Card */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <div className="font-mono bg-slate-950 border-2 border-emerald-500/25 px-5 py-3 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] relative">
                        <span className="text-3xl font-black text-slate-100 tracking-tight animate-pulse">{matchDetails.match.home_score}</span>
                        <span className="text-slate-550 text-xl font-bold animate-pulse">:</span>
                        <span className="text-3xl font-black text-slate-100 tracking-tight animate-pulse">{matchDetails.match.away_score}</span>
                      </div>
                      {matchDetails.match.status === "live" && (
                        <span className="text-[8px] font-black uppercase font-mono tracking-widest text-rose-400 mt-2 bg-rose-500/15 border border-rose-500/20 px-2.5 py-0.5 rounded-full animate-bounce">
                          SIMULATOR LIVE • {matchDetails.match.simulation_minute}'
                        </span>
                      )}
                      {matchDetails.match.status === "finished" && (
                        <span className="text-[8px] font-black uppercase font-mono tracking-widest text-slate-400 mt-2 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
                          COMPLETED DEBRIEF
                        </span>
                      )}
                      {matchDetails.match.status === "scheduled" && (
                        <span className="text-[8px] font-black uppercase font-mono tracking-widest text-amber-500 mt-2 bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                          PRE-KICKOFF ANALYSIS
                        </span>
                      )}
                    </div>

                    {/* Away Team profile */}
                    <div 
                      className={`text-center sm:text-right flex-1 p-4 rounded-2xl bg-slate-950/20 border border-slate-850/80 transition-all duration-300 relative group overflow-hidden ${awayColors.borderHover}`}
                      style={{ contentVisibility: "auto" }}
                    >
                      <div className={`absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${awayColors.gradient} blur-xl -z-10`} />
                      <div className="relative z-10 space-y-1">
                        <span className="text-4xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">{getFlagEmoji(matchDetails.match.away_team)}</span>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 font-sans mt-1.5">{matchDetails.match.away_team}</h2>
                        <div className="flex flex-col items-center sm:items-end gap-1">
                          <p className="text-[9px] text-teal-400 font-mono font-bold bg-teal-500/10 border border-teal-500/10 px-2.5 py-0.5 rounded-full inline-block">
                            ELO rating: {matchDetails.match.away_elo}
                          </p>
                          {matchDetails.match.away_form && matchDetails.match.away_form.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5" title="Recent rolling match form (oldest to newest)">
                              <span className="text-[7.5px] font-mono font-black text-slate-500 uppercase tracking-widest">FORM:</span>
                              <div className="flex items-center gap-0.5">
                                {matchDetails.match.away_form.map((result, idx) => (
                                  <span
                                    key={idx}
                                    className={`w-4 h-4 flex items-center justify-center rounded-md border text-[8px] font-black font-mono transition-transform hover:scale-115 ${
                                      result === "W"
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-[0_0_4px_rgba(16,185,129,0.15)]"
                                        : result === "D"
                                        ? "bg-amber-500/15 text-amber-500 border-amber-500/25 shadow-[0_0_4px_rgba(245,158,11,0.15)]"
                                        : "bg-rose-500/15 text-rose-440 border-rose-500/25 shadow-[0_0_4px_rgba(239,68,68,0.15)]"
                                    }`}
                                  >
                                    {result}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              </div>

              {/* Simulation Driver Controllers */}
              <div className="w-full shrink-0 border-t border-slate-800/80 pt-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4.5 h-4.5 text-slate-400" />
                  <div className="text-left">
                    <span className="block text-[8px] text-slate-500 font-mono uppercase font-bold tracking-widest">Atmosphere Murmur Volume</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={crowdVolume} 
                      onChange={(e) => setCrowdVolume(Number(e.target.value))}
                      className="w-24 accent-emerald-500 h-1 bg-slate-950 rounded cursor-pointer"
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 font-bold">{crowdVolume}%</span>
                </div>

                <div className="flex gap-2">
                  {matchDetails.match.status === "scheduled" && (
                    <>
                      <button
                        onClick={() => handleStartSimulation("quick")}
                        disabled={simulating}
                        className="py-2.5 px-4 rounded-xl bg-slate-800/85 hover:bg-slate-750 text-slate-200 border border-slate-750 font-black text-[9px] uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5 shadow"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        Quick sim
                      </button>

                      <button
                        onClick={() => handleStartSimulation("ticking")}
                        disabled={simulating}
                        className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-rose transition cursor-pointer flex items-center gap-1.5 shadow"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Ticking sim
                      </button>
                    </>
                  )}

                  {matchDetails.match.status === "live" && (
                    <div className="animate-pulse bg-emerald-950/40 border border-emerald-500/25 px-4 py-2 rounded-xl flex items-center gap-2 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Poisson simulator running...
                    </div>
                  )}

                  {matchDetails.match.status === "finished" && (
                    <button
                      onClick={() => handleStartSimulation("ticking")}
                      disabled={simulating}
                      className="py-2 px-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-750 border border-slate-755 text-slate-350 text-[9px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Rerun Simulator
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* HALFTIME CRUCIAL PAUSE POPUP MODAL/CARD OVERLAY */}
            {matchDetails.match.status === "live" && matchDetails.match.simulation_minute === 45 && !matchDetails.match.halftime_prediction && (
              <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 border-2 border-amber-500/40 p-6 rounded-2xl space-y-5 shadow-3xl text-center relative overflow-hidden animate-bounce-short">
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl" />
                
                <div className="flex items-center justify-center gap-2 text-amber-400">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                    Mid-Simulation Decision Intercept
                  </span>
                </div>

                <h3 className="text-base font-black text-slate-100 uppercase tracking-wide">
                  🚨 HALFTIME WHISTLE: SPECULATE SECOND HALF DIRECTION
                </h3>
                
                <p className="text-xs text-slate-300 leading-relaxed max-w-[550px] mx-auto">
                  The Poisson Engine has paused at minute 45. Scores stand at <span className="font-bold text-emerald-400">{matchDetails.match.home_team} {matchDetails.match.home_score} - {matchDetails.match.away_score} {matchDetails.match.away_team}</span>. Under international research mandates, configure your prediction below to release the clock and resume simulated ticking.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 max-w-5xl mx-auto text-left">
                  
                  {/* Left option pane: standard index */}
                  <div className="space-y-3 bg-slate-950/30 p-4 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-550 flex items-center gap-1.5">
                      🔮 Option A: Standard Poisson Index Commit
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Commit to one of the traditional statistical outcomes to release the time intercept lock immediately.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <button
                        onClick={() => handleLockHalftimeForecast("over15")}
                        disabled={submittingHT}
                        className="py-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:border-amber-500/40 text-left text-slate-200 hover:text-amber-400 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        ⚽ <span className="truncate">Over 1.5 Second Half Goals</span>
                      </button>

                      <button
                        onClick={() => handleLockHalftimeForecast("under15")}
                        disabled={submittingHT}
                        className="py-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:border-amber-500/40 text-left text-slate-200 hover:text-amber-400 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        🛡️ <span className="truncate">Under 1.5 Second Half Goals</span>
                      </button>

                      <button
                        onClick={() => handleLockHalftimeForecast("homeScoreNext")}
                        disabled={submittingHT}
                        className="py-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:border-amber-500/40 text-left text-slate-200 hover:text-amber-400 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        🔥 <span className="truncate">{matchDetails.match.home_team} will score next</span>
                      </button>

                      <button
                        onClick={() => handleLockHalftimeForecast("awayScoreNext")}
                        disabled={submittingHT}
                        className="py-2 px-3 rounded-lg bg-slate-950 border border-slate-850 hover:border-amber-500/40 text-left text-slate-200 hover:text-amber-400 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        ⚡ <span className="truncate">{matchDetails.match.away_team} will score next</span>
                      </button>
                    </div>
                  </div>

                  {/* Right option pane: custom AI prompt */}
                  <div id="halftime-custom-prompt-container" className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-dashed border-emerald-500/25">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Option B: Custom Gemini Tactical Synthesis
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Submit custom coaching decisions, manager speech adjustments, or situational predictions. Gemini will evaluate the ELO-Poisson balance.
                    </p>

                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={halftimeCustomPrompt}
                        onChange={(e) => setHalftimeCustomPrompt(e.target.value)}
                        placeholder="E.g. Argentina will change to a 4-3-3 high wing-press to search for an equalizer, exploiting space in the half-spaces."
                        className="w-full text-xs font-medium text-slate-200 bg-slate-950 border border-slate-850 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      <div className="flex justify-between items-center gap-2">
                        <button
                          onClick={handleGenerateCustomAnalysis}
                          disabled={analyzingHalftime || !halftimeCustomPrompt.trim()}
                          className="py-2 px-3.5 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {analyzingHalftime ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                              Refining Tactical Deck...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              Consult Gemini Intel
                            </>
                          )}
                        </button>
                        
                        {halftimeCustomAnalysisResult && (
                          <button
                            onClick={() => handleLockHalftimeForecast("over15")}
                            disabled={submittingHT}
                            className="py-2 px-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-md"
                          >
                            Lock & Resume Sim
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Centered evaluation results */}
                {halftimeCustomAnalysisResult && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/90 text-left border border-emerald-500/35 overflow-y-auto max-h-[300px] space-y-3 font-sans text-xs max-w-5xl mx-auto shadow-2xl animate-fade-in">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1 border-b border-slate-800/80 pb-1.5 font-mono">
                      <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                      GEMINI REAL-TIME TACTICAL BLUEPRINT FOR SECOND HALF
                    </div>
                    {halftimeCustomAnalysisResult.split("\n\n").map((chunk, index) => {
                      if (chunk.startsWith("###")) {
                        return (
                          <h4 key={index} className="text-[11px] font-black uppercase text-amber-400 mt-4 border-b border-slate-900 pb-1 font-mono tracking-wider animate-pulse">
                            {chunk.replace("###", "").trim()}
                          </h4>
                        );
                      }
                      return (
                        <p key={index} className="text-slate-200 leading-relaxed pl-1 whitespace-pre-wrap">
                          {chunk}
                        </p>
                      );
                    })}
                  </div>
                )}

                {submittingHT && (
                  <p className="text-[10px] text-amber-500 font-mono animate-pulse">
                    Saving intelligence commitment with the Dixon Coles array...
                  </p>
                )}
              </div>
            )}

            {/* INTERACTIVE VOTING / ANALYST CONSENSUS COMPLIMENT PANEL */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-5 relative">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent" />
              
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                    Public Consensus vs. AI Expectancy Deck
                  </h4>
                </div>
                <span className="text-[8px] font-bold text-slate-500 font-mono bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 uppercase">
                  Prediction Poll
                </span>
              </div>

              {/* Your forecasting sector */}
              <div className="space-y-3 bg-slate-950/60 p-4 border border-slate-850 rounded-2xl">
                <p className="text-[10px] font-extrabold uppercase text-slate-450 tracking-widest font-mono text-center mb-1">
                  Cast Your Forecast Vote (Who is going to win?)
                </p>
                
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleCastVote("home")}
                    disabled={submittingVote}
                    className={`py-2 px-3 rounded-xl text-center border font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      votedChoice === "home"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 scale-[1.03]"
                        : "bg-slate-900/60 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[15px]">{getFlagEmoji(matchDetails.match.home_team)}</span>
                    <span className="text-[9px] uppercase tracking-wider truncate max-w-full">
                      {matchDetails.match.home_team} Win
                    </span>
                  </button>

                  <button
                    onClick={() => handleCastVote("draw")}
                    disabled={submittingVote}
                    className={`py-2 px-3 rounded-xl text-center border font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      votedChoice === "draw"
                        ? "bg-slate-500/15 border-slate-500 text-slate-300 scale-[1.03]"
                        : "bg-slate-900/60 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[15px]">🤝</span>
                    <span className="text-[9px] uppercase tracking-wider truncate max-w-full">
                      Deadlock Draw
                    </span>
                  </button>

                  <button
                    onClick={() => handleCastVote("away")}
                    disabled={submittingVote}
                    className={`py-2 px-3 rounded-xl text-center border font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      votedChoice === "away"
                        ? "bg-teal-500/15 border-teal-500 text-teal-400 scale-[1.03]"
                        : "bg-slate-900/60 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[15px]">{getFlagEmoji(matchDetails.match.away_team)}</span>
                    <span className="text-[9px] uppercase tracking-wider truncate max-w-full">
                      {matchDetails.match.away_team} Win
                    </span>
                  </button>
                </div>
              </div>

              {/* Consensus comparison charts comparing AI vs Public */}
              {matchDetails.match.votes_distribution && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* AI prediction expectations */}
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider font-mono flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      AI expected Win probability
                    </span>

                    <div className="space-y-1.5 pt-1.5">
                      {[
                        { label: matchDetails.match.home_team, val: matchDetails.match.win_probability.home, fill: "bg-emerald-500/80" },
                        { label: "Draw", val: matchDetails.match.win_probability.draw, fill: "bg-slate-600" },
                        { label: matchDetails.match.away_team, val: matchDetails.match.win_probability.away, fill: "bg-teal-500/80" }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[9px] text-slate-400">
                            <span>{item.label}</span>
                            <span className="font-mono font-bold">{(item.val * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full ${item.fill} rounded-full`} style={{ width: `${item.val * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Public Analyst Consensus votes values */}
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider font-mono flex items-center gap-1">
                      <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                      Analyst Collective consensus
                    </span>

                    <div className="space-y-1.5 pt-1.5">
                      {[
                        { label: matchDetails.match.home_team, val: matchDetails.match.votes_distribution.percentages.home, fill: "bg-emerald-500/80" },
                        { label: "Draw", val: matchDetails.match.votes_distribution.percentages.draw, fill: "bg-slate-600" },
                        { label: matchDetails.match.away_team, val: matchDetails.match.votes_distribution.percentages.away, fill: "bg-teal-500/80" }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[9px] text-slate-400">
                            <span>{item.label}</span>
                            <span className="font-mono font-bold">{(item.val * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full ${item.fill} rounded-full`} style={{ width: `${item.val * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Poisson mathematical targets / Interactive Predictive Engine */}
              {(() => {
                const poissonData = getPoissonProbabilities();
                const homeColors = getTeamColors(matchDetails.match.home_team);
                const awayColors = getTeamColors(matchDetails.match.away_team);
                return (
                  <div className="space-y-4 mt-3">
                    {/* CORE WIN PROBABILITY & POISSON MODELING ENGINE CARD */}
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-900/60 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                          <div>
                            <span className="block text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                              Poisson Win Probability Simulator
                            </span>
                            <span className="block text-[7px] text-slate-500 font-mono">
                              DYNAMIC BIVARIATE POISSON CORRELATION ENGINE
                            </span>
                          </div>
                        </div>
                        <span className="text-[7.5px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full font-mono uppercase">
                          Live Solver
                        </span>
                      </div>

                      {/* Expected Goals & Modifier Sliders */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                        {/* Home Slider */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-mono">
                            <span className="text-slate-400 font-bold uppercase truncate max-w-[140px]">{matchDetails.match.home_team} Expected Goals (λ)</span>
                            <span className="text-emerald-400 font-black">{poissonData.expectedGoalsHome.toFixed(2)} xG</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[7px] text-slate-600 font-mono font-bold">MUTED</span>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2.5" 
                              step="0.1"
                              value={poissonHomeAttack} 
                              onChange={(e) => setPoissonHomeAttack(Number(e.target.value))}
                              className="flex-1 accent-emerald-500 h-1 bg-slate-950 rounded cursor-pointer"
                            />
                            <span className="text-[7.5px] font-mono text-emerald-400 font-bold">x{poissonHomeAttack.toFixed(1)}</span>
                          </div>
                          <span className="block text-[6.5px] text-slate-500 font-mono">ADJUST HOME ATTACK MULTIPLIER</span>
                        </div>

                        {/* Away Slider */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-mono">
                            <span className="text-slate-400 font-bold uppercase truncate max-w-[140px]">{matchDetails.match.away_team} Expected Goals (μ)</span>
                            <span className="text-teal-400 font-black">{poissonData.expectedGoalsAway.toFixed(2)} xG</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[7px] text-slate-600 font-mono font-bold font-bold">MUTED</span>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2.5" 
                              step="0.1"
                              value={poissonAwayAttack} 
                              onChange={(e) => setPoissonAwayAttack(Number(e.target.value))}
                              className="flex-1 accent-teal-500 h-1 bg-slate-950 rounded cursor-pointer"
                            />
                            <span className="text-[7.5px] font-mono text-teal-400 font-bold">x{poissonAwayAttack.toFixed(1)}</span>
                          </div>
                          <span className="block text-[6.5px] text-slate-500 font-mono">ADJUST AWAY ATTACK MULTIPLIER</span>
                        </div>
                      </div>

                      {/* Recalculated Win Probability Bars */}
                      <div className="space-y-2">
                        <span className="block text-[8px] font-bold text-slate-450 uppercase tracking-widest font-mono">
                          Simulated Win Probability Results
                        </span>
                        
                        <div className="space-y-2.5">
                          {[
                            { label: matchDetails.match.home_team, val: poissonData.homeWin / 100, fill: "bg-emerald-500/80" },
                            { label: "Draw Likelihood", val: poissonData.draw / 100, fill: "bg-slate-600" },
                            { label: matchDetails.match.away_team, val: poissonData.awayWin / 100, fill: "bg-teal-500/80" }
                          ].map((item, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-[8.5px] text-slate-400">
                                <span className="font-bold uppercase tracking-wider">{item.label}</span>
                                <span className="font-mono font-black text-slate-100">{(item.val * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900-50">
                                <div className={`h-full ${item.fill} rounded-full transition-all duration-300`} style={{ width: `${item.val * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic Score Probability Matrix */}
                      <div className="pt-2 border-t border-slate-900">
                        <span className="block text-[8px] font-bold text-slate-450 uppercase tracking-widest font-mono mb-2">
                          Projected Exact Match Scoreline Likelihoods
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {poissonData.likelyScores.map((scoreObj, idx) => (
                            <div key={idx} className="p-2 bg-slate-900 rounded-lg text-center border border-slate-850/60 hover:border-slate-700 transition">
                              <p className="text-[7px] text-slate-500 font-mono font-bold uppercase">SCORE</p>
                              <p className="text-xs font-black text-slate-200 font-mono mt-0.5">{scoreObj.score}</p>
                              <p className="text-[8px] text-emerald-400 font-mono font-bold mt-0.5">{scoreObj.percentage.toFixed(1)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* PROJECTED PLAYER PERFORMANCE / MAN OF THE MATCH ENGINE */}
                    {(() => {
                      const topPerformers = getProjectedPlayerPerformance();
                      return (
                        <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4" id="projected-player-performance-card">
                          <div className="flex items-center justify-between border-b border-slate-900/60 pb-2.5">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                              <div className="truncate">
                                <span className="block text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                                  Projected Player Performance
                                </span>
                                <span className="block text-[7px] text-slate-500 font-mono truncate">
                                  POISSON-DRAUGHT MAN OF THE MATCH PROBABILITIES
                                </span>
                              </div>
                            </div>
                            <span className="text-[7.5px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full font-mono uppercase shrink-0">
                              MOTM Forecast
                            </span>
                          </div>

                          <div className="space-y-3">
                            {topPerformers.map((player, idx) => (
                              <div key={idx} className="bg-slate-900/40 border border-slate-850/60 p-3 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div 
                                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-mono font-black text-xs text-slate-950 shadow-md relative"
                                    style={{ backgroundColor: player.color }}
                                  >
                                    #{idx + 1}
                                    <span className="absolute -top-1 -right-1 text-[8px]">⭐</span>
                                  </div>
                                  
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-[11px] font-extrabold text-slate-100 truncate font-sans">
                                        {player.name}
                                      </p>
                                      <span className="text-[8px] px-1 py-0.2 rounded bg-slate-955 border border-slate-800 font-mono text-slate-400 font-bold uppercase shrink-0">
                                        {player.role}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-mono truncate">
                                      {player.teamName} • OVR {player.rating}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 space-y-1">
                                  <span className="text-[12.5px] font-mono font-black text-amber-400 block leading-none">
                                    {player.probability}%
                                  </span>
                                  <span className="text-[7.5px] font-mono text-slate-500 block uppercase tracking-wide leading-none">
                                    MOTM CHANCE
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <span className="block text-[7.5px] leading-relaxed text-slate-500 font-mono text-center">
                            Calculated dynamically using localized Poisson Expected Goals and real-time defensive workload modifiers.
                          </span>
                        </div>
                      );
                    })()}

                    {/* D3 TACTICAL INSIGHT NETWORKS AND HEATMAPS */}
                    <TacticalInsight match={matchDetails.match} />

                    {/* KEY PLAYER SIDE-BY-SIDE ANALYST COMPARISON CARD */}
                    {(() => {
                      const homeList = playersByTeam[matchDetails.match.home_team] || [];
                      const awayList = playersByTeam[matchDetails.match.away_team] || [];
                      const hPlayer = homePlayer || homeList[3] || "";
                      const aPlayer = awayPlayer || awayList[3] || "";
                      
                      const radarData = getRadarChartData(hPlayer, aPlayer);
                      const hStats = getPlayerStatsMap(matchDetails.match.home_team, hPlayer);
                      const aStats = getPlayerStatsMap(matchDetails.match.away_team, aPlayer);

                      return (
                        <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-900/60 pb-2.5">
                            <div className="flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-emerald-400" />
                              <div>
                                <span className="block text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                                  Key Player Comparison
                                </span>
                                <span className="block text-[7px] text-slate-500 font-mono">
                                  RADAR METRICS & ATTACK INDEX PROFILES
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Dual selectors */}
                          <div className="grid grid-cols-2 gap-3 pb-1">
                            <div>
                              <label className="block text-[7px] uppercase tracking-widest font-mono font-bold text-slate-500 mb-1">
                                {matchDetails.match.home_team} Performer
                              </label>
                              <div className="relative">
                                <select 
                                  value={hPlayer}
                                  onChange={(e) => setHomePlayer(e.target.value)}
                                  className="w-full text-[9px] bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono font-bold text-slate-250 appearance-none focus:outline-none focus:border-slate-700 cursor-pointer"
                                >
                                  {homeList.map((p, pIdx) => (
                                    <option key={pIdx} value={p}>{p}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[7px] uppercase tracking-widest font-mono font-bold text-slate-500 mb-1">
                                {matchDetails.match.away_team} Performer
                              </label>
                              <div className="relative">
                                <select 
                                  value={aPlayer}
                                  onChange={(e) => setAwayPlayer(e.target.value)}
                                  className="w-full text-[9px] bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono font-bold text-slate-255 appearance-none focus:outline-none focus:border-slate-700 cursor-pointer"
                                >
                                  {awayList.map((p, pIdx) => (
                                    <option key={pIdx} value={p}>{p}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          {/* Radar Chart Visualizer */}
                          <div className="h-[200px] w-full pt-1 flex items-center justify-center relative overflow-hidden bg-slate-900/35 p-2 border border-slate-900 rounded-xl">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#1e293b" />
                                <PolarAngleAxis 
                                  dataKey="subject" 
                                  tick={{ fill: "#64748b", fontSize: 7, fontWeight: "bold" }} 
                                />
                                <PolarRadiusAxis 
                                  angle={30} 
                                  domain={[0, 100]} 
                                  tick={{ fill: "#475569", fontSize: 6 }} 
                                />
                                <Radar 
                                  name={matchDetails.match.home_team} 
                                  dataKey="A" 
                                  stroke="#10b981" 
                                  fill="#10b981" 
                                  fillOpacity={0.25} 
                                />
                                <Radar 
                                  name={matchDetails.match.away_team} 
                                  dataKey="B" 
                                  stroke="#06b6d4" 
                                  fill="#06b6d4" 
                                  fillOpacity={0.25} 
                                />
                                <Tooltip 
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-xl space-y-1 w-44 font-mono text-[9px] backdrop-blur-md">
                                          <p className="font-black uppercase text-amber-400 border-b border-slate-900 pb-1 mb-1 tracking-wider text-[8px]">
                                            ⚡ {label} Metric
                                          </p>
                                          {payload.map((entry: any, index: number) => {
                                            const isHome = entry.dataKey === "A";
                                            const teamName = isHome ? matchDetails.match.home_team : matchDetails.match.away_team;
                                            const playerSelected = isHome ? hPlayer : aPlayer;
                                            const colorClass = isHome ? "text-emerald-400" : "text-cyan-400";
                                            return (
                                              <div key={index} className="flex flex-col border-b border-slate-900/50 pb-1 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-slate-400 font-bold text-[8.5px] truncate max-w-[90px]">{playerSelected}</span>
                                                  <span className={`font-black text-[9.5px] ${colorClass}`}>{entry.value}</span>
                                                </div>
                                                <span className="text-slate-500 text-[6.5px] uppercase tracking-wider">{teamName}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Side by side stats breakdown numbers */}
                          <div className="space-y-1.5 text-[8.5px] font-mono">
                            <div className="flex justify-between items-center text-slate-500 font-bold border-b border-slate-900 pb-1.5 uppercase font-mono tracking-widest text-[7px]">
                              <span>{hPlayer}</span>
                              <span>Performance Metrics</span>
                              <span className="text-right">{aPlayer}</span>
                            </div>
                            
                            {[
                              { label: "Season Goals", valHome: hStats.goals, valAway: aStats.goals },
                              { label: "Season Assists", valHome: hStats.assists, valAway: aStats.assists },
                              { label: "Defensive Actions/Tackles", valHome: hStats.tackles, valAway: aStats.tackles },
                            ].map((row, rowIdx) => (
                              <div key={rowIdx} className="flex justify-between items-center py-1 border-b border-slate-900/50">
                                <span className="font-bold text-slate-200">{row.valHome}</span>
                                <span className="text-slate-400 font-bold text-[7.5px] uppercase">{row.label}</span>
                                <span className="text-right font-bold text-slate-200">{row.valAway}</span>
                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })()}

                    {/* TACTICAL LINEUP VISUALIZER CARD */}
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-amber-400" />
                          <div>
                            <span className="block text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                              Tactical Lineup Visualizer
                            </span>
                            <span className="block text-[7px] text-slate-500 font-mono">
                              INTERACTIVE FORMATION GRID & SUBS BENCH
                            </span>
                          </div>
                        </div>
                        
                        {/* Interactive Toggle for Teams */}
                        <div className="flex bg-slate-900 p-0.5 border border-slate-850 rounded-lg">
                          <button
                            onClick={() => {
                              setPitchTeamToggle("home");
                              setSelectedPitchPlayer(null);
                            }}
                            style={{ 
                              borderColor: pitchTeamToggle === "home" ? getTeamColors(matchDetails.match.home_team).secondary : 'transparent',
                              color: pitchTeamToggle === "home" ? '#fff' : '#64748b' 
                            }}
                            className={`px-2 py-0.5 text-[8px] font-mono font-bold tracking-wider uppercase rounded-md border transition ${
                              pitchTeamToggle === "home" 
                                ? "bg-slate-950 shadow-sm" 
                                : "hover:text-slate-300"
                            }`}
                          >
                            {matchDetails.match.home_team_short || matchDetails.match.home_team}
                          </button>
                          <button
                            onClick={() => {
                              setPitchTeamToggle("away");
                              setSelectedPitchPlayer(null);
                            }}
                            style={{ 
                              borderColor: pitchTeamToggle === "away" ? getTeamColors(matchDetails.match.away_team).secondary : 'transparent',
                              color: pitchTeamToggle === "away" ? '#fff' : '#64748b' 
                            }}
                            className={`px-2 py-0.5 text-[8px] font-mono font-bold tracking-wider uppercase rounded-md border transition  ${
                              pitchTeamToggle === "away" 
                                ? "bg-slate-950 shadow-sm" 
                                : "hover:text-slate-300"
                            }`}
                          >
                            {matchDetails.match.away_team_short || matchDetails.match.away_team}
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const currentTeam = pitchTeamToggle === "home" ? matchDetails.match.home_team : matchDetails.match.away_team;
                        const colors = getTeamColors(currentTeam);
                        const starters = pitchTeamToggle === "home" ? activeLineupHome : activeLineupAway;
                        const subs = pitchTeamToggle === "home" ? activeSubsHome : activeSubsAway;

                        return (
                          <div className="space-y-4">
                            {/* SVG FIELD */}
                            <div className="relative aspect-[4/5] w-full bg-gradient-to-b from-slate-950 to-emerald-950/40 rounded-xl border border-slate-900 overflow-hidden p-2 flex items-center justify-center">
                              {/* Absolute styling lines overlay */}
                              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                                backgroundImage: `radial-gradient(circle at center, transparent 30%, #000000 90%), linear-gradient(to bottom, transparent 50%, rgba(16, 185, 129, 0.1) 100%)`
                              }} />
                              
                              <svg viewBox="0 0 100 100" className="w-full h-full select-none">
                                {/* Defs for gradients or effects */}
                                <defs>
                                  <radialGradient id="fieldGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                                  </radialGradient>
                                </defs>
                                
                                {/* Inner Field color base */}
                                <rect x="0" y="0" width="100" height="100" fill="url(#fieldGlow)" opacity="0.4" />
                                
                                {/* Football Pitch Geometry Lines */}
                                <rect x="4" y="4" width="92" height="92" rx="2" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <line x1="4" y1="50" x2="96" y2="50" stroke="#334155" strokeWidth="0.5" />
                                <circle cx="50" cy="50" r="14" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <circle cx="50" cy="50" r="1.5" fill="#334155" />

                                {/* Top Goal Crease */}
                                <rect x="25" y="4" width="50" height="15" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <rect x="37" y="4" width="26" height="5" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <circle cx="50" cy="13" r="0.5" fill="#334155" />
                                <path d="M 37 19 A 14 14 0 0 0 63 19" fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />

                                {/* Bottom Goal Crease */}
                                <rect x="25" y="81" width="50" height="15" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <rect x="37" y="91" width="26" height="5" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <circle cx="50" cy="87" r="0.5" fill="#334155" />
                                <path d="M 37 81 A 14 14 0 0 1 63 81" fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />

                                {/* Corner Arcs */}
                                <path d="M 4 8 A 4 4 0 0 0 8 4" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <path d="M 96 8 A 4 4 0 0 1 92 4" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <path d="M 4 92 A 4 4 0 0 1 8 96" fill="none" stroke="#334155" strokeWidth="0.5" />
                                <path d="M 96 92 A 4 4 0 0 0 92 96" fill="none" stroke="#334155" strokeWidth="0.5" />

                                {/* Starting Lineup Players coordinates rendering on Pitch */}
                                {starters.map((player) => {
                                  const isSelected = selectedPitchPlayer?.id === player.id;
                                  const isBanned = liveBannedPlayers.some(
                                    (bp) => bp.player_name.toLowerCase() === player.name.toLowerCase()
                                  );

                                  return (
                                    <g
                                      key={player.id}
                                      onClick={() => setSelectedPitchPlayer(player)}
                                      className="cursor-pointer group"
                                    >
                                      {/* Highlight pulse circle */}
                                      {isSelected && (
                                        <circle
                                          cx={player.x}
                                          cy={player.y}
                                          r="5"
                                          fill="none"
                                          stroke={isBanned ? "#ef4444" : "#ffffff"}
                                          strokeWidth="0.75"
                                          className="animate-ping"
                                          style={{ transformOrigin: `${player.x}px ${player.y}px` }}
                                        />
                                      )}

                                      {/* Additional Red Card Halo for banned players */}
                                      {isBanned && (
                                        <circle
                                          cx={player.x}
                                          cy={player.y}
                                          r="4.2"
                                          fill="none"
                                          stroke="#ef4444"
                                          strokeWidth="0.6"
                                          strokeDasharray="1,1"
                                          className="animate-spin"
                                          style={{ transformOrigin: `${player.x}px ${player.y}px`, animationDuration: "8s" }}
                                        />
                                      )}

                                      {/* Player Spot shadow */}
                                      <circle
                                        cx={player.x}
                                        cy={player.y}
                                        r="3.2"
                                        fill="#020617"
                                        opacity="0.6"
                                      />

                                      {/* Player Jersey Spot */}
                                      <circle
                                        cx={player.x}
                                        cy={player.y}
                                        r="2.8"
                                        fill={isBanned ? "#7f1d1d" : colors.primary}
                                        stroke={isSelected ? "#ffffff" : (isBanned ? "#f87171" : colors.secondary)}
                                        strokeWidth={isSelected ? "1" : "0.5"}
                                        className="transition group-hover:scale-110 duration-200"
                                        style={{ transformOrigin: `${player.x}px ${player.y}px` }}
                                      />

                                      {/* Player initials / Number */}
                                      <text
                                        x={player.x}
                                        y={player.y + 0.8}
                                        fontSize="2.2"
                                        fontWeight="900"
                                        textAnchor="middle"
                                        fill={isBanned ? "#fca5a5" : (colors.primary === "#ffffff" ? "#000000" : "#ffffff")}
                                        className="font-sans font-black select-none pointer-events-none"
                                      >
                                        {player.posName}
                                      </text>

                                      {/* Tiny Floating Red Card flag badge next to the marker */}
                                      {isBanned && (
                                        <rect
                                          x={player.x + 1.2}
                                          y={player.y - 4}
                                          width="1.8"
                                          height="2.6"
                                          rx="0.3"
                                          fill="#ef4444"
                                          stroke="#ffffff"
                                          strokeWidth="0.15"
                                          className="animate-bounce"
                                        />
                                      )}

                                      {/* Player Name Tag */}
                                      <rect
                                        x={player.x - 9}
                                        y={player.y + 3.8}
                                        width="18"
                                        height="3.2"
                                        rx="1"
                                        fill={isBanned ? "#450a0a" : "#020617"}
                                        stroke={isSelected ? (isBanned ? "#ef4444" : colors.secondary) : (isBanned ? "#991b1b" : "transparent")}
                                        strokeWidth="0.25"
                                        opacity="0.85"
                                      />
                                      
                                      <text
                                        x={player.x}
                                        y={player.y + 6.1}
                                        fontSize="1.8"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        fill={isBanned ? "#ef4444" : (isSelected ? "#ffffff" : "#cbd5e1")}
                                        className="font-mono tracking-wide"
                                      >
                                        {isBanned ? "⚠️ BANNED" : (player.name.length > 9 ? player.name.substring(0, 8) + "." : player.name)}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>

                            {/* SELECTED PLAYER STATS & LIVE ACTIONS */}
                            <div className="bg-slate-900/40 border border-slate-900/60 p-3 rounded-xl min-h-[110px] flex flex-col justify-between">
                              {selectedPitchPlayer ? (
                                <div className="space-y-3 text-left">
                                  
                                  {/* Real-time Banned player red card alert banner */}
                                  {(() => {
                                    const isPlayerBanned = liveBannedPlayers.some(
                                      (bp) => bp.player_name.toLowerCase() === selectedPitchPlayer.name.toLowerCase()
                                    );
                                    if (!isPlayerBanned) return null;
                                    
                                    return (
                                      <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 rounded-xl flex flex-col gap-2 relative overflow-hidden animate-pulse">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                          <span className="text-[10px] font-black uppercase font-mono tracking-wider text-rose-455">
                                            ⚠️ Disciplinary Ban Active
                                          </span>
                                        </div>
                                        <p className="text-[9px] font-sans leading-relaxed text-slate-300">
                                          <strong>{selectedPitchPlayer.name}</strong> was issued a red card. This slot is penalized. Sub off this player immediately to fill the vacancy!
                                        </p>
                                        {subs.length > 0 && (
                                          <button
                                            onClick={() => {
                                              const sorted = [...subs].sort((a,b) => b.rating - a.rating);
                                              const bestSub = sorted[0];
                                              if (bestSub) {
                                                handleSubstitution(selectedPitchPlayer.id, bestSub.id);
                                              }
                                            }}
                                            className="py-1.5 px-3 bg-red-650 hover:bg-red-550 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                          >
                                            🔧 Use Recommended Sub: {subs.sort((a,b) => b.rating - a.rating)[0].name}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Player Stats banner */}
                                  <div className="flex justify-between items-start border-b border-slate-900 pb-2">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span style={{ backgroundColor: colors.primary, color: colors.primary === "#ffffff" ? "#000" : "#fff" }} className="text-[7.5px] px-1.5 py-0.5 rounded font-black font-mono">
                                          {selectedPitchPlayer.posName}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-100 font-mono">
                                          {selectedPitchPlayer.name}
                                        </span>
                                      </div>
                                      <span className="text-[7px] text-slate-500 font-mono uppercase tracking-wider block mt-0.5">
                                        Current Starting Lineup Performer ({currentTeam})
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="block text-[11px] font-black text-amber-400 font-mono">
                                        {selectedPitchPlayer.rating} OVR
                                      </span>
                                      <span className="block text-[6.5px] text-slate-500 font-mono uppercase">
                                        Season Rating
                                      </span>
                                    </div>
                                  </div>

                                  {/* Detailed Metrics */}
                                  <div className="grid grid-cols-3 gap-1 px-1">
                                    <div className="bg-slate-950/40 border border-slate-900 px-2 py-1.5 rounded-lg text-center">
                                      <span className="block text-[10px] font-black text-slate-200 font-mono">
                                        {selectedPitchPlayer.goals}
                                      </span>
                                      <span className="block text-[6.5px] text-slate-500 font-mono uppercase">
                                        Goals
                                      </span>
                                    </div>
                                    <div className="bg-slate-950/40 border border-slate-900 px-2 py-1.5 rounded-lg text-center">
                                      <span className="block text-[10px] font-black text-slate-200 font-mono">
                                        {selectedPitchPlayer.assists}
                                      </span>
                                      <span className="block text-[6.5px] text-slate-500 font-mono uppercase">
                                        Assists
                                      </span>
                                    </div>
                                    <div className="bg-slate-950/40 border border-slate-900 px-2 py-1.5 rounded-lg text-center">
                                      <span className="block text-[10px] font-black text-slate-200 font-mono">
                                        {selectedPitchPlayer.tackles}
                                      </span>
                                      <span className="block text-[6.5px] text-slate-500 font-mono uppercase">
                                        Tackles
                                      </span>
                                    </div>
                                  </div>

                                  {/* Substitution selector interface */}
                                  <div className="border-t border-slate-900 pt-2.5">
                                    <label className="block text-[7px] uppercase tracking-wider font-mono font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                                      <ArrowLeftRight className="w-2.5 h-2.5 text-amber-500" />
                                      Initiate Live Substitution Board:
                                    </label>
                                    <div className="grid grid-cols-1 gap-1 max-h-[85px] overflow-y-auto pr-0.5">
                                      {subs.map((subPlayer) => (
                                        <button
                                          key={subPlayer.id}
                                          onClick={() => handleSubstitution(selectedPitchPlayer.id, subPlayer.id)}
                                          className="flex justify-between items-center bg-slate-950 border border-slate-850 hover:border-slate-700 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg text-left transition text-[8.5px] font-mono group"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 bg-slate-900 rounded text-slate-400 text-[6.5px] font-bold">
                                              {subPlayer.role}
                                            </span>
                                            <span className="text-slate-200 font-bold group-hover:text-amber-400 transition">
                                              {subPlayer.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[8px] text-slate-500">{subPlayer.rating} OVR</span>
                                            <span className="text-[7px] text-amber-500 font-black group-hover:translate-x-0.5 transition uppercase tracking-wider">
                                              Sub In &rarr;
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-2">
                                  <Users className="w-5 h-5 text-slate-600 animate-pulse" />
                                  <div>
                                    <p className="text-[9px] font-medium text-slate-300 font-sans">
                                      Tactical Inspector Slate
                                    </p>
                                    <p className="text-[7.5px] text-slate-550 font-mono mt-0.5">
                                      CLICK ANY STARTER ON THE SVG GRID ABOVE TO EXPLORE SKILL COMPOSITION, INTERACTION MAPS, OR COMMAND SUB OUT ACTION
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* DISCIPLINARY REGISTER & REPLACEMENTS HISTORICAL LOG */}
                            <div className="mt-2.5 pt-3 border-t border-slate-900 space-y-2.5 text-left">
                              <div className="flex items-center justify-between">
                                <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                  Discipline violations telemetry
                                </span>
                                {liveBannedPlayers.length > 0 && (
                                  <span className="text-[7px] font-black bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded border border-rose-500/25 font-mono uppercase">
                                    {liveBannedPlayers.length} Bans List
                                  </span>
                                )}
                              </div>

                              {liveBannedPlayers.length === 0 ? (
                                <div className="p-3 bg-slate-950/40 border border-slate-900 text-center rounded-xl">
                                  <span className="text-[8.5px] text-slate-550 font-mono italic">
                                    No active red card violations detected for selected team rosters.
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {liveBannedPlayers.map((bp) => {
                                    const replacementName = banReplacements[bp.name];
                                    return (
                                      <div 
                                        key={bp.name}
                                        className={`p-2 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 ${
                                          replacementName 
                                            ? "bg-emerald-950/5 border-emerald-500/20" 
                                            : "bg-red-950/10 border-red-500/15"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-3 bg-red-600 rounded-sm shrink-0" />
                                          <div>
                                            <span className="block text-[8.5px] font-black text-slate-200 font-mono">
                                              {bp.name}
                                            </span>
                                            <span className="block text-[6.5px] text-slate-500 font-mono uppercase">
                                              Red carded at {bp.minute}'
                                            </span>
                                          </div>
                                        </div>

                                        {replacementName ? (
                                          <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-900 text-[7.5px] font-mono">
                                            <span className="text-slate-500">Replaced by:</span>
                                            <span className="text-emerald-400 font-extrabold uppercase">
                                               {replacementName}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between sm:justify-end gap-2.5">
                                            <span className="text-[7.5px] text-rose-455 font-mono font-bold animate-pulse uppercase">
                                              ⚠️ vacancy
                                            </span>
                                            {(() => {
                                              const starterPlayer = starters.find(p => p.name.toLowerCase() === bp.name.toLowerCase());
                                              if (starterPlayer && subs.length > 0) {
                                                const sortedSubs = [...subs].sort((a,b) => b.rating - a.rating);
                                                const best = sortedSubs[0];
                                                return (
                                                  <button
                                                    onClick={() => handleSubstitution(starterPlayer.id, best.id)}
                                                    className="px-2 py-0.5 bg-red-650 hover:bg-rose-500 text-white font-black text-[7px] uppercase rounded transition cursor-pointer"
                                                  >
                                                    Sub In {best.name} &rarr;
                                                  </button>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* HISTORICAL H2H MATCH HISTORY TIMELINE */}
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="block text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                              Historical Match History
                            </span>
                            <span className="block text-[7px] text-slate-500 font-mono">
                              PREVIOUS MATCH RESULTS & CHRONOLOGICAL HEAD-TO-HEAD
                            </span>
                          </div>
                        </div>
                        <span className="text-[7.5px] font-bold text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-full font-mono uppercase">
                          All Meetings
                        </span>
                      </div>

                      {/* Timeline list of previous matches */}
                      <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                        {matchDetails.match.historical_clashes && matchDetails.match.historical_clashes.length > 0 ? (
                          matchDetails.match.historical_clashes.map((clash, cIdx) => {
                            const [hScore, aScore] = clash.score.split("-").map(Number);
                            const homeWon = hScore > aScore;
                            const awayWon = aScore > hScore;
                            const draw = hScore === aScore;

                            return (
                              <div key={cIdx} className="bg-slate-900/60 p-2.5 border border-slate-850/70 rounded-xl relative hover:border-slate-755 transition">
                                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                  {homeWon && (
                                    <span className="text-[6.5px] font-mono font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                      {matchDetails.match.home_team} Win
                                    </span>
                                  )}
                                  {awayWon && (
                                    <span className="text-[6.5px] font-mono font-black uppercase tracking-wider bg-teal-500/15 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded-md">
                                      {matchDetails.match.away_team} Win
                                    </span>
                                  )}
                                  {draw && (
                                    <span className="text-[6.5px] font-mono font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-750 px-1.5 py-0.5 rounded-md">
                                      Draw
                                    </span>
                                  )}
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-[7px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                                    <span>#{clash.meetingNumber}</span>
                                    <span>•</span>
                                    <span>{clash.date}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-black">{clash.stage}</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-100 font-sans pr-16 gap-1.5">
                                    <div className="flex items-center gap-1.5 truncate max-w-[100px]">
                                      <span>{getFlagEmoji(matchDetails.match.home_team)}</span>
                                      <span className={homeWon ? "text-emerald-400 font-black truncate" : "text-slate-200 truncate"}>{matchDetails.match.home_team}</span>
                                    </div>
                                    
                                    <div className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px] font-black shrink-0 text-slate-100">
                                      {clash.score}
                                    </div>

                                    <div className="flex items-center gap-1.5 truncate max-w-[100px] justify-end">
                                      <span className={awayWon ? "text-emerald-450 font-black truncate" : "text-slate-200 truncate"}>{matchDetails.match.away_team}</span>
                                      <span>{getFlagEmoji(matchDetails.match.away_team)}</span>
                                    </div>
                                  </div>

                                  {clash.homeElo && clash.awayElo && (
                                    <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-500 pt-1 border-t border-slate-900/60">
                                      <span>H2H Ratings Index</span>
                                      <span className="font-extrabold text-slate-450">
                                        {clash.homeElo} ELO vs {clash.awayElo} ELO
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 bg-slate-900 rounded-xl text-center text-[9px] text-slate-500 font-mono">
                            No chronological matchup data found
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })()}

            </div>

            {/* 5-MATCH ROLLING FORM HEATMAP AND MOMENTUM ANALYTICS */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                      Rolling Form Heatmap
                    </h4>
                    <p className="text-[8px] text-slate-500 font-sans">5-match rolling velocity & recent match results</p>
                  </div>
                </div>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-[7px] text-slate-400 font-mono font-bold px-1.5 py-0.5 uppercase">
                  Momentum Index
                </div>
              </div>

              {/* Grid: Home and Away Forms with points calculation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Home Team Form momentum */}
                <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-200 uppercase font-mono tracking-wider flex items-center gap-1">
                      <span>{getFlagEmoji(matchDetails.match.home_team)}</span>
                      <span className="truncate max-w-[120px]">{matchDetails.match.home_team}</span>
                    </span>
                    <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Points: {matchDetails.match.home_form ? matchDetails.match.home_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0}
                    </span>
                  </div>

                  {/* Horizontal heat map layout */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {matchDetails.match.home_form?.map((result, idx) => {
                      let desc = result === "W" ? "Win (3 pts)" : result === "D" ? "Draw (1 pt)" : "Loss (0 pts)";
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-center space-y-1 transition duration-200 hover:scale-105 select-none ${
                            result === "W"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                              : result === "D"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-455 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                          }`}
                          title={`Match ${idx + 1}: ${desc}`}
                        >
                          <p className="text-[7px] text-slate-500 font-mono font-bold uppercase">Meet -{5 - idx}</p>
                          <p className="text-sm font-black font-mono">{result}</p>
                          <p className="text-[6px] text-slate-400 font-mono">
                            {result === "W" ? "+3 Pts" : result === "D" ? "+1 Pt" : "0 Pts"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="h-1 bg-slate-900 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-emerald-500 transition-all duration-500" 
                      style={{ 
                        width: `${Math.round(((matchDetails.match.home_form ? matchDetails.match.home_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0) / 15) * 100)}%` 
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[7px] font-mono text-slate-500">
                    <span>MOMENTUM AMPLITUDE</span>
                    <span className="font-bold text-slate-400">
                      {Math.round(((matchDetails.match.home_form ? matchDetails.match.home_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0) / 15) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Away Team Form momentum */}
                <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-200 uppercase font-mono tracking-wider flex items-center gap-1">
                      <span>{getFlagEmoji(matchDetails.match.away_team)}</span>
                      <span className="truncate max-w-[120px]">{matchDetails.match.away_team}</span>
                    </span>
                    <span className="text-[8px] font-mono text-teal-400 font-bold uppercase bg-teal-500/10 px-2 py-0.5 rounded-full">
                      Points: {matchDetails.match.away_form ? matchDetails.match.away_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0}
                    </span>
                  </div>

                  {/* Horizontal heat map layout */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {matchDetails.match.away_form?.map((result, idx) => {
                      let desc = result === "W" ? "Win (3 pts)" : result === "D" ? "Draw (1 pt)" : "Loss (0 pts)";
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-center space-y-1 transition duration-200 hover:scale-105 select-none ${
                            result === "W"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                              : result === "D"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-455 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                          }`}
                          title={`Match ${idx + 1}: ${desc}`}
                        >
                          <p className="text-[7px] text-slate-500 font-mono font-bold uppercase">Meet -{5 - idx}</p>
                          <p className="text-sm font-black font-mono">{result}</p>
                          <p className="text-[6px] text-slate-400 font-mono">
                            {result === "W" ? "+3 Pts" : result === "D" ? "+1 Pt" : "0 Pts"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="h-1 bg-slate-900 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-teal-500 transition-all duration-500" 
                      style={{ 
                        width: `${Math.round(((matchDetails.match.away_form ? matchDetails.match.away_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0) / 15) * 100)}%` 
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[7px] font-mono text-slate-500">
                    <span>MOMENTUM AMPLITUDE</span>
                    <span className="font-bold text-slate-400">
                      {Math.round(((matchDetails.match.away_form ? matchDetails.match.away_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0) / 15) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Composite Form Battle overview */}
              <div className="bg-slate-950 p-3.5 border border-slate-850 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <div className="text-left font-sans">
                    <p className="text-[9px] font-black uppercase text-slate-330 font-mono">Form Clashing Intelligence</p>
                    <p className="text-[8px] text-slate-500">Relative force comparison over past 15 possible points</p>
                  </div>
                </div>

                <div className="w-full sm:w-auto flex items-center justify-end gap-2 text-right">
                  {(() => {
                    const hp = matchDetails.match.home_form ? matchDetails.match.home_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0;
                    const ap = matchDetails.match.away_form ? matchDetails.match.away_form.reduce((sum, res) => sum + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0) : 0;
                    if (hp > ap) {
                      return (
                        <p className="text-[9px] font-mono font-bold text-emerald-450 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                          🔥 {matchDetails.match.home_team.toUpperCase()} HAS BETTER OVERALL MOMENTUM (+{hp - ap} PTS)
                        </p>
                      );
                    } else if (ap > hp) {
                      return (
                        <p className="text-[9px] font-mono font-bold text-teal-450 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">
                          🔥 {matchDetails.match.away_team.toUpperCase()} HAS BETTER OVERALL MOMENTUM (+{ap - hp} PTS)
                        </p>
                      );
                    } else {
                      return (
                        <p className="text-[9px] font-mono font-bold text-amber-450 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          ⚖️ BOTH CLUBS ARE EQUAL IN RECENT MOMENTUM ({hp} PTS)
                        </p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* HALFTIME PROGRESS BRIEF BADGES */}
            {matchDetails.match.halftime_prediction && (
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="block text-[8px] text-slate-500 uppercase font-bold font-mono">Your locked halftime prediction</span>
                    <span className="font-bold text-slate-200">
                      {matchDetails.match.halftime_prediction === "over15" && "Over 1.5 Second Half Goals"}
                      {matchDetails.match.halftime_prediction === "under15" && "Under 1.5 Second Half Goals"}
                      {matchDetails.match.halftime_prediction === "homeScoreNext" && `${matchDetails.match.home_team} score next`}
                      {matchDetails.match.halftime_prediction === "awayScoreNext" && `${matchDetails.match.away_team} score next`}
                    </span>
                  </div>
                </div>

                <div>
                  {matchDetails.match.halftime_prediction_status === "pending" && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider font-mono animate-pulse">
                      Pending 
                    </span>
                  )}
                  {matchDetails.match.halftime_prediction_status === "correct" && (
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1 shadow-glow">
                      🏆 Correct 
                    </span>
                  )}
                  {matchDetails.match.halftime_prediction_status === "incorrect" && (
                    <span className="px-2.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                      Missed
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* OPEN SOURCE CRITICAL NOTIFICATIONS CHANNEL (GEMINI ANALYZED) */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl space-y-3">
              <div className="px-5 py-4 bg-slate-950 border-b border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <span className="block text-[8px] font-extrabold uppercase tracking-widest text-[#10b981] font-mono">
                    Open Source Surveillance Channel
                  </span>
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wide">
                    Live Status Alerts & Gemini Credibility Audit
                  </h4>
                </div>

                <button
                  onClick={handleListenToOpenSources}
                  disabled={fetchingAlert}
                  className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-extrabold text-[9px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow animate-pulse"
                >
                  {fetchingAlert ? "Analyzing alert..." : "📡 Trigger Source Scan"}
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[290px] overflow-y-auto">
                {alerts.length > 0 ? (
                  alerts.map((alert) => {
                    const isCredible = alert.credibility_rating === "Highly Credible";
                    const isSuspicious = alert.credibility_rating === "Suspicious / Unverified";
                    return (
                      <div key={alert.id} className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 relative overflow-hidden transition-all duration-300">
                        {/* Rating Indicator Tag */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[8px] uppercase text-slate-500">
                              Source: {alert.source}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                              isCredible 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                                : isSuspicious 
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/25" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                            }`}>
                              {alert.credibility_rating}
                            </span>
                            <span className="font-mono text-[9px] text-slate-400 font-bold">
                              Score: {alert.credibility_score}%
                            </span>
                          </div>
                        </div>

                        {/* Raw Content Section */}
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-450 italic">"{alert.raw_text}"</p>
                        </div>

                        {/* Rationale and metrics */}
                        <div className="p-2.5 bg-slate-900/60 border border-slate-850 rounded-lg space-y-1">
                          <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
                            <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                            <span>Gemini Credibility Rationale</span>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-relaxed">{alert.gemini_rationale}</p>
                          <p className="text-[9px] text-slate-450 font-mono mt-1 pt-1 border-t border-slate-850/40">
                            <span className="font-bold text-slate-300">Tactical Impact:</span> {alert.estimated_impact}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-5 text-slate-550 space-y-1.5">
                    <Radio className="w-6 h-6 text-slate-700 mx-auto animate-pulse" />
                    <p className="text-[10px] uppercase font-bold tracking-wider font-mono">
                      No active alerts synced
                    </p>
                    <p className="text-[9px] text-slate-600 max-w-[280px] mx-auto">
                      Click "Trigger Source Scan" to instruct Gemini to capture raw internet bulletins and audit their credibility levels.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* PREDICTIVE ANALYTICS: POISSON TREND & ELO SWITCHER WIDGET */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-teal-400" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                      Predictive Poisson Trend Engine
                    </h4>
                    <p className="text-[9px] text-slate-500 font-sans">
                      Side-by-side Poisson expectancy & ELO progression index
                    </p>
                  </div>
                </div>

                {/* Switcher Option Toggles */}
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                  <button
                    onClick={() => setPredictiveTab("outcomes")}
                    className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-wider font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      predictiveTab === "outcomes"
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    <span>🎯 Poisson Probabilities</span>
                  </button>
                  <button
                    onClick={() => setPredictiveTab("elo")}
                    className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-wider font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      predictiveTab === "elo"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-500 hover:text-slate-350 border border-transparent"
                    }`}
                  >
                    <span>⚡ Historical ELO</span>
                  </button>
                </div>
              </div>

              {/* Graphical Plot container */}
              <div className="h-[200px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getPredictiveTrendData()} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="stepLabel" 
                      tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      tick={{ fontSize: 8, fill: '#64748b' }} 
                      domain={predictiveTab === "elo" ? ["auto - 30", "auto + 30"] : [0, 100]}
                      tickFormatter={(val) => predictiveTab === "elo" ? val : `${val}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b' }}
                      itemStyle={{ fontSize: '9px', fontWeight: 'semibold' }}
                      formatter={(val: number, name: string) => {
                        const isHome = name === "home" || name === matchDetails.match.home_team;
                        const label = isHome ? matchDetails.match.home_team : matchDetails.match.away_team;
                        const suffix = predictiveTab === "elo" ? " ELO Points" : "% Goal Expectancy";
                        return [val + suffix, label];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', marginTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey={predictiveTab === "elo" ? "homeElo" : "homePoissonWinProb"} 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6 }}
                      name={`${matchDetails.match.home_team}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={predictiveTab === "elo" ? "awayElo" : "awayPoissonWinProb"} 
                      stroke="#14b8a6" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6 }}
                      name={`${matchDetails.match.away_team}`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Metric explanatory card beneath */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-left font-mono space-y-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {predictiveTab === "outcomes" ? "POI-INDEX: Multi-match attacking trendline" : "ELO-INDEX: Rolling team performance form"}
                  </p>
                  <p className="text-[8px] text-slate-500 leading-normal">
                    {predictiveTab === "outcomes" 
                      ? `Computes the side-by-side math probability of each squad scoring 2+ goals. Observe Poisson expectancy curves peak at step 5 which has the official forecasted outcomes.`
                      : `Demonstrates ELO progression trends modeled over recent matches up to the forecasted fifth step. Higher rating represents structural tactical advantage.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* RIVALRY INTENSITY OVERLAY RADAR CHART */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-5" id="rivalry-intensity-radar-block">
              <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <ArrowLeftRight className="w-4.5 h-4.5 text-emerald-400" />
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                    Rivalry Intensity Index
                  </h4>
                  <p className="text-[9px] text-slate-500 font-sans">
                    Dynamic head-to-head tactical rating comparing {matchDetails.match.home_team} vs {matchDetails.match.away_team}
                  </p>
                </div>
              </div>

              <div className="h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRivalryIntensityData()}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: "bold" }}
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 7, fill: "#475569" }}
                    />
                    <Radar 
                      name={matchDetails.match.home_team} 
                      dataKey={matchDetails.match.home_team} 
                      stroke={matchDetails.match.home_jersey_color || "#10b981"} 
                      fill={matchDetails.match.home_jersey_color || "#10b981"} 
                      fillOpacity={0.25} 
                    />
                    <Radar 
                      name={matchDetails.match.away_team} 
                      dataKey={matchDetails.match.away_team} 
                      stroke={matchDetails.match.away_jersey_color || "#14b8a6"} 
                      fill={matchDetails.match.away_jersey_color || "#14b8a6"} 
                      fillOpacity={0.25} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px" }}
                      itemStyle={{ fontSize: "9px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "9px", marginTop: "10px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-start gap-3">
                <Info className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-left font-mono space-y-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    RIVALRY INTENSITY ANALYSIS MATRIX
                  </p>
                  <p className="text-[8px] text-slate-500 leading-normal">
                    This radar chart overlays crucial head-to-head metrics. Overlapping areas signify tactical parity while peaks highlight localized club advantages like {matchDetails.match.home_team} attacking dominance vs {matchDetails.match.away_team} block setups.
                  </p>
                </div>
              </div>
            </div>

            {/* H2H MULTI-MEETINGS PERFORMANCE TREND GRAPHS (TREND OVER 2, 3, 4, 5, 6 MEETINGS) */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-350 tracking-widest font-mono">
                      Head-to-Head Trend Analytics
                    </h4>
                    <p className="text-[9px] text-slate-500 font-sans hidden sm:block">Historical clashes metrics over past encounters</p>
                  </div>
                </div>

                {/* Left/Right switches: ELO vs Performance vs Scope */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode toggler (Elo ratings / Past performance metrics) */}
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                    <button
                      onClick={() => setH2hGraphTab("elo")}
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        h2hGraphTab === "elo"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Team ELO Trend
                    </button>
                    <button
                      onClick={() => setH2hGraphTab("performance")}
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        h2hGraphTab === "performance"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      <BarChart2 className="w-3 h-3 text-teal-400" />
                      Performance Index
                    </button>
                  </div>

                  {/* Meetings trend limits control (2,3,4,5,6 meetings selector) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-slate-500 font-bold uppercase">Scope:</span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                      {[2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          onClick={() => setMeetingsLimit(num)}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black font-mono transition cursor-pointer ${
                            meetingsLimit === num 
                              ? "bg-slate-800 text-emerald-500 font-extrabold border border-slate-750" 
                              : "text-slate-500 hover:text-slate-350 border border-transparent"
                          }`}
                        >
                          {num}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendering line graph plotting trend performance index or ELO with dual support */}
              <div className="h-[210px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getHistoricalClashesTrends()} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="meetingNumber" 
                      tickFormatter={(num) => `Meet #${num}`}
                      tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      tick={{ fontSize: 8, fill: '#64748b' }} 
                      domain={h2hGraphTab === "elo" ? ["auto - 40", "auto + 40"] : [20, 80]} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b' }}
                      itemStyle={{ fontSize: '9px', fontWeight: 'semibold' }}
                      formatter={(val: number, name: string) => {
                        if (name === "homeElo" || name === `${matchDetails.match.home_team} ELO`) return [val, `${matchDetails.match.home_team} ELO Rating`];
                        if (name === "awayElo" || name === `${matchDetails.match.away_team} ELO`) return [val, `${matchDetails.match.away_team} ELO Rating`];
                        if (name === "homePerformanceIndex") return [val, `${matchDetails.match.home_team} Performance Index`];
                        return [val, `${matchDetails.match.away_team} Performance Index`];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', marginTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey={h2hGraphTab === "elo" ? "homeElo" : "homePerformanceIndex"} 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6 }}
                      name={h2hGraphTab === "elo" ? `${matchDetails.match.home_team} ELO` : "homePerformanceIndex"}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={h2hGraphTab === "elo" ? "awayElo" : "awayPerformanceIndex"} 
                      stroke="#14b8a6" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6 }}
                      name={h2hGraphTab === "elo" ? `${matchDetails.match.away_team} ELO` : "awayPerformanceIndex"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Historical clash results grid for analysts with dynamic indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                {getHistoricalClashesTrends().map((clash, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-2 border border-slate-850 rounded-xl text-center space-y-1 hover:border-slate-700 transition">
                    <p className="text-[7px] text-slate-500 font-mono font-bold uppercase truncate">{clash.stage}</p>
                    <p className="text-xs font-black text-slate-200 font-mono">{clash.score}</p>
                    {h2hGraphTab === "elo" && clash.homeElo && clash.awayElo ? (
                      <p className="text-[7px] text-emerald-400 font-mono font-bold">
                        {clash.homeElo} : {clash.awayElo} ELO
                      </p>
                    ) : (
                      <p className="text-[7px] text-slate-400 font-mono">
                        Idx: {clash.homePerformanceIndex} vs {clash.awayPerformanceIndex}
                      </p>
                    )}
                    <p className="text-[6px] text-slate-600 font-mono">{clash.date.split("-")[0]}</p>
                  </div>
                ))}
              </div>

            </div>

            {/* POST-MATCH DEBRIEF STATS DECK */}
            {matchDetails.match.status === "finished" && (
              <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
                  <Award className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="text-[10px] font-black uppercase text-slate-200 tracking-wider font-mono">
                    Official Match Debrief & Summary
                  </h4>
                </div>

                <div className="space-y-3.5">
                  {/* Possession */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                      <span>{debriefStats.possession.home}% Control</span>
                      <span>Possession Ratio</span>
                      <span>{debriefStats.possession.away}% Control</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${debriefStats.possession.home}%` }} />
                      <div className="h-full bg-teal-500" style={{ width: `${debriefStats.possession.away}%` }} />
                    </div>
                  </div>

                  {/* Total Shots */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                      <span>{debriefStats.shots.home} Shots</span>
                      <span>Attack Volume</span>
                      <span>{debriefStats.shots.away} Shots</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(debriefStats.shots.home / (debriefStats.shots.home + debriefStats.shots.away)) * 100}%` }} />
                      <div className="h-full bg-teal-500" style={{ width: `${(debriefStats.shots.away / (debriefStats.shots.home + debriefStats.shots.away)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Pass Accuracy */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                      <span>{debriefStats.passes.home}% Complete</span>
                      <span>Pass Accuracy</span>
                      <span>{debriefStats.passes.away}% Complete</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${debriefStats.passes.home}%` }} />
                      <div className="h-full bg-teal-500" style={{ width: `${debriefStats.passes.away}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SIMULATED LIVE EVENTS LISTENING FEED */}
            {matchDetails.events && matchDetails.events.length > 0 && (
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-5 py-4 bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase tracking-widest text-[#10b981] font-mono">
                  Poisson Event Sequence Logs
                </div>
                
                <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                  {matchDetails.events.map((ev) => {
                    const isGoal = ev.event_type === "goal";
                    const isCard = ev.event_type.includes("card");
                    return (
                      <div key={ev.id} className="flex gap-3 text-xs border-b border-slate-950 pb-3 last:border-0 hover:bg-slate-950/20 px-2 py-1 rounded-lg transition">
                        <span className="font-mono font-bold text-emerald-400 shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 self-start text-[10px]">
                          {ev.minute}'
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                            {isGoal && "⚽ GOAL!"}
                            {ev.event_type === "yellow_card" && "🟨 YELLOW CARD"}
                            {ev.event_type === "red_card" && "🟥 RED CARD!"}
                            {ev.event_type === "substitution" && "🔄 INFO"}
                            <span className="text-slate-400 font-medium normal-case font-sans">
                              {ev.player_name ? `(${ev.player_name})` : ""}
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{ev.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {/* Unified Sports Analytics Dashboard Headers & Toggles */}
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xs font-black uppercase text-slate-100 tracking-wider font-mono">
                  🏆 KickIQ World Cup Core Hub
                </h2>
                <p className="text-[8px] text-slate-500 font-mono uppercase mt-0.5">
                  PREDICTIVE MODELS & TOURNAMENT ANALYSIS SUITE
                </p>
              </div>

              {/* Sub-Tabs Control */}
              <div className="flex bg-slate-900 p-1 border border-slate-800 rounded-xl max-w-max">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setDashboardCenterTab("overview");
                  }}
                  className={`px-3 py-1.5 text-[8.5px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    dashboardCenterTab === "overview"
                      ? "bg-slate-950 text-emerald-400 border border-slate-850 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setDashboardCenterTab("bracket");
                  }}
                  className={`px-3 py-1.5 text-[8.5px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    dashboardCenterTab === "bracket"
                      ? "bg-slate-950 text-emerald-400 border border-slate-850 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bracket
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setDashboardCenterTab("scorers");
                  }}
                  className={`px-3 py-1.5 text-[8.5px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    dashboardCenterTab === "scorers"
                      ? "bg-slate-950 text-emerald-400 border border-slate-850 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Golden Boot
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setDashboardCenterTab("predictors");
                  }}
                  className={`px-3 py-1.5 text-[8.5px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    dashboardCenterTab === "predictors"
                      ? "bg-slate-950 text-emerald-400 border border-slate-850 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Top Predictors
                </button>
              </div>
            </div>

            {dashboardCenterTab === "overview" && (
              <div className="space-y-6">
                {/* Personalized Config deck */}
                <PersonalizedDashboard
                  user={user}
                  matches={matches}
                  onSelectMatch={onSelectMatch}
                />

                {/* Real-time Scoreboard */}
                <LiveScoreboard
                  onSelectMatch={onSelectMatch}
                  onSelectTeam={(teamName) => {
                    triggerHaptic("medium");
                    setSelectedIntelTeam(teamName);
                  }}
                />

                {/* Featured active predictions */}
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-4">
                  <div>
                    <span className="block text-[10px] font-black uppercase text-amber-400 tracking-wider font-mono">
                      🔥 Live Prediction Decks
                    </span>
                    <span className="block text-[7px] text-slate-500 font-mono mt-0.5 uppercase">
                      CRUNCH POISSON SIMULATIONS FROM GLOBAL VOTING METRICS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches
                      .filter((m) => m.status === "live" || m.status === "scheduled")
                      .slice(0, 2)
                      .map((match) => (
                        <PredictionCard
                          key={match.id}
                          match={match}
                          user={user}
                          onVoteRegistered={(updated) => {
                            if (onRefreshMatches) onRefreshMatches();
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}

            {dashboardCenterTab === "bracket" && (
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl">
                <div className="mb-4">
                  <span className="block text-[10px] font-black uppercase text-teal-400 tracking-wider font-mono">
                    🌳 Interactive Playoff Brackets
                  </span>
                  <span className="block text-[7px] text-slate-500 font-mono mt-0.5 uppercase">
                    VISUALIZE KNOCKOUTS & MATHEMATICAL PROGRESS RATES TO THE FINAL
                  </span>
                </div>
                <TournamentBracket
                  onSelectMatch={onSelectMatch}
                  selectedMatchId={selectedMatch?.id}
                />
              </div>
            )}

            {dashboardCenterTab === "scorers" && (
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl">
                <div className="mb-4">
                  <span className="block text-[10px] font-black uppercase text-emerald-400 tracking-wider font-mono">
                    ⚽ Top Striker Leaderboards
                  </span>
                  <span className="block text-[7px] text-slate-500 font-mono mt-0.5 uppercase">
                    GOLDEN BOOT PROJECTIONS & CODY GAKPO TRANSITION SUCCESS INDEX
                  </span>
                </div>
                <GoldenBootLeaderboard />
              </div>
            )}

            {dashboardCenterTab === "predictors" && (
              <PredictorsLeaderboard 
                user={user} 
                authToken={authToken} 
                onProfileUpdated={onProfileUpdated}
              />
            )}
          </div>
        )}
      </div>

      {/* COLUMN 4: Interactive Dialectic AI Chatbot / AI Insight Sidebar */}
      {isSidebarOpen ? (
        <div className="lg:col-span-1 max-h-[82vh] flex flex-col transition-all duration-300 animate-in slide-in-from-right-10">
          <ChatPanel 
            matchId={selectedMatch?.id} 
            authToken={authToken} 
            externalPrompt={externalPrompt}
            onClearExternalPrompt={() => setExternalPrompt(null)}
            onCollapse={() => {
              triggerHaptic("light");
              setIsSidebarOpen(false);
            }} 
          />
        </div>
      ) : (
        /* FLOATING ACTION TAB TO RE-OPEN AI INSIGHT SIDEBAR */
        <button
          onClick={() => {
            triggerHaptic("light");
            setIsSidebarOpen(true);
          }}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-slate-900 border-l border-y border-emerald-500/30 text-emerald-400 font-mono font-bold text-[10px] py-4 px-2.5 rounded-l-2xl shadow-2xl flex flex-col items-center gap-2.5 hover:bg-slate-850 hover:border-emerald-500 transition-all cursor-pointer group animate-in slide-in-from-right-5 duration-300"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400 group-hover:scale-110 transition" />
          <span className="[writing-mode:vertical-lr] tracking-widest uppercase text-slate-305 font-black">
            AI Insight
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
        </button>
      )}

      {selectedIntelTeam && (
        <TeamIntelligence
          teamName={selectedIntelTeam}
          matches={matches}
          onClose={() => setSelectedIntelTeam(null)}
          onAskAi={(prompt) => {
            setExternalPrompt(prompt);
            setSelectedIntelTeam(null);
          }}
        />
      )}

    </div>
  );
}
