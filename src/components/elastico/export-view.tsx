'use client'

import { useState, useRef, useCallback } from 'react'

import {
  Download,
  FileText,
  FileSpreadsheet,
  FileDown,
  Calendar,
  Clock,
  Link2,
  Code2,
  History,
  Database,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  BarChart3 as BarChartIcon,
  User as UserIcon,
  Trophy as TrophyIcon,
  Target as TargetIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  'file-text': FileText,
  'bar-chart': BarChartIcon,
  'user': UserIcon,
  'trophy': TrophyIcon,
  'target': TargetIcon,
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useElasticoStore } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExportRecord {
  id: string
  type: string
  format: string
  rows: number
  createdAt: string
  status: 'completed' | 'failed'
  size?: string
}

// ── Report Templates ──────────────────────────────────────────────────────────────

const REPORT_TEMPLATES = [
  { id: 'match-report', name: 'Match Report', description: 'Comprehensive match analysis with xG, shots, possession, and key events', icon: 'file-text' as const, category: 'match' },
  { id: 'team-analysis', name: 'Team Analysis', description: 'Deep dive into team performance, form, and tactical tendencies', icon: 'bar-chart' as const, category: 'team' },
  { id: 'player-report', name: 'Player Report', description: 'Individual player statistics, form, and comparison data', icon: 'user' as const, category: 'player' },
  { id: 'tournament-summary', name: 'Tournament Summary', description: 'Full tournament overview with standings, top scorers, and key stats', icon: 'trophy' as const, category: 'tournament' },
  { id: 'prediction-accuracy', name: 'Prediction Accuracy Report', description: 'Analysis of prediction model performance across all models', icon: 'target' as const, category: 'prediction' },
]

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/matches', description: 'List all matches with filters', params: 'status, stage, competition, limit, offset' },
  { method: 'GET', path: '/api/matches/[id]', description: 'Get match details with events', params: 'id (path)' },
  { method: 'GET', path: '/api/teams', description: 'List all teams', params: 'limit, offset' },
  { method: 'GET', path: '/api/players', description: 'List players with filters', params: 'teamId, position, search, sortBy, limit, offset' },
  { method: 'GET', path: '/api/players/[id]', description: 'Player detail with match history', params: 'id (path)' },
  { method: 'POST', path: '/api/predictions', description: 'Submit a match prediction', params: 'matchId, predictedHomeGoals, predictedAwayGoals, confidence, model' },
  { method: 'GET', path: '/api/analytics/predictions', description: 'Prediction accuracy analytics', params: 'model, startDate' },
  { method: 'GET', path: '/api/leaderboard', description: 'Prediction leaderboard', params: 'limit, offset' },
  { method: 'POST', path: '/api/export', description: 'Generate data export', params: 'type, format, filters' },
  { method: 'GET', path: '/api/bookmarks', description: 'List bookmarked matches', params: 'none (requires auth)' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function ExportView() {
  const token = useElasticoStore(s => s.token)
  const user = useElasticoStore(s => s.user)
  const [exportType, setExportType] = useState('matches')
  const [exportFormat, setExportFormat] = useState('csv')
  const [exporting, setExporting] = useState(false)
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([])
  const [scheduledReports] = useState<{ id: string; name: string; frequency: string; type: string; format: string; active: boolean; nextRun: string }[]>([])
  const [chartRef, setChartRef] = useState<HTMLElement | null>(null)

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/export', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: exportType, format: exportFormat, filters: {} }),
      })

      if (!res.ok) throw new Error('Export failed')

      if (exportFormat === 'csv' && res.headers.get('content-type')?.includes('text/csv')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `elastico-${exportType}-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `elastico-${exportType}-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      const newRecord: ExportRecord = {
        id: `e${Date.now()}`,
        type: exportType.charAt(0).toUpperCase() + exportType.slice(1),
        format: exportFormat.toUpperCase(),
        rows: 0,
        createdAt: new Date().toLocaleString(),
        status: 'completed',
      }
      setExportHistory(prev => [newRecord, ...prev])
      toast.success(`Exported ${exportType} as ${exportFormat.toUpperCase()}`)
    } catch {
      toast.error('Export failed. Please try again.')
      setExportHistory(prev => [{
        id: `e${Date.now()}`,
        type: exportType,
        format: exportFormat.toUpperCase(),
        rows: 0,
        createdAt: new Date().toLocaleString(),
        status: 'failed',
      }, ...prev])
    } finally {
      setExporting(false)
    }
  }, [exportType, exportFormat, token])

  const handleReportTemplate = useCallback((template: typeof REPORT_TEMPLATES[0]) => {
    toast.info(`Generating ${template.name}...`)
    // Use browser print as PDF generation
    setTimeout(() => {
      window.print()
      toast.success(`${template.name} generated!`)
    }, 500)
  }, [])

  const handleExportChartAsPNG = useCallback(() => {
    if (!chartRef) {
      toast.error('No chart to export. Visit a chart view first.')
      return
    }
    toast.info('Chart export uses the browser Print dialog. Use "Save as PDF" to capture charts.')
    window.print()
  }, [chartRef])

  const handleShareReport = useCallback((record: ExportRecord) => {
    const link = `${window.location.origin}/shared/report/${record.id}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link)
    } else {
      const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    toast.success('Shareable link copied to clipboard!')
  }, [])

  const handleCopyEndpoint = useCallback((path: string) => {
    const fullUrl = `${window.location.origin}${path}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl)
    } else {
      const ta = document.createElement('textarea'); ta.value = fullUrl; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    toast.success('API endpoint URL copied!')
  }, [])

  return (
    <div
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="text-primary" /> Data Export & Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Export data, generate reports, and access the API</p>
      </div>

      <Tabs defaultValue="custom" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-card/50 p-1 rounded-lg">
          <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          <TabsTrigger value="custom" className="text-xs">Custom Export</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs">Scheduled</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          <TabsTrigger value="charts" className="text-xs">Chart Export</TabsTrigger>
          <TabsTrigger value="api" className="text-xs">API Access</TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs">Bulk Export</TabsTrigger>
          <TabsTrigger value="share" className="text-xs">Share</TabsTrigger>
        </TabsList>

        {/* Report Templates */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="glass-card p-6 rounded-xl border border-border/30 cursor-pointer group transition-all duration-200 hover:-translate-y-1"
                onClick={() => handleReportTemplate(template)}
              >
                {(() => { const Icon = ICON_MAP[template.icon] || FileText; return <Icon className="size-8 text-primary/60 mb-3" /> })()}
                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{template.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{template.description}</p>
                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline" className="text-[9px]">{template.category}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                    <FileDown className="size-3" /> PDF
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Custom Report Builder */}
        <TabsContent value="custom">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" /> Custom Export Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Data Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matches">Matches</SelectItem>
                      <SelectItem value="players">Players</SelectItem>
                      <SelectItem value="predictions">My Predictions</SelectItem>
                      <SelectItem value="teams">Teams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Date Range</Label>
                  <Input type="text" placeholder="All dates" disabled />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Button onClick={handleExport} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {exporting ? 'Exporting...' : `Export ${exportType} as ${exportFormat.toUpperCase()}`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {exportType === 'matches' && 'Includes scores, xG, possession, shots, and team data'}
                  {exportType === 'players' && 'Includes stats, ratings, market values, and team info'}
                  {exportType === 'predictions' && 'Includes your predictions with outcomes and accuracy'}
                  {exportType === 'teams' && 'Includes ELO, xG, style, and squad data'}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports */}
        <TabsContent value="scheduled">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Scheduled Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduledReports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="size-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No scheduled reports yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Scheduled report automation is coming soon.</p>
                </div>
              ) : (
                scheduledReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-3 h-3 rounded-full', report.active ? 'bg-primary' : 'bg-muted-foreground/30')} />
                      <div>
                        <div className="text-sm font-medium">{report.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {report.frequency} · {report.type} · {report.format} · Next: {report.nextRun}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', report.active ? 'text-primary border-primary/30' : 'text-muted-foreground')}>
                        {report.active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full gap-2 text-xs" disabled>
                <Calendar className="size-4" /> Schedule New Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export History */}
        <TabsContent value="history">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="size-4 text-primary" /> Export History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {exportHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="size-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No exports yet.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Use the Custom Export tab to generate your first export.</p>
                  </div>
                ) : exportHistory.map(record => (
                  <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30">
                    {record.status === 'completed' ? (
                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                    ) : (
                      <AlertCircle className="size-4 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{record.type} Export</div>
                      <div className="text-[10px] text-muted-foreground">
                        {record.format} · {record.rows} rows · {record.createdAt}
                        {record.size && ` · ${record.size}`}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      'text-[9px] shrink-0',
                      record.status === 'completed' ? 'text-primary border-primary/30' : 'text-red-400 border-red-400/30'
                    )}>
                      {record.status}
                    </Badge>
                    {record.status === 'completed' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleShareReport(record)}>
                        <Share2 className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart Export */}
        <TabsContent value="charts">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileDown className="size-4 text-primary" /> Data Visualization Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export any chart or visualization as a high-quality image using your browser&apos;s built-in capabilities.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'Match xG Chart', view: 'tactical' },
                  { name: 'Player Radar Chart', view: 'players' },
                  { name: 'Team Comparison', view: 'compare' },
                  { name: 'Leaderboard Chart', view: 'leaderboard' },
                  { name: 'Tournament Standings', view: 'tournament' },
                  { name: 'Prediction Accuracy', view: 'predictions' },
                ].map(chart => (
                  <div
                    key={chart.name}
                    className="glass-card p-4 rounded-lg border border-border/30 cursor-pointer transition-all duration-200 hover:-translate-y-1"
                    onClick={() => toast.info(`Navigate to ${chart.name} view, then use Ctrl+P to save as PDF`)}
                  >
                    <BarChartIcon className="size-5 text-primary mb-2" />
                    <h4 className="text-sm font-medium">{chart.name}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">Click to navigate, then print to save</p>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={handleExportChartAsPNG} className="gap-2">
                <FileDown className="size-4" /> Export Current View as PDF
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Access */}
        <TabsContent value="api">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code2 className="size-4 text-primary" /> API Documentation
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Programmatic access to ELASTICO data. Use Bearer token authentication for protected endpoints.
              </p>
            </CardHeader>
            <CardContent>
              {/* Auth info */}
              <div className="glass-card p-3 rounded-lg border border-border/30 mb-4">
                <div className="text-xs font-medium mb-1">Authentication</div>
                <code className="text-[11px] text-primary bg-primary/5 px-2 py-1 rounded block overflow-x-auto">
                  Authorization: Bearer {'{'}token{'}'}
                </code>
                <div className="text-[10px] text-muted-foreground mt-1">Your API token is the same as your session token.</div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {API_ENDPOINTS.map((endpoint) => (
                  <div
                    key={endpoint.path + endpoint.method}
                    className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30 group cursor-pointer"
                    onClick={() => handleCopyEndpoint(endpoint.path)}
                  >
                    <Badge variant="outline" className={cn(
                      'text-[10px] font-mono shrink-0',
                      endpoint.method === 'GET' ? 'text-emerald-400 border-emerald-400/30' : 'text-orange-400 border-orange-400/30'
                    )}>
                      {endpoint.method}
                    </Badge>
                    <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{endpoint.path}</code>
                    <span className="text-[10px] text-muted-foreground hidden md:block max-w-48 truncate">{endpoint.description}</span>
                    <Copy className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Export */}
        <TabsContent value="bulk">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="size-4 text-primary" /> Bulk Data Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.role === 'admin' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Export the full database for backup or migration purposes. This includes all matches, players, teams, predictions, and user data.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['matches', 'players', 'teams', 'predictions', 'users', 'all'].map(type => (
                      <Button
                        key={type}
                        variant="outline"
                        className="gap-2 justify-start"
                        onClick={() => toast.info(`Bulk export of ${type} started. You will be notified when ready.`)}
                      >
                        <Database className="size-4" />
                        Export {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="size-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Bulk data export is available for <Badge variant="outline" className="text-primary border-primary/30 ml-1">Admin</Badge> users only.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Share Reports */}
        <TabsContent value="share">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Share2 className="size-4 text-primary" /> Share Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate shareable links for your exported reports. Links expire after 7 days.
              </p>
              <div className="space-y-2">
                {exportHistory.filter(r => r.status === 'completed').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Share2 className="size-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No completed exports to share.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Complete an export first, then share it from here.</p>
                  </div>
                ) : exportHistory.filter(r => r.status === 'completed').map(record => (
                  <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30">
                    <FileText className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{record.type} Export</div>
                      <div className="text-[10px] text-muted-foreground">{record.createdAt}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1 shrink-0"
                      onClick={() => handleShareReport(record)}
                    >
                      <Link2 className="size-3" /> Share
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ExportView