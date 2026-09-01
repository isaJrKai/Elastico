import re, glob, os

os.chdir('/home/z/my-project')

replacements = [
    ('glass-card-premium', 'rounded-lg border border-border bg-card'),
    ('glass-card', 'rounded-lg border border-border bg-card'),
    ('card-hover-lift', ''),
    ('bento-grid', 'grid gap-3'),
    ('animate-fade-in-up', ''),
    ('shimmer-effect', ''),
    ('aurora-effect', ''),
]

files = glob.glob('src/components/elastico/*.tsx')
count = 0
for f in files:
    with open(f, 'r') as fh:
        content = fh.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        # Fix double/multiple spaces in className values
        def fix_class(m):
            cls = m.group(1)
            while '  ' in cls:
                cls = cls.replace('  ', ' ')
            cls = cls.strip()
            if not cls:
                return ''
            return f'className="{cls}"'
        content = re.sub(r'className="([^"]+)"', fix_class, content)
        with open(f, 'w') as fh:
            fh.write(content)
        count += 1
        print(f'Cleaned: {f}')
print(f'Total: {count} files cleaned')
