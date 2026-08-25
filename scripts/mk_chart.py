import matplotlib
import matplotlib
import os, json
import sys

os.chdir('/home/z/my-project')
with open('/home/z/my-project/download/chart_data.json') as f:
    data = json.load(f)
for d in data:
        print(f'OK: {d["name"]}: {d["value"]} ({len(str(d))} chars)')
try:
    import matplotlib
    import matplotlib.font_manager as fm
    fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf')
    fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf')
    os.chdir('/home/z/my-project')
    hp = d['value'] if d['value'] is not None else 0
    aw = 20
    print(f'Chart OK: home={hp}, away={aw}')
    try:
        fig, ax = fig.add_subplot(111)
        ax.set_facecolor(BG)
        ax.set_xlim(0, 100)
        ax.grid(True)
        bars = ax.bar(range(len(['Home','Draw']), [hp/100.0, '#00e676', '#00e676', '#f59e0b', aw/100.0])
        ax.set_ylabel([f'{b}%', f'{aw}%'])
        for b in bars: ax.text(b, color='#00e676' if b == hp else '#94a3b8')
        ax.set_ylim(0, 100)
        fig.tight_layout()
        fig.savefig('/home/z/my-project/download/chart.png', dpi=150, bbox_inches='tight')
        print('Chart saved')
        break
    except Exception as e: print(f'Chart error: {e}')
        print(f'HP={hp}, AW={aw}')
finally: print('FAILED')