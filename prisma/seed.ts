import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

// World Cup 2026 Teams
const teams = [
  { name: 'United States', code: 'USA', group: 'A', primaryColor: '#002868', secondaryColor: '#BF0A30', coachName: 'Mauricio Pochettino', style: 'attacking', xgPerGame: 1.45, xgaPerGame: 0.95, possession: 55, passAccuracy: 84, pressIntensity: 62, eloRating: 1660, rank: 13 },
  { name: 'Mexico', code: 'MEX', group: 'A', primaryColor: '#006847', secondaryColor: '#FFFFFF', coachName: 'Javier Aguirre', style: 'balanced', xgPerGame: 1.30, xgaPerGame: 1.10, possession: 52, passAccuracy: 82, pressIntensity: 58, eloRating: 1640, rank: 15 },
  { name: 'Brazil', code: 'BRA', group: 'D', primaryColor: '#009C3B', secondaryColor: '#FFDF00', coachName: 'Dorival Junior', style: 'attacking', xgPerGame: 1.80, xgaPerGame: 0.85, possession: 58, passAccuracy: 86, pressIntensity: 65, eloRating: 1840, rank: 5 },
  { name: 'Argentina', code: 'ARG', group: 'B', primaryColor: '#75AADB', secondaryColor: '#FFFFFF', coachName: 'Lionel Scaloni', style: 'balanced', xgPerGame: 1.75, xgaPerGame: 0.80, possession: 57, passAccuracy: 85, pressIntensity: 63, eloRating: 1910, rank: 1 },
  { name: 'France', code: 'FRA', group: 'C', primaryColor: '#002395', secondaryColor: '#ED2939', coachName: 'Didier Deschamps', style: 'balanced', xgPerGame: 1.70, xgaPerGame: 0.82, possession: 56, passAccuracy: 85, pressIntensity: 64, eloRating: 1870, rank: 2 },
  { name: 'England', code: 'ENG', group: 'C', primaryColor: '#FFFFFF', secondaryColor: '#CF081F', coachName: 'Thomas Tuchel', style: 'attacking', xgPerGame: 1.65, xgaPerGame: 0.88, possession: 58, passAccuracy: 87, pressIntensity: 66, eloRating: 1850, rank: 4 },
  { name: 'Spain', code: 'ESP', group: 'B', primaryColor: '#C60B1E', secondaryColor: '#FFC400', coachName: 'Luis de la Fuente', style: 'attacking', xgPerGame: 1.85, xgaPerGame: 0.75, possession: 62, passAccuracy: 89, pressIntensity: 68, eloRating: 1890, rank: 3 },
  { name: 'Germany', code: 'GER', group: 'A', primaryColor: '#000000', secondaryColor: '#DD0000', coachName: 'Julian Nagelsmann', style: 'attacking', xgPerGame: 1.72, xgaPerGame: 0.90, possession: 60, passAccuracy: 87, pressIntensity: 67, eloRating: 1830, rank: 6 },
  { name: 'Portugal', code: 'POR', group: 'D', primaryColor: '#006600', secondaryColor: '#FF0000', coachName: 'Roberto Martinez', style: 'attacking', xgPerGame: 1.68, xgaPerGame: 0.87, possession: 58, passAccuracy: 86, pressIntensity: 64, eloRating: 1820, rank: 7 },
  { name: 'Netherlands', code: 'NED', group: 'D', primaryColor: '#FF6600', secondaryColor: '#FFFFFF', coachName: 'Ronald Koeman', style: 'balanced', xgPerGame: 1.60, xgaPerGame: 0.92, possession: 56, passAccuracy: 85, pressIntensity: 62, eloRating: 1790, rank: 8 },
  { name: 'Italy', code: 'ITA', group: 'B', primaryColor: '#0066CC', secondaryColor: '#FFFFFF', coachName: 'Luciano Spalletti', style: 'defensive', xgPerGame: 1.50, xgaPerGame: 0.78, possession: 54, passAccuracy: 84, pressIntensity: 60, eloRating: 1770, rank: 9 },
  { name: 'Japan', code: 'JPN', group: 'C', primaryColor: '#000080', secondaryColor: '#FFFFFF', coachName: 'Hajime Moriyasu', style: 'balanced', xgPerGame: 1.35, xgaPerGame: 1.05, possession: 52, passAccuracy: 83, pressIntensity: 65, eloRating: 1680, rank: 14 },
  { name: 'South Korea', code: 'KOR', group: 'C', primaryColor: '#CD2E3A', secondaryColor: '#0047A0', coachName: 'Hong Myung-bo', style: 'balanced', xgPerGame: 1.25, xgaPerGame: 1.15, possession: 50, passAccuracy: 81, pressIntensity: 63, eloRating: 1650, rank: 16 },
  { name: 'Canada', code: 'CAN', group: 'A', primaryColor: '#FF0000', secondaryColor: '#FFFFFF', coachName: 'Mauro Biello', style: 'balanced', xgPerGame: 1.20, xgaPerGame: 1.20, possession: 48, passAccuracy: 80, pressIntensity: 60, eloRating: 1610, rank: 18 },
  { name: 'Australia', code: 'AUS', group: 'B', primaryColor: '#FFCD00', secondaryColor: '#00843D', coachName: 'Tony Popovic', style: 'balanced', xgPerGame: 1.18, xgaPerGame: 1.25, possession: 47, passAccuracy: 79, pressIntensity: 61, eloRating: 1590, rank: 22 },
  { name: 'Uruguay', code: 'URU', group: 'D', primaryColor: '#5CBFEB', secondaryColor: '#001489', coachName: 'Marcelo Bielsa', style: 'defensive', xgPerGame: 1.40, xgaPerGame: 0.90, possession: 50, passAccuracy: 82, pressIntensity: 64, eloRating: 1750, rank: 11 },
]

