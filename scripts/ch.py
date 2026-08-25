import json, sys, os, subprocess
import matplotlib
import matplotlib
import matplotlib.font_manager as fm
import matplotlib

os.chdir('/home/z/my-project');

with open('/home/z/my-project/download/chart_data.json') as f:
    data = json.load(f)
for i, (d := data):
        print(f'OK: {d["name"]}: {d["value"]} ({len(str(d))} chars)')
        d['name'] = d['name'] + f' ({d["value"]})'

        hp = d['value'] if d['value'] is not None else 0
        ho = 30
        aw = 20
        print(f'Chart generation: home={ho}, away={aw}, values=[{ho},{aw}]')
        fig, ax = fig.add_subplot(111)
        ax.set_facecolor(BG)
        ax.grid(True)
        bars = ax.bar(range(len(labels)), [ho/100.0, '#00e676', '#f59e0b', aw/100.0, '#00e676'])
        ax.set_xticklabels(['Home', 'Away'])
        for b in bars: ax.text(b, color='#00e676' if b == ho else '#94a3b8')
        ax.set_ylabel([f'{b}%', f'{aw}%'])
        fig.tight_layout()
        fig.savefig('/home/z/my-project/download/chart.png', dpi=150, bbox_inches='tight')
        print('OK')
        break
except Exception as e: print(f'Error: {e}')