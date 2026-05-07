# Design Reference Guide - API Documentation

## Quick Reference

### Color Palette
```
Sage Green (Primary):    #9BA896    - Success, Active, Primary CTA
Electric Blue (Accent):  #0099FF    - Info, Alt CTA
Text Main:               #2A2A2A    - Headlines, Primary content
Text Soft:               #6B6B6B    - Descriptions, Secondary content
Background:              #FAFAFA    - Page background
Panel Light:             #F5F5F5    - Card backgrounds
Panel:                   #F9F9F9    - Lighter panels
Error:                   #D94F4F    - Errors, Required indicators
Line/Border:             var(--line) - Borders (rgba with opacity)
```

### Typography
```
Headings:    Lora, serif      - Elegant, authoritative
Body:        Inter, sans-serif - Clear, modern
Code:        JetBrains Mono   - Technical appearance

Sizes:
H1: 1.8rem (docs header)
H2: 1.4rem (section headers)
H3: 1.15rem (subsection)
H4: 0.95rem (labels, params)
H5: 0.85rem (descriptions)
Body: 0.9rem
Small: 0.8rem

Weight: 500 (regular), 600 (semi-bold), 700 (bold)
```

### Spacing Scale
```
xs: 0.5rem (4px)
sm: 0.75rem (6px)
md: 1rem (8px)
lg: 1.5rem (12px)
xl: 2rem (16px)
```

### Border Radius
```
Buttons/Inputs:  8-10px
Cards:           12-16px
Badges:          4-8px
Circles:         50% (for circular badges)
```

---

## Component System

### Endpoint Card
```
├─ Header
│  ├─ Method Badge (POST, GET, etc.)
│  └─ Path Info (path + description)
├─ Provider Badges
├─ Parameters Section
├─ Status Codes Section
└─ Code Examples
```

**CSS Classes**:
- `.endpoint-card` - Main container
- `.endpoint-header` - Flex header
- `.endpoint-method` - Method badge (with gradient)
- `.endpoint-path` - Path container
- `.provider-badge` - Individual badge
- `.provider-badge.meta` - Meta AI specific
- `.provider-badge.veo` - Veo AI specific

### Parameter Item
```
├─ Parameter Name (monospace)
├─ Description
├─ Type Badge (right side)
└─ Required indicator (if needed)
```

**CSS Classes**:
- `.param-item` - Container with left border
- `.param-name` - Name in monospace
- `.param-type` - Type badge
- `.param-required` - Red required indicator
- `.param-description` - Full description text

### Status Item
```
├─ Status Code (left border colored)
└─ Description
```

**CSS Classes**:
- `.status-item` - Container
- `.status-item.success` - Success (green border)
- `.status-item.error` - Error (red border)
- `.status-item.info` - Info (blue border)
- `.status-code` - Code number
- `.status-description` - Description text

### Use Case Card
```
├─ Header (Gradient background)
│  ├─ Icon circle
│  └─ Title
├─ Body
│  ├─ Description
│  └─ JSON Example
```

**CSS Classes**:
- `.usecase-card` - Main container
- `.usecase-header` - Gradient header
- `.usecase-icon` - Icon container
- `.usecase-title` - Title text
- `.usecase-body` - Content area
- `.usecase-description` - Description text
- `.usecase-example` - Code example block

### Quick Start Step
```
├─ Step Number Circle
├─ Title
└─ Description
```

**CSS Classes**:
- `.quickstart-step` - Container
- `.step-number` - Circular badge with number
- `.quickstart-step h4` - Title
- `.quickstart-step p` - Description

### Preset Button
```
Text Label
```

**CSS Classes**:
- `.preset-buttons` - Container (flex, gap, wrap)
- `.preset-btn` - Individual button
- `.preset-btn:hover` - Hover state (border color, bg change)
- `.preset-btn.active` - Active state (accent bg, white text)

---

## Color Usage Guidelines

### Accent Color (Sage Green #9BA896)
**Use for**:
- Success states
- Active/selected elements
- Primary call-to-action buttons
- Border accents
- Status indicators (success)
- Primary icons

**Examples**:
```css
background: var(--accent);
border-color: var(--accent);
border-left: 3px solid var(--accent);
background: linear-gradient(135deg, var(--accent), rgba(155, 168, 150, 0.6));
```

### Electric Blue (#0099FF)
**Use for**:
- Information states
- Secondary/alternative actions
- Links and click-through elements
- Info icons
- Status indicators (info)
- Gradient accents

**Examples**:
```css
color: #0099FF;
border: 1px solid #0099FF;
background: rgba(0, 153, 255, 0.1);
```

### Error Red (#D94F4F)
**Use for**:
- Error states
- Danger actions
- Required indicators
- Error messages
- Status codes (4xx, 5xx)

**Examples**:
```css
color: #D94F4F;
border-left-color: #D94F4F;
background: rgba(217, 79, 79, 0.08);
```