// Sample matches
const matches = [
  // Group A
  { homeTeamCode: 'USA', awayTeamCode: 'CAN', stage: 'Group Stage', group: 'A', date: new Date('2026-06-11T18:00:00Z') },
  { homeTeamCode: 'MEX', awayTeamCode: 'GER', stage: 'Group Stage', group: 'A', date: new Date('2026-06-11T21:00:00Z') },
  { homeTeamCode: 'GER', awayTeamCode: 'USA', stage: 'Group Stage', group: 'A', date: new Date('2026-06-17T18:00:00Z') },
  { homeTeamCode: 'CAN', awayTeamCode: 'MEX', stage: 'Group Stage', group: 'A', date: new Date('2026-06-17T21:00:00Z') },
  // Group B
  { homeTeamCode: 'ARG', awayTeamCode: 'ITA', stage: 'Group Stage', group: 'B', date: new Date('2026-06-12T18:00:00Z') },
  { homeTeamCode: 'ESP', awayTeamCode: 'AUS', stage: 'Group Stage', group: 'B', date: new Date('2026-06-12T21:00:00Z') },
  // Group C
  { homeTeamCode: 'FRA', awayTeamCode: 'KOR', stage: 'Group Stage', group: 'C', date: new Date('2026-06-13T18:00:00Z') },
  { homeTeamCode: 'ENG', awayTeamCode: 'JPN', stage: 'Group Stage', group: 'C', date: new Date('2026-06-13T21:00:00Z') },
  // Group D
  { homeTeamCode: 'BRA', awayTeamCode: 'URU', stage: 'Group Stage', group: 'D', date: new Date('2026-06-14T18:00:00Z') },
  { homeTeamCode: 'POR', awayTeamCode: 'NED', stage: 'Group Stage', group: 'D', date: new Date('2026-06-14T21:00:00Z') },
]

