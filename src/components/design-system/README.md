# ELASTICO Design System v1.0

## 📦 Component Library

A comprehensive collection of 38 production-grade UI components with:
- ✨ Smooth animations & transitions
- 🎨 iOS-inspired design patterns
- ♿ Full accessibility support
- 📱 Mobile-first responsive design
- ⚡ Performance optimized (60fps)

---

## 🗂️ Component Categories

### Animations (10)
- `ScrollReveal` — Elements reveal on scroll
- `ParallaxSection` — Depth-based scroll parallax
- `GlassmorphCard` — Frosted glass effect
- `WavyBackground` — SVG wavy animations
- `FloatingElement` — Floating motion
- `PulseRing` — Expanding pulse indicator
- `ShimmerLoader` — Loading skeleton
- `MotionText` — Character-by-character text animation
- `GradientShift` — Animated gradient backgrounds
- `SkeletonPulse` — Advanced loading state

### Data Visualization (8)
- `InteractiveChart` — Hover-triggered charts
- `HeatmapGrid` — Interactive grid
- `LiveCounter` — Animated counters
- `ProgressRing` — Circular progress
- `BarChartInteractive` — Interactive bars
- `SparklineChart` — Mini charts
- `GaugeChart` — Radial gauge
- `StatCard` — Animated stat cards

### Gestures & Touch (6)
- `SwipeCard` — Gesture-based swiping
- `PinchZoom` — Pinch-to-zoom
- `HorizontalScroll` — Momentum scroll
- `LongPressMenu` — Long-press context
- `DoubleTapAction` — Double-tap favorite
- `DragReorder` — Drag-to-reorder

### Navigation (6)
- `BottomSheet` — iOS-style drawer
- `SlidingPanel` — Slide-in panel
- `ModalTransition` — Smooth modals
- `PageTransition` — View transitions
- `TabBar` — Bottom tab navigation
- `NavigationBreadcrumb` — Animated breadcrumbs

### Forms (5)
- `AnimatedInput` — Floating label input
- `RangeSliderVisual` — Dual-handle slider
- `ToggleSwitch` — iOS toggle
- `CheckboxAnim` — Animated checkbox
- `SearchBar` — Expandable search

### Micro-interactions (3)
- `TooltipAnim` — Animated tooltip
- `BadgeNotification` — Notification badge
- `ContextMenu` — Right-click menu

---

## 🚀 Usage

```tsx
import { ScrollReveal } from '@/components/design-system/animations/scroll-reveal'
import { GlassmorphCard } from '@/components/design-system/animations/glassmorphic-card'
import { LiveCounter } from '@/components/design-system/data-viz/live-counter'

export default function Page() {
  return (
    <ScrollReveal direction="up" distance={50}>
      <GlassmorphCard>
        <h2>Welcome</h2>
        <LiveCounter value={1000} duration={2} />
      </GlassmorphCard>
    </ScrollReveal>
  )
}
```

---

## 🎨 Design Tokens

- **Colors** — `src/components/design-system/theme/colors.ts`
- **Animations** — `src/components/design-system/theme/animations.ts`
- **Motion Utilities** — `src/components/design-system/utils/motion-utils.ts`

---

## 📚 Hooks

- `useScrollTrigger()` — Detect scroll intersection
- `useMousePosition()` — Track mouse position
- `useGesture()` — Handle touch gestures (from react-use-gesture)

---

## ✅ Accessibility

All components include:
- ARIA labels & roles
- Keyboard navigation
- Screen reader support
- Focus management
- High contrast mode support

---

## ⚡ Performance

- 60fps animations (GPU-accelerated)
- Code splitting for lazy loading
- Optimized re-renders (React.memo)
- Production bundle < 50KB (gzipped)

---

## 📖 Storybook

```bash
npm run storybook
```

Visit: http://localhost:6006

---

## 🔗 Dependencies

- `framer-motion` — Animation library
- `react-use-gesture` — Gesture detection
- `recharts` — Data visualization
- `@dnd-kit` — Drag-and-drop (already in project)

---

Built with ❤️ for ELASTICO