### Text Colors
**Main Text (#2A2A2A)**:
- Headlines
- Important information
- Primary body text

**Soft Text (#6B6B6B)**:
- Descriptions
- Secondary information
- Helper text
- Labels

---

## Gradient Combinations

### Primary Gradient (Sage Green to Muted)
```css
linear-gradient(135deg, var(--accent), rgba(155, 168, 150, 0.6))
```
**Use for**: Endpoint method badges, section headers, use case headers

### Electric Blue Gradient (Tech-focused)
```css
linear-gradient(135deg, #0099FF, #00D9FF)
```
**Use for**: Alternative accents, tech-forward elements

### Error Gradient (Red combinations)
```css
linear-gradient(135deg, #D94F4F, #E87A7A)
```
**Use for**: Error indicators, deletion actions

---

## Responsive Breakpoints

### Desktop (1080px and above)
```css
- Multi-column layouts (2-4 columns)
- Full-width playground controls
- Side-by-side endpoint cards
- 4-column use case grid
```

### Tablet (640px to 1080px)
```css
- Single-column stacked sections
- 2-column grids become 1-column
- Adjusted padding (1rem instead of 1.5rem)
- Responsive control grid
```

### Mobile (below 640px)
```css
- Full single-column layout
- Stacked buttons (full width)
- Reduced font sizes
- Touch-friendly button sizes (min 44px height)
- Reduced padding for compact display
```

---

## Interactive States

### Button States
```css
/* Default */
background: var(--accent);
color: white;
border: 1px solid var(--accent);

/* Hover */
background: var(--accent-2);
border-color: var(--accent-2);

/* Active/Pressed */
opacity: 0.8;
transform: scale(0.98);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

### Card Hover Effects
```css
/* Default */
border: 1px solid var(--line);
box-shadow: none;

/* Hover */
border-color: var(--accent);
box-shadow: 0 8px 24px rgba(155, 168, 150, 0.12);
transform: translateY(-2px);
```

### Input Focus States
```css
border-color: var(--accent);
background: var(--panel);
outline: none;
```

---

## Spacing Patterns

### Card Padding
```css
.endpoint-card { padding: 1.5rem; }
.usecase-card { padding: 0 (header) + 1.25rem (body); }
.param-item { padding: 0.9rem; }
```

### Section Margins
```css
margin-top: 1.5rem - 2.5rem;
margin-bottom: 1.5rem - 2rem;
```

### Gap Values
```css
flex-gap: 0.75rem - 1.5rem;
grid-gap: 1rem - 1.5rem;
```

---

## Icon Usage

### Icon Sizes by Context
```
Badges/Labels:      14px
Headers:            16-18px
Large icons:        24px
Inline icons:       14-16px
```

### Icon Color
```
Primary:            white (on colored bg)
Secondary:          var(--text-main) or var(--text-soft)
Inactive:           var(--text-soft)
Error:              #D94F4F
Success:            var(--accent)
```

### Icons Used
```
Zap:        Documentation header, energy
Sparkles:   Provider badges, AI capability
Film:       Entertainment, video content
ShoppingCart: E-commerce, shopping
Megaphone:  Marketing, announcements
Share2:     Social media, sharing
Download:   Download action, retrieval
Video:      Video content, generation
Play:       Action, playback
```

---

## Animation & Transitions

### Standard Transition
```css
transition: all 0.2s ease;
```

### Button/Link Transitions
```css
transition: all 0.2s ease;
/* Color, background, border, shadow */
```

### Pulse Animation (Loading)
```css
animation: pulse-dot 1.1s infinite;

@keyframes pulse-dot {
  0% { box-shadow: 0 0 0 0 rgba(155, 168, 150, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(155, 168, 150, 0); }
  100% { box-shadow: 0 0 0 0 rgba(155, 168, 150, 0); }
}
```

### Spin Animation (Loading)
```css
animation: spin 0.8s linear infinite;

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Accessibility Considerations

### Color Contrast
- Text on background: minimum 4.5:1 ratio (WCAG AA)
- Use non-color indicators (icons, text, borders)
- Don't rely on color alone for information

### Keyboard Navigation
- All interactive elements focusable
- Clear focus indicators (border or outline)
- Tab order logical and predictable

### Screen Readers
- Semantic HTML elements
- ARIA labels where needed
- Form labels properly associated
- Alt text for meaningful images

### Font Sizing
- Minimum 14px for body text
- Scalable units (rem, not px)
- Line height 1.4-1.6 for readability

---

## Class Naming Convention

**Naming Pattern**: `.section-component-state`

**Examples**:
```css
.docs-header              /* Section-component */
.endpoint-card            /* Section-component */
.endpoint-method          /* Section-component-part */
.param-type               /* Section-component-type */
.status-item.success      /* Section-component.modifier */
.preset-btn:hover         /* Component:pseudo-class */
.preset-btn.active        /* Component.state */
```

---

## Maintenance Guidelines

### Adding New Sections
1. Follow established color palette
2. Use existing component patterns
3. Maintain spacing consistency
4. Test responsive breakpoints
5. Add appropriate documentation

### Updating Colors
1. Update CSS custom properties
2. Test contrast ratios
3. Verify all component states
4. Check responsive displays

### Typography Changes
1. Maintain hierarchy (H1 > H2 > H3...)
2. Keep monospace for code
3. Use established font sizes
4. Test readability at all sizes

---

## Quick Copy-Paste Components

### Gradient Accent Button
```jsx
<button style={{
  background: 'linear-gradient(135deg, var(--accent), rgba(155, 168, 150, 0.6))',
  color: 'white',
  border: '1px solid var(--accent)',
  borderRadius: '8px',
  padding: '0.8rem 1.2rem',
  fontWeight: '600',
  cursor: 'pointer'
}}>Button Text</button>
```

### Card with Hover Effect
```jsx
<div style={{
  border: '1px solid var(--line)',
  borderRadius: '12px',
  padding: '1.5rem',
  background: 'var(--panel)',
  transition: 'all 0.3s ease',
  cursor: 'pointer'
}}>Content</div>
```

### Status Badge
```jsx
<span style={{
  padding: '0.3rem 0.6rem',
  borderRadius: '4px',
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  fontSize: '0.7rem',
  fontWeight: '700',
  textTransform: 'uppercase'
}}>Status</span>
```

---

## Related Documentation
- See IMPLEMENTATION_SUMMARY.md for technical details
- See DOCS_REDESIGN.md for original design plan
- See README.md for project setup instructions
