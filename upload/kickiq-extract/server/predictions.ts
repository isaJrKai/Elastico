// KickIQ Mathematical Football Predictions Engine
// Core Models: ELO, Dixon-Coles Poisson with low-score adjustment, Monte Carlo Simulation & Wilson CIs.

export interface MatchPredictions {
  mu_home: number;
  mu_away: number;
  win_probability: {
    home: number;
    draw: number;
    away: number;
  };
  confidence_intervals: {
    home: [number, number];
    draw: [number, number];
    away: [number, number];
  };
  score_grid: { score: string; probability: number }[];
}

// 1. Double/Factorial Helper
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// 2. Poisson Probability Mass Function
export function poissonPmf(k: number, mu: number): number {
  return (Math.exp(-mu) * Math.pow(mu, k)) / factorial(k);
}

// 3. Dixon-Coles Low Score Correction Factor (rho = -0.13)
export function dixonColesCorrection(x: number, y: number, mu_home: number, mu_away: number, rho: number = -0.13): number {
  if (x === 0 && y === 0) {
    return 1 - mu_home * mu_away * rho;
  }
  if (x === 1 && y === 0) {
    return 1 + mu_away * rho;
  }
  if (x === 0 && y === 1) {
    return 1 + mu_home * rho;
  }
  if (x === 1 && y === 1) {
    return 1 - rho;
  }
  return 1;
}

// 4. Calculate Wilson 95% Confidence Interval
// z-score for 95% confidence is 1.96
export function wilsonInterval(p: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.96;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const pivot = (p + z2 / (2 * n)) / denominator;
  const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n)) / denominator;
  return [Math.max(0, pivot - spread), Math.min(1, pivot + spread)];
}

// 5. Compute Full Prediction Profile derived from ELO ratings
export function predictMatch(homeElo: number, awayElo: number, mcIterations: number = 2000): MatchPredictions {
  // ELO difference
  const eloDiff = homeElo - awayElo;

  // Let's derive expected goals based on ELO Difference
  // Base average goals per team = 1.3
  // Home advantage bias adds ~0.15 goals
  // Scaled exponentially using a factor of 800
  const mu_home = Math.max(0.1, 1.3 * Math.pow(Math.E, eloDiff / 800) + 0.15);
  const mu_away = Math.max(0.1, 1.3 * Math.pow(Math.E, -eloDiff / 800));

  // Build Score Probability Grid (10x10)
  const maxGoals = 8;
  const pGrid: number[][] = [];
  let sumP = 0;

  for (let x = 0; x <= maxGoals; x++) {
    pGrid[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const plainPoisson = poissonPmf(x, mu_home) * poissonPmf(y, mu_away);
      const correction = dixonColesCorrection(x, y, mu_home, mu_away);
      const scoreProb = plainPoisson * correction;
      pGrid[x][y] = scoreProb;
      sumP += scoreProb;
    }
  }

  // Normalize grid to support cumulative distribution sampling
  const score_grid: { score: string; probability: number }[] = [];
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      pGrid[x][y] = pGrid[x][y] / sumP;
      score_grid.push({
        score: `${x}-${y}`,
        probability: pGrid[x][y],
      });
    }
  }

  // Sort score grid for dashboard display of most outcome likelihoods
  score_grid.sort((a, b) => b.probability - a.probability);

  // Monte Carlo Simulation using precomputed CDF
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  // Compute 1D CDF vector
  const flatScores: { x: number; y: number; p: number }[] = [];
  let cumSum = 0;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      cumSum += pGrid[x][y];
      flatScores.push({ x, y, p: cumSum });
    }
  }

  for (let i = 0; i < mcIterations; i++) {
    const r = Math.random();
    // Binary search flat CDF for speed with high iterations
    let low = 0;
    let high = flatScores.length - 1;
    let matchIdx = flatScores.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (flatScores[mid].p >= r) {
        matchIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const result = flatScores[matchIdx];
    if (result.x > result.y) homeWins++;
    else if (result.x === result.y) draws++;
    else awayWins++;
  }

  const pHome = homeWins / mcIterations;
  const pDraw = draws / mcIterations;
  const pAway = awayWins / mcIterations;

  return {
    mu_home,
    mu_away,
    win_probability: {
      home: pHome,
      draw: pDraw,
      away: pAway,
    },
    confidence_intervals: {
      home: wilsonInterval(pHome, mcIterations),
      draw: wilsonInterval(pDraw, mcIterations),
      away: wilsonInterval(pAway, mcIterations),
    },
    score_grid: score_grid.slice(0, 10), // Return top 10 scoring outcomes
  };
}

