# 🔄 Git Workflow for Design System

## Branch Structure

```
main (production)
├── design-system-v1 (feature branch)
│   ├── feat/animations
│   ├── feat/data-viz
│   ├── feat/gestures
│   ├── feat/navigation
│   ├── feat/forms
│   └── feat/micro-interactions
```

## Daily Workflow

### 1. Start Work
```bash
git checkout design-system-v1
git pull origin design-system-v1
git checkout -b feat/component-name
```

### 2. Commit Often
```bash
# Small, atomic commits
git add src/components/design-system/animations/my-component.tsx
git commit -m "feat(design-system): add ScrollReveal component

- Add scroll-triggered animation
- Include Storybook stories (5 variants)
- Full TypeScript types
- WCAG AAA accessibility
- Mobile responsive"
```

### 3. Push & Create PR
```bash
git push origin feat/component-name

# Create PR with template
```

## PR Checklist

```markdown
## Design System Component PR

### Component(s) Added
- [ ] Component implementation
- [ ] TypeScript types
- [ ] Storybook stories (3+ variants)
- [ ] Accessibility (ARIA labels, keyboard nav)

### Testing
- [ ] Desktop (Chrome, Safari, Firefox)
- [ ] Mobile (iOS Safari, Chrome Android)
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Dark mode support
- [ ] Lighthouse ≥ 90

### Documentation
- [ ] Component README
- [ ] Usage examples
- [ ] Props documentation
- [ ] Accessibility notes

### Visuals
- [ ] Chromatic visual tests passing
- [ ] Screenshots of variants
- [ ] Animation/interaction demo (if applicable)
```

## Merge & Deploy

```bash
# Squash merge for clean history
git checkout design-system-v1
git pull
git merge --squash feat/component-name
git commit -m "feat: add [Component Name] to design system"

# Push to design-system-v1
git push origin design-system-v1

# Create PR to main for final review
```

## Commands Reference

```bash
# Check status
git status

# View changes
git diff

# Stage changes
git add .

# Commit
git commit -m "feat(design-system): [description]"

# Push
git push origin feat/branch-name

# Update branch
git fetch origin
git rebase origin/design-system-v1

# Clean up
git branch -d feat/branch-name
```

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>

Example:
feat(design-system/animations): add ScrollReveal component

- Implements Intersection Observer for scroll-triggered animations
- Supports 4 directions: up, down, left, right
- 3 animation timing variants (fast, normal, slow)
- Full keyboard & screen reader support
- Mobile responsive with touch support

Fixes #123
Closes #456
```

## Review Process

1. **Code Review** → Verify component quality
2. **Design Review** → Check alignment with design tokens
3. **Accessibility Review** → Ensure WCAG AAA compliance
4. **Performance Review** → Lighthouse score ≥ 90
5. **Approve & Merge**

---

Happy building! 🚀
