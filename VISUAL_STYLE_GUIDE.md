# Visual Style Guide - API Documentation

## Overview

This guide ensures consistency across all documentation pages and provides reference for future updates.

---

## Typography System

### Font Stack

```css
Headings: 'Lora', serif
Body: 'Inter', sans-serif
Code: 'JetBrains Mono', monospace
```

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | 1.8rem | 700 | 1.2 | Main section titles |
| H2 | 1.6rem | 700 | 1.3 | Major subsections |
| H3 | 1.2rem | 700 | 1.4 | Topic headers |
| H4 | 0.95rem | 700 | 1.5 | Parameter sections |
| H5 | 0.9rem | 700 | 1.6 | Code labels |
| Body | 0.95rem | 400 | 1.7 | Main content |
| Small | 0.8rem | 400 | 1.5 | Captions |
| Code | 0.75rem | 400 | 1.6 | Code blocks |

### Letter Spacing

- Headers: 0.05em - 0.15em
- Labels: 0.1em - 0.15em
- Body: 0.3px

---

## Color System

### Primary Colors

```
Sage Green: #9BA896
├─ Primary Action
├─ Accent Highlights
├─ Active States
└─ Success Indicators

Warm Greige: #C9C5B9
├─ Hover States
├─ Secondary Actions
└─ Lighter Accents
```

### Neutral Colors

```
Main Text: #2A2A2A
├─ Headings
├─ Primary Content
└─ High Contrast

Soft Text: #6B6B6B
├─ Secondary Content
├─ Descriptions
└─ Captions

Background Deep: #FAFAFA
├─ Main Background
└─ Outer Container

Background Soft: #F5F5F5
├─ Card Backgrounds
├─ Code Blocks
└─ Input Fields

Line Color: rgba(201, 197, 185, 0.4)
├─ Borders
├─ Dividers
└─ Subtle Separations
```

### Status Colors

```
Success: #9BA896 (Sage Green)
├─ Positive Actions
├─ Completed Status
└─ Success Messages

Error: #D94F4F (Muted Red)
├─ Errors
├─ Warnings
└─ Negative States

Info: #0099FF (Bright Blue)
├─ Information
├─ Tips
└─ Hints
```

---

## Spacing System

### Baseline Unit: 0.25rem

```
XS: 0.25rem
S: 0.5rem
M: 0.75rem
L: 1rem
XL: 1.5rem
2XL: 2rem
3XL: 2.5rem
4XL: 3rem
```

### Common Spacing Patterns

```css
/* Sections */
margin-top: 2.5rem;
margin-bottom: 2rem;
padding: 1.5rem;

/* Elements */
gap: 0.75rem;
margin-bottom: 1rem;
padding: 1rem;

/* Compact */
gap: 0.5rem;
margin: 0.5rem;
padding: 0.75rem;
```

---

## Component Specifications

### Documentation Cards

```css
.usecase-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.usecase-card:hover {
  border-color: var(--accent);
  box-shadow: 0 12px 32px rgba(155, 168, 150, 0.15);
  transform: translateY(-2px);
}
```

**Dimensions**:
- Min width: 280px (grid)
- Border radius: 12px
- Border: 1px solid
- Shadow: 0 12px 32px with 15% opacity

### Code Blocks

```css
.usecase-subsection pre {
  background: var(--bg-soft);
  border-left: 4px solid var(--accent);
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.6;
  max-height: 500px;
  overflow-y: auto;
}
```

**Specifications**:
- Left accent border: 4px
- Line height: 1.6
- Max height: 500px (scrollable)
- Custom scrollbar styling

### Headers

```css
.docs-header {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--accent);
}

.docs-header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), rgba(155, 168, 150, 0.6));
}
```

---

## Visual Hierarchy

### Section Organization

```
1. Header Section (Top)
   ├─ Icon + Title + Description
   └─ Border-bottom separator

2. Quick Start Guide
   ├─ 3-step visual flow
   └─ Numbered circles

3. API Endpoints
   ├─ Method badges (POST/GET)
   ├─ Endpoint path
   ├─ Parameters
   ├─ Status codes
   └─ Code examples

4. Use Cases
   ├─ Use Case Cards (4 columns)
   ├─ Detailed Sections
   │  ├─ Basic Example
   │  ├─ Advanced Example
   │  └─ Integration Code
   └─ Next Use Case

5. Interactive Playground
   ├─ Preset Buttons
   ├─ Control Panel
   └─ Response Viewer
```

### Visual Weight

```
Maximum Weight
├─ Main headings (H1-H2)
├─ Accent colors
└─ Hover states

High Weight
├─ Section headings (H3-H4)
├─ Code blocks
└─ Important parameters

Medium Weight
├─ Body text
├─ Secondary info
└─ Descriptions

Low Weight
├─ Captions
├─ Hints
└─ Subtle text
```

