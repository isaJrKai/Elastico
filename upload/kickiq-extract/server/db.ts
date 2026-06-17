import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// Database File Path
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "worldcup_db.json");

export interface User {
  id: number;
  email?: string;
  phone?: string;
  password?: string;
  google_id?: string;
  display_name: string;
  avatar_url?: string;
  auth_provider: "email" | "google" | "sms";
  role: "user" | "admin";
  plan: "free" | "pro" | "elite";
  free_match_used: number; // 0 or 1
  is_active: number; // 0 or 1
  created_at: string;
  last_login?: string;
  session_id?: string; // Add session_id for active concurrent logins protection
  is_bypass_active?: number; // 0 or 1
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  whatsapp_link?: string;
  telegram_link?: string;
}

export interface OtpCode {
  id: number;
  phone: string;
  code: string;
  purpose: "register" | "login" | "reset";
  expires_at: string;
  used: number; // 0 or 1
  created_at: string;
}

export interface PasswordReset {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used: number; // 0 or 1
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  country: string;
  elo_rating: number;
  crest_url?: string;
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
  votes_home?: number;
  votes_draw?: number;
  votes_away?: number;
  voted_users?: Record<string, "home" | "draw" | "away">;
  halftime_prediction?: "over15" | "homeScoreNext" | "awayScoreNext" | "under15";
  halftime_prediction_status?: "pending" | "correct" | "incorrect";
  halftime_custom_prompt?: string;
  halftime_custom_analysis?: string;
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

export interface Player {
  id: number;
  name: string;
  team_id: number;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
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
}

export interface AppSettings {
  admin_email: string;
  game_speed_multiplier: number;
  allow_registrations: boolean;
  maintenance_mode: boolean;
  ai_continuous_learning: boolean;
  ai_learning_rate: number;
}

// Full DB State Structure
interface DBState {
  users: User[];
  otp_codes: OtpCode[];
  password_resets: PasswordReset[];
  teams: Team[];
  matches: Match[];
  match_events: MatchEvent[];
  players: Player[];
  api_logs: ApiLog[];
  whitelisted_free_emails: string[];
  settings?: AppSettings;
  simulation_trials?: Record<string, string[]>;
  failed_logins?: Record<string, { attempts: number; locked_at?: string }>;
}

class JSONDatabase {
  private state: DBState = {
    users: [],
    otp_codes: [],
    password_resets: [],
    teams: [],
    matches: [],
    match_events: [],
    players: [],
    api_logs: [],
    whitelisted_free_emails: [],
    simulation_trials: {},
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        this.state = JSON.parse(fileContent);
        if (!this.state.whitelisted_free_emails) {
          this.state.whitelisted_free_emails = [];
        }
      } else {
        this.seed();
        this.save();
      }
      if (!this.state.settings) {
        this.state.settings = {
          admin_email: "kaisoisaac@gmail.com",
          game_speed_multiplier: 1.0,
          allow_registrations: true,
          maintenance_mode: false,
          ai_continuous_learning: true,
          ai_learning_rate: 0.15,
        };
      }
      if (this.state.settings.ai_continuous_learning === undefined) {
        this.state.settings.ai_continuous_learning = true;
      }
      if (this.state.settings.ai_learning_rate === undefined) {
        this.state.settings.ai_learning_rate = 0.15;
      }
      this.ensureRequiredAccounts();
    } catch (err) {
      console.error("[db] Initialization failed, using in-memory state", err);
      this.seed();
    }
  }

  private ensureRequiredAccounts() {
    // 1. Ensure the root admin exists based on custom settings state
    const adminEmail = "kaisoisaac@gmail.com";
    if (this.state.settings) {
      this.state.settings.admin_email = "kaisoisaac@gmail.com";
    }
    let admin = this.state.users.find((u) => u.email?.toLowerCase() === adminEmail);
    if (!admin) {
      const adminPassRaw = process.env.ADMIN_SECRET || "adminSecret123!";
      const hashed = bcrypt.hashSync(adminPassRaw, 10);
      const newId = this.state.users.length > 0 ? Math.max(...this.state.users.map((u) => u.id)) + 1 : 1;
      this.state.users.push({
        id: newId,
        email: adminEmail,
        password: hashed,
        display_name: "Isaac (Admin)",
        auth_provider: "email",
        role: "admin",
        plan: "elite",
        free_match_used: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
        is_bypass_active: 1,
      });
    } else {
      admin.role = "admin";
      admin.plan = "elite";
    }

    // Downgrade any other users with role === "admin" who are NOT kaisoisaac@gmail.com
    this.state.users.forEach((u) => {
      if (u.role === "admin" && u.email?.toLowerCase() !== adminEmail) {
        u.role = "user";
        u.plan = "free";
      }
    });

    // 2. Ensure the bypass premium mockup account exists so they DO NOT log into the admin account
    const bypassEmail = "analyst.pro@kickiq.ai";
    let bypassUser = this.state.users.find((u) => u.email?.toLowerCase() === bypassEmail);
    if (!bypassUser) {
      const bypassPassRaw = "KickIQ_Pro_2026!";
      const hashed = bcrypt.hashSync(bypassPassRaw, 10);
      const newId = this.state.users.length > 0 ? Math.max(...this.state.users.map((u) => u.id)) + 1 : 1;
      this.state.users.push({
        id: newId,
        email: bypassEmail,
        password: hashed,
        display_name: "Pro Analyst Team",
        auth_provider: "email",
        role: "user", // CRITICAL: This is set to "user" so they CANNOT access Admin sessions
        plan: "elite", // CRITICAL: Elite access to unlock predictions / brackets / Golden Boot
        free_match_used: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      });
    } else {
      // Hard enforce safety boundaries so even if altered, they can't sneak admin privileges
      bypassUser.role = "user";
      bypassUser.plan = "elite";
    }
    this.save();
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (err) {
      console.error("[db] Save failure", err);
    }
  }

  // Pure state getters for queries
  public get settings(): AppSettings {
    if (!this.state.settings) {
      this.state.settings = {
        admin_email: "kaisoisaac@gmail.com",
        game_speed_multiplier: 1.0,
        allow_registrations: true,
        maintenance_mode: false,
        ai_continuous_learning: true,
        ai_learning_rate: 0.15,
      };
    }
    return this.state.settings;
  }

  public updateSettings(newSettings: Partial<AppSettings>) {
    const current = this.settings;
    this.state.settings = {
      ...current,
      ...newSettings,
    };
    this.ensureRequiredAccounts();
  }

  public get users() { return this.state.users; }
  public get otp_codes() { return this.state.otp_codes; }
  public get password_resets() { return this.state.password_resets; }
  public get teams() { return this.state.teams; }
  public get matches() { return this.state.matches; }
  public get match_events() { return this.state.match_events; }
  public get players() { return this.state.players; }
  public get api_logs() { return this.state.api_logs; }
  public get whitelisted_free_emails() { return this.state.whitelisted_free_emails; }
  public get simulation_trials(): Record<string, string[]> {
    if (!this.state.simulation_trials) {
      this.state.simulation_trials = {};
    }
    return this.state.simulation_trials;
  }

  public get failed_logins(): Record<string, { attempts: number; locked_at?: string }> {
    if (!this.state.failed_logins) {
      this.state.failed_logins = {};
    }
    return this.state.failed_logins;
  }

  // Seed Helper
  private seed() {
    console.log("[db] Seeding new World Cup 2026 database...");
    
    // 1. Seed Teams
    const teamsData: Omit<Team, "id">[] = [
      { name: "Brazil", country: "Brazil", elo_rating: 1850 },
      { name: "Germany", country: "Germany", elo_rating: 1780 },
      { name: "Argentina", country: "Argentina", elo_rating: 1820 },
      { name: "France", country: "France", elo_rating: 1800 },
      { name: "England", country: "England", elo_rating: 1750 },
      { name: "Spain", country: "Spain", elo_rating: 1770 },
      { name: "Portugal", country: "Portugal", elo_rating: 1720 },
      { name: "Netherlands", country: "Netherlands", elo_rating: 1700 },
    ];
    
    this.state.teams = teamsData.map((t, idx) => ({ ...t, id: idx + 1 }));

    // 2. Seed Players
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

    let pId = 1;
    this.state.teams.forEach((team) => {
      const names = playersByTeam[team.name] || [];
      names.forEach((pName, pIdx) => {
        let pos: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" = "Forward";
        if (pIdx === 0) pos = "Goalkeeper";
        else if (pIdx === 1) pos = "Defender";
        else if (pIdx === 2) pos = "Midfielder";

        this.state.players.push({
          id: pId++,
          name: pName,
          team_id: team.id,
          position: pos,
        });
      });
    });

    // 3. Seed Matches
    const matchData: Omit<Match, "id" | "home_score" | "away_score" | "simulation_minute" | "status">[] = [
      { home_team_id: 1, away_team_id: 4, date: "2026-06-12 16:00", stadium: "Estadio Azteca", stage: "Group Stage" },
      { home_team_id: 2, away_team_id: 3, date: "2026-06-13 16:00", stadium: "MetLife Stadium", stage: "Group Stage" },
      { home_team_id: 5, away_team_id: 6, date: "2026-06-14 20:00", stadium: "SoFi Stadium", stage: "Group Stage" },
      { home_team_id: 7, away_team_id: 8, date: "2026-06-15 18:00", stadium: "AT&T Stadium", stage: "Group Stage" },
    ];

    this.state.matches = matchData.map((m, idx) => {
      // Seed pre-cast analyst mock votes for exciting visualizations
      const votes_home = Math.floor(25 + Math.random() * 50);
      const votes_draw = Math.floor(10 + Math.random() * 25);
      const votes_away = Math.floor(15 + Math.random() * 40);
      return {
        ...m,
        id: idx + 1,
        status: "scheduled",
        home_score: 0,
        away_score: 0,
        simulation_minute: 0,
        votes_home,
        votes_draw,
        votes_away,
        voted_users: {},
      };
    });

    // 4. Create Default Admin User
    const adminEmail = "kaisoisaac@gmail.com";
    const adminPassRaw = process.env.ADMIN_SECRET || "adminSecret123!";
    const hashed = bcrypt.hashSync(adminPassRaw, 10);

    this.state.users.push({
      id: 1,
      email: adminEmail,
      password: hashed,
      display_name: "Isaac (Admin)",
      auth_provider: "email",
      role: "admin",
      plan: "elite",
      free_match_used: 0,
      is_active: 1,
      created_at: new Date().toISOString(),
      is_bypass_active: 1,
    });
    this.state.whitelisted_free_emails.push("kaisoisaac@gmail.com");
  }
}

export const db = new JSONDatabase();