// Sample news
const news = [
  { title: 'Argentina confirmed as World Cup 2026 top seeds', summary: 'Following their Copa America triumph, Argentina retains the #1 spot in FIFA rankings.', category: 'match', isBreaking: true, sentiment: 'positive', source: 'FIFA.com' },
  { title: 'Brazil announce final 26-man squad', summary: 'Dorival Junior has named his squad with several surprise inclusions from the Brazilian league.', category: 'transfer', isBreaking: false, sentiment: 'neutral', source: 'Globo Esporte' },
  { title: 'England vs Japan preview: Tactical breakdown', summary: 'Tuchel faces his biggest test as England manager against a technically gifted Japan side.', category: 'tactical', isBreaking: false, sentiment: 'neutral', source: 'ELASTICO Analysis' },
  { title: 'USA-Mexico rivalry renewed in World Cup opener', summary: 'The CONCACAF giants meet on the biggest stage in what promises to be a fiery Group A encounter.', category: 'match', isBreaking: true, sentiment: 'positive', source: 'ESPN FC' },
  { title: 'Key injuries ahead of the tournament', summary: 'Several star players are racing against time to be fit for the World Cup kickoff.', category: 'injury', isBreaking: false, sentiment: 'negative', source: 'The Athletic' },
]

async function main() {
  console.log('Seeding ELASTICO database...')

  // Create admin user (password: admin123)
  const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex')
  const admin = await db.user.upsert({
    where: { email: 'admin@elastico.app' },
    update: {},
    create: {
      email: 'admin@elastico.app',
      passwordHash,
      name: 'ELASTICO Admin',
      displayName: 'Admin',
      role: 'admin',
      plan: 'elite',
      predictionAccuracy: 0,
      loginCount: 0,
    },
  })
  console.log(`  Admin user created: admin@elastico.app`)

  // Create demo user (password: demo123)
  const demoHash = crypto.createHash('sha256').update('demo123').digest('hex')
  const demo = await db.user.upsert({
    where: { email: 'demo@elastico.app' },
    update: {},
    create: {
      email: 'demo@elastico.app',
      passwordHash: demoHash,
      name: 'Demo User',
      displayName: 'Demo',
      role: 'user',
      plan: 'free',
      loginCount: 0,
    },
  })
  console.log(`  Demo user created: demo@elastico.app`)

  // Create teams
  const teamMap = new Map<string, string>()
  for (const t of teams) {
    const team = await db.team.upsert({
      where: { code: t.code },
      update: { ...t, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
      create: { ...t, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    })
    teamMap.set(t.code, team.id)
    console.log(`  Team: ${t.name} (${t.code})`)
  }

  // Create matches
  for (const m of matches) {
    const homeId = teamMap.get(m.homeTeamCode)!
    const awayId = teamMap.get(m.awayTeamCode)!

    // Generate ELO-based probabilities
    const homeTeam = teams.find(t => t.code === m.homeTeamCode)!
    const awayTeam = teams.find(t => t.code === m.awayTeamCode)!
    const eloDiff = homeTeam.eloRating - awayTeam.eloRating
    const homeWinProb = 1 / (1 + Math.pow(10, -eloDiff / 400))
    const drawProb = 0.26
    const awayWinProb = 1 - homeWinProb - drawProb

    await db.match.create({
      data: {
        homeTeamId: homeId,
        awayTeamId: awayId,
        stage: m.stage,
        group: m.group,
        date: m.date,
        status: 'upcoming',
        homeWinProb: Math.round(homeWinProb * 1000) / 1000,
        drawProb: Math.round(drawProb * 1000) / 1000,
        awayWinProb: Math.round(awayWinProb * 1000) / 1000,
        homeEloBefore: homeTeam.eloRating,
        awayEloBefore: awayTeam.eloRating,
      },
    })
    console.log(`  Match: ${m.homeTeamCode} vs ${m.awayTeamCode}`)
  }

  // Create news
  for (const n of news) {
    await db.newsItem.create({
      data: {
        ...n,
        publishedAt: new Date(),
      },
    })
  }
  console.log(`  ${news.length} news articles created`)

  // Create system settings
  await db.systemSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    create: { key: 'site_name', value: 'ELASTICO', type: 'string' },
  })
  await db.systemSetting.upsert({
    where: { key: 'prediction_engine' },
    update: {},
    create: { key: 'prediction_engine', value: 'ensemble', type: 'string' },
  })

  console.log('\nSeed complete! Login with admin@elastico.app / admin123')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())