---

## Gradient Specifications

### Card Headers

```css
background: linear-gradient(
  135deg,
  var(--accent) 0%,
  rgba(155, 168, 150, 0.6) 100%
);
```

**Direction**: 135deg (top-left to bottom-right)
**Colors**: Sage green to lighter sage
**Opacity**: 100% → 60%

### Background Overlays

```css
background:
  linear-gradient(180deg, rgba(245, 245, 245, 0.3), rgba(250, 250, 250, 0.8)),
  radial-gradient(circle at 80% 15%, rgba(155, 168, 150, 0.08), transparent 40%);
```

**Pattern**: Linear + Radial combination
**Effect**: Subtle depth and direction

---

## Border & Shadow System

### Borders

```css
Standard: 1px solid var(--line)
Accent: 1px solid var(--accent)
Thick: 2px solid var(--line)
Accent Thick: 3px solid var(--accent)
```

### Shadows

```css
Subtle: 0 2px 8px rgba(42, 42, 42, 0.06)
Medium: 0 8px 24px rgba(42, 42, 42, 0.12)
Large: 0 12px 32px rgba(155, 168, 150, 0.15)
Modal: 0 20px 60px rgba(42, 42, 42, 0.2)
```

### Border Radius

```css
Subtle: 6px
Standard: 8px
Prominent: 10px
Card: 12px
Large: 16px
Rounded: 999px (pills)
```

---

## Animation & Transitions

### Timing Functions

```css
Default: 0.2s ease
Slow: 0.3s ease
Smooth: cubic-bezier(0.4, 0, 0.2, 1)
```

### Hover States

```css
/* Cards */
border-color: var(--accent);
box-shadow: 0 12px 32px rgba(155, 168, 150, 0.15);
transform: translateY(-2px);
transition: all 0.3s ease;

/* Buttons */
background: var(--accent-2);
border-color: var(--accent-2);
transition: all 0.2s ease;
```

### Active States

```css
border-color: var(--accent);
background: var(--accent);
color: white;
font-weight: 700;
```

---

## Responsive Design

### Breakpoints

```
Desktop: 1200px+
├─ Multi-column grids
├─ Full width components
└─ All features visible

Tablet: 768px - 1200px
├─ 2-column grids
├─ Adjusted spacing
└─ Optimized touch targets

Mobile: < 768px
├─ Single column
├─ Larger touch targets
└─ Compact spacing
```

### Responsive Classes

```css
@media (max-width: 1080px) {
  /* Adjust grids to 1 column */
  grid-template-columns: 1fr;
}

@media (max-width: 768px) {
  /* Touch-friendly sizing */
  padding: 1rem;
  gap: 1rem;
  
  /* Stack layouts */
  flex-direction: column;
  grid-template-columns: 1fr;
}
```

---

## Accessibility Guidelines

### Color Contrast

```
Text on Background: 4.5:1 (WCAG AA)
Large Text: 3:1 (WCAG AA)
Interactive Elements: 4.5:1
```

### Focus States

```css
:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(155, 168, 150, 0.25);
}
```

### Semantic HTML

```html
<h1> - Main page title
<h2> - Section headings
<h3> - Subsection headings
<section> - Content sections
<article> - Self-contained content
<code> - Inline code
<pre> - Code blocks
<button> - Interactive elements
```

---

## Code Block Styling

### Syntax Highlighting (Reserved for Future)

```
Keywords: Bold
Strings: Different color
Numbers: Neutral
Comments: Light gray
Operators: Accent color
```

### Code Features

```css
/* Scrollable on long code */
max-height: 500px;
overflow-y: auto;

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-thumb {
  background: var(--accent);
  border-radius: 4px;
}
```

---

## Interactive Elements

### Buttons

```css
/* Primary */
background: var(--accent);
color: white;
border: 1px solid var(--accent);

/* Secondary */
background: var(--panel);
color: var(--text-main);
border: 1px solid var(--line);

/* Hover */
background: var(--accent-2);
border-color: var(--accent-2);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

### Forms

```css
Input {
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.8rem 0.95rem;
}

Input:focus {
  border-color: var(--accent);
  background: var(--panel);
}
```

---

## Implementation Checklist

When adding new content:

- [ ] Typography hierarchy follows scale
- [ ] Colors use CSS variables
- [ ] Spacing follows 0.25rem baseline
- [ ] Border radius appropriate for component
- [ ] Shadows applied consistently
- [ ] Transitions smooth (0.2s-0.3s)
- [ ] Responsive breakpoints considered
- [ ] Accessibility contrast verified
- [ ] Focus states defined
- [ ] Mobile touch targets ≥ 44px

---

## Browser Testing

Test on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

Verify:
- Color rendering
- Font loading
- Shadow rendering
- Gradient smoothness
- Scroll performance
- Touch interactions
