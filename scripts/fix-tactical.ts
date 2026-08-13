// Script to read tactical-view, identify the old tabs block, and write the new version
import * as fs from 'fs'

const filePath = '/home/z/my-project/elastico-work/Elastico-main/src/components/elastico/tactical-view.tsx'
let content = fs.readFileSync(filePath, 'utf-8')

// Find the pressing tab start and AI insight tab end
const pressingStart = content.indexOf(`        {/* 2. Pressing Intensity Heatmap */`)
const aiInsightEnd = content.indexOf(`      </Tabs>\n    </motion.div>`) + `      </Tabs>\n    </motion.div>`.length

if (pressingStart === -1) {
  console.error('Could not find pressing tab start')
  process.exit(1)
}
if (aiInsightEnd === -1) {
  console.error('Could not find Tabs closing')
  process.exit(1)
}

console.log(`Found pressing at ${pressingStart}, tabs end at ${aiInsightEnd}`)
console.log(`File length: ${content.length}`)

// The new tabs content
const newTabs = `        {/* 2. Pressing Intensity Heatmap */
        <TabsContent value="pressing">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="size-4 text-red-400" /> Pressing Intensity Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <Flame className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Pressing intensity data is not available for this match.</p>
                <p className="text-xs text-muted-foreground mt-1">This requires event-level pressure data (e.g. StatsBomb events with under_pressure flags). Select a StatsBomb-covered match in the Shot Map tab.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Pass Network */}
        <TabsContent value="passing">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-primary" /> Pass Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <ArrowRightLeft className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Pass network data is not available for this match.</p>
                <p className="text-xs text-muted-foreground mt-1">This requires event-level pass data with start/end coordinates. StatsBomb covers this for historical tournament matches — a future version will wire this data source.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. xG Timeline — computed from real StatsBomb shot data when available */}
        <TabsContent value="xg">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Expected Goals (xG) Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sbShots.length > 0 && sbShotMeta ? (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sbShots.reduce((acc: Array<{minute: number; home: number; away: number}>, s) => {
                        const bucket = acc.find(b => b.minute === s.minute)
                        if (bucket) {
                          if (s.team === 'home') bucket.home += s.xg
                          else bucket.away += s.xg
                        } else {
                          acc.push({ minute: s.minute, home: s.team === 'home' ? s.xg : 0, away: s.team === 'away' ? s.xg : 0 })
                        }
                        return acc
                      }, []).sort((a, b) => a.minute - b.minute)}>
                        <defs>
                          <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gAway" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff5252" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ff5252" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="minute" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Area type="stepAfter" dataKey="home" stroke="#00e676" fill="url(#gHome)" strokeWidth={2} name={sbShotMeta.homeTeam} />
                        <Area type="stepAfter" dataKey="away" stroke="#ff5252" fill="url(#gAway)" strokeWidth={2} name={sbShotMeta.awayTeam} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{sbShotMeta.homeTeam} — {sbShotMeta.homeXg} xG</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">{sbShotMeta.awayTeam} — {sbShotMeta.awayXg} xG</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <TrendingUp className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">xG timeline data is not available for this match.</p>
                  <p className="text-xs text-muted-foreground mt-1">Select a StatsBomb-covered match in the Shot Map tab to see real cumulative xG computed from actual shot data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Shot Map — WIRED TO REAL STATS BOMB DATA */}
        <TabsContent value="shots">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> Shot Map
                  {sbShotMeta && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {sbShotMeta.totalShots} shots · {sbShotMeta.homeTeam} {sbShotMeta.homeXg} xG — {sbShotMeta.awayTeam} {sbShotMeta.awayXg} xG
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <select value={sbSelectedComp} onChange={e => setSbSelectedComp(e.target.value)} className="bg-muted border border-border rounded px-2 py-1.5 text-xs">
                  {Object.entries(sbCompetitions).map(([id, comp]) => (
                    <option key={id} value={id}>{comp.name} ({comp.country})</option>
                  ))}
                </select>
                {sbCompetitions[sbSelectedComp]?.seasons && (
                  <select value={String(sbSelectedSeason)} onChange={e => setSbSelectedSeason(Number(e.target.value))} className="bg-muted border border-border rounded px-2 py-1.5 text-xs">
                    {sbCompetitions[sbSelectedComp].seasons.map(s => (
                      <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                )}
                <select
                  value={sbSelectedMatch || ''}
                  onChange={e => { const id = Number(e.target.value); setSbSelectedMatch(id || null); if (id) fetchSbShots(id) }}
                  className="bg-muted border border-border rounded px-2 py-1.5 text-xs max-w-xs"
                >
                  <option value="">Select a match...</option>
                  {sbMatches.map(m => (
                    <option key={m.id} value={String(m.id)}>{m.homeTeam} {m.homeScore}-{m.awayScore} {m.awayTeam} ({m.date.slice(0, 10)})</option>
                  ))}
                </select>
                {sbLoading && <span className="text-xs text-muted-foreground self-center">Loading...</span>}
              </div>
              {sbError && <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">{sbError}</div>}
              {sbShots.length > 0 ? (
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 overflow-hidden">
                  <div className="absolute inset-2 border border-emerald-700/30 rounded-sm" />
                  <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-l border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-2 bg-white/30 border-b border-white/50" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-20 h-10 border-b border-l border-r border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-44 h-24 border-b border-l border-r border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-[22%] w-1.5 h-1.5 rounded-full bg-white/40" />
                  {sbShots.map((shot, i) => {
                    const outcomeColor = shot.goal ? '#00e676' : ['Saved', 'Saved to Post'].includes(shot.outcome) ? '#ffab40' : shot.outcome === 'Blocked' ? '#78909c' : '#ff5252'
                    return (
                      <motion.div key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring' }} className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style={{ left: \`\${shot.x}%\`, top: \`\${shot.y}%\` }}>
                        <div className="rounded-full border-2 border-background/60 shadow-lg transition-transform hover:scale-125" style={{ width: \`\${Math.max(14, shot.xg * 50)}px\`, height: \`\${Math.max(14, shot.xg * 50)}px\`, backgroundColor: outcomeColor, opacity: shot.team === 'home' ? 0.9 : 0.7 }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg">
                          {shot.player || 'Unknown'} — {shot.outcome} ({shot.xg.toFixed(2)} xG, {shot.minute}&apos;)
                        </div>
                      </motion.div>
                    )
                  })}
                  <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[9px]">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#00e676]" /> Goal</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5252]" /> Miss/Post</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ffab40]" /> Saved</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#78909c]" /> Blocked</div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/20 rounded-lg border border-emerald-800/20 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Select a StatsBomb match above to view real shot locations.</p>
                    <p className="text-xs text-muted-foreground mt-1">Data covers historical tournaments (World Cup, Euros, Champions League, etc.) — free, no API key required.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Tactical Comparison — uses real match data from store */}
        <TabsContent value="comparison">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Detailed Tactical Comparison</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {match ? [
                { label: 'Possession %', home: match.possessionHome, away: 100 - match.possessionHome },
                { label: 'Shots', home: match.shotsHome, away: match.shotsAway },
                { label: 'Shots on Target', home: match.shotsOnTargetHome, away: match.shotsOnTargetAway },
                { label: 'Corners', home: match.cornersHome, away: match.cornersAway },
                { label: 'Fouls', home: match.foulsHome, away: match.foulsAway },
                ...(sbShotMeta ? [{ label: 'xG (StatsBomb)', home: parseFloat(sbShotMeta.homeXg), away: parseFloat(sbShotMeta.awayXg) }] : []),
              ].map((stat) => {
                const total = stat.home + stat.away || 1
                const homePct = Math.round((stat.home / total) * 100)
                return (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-36 shrink-0 text-right text-primary">{stat.home}</span>
                    <div className="flex-1"><div className="flex h-2.5 rounded-full overflow-hidden bg-muted/50"><div className="bg-primary/80 rounded-l-full" style={{ width: \`\${homePct}%\` }} /><div className="bg-orange-500/70 rounded-r-full" style={{ width: \`\${100 - homePct}%\` }} /></div></div>
                    <span className="text-xs font-medium w-36 shrink-0 text-orange-400">{stat.away}</span>
                    <span className="text-[10px] text-muted-foreground w-32 shrink-0">{stat.label}</span>
                  </div>
                )
              }) : <p className="text-sm text-muted-foreground text-center py-8">Select a match to see tactical comparison.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7-17: Tabs with no real data pipeline — honest empty states */}
        {['setpieces', 'substitutions', 'momentum', 'zone', 'buildup', 'defensive', 'aerial', 'counter', 'defline', 'wides', 'transition'].map(tab => {
          const labels: Record<string, { title: string; note: string }> = {
            setpieces: { title: 'Set Piece Analysis', note: 'Set piece data requires event-level filtering (corners, free kicks, penalties). StatsBomb events can provide this for covered matches — not yet wired.' },
            substitutions: { title: 'Substitution Impact', note: 'Substitution impact analysis requires before/after match state data. Not currently available as a computed metric.' },
            momentum: { title: 'Match Momentum', note: 'Momentum is a derived metric requiring event-level data (turnovers, dangerous attacks, pressures). Not currently computed.' },
            zone: { title: 'Zone Control', note: 'Zone control requires spatial event data (player tracking or event locations). StatsBomb provides event locations for covered matches — not yet wired.' },
            buildup: { title: 'Build-up Patterns', note: 'Build-up pattern classification requires pass sequence analysis. Not currently computed.' },
            defensive: { title: 'Defensive Actions', note: 'Defensive action breakdown (tackles, interceptions, blocks) requires event-level data. StatsBomb events can provide this for covered matches — not yet wired.' },
            aerial: { title: 'Aerial Duels', note: 'Aerial duel data requires event-level duel outcomes. StatsBomb events include aerial duels for covered matches — not yet wired.' },
            counter: { title: 'Counter-Attack Analysis', note: 'Counter-attack detection requires possession chain analysis with transition events. Not currently computed.' },
            defline: { title: 'Defensive Line Height', note: 'Defensive line height requires spatial event data (player positions or event locations). Not currently available.' },
            wides: { title: 'Wide Play Analysis', note: 'Wide play analysis requires pass location and cross data by zone. StatsBomb events can provide this for covered matches — not yet wired.' },
            transition: { title: 'Transition Speed', note: 'Transition speed requires timestamped event sequences with phase detection. Not currently computed.' },
          }
          const info = labels[tab]
          return (
            <TabsContent key={tab} value={tab}>
              <Card className="glass-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{info.title}</CardTitle></CardHeader>
                <CardContent>
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">Data not available for this match.</p>
                    <p className="text-xs text-muted-foreground mt-1">{info.note}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}

        {/* 18. Tactical AI Insight */}
        <TabsContent value="ai">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Tactical AI Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <Brain className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">AI-generated tactical insights are not available.</p>
                <p className="text-xs text-muted-foreground mt-1">The previous content in this tab was fabricated tactical analysis presented as if generated by an AI model. This has been removed. A real implementation would require connecting to an LLM API with actual match/event data as context.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}`

// Replace from pressingStart to end
content = content.slice(0, pressingStart) + newTabs

fs.writeFileSync(filePath, content, 'utf-8')
console.log('Done! File updated successfully')
console.log(`New file length: ${content.length}`)
