export interface User {
  id: number;
  email?: string;
  phone?: string;
  display_name: string;
  avatar_url?: string;
  auth_provider: "email" | "google" | "sms";
  role: "user" | "admin";
  plan: "free" | "pro" | "elite";
  free_match_used: boolean;
}

export interface Team {
  id: number;
  name: string;
  country: string;
  elo_rating: number;
}

export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  date: string;
  stadium: string;
  stage: string;
  status: "scheduled" | "live" | "finished";
  home_score: number;
  away_score: number;
  simulation_minute: number;
  home_team: string;
  away_team: string;
  home_crest?: string;
  away_crest?: string;
  home_elo: number;
  away_elo: number;
  home_jersey_color?: string;
  away_jersey_color?: string;
  win_probability: {
    home: number;
    draw: number;
    away: number;
  };
  mu_home: number;
  mu_away: number;
  confidence_intervals: {
    home: [number, number];
    draw: [number, number];
    away: [number, number];
  };
  score_grid: { score: string; probability: number }[];
  votes_distribution?: {
    home: number;
    draw: number;
    away: number;
    total: number;
    percentages: {
      home: number;
      draw: number;
      away: number;
    };
  };
  voted_users?: Record<string, "home" | "draw" | "away">;
  halftime_prediction?: "over15" | "homeScoreNext" | "awayScoreNext" | "under15";
  halftime_prediction_status?: "pending" | "correct" | "incorrect";
  halftime_custom_prompt?: string;
  halftime_custom_analysis?: string;
  home_form?: ("W" | "D" | "L")[];
  away_form?: ("W" | "D" | "L")[];
  historical_clashes?: {
    meetingNumber: number;
    date: string;
    stage: string;
    score: string;
    homeScore: number;
    awayScore: number;
    goalDifference: number;
    homePerformanceIndex: number;
    awayPerformanceIndex: number;
    homeElo?: number;
    awayElo?: number;
  }[];
}

export interface MatchEvent {
  id: number;
  match_id: number;
  minute: number;
  event_type: "goal" | "yellow_card" | "red_card" | "substitution";
  team_id?: number;
  player_name?: string;
  description: string;
  created_at: string;
}

export interface ApiLog {
  id: number;
  user_id?: number | null;
  endpoint: string;
  method: string;
  status: number;
  ip: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
  email?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface LineupPlayer {
  id: string;
  name: string;
  role: "GK" | "DEF" | "MID" | "FWD";
  posName: string;
  rating: number;
  x: number;
  y: number;
  goals: number;
  assists: number;
  tackles: number;
}