// 6. Generate match event log based on Poisson intensities
export function generateTimelineEvents(
  matchId: number,
  homeTeamId: number,
  awayTeamId: number,
  homePlayers: string[],
  awayPlayers: string[],
  mu_home: number,
  mu_away: number
): { minute: number; event_type: "goal" | "yellow_card" | "red_card" | "substitution"; team_id?: number; player_name: string; description: string }[] {
  const events: any[] = [];
  const cardPlayers = new Set<string>();

  for (let min = 1; min <= 90; min++) {
    const rEvent = Math.random();

    // 1. Home Goal check (mu_home / 90 chance per minute)
    if (rEvent < mu_home / 90) {
      const player = homePlayers[Math.floor(Math.random() * homePlayers.length)];
      events.push({
        minute: min,
        event_type: "goal",
        team_id: homeTeamId,
        player_name: player,
        description: `GOAL! ${player} scores with a majestic effort, driving the home crowd crazy!`,
      });
      continue;
    }

    // 2. Away Goal check (mu_away / 90 chance per minute)
    else if (rEvent < (mu_home + mu_away) / 90) {
      const player = awayPlayers[Math.floor(Math.random() * awayPlayers.length)];
      events.push({
        minute: min,
        event_type: "goal",
        team_id: awayTeamId,
        player_name: player,
        description: `GOAL! Beautiful counter-pressing lead. ${player} finds the back of the net!`,
      });
      continue;
    }

    // 3. Yellow card (1.5% chance per minute)
    const cardChance = Math.random();
    if (cardChance < 0.015) {
      const isHome = Math.random() < 0.5;
      const teamId = isHome ? homeTeamId : awayTeamId;
      const players = isHome ? homePlayers : awayPlayers;
      const player = players[Math.floor(Math.random() * players.length)];

      if (cardPlayers.has(player)) {
        // Double yellow -> Red card!
        events.push({
          minute: min,
          event_type: "red_card",
          team_id: teamId,
          player_name: player,
          description: `RED CARD! Second yellow for ${player} after an aggressive tactical tackle. Sent off!`,
        });
        cardPlayers.delete(player);
      } else {
        events.push({
          minute: min,
          event_type: "yellow_card",
          team_id: teamId,
          player_name: player,
          description: `Yellow Card shown to ${player} for persistent fouling or a reckless challenge.`,
        });
        cardPlayers.add(player);
      }
      continue;
    }

    // 4. Substitution check (2% chance after min 50)
    if (min >= 50 && Math.random() < 0.02) {
      const isHome = Math.random() < 0.5;
      const teamId = isHome ? homeTeamId : awayTeamId;
      const players = isHome ? homePlayers : awayPlayers;
      const subIn = players[Math.floor(Math.random() * players.length)];
      const subOut = `${subIn}'s substitute`;
      events.push({
        minute: min,
        event_type: "substitution",
        team_id: teamId,
        player_name: subIn,
        description: `Tactical Change: ${subIn} enters the pitch to modify team strategy, replacing the tired legs of ${subOut}.`,
      });
      continue;
    }
  }

  // Sort events by minute ascending
  return events.sort((a, b) => a.minute - b.minute);
}
