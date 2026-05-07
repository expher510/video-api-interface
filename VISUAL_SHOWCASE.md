# API Documentation Redesign - Visual Showcase

## Section 1: Documentation Header

```
╔═══════════════════════════════════════════════════════════════════════╗
│  ⚡  API Documentation                                                 │
│  ───────────────────────────────────────────────────────────────────  │
│  Powerful, scalable video generation API for developers. Create      │
│  stunning videos, images, and video transformations in seconds      │
│  using our cutting-edge AI models.                                   │
╚═══════════════════════════════════════════════════════════════════════╝
```

**Visual Elements:**
- Zap icon with gradient sage green background
- Large serif heading (1.8rem)
- Clear value proposition
- Professional, welcoming tone
- Sage green accent border at bottom

---

## Section 2: Quick Start Guide

```
┌─────────────────────────────────────────────────────────────────┐
│ Quick Start in 3 Steps                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │  1 (in circle)   │  │  2 (in circle)   │  │ 3 (circle)  │  │
│  │  Get API Key     │  │ Send Request     │  │Poll Results │  │
│  │  Create account  │  │ POST to generate │  │Check status │  │
│  │  from Key Cons.  │  │ with prompt      │  │retrieve med │  │
│  └──────────────────┘  └──────────────────┘  └─────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Colors:**
- Step numbers: Sage green circles (#9BA896) with white text
- Background: Light gray (#F5F5F5)
- Text: Dark gray for headings, soft gray for descriptions
- Cards: White with subtle border

---

## Section 3: Production Base URL

```
┌──────────────────────────────────────────────────────┐
│  Production Base URL                                 │
│  https://api.example.com/v1                          │
└──────────────────────────────────────────────────────┘
```

**Style:**
- Subtle label (text-soft gray)
- Monospace code font
- Light background with border
- Padding: 1rem

---

## Section 4: Endpoint Card - POST /api/generate

```
╔════════════════════════════════════════════════════════════════╗
│                                                                 │
│  POST     /api/generate                                        │
│           Initiate a new video, image, or video               │
│           transformation request                              │
│                                                                 │
│  [Meta AI] [Veo AI]                                           │
│                                                                 │
│  REQUEST BODY PARAMETERS                                      │
│  ──────────────────────────────────────────────────────────  │
│                                                                 │
│  provider (required)          ┌──────────┐                   │
│  AI provider for generation   │  ENUM    │                   │
│                               └──────────┘                   │
│                                                                 │
│  mode (required)              ┌──────────┐                   │
│  Generation type: video,      │  ENUM    │                   │
│  image, or image_to_video     └──────────┘                   │
│                                                                 │
│  prompt (required)            ┌──────────┐                   │
│  Detailed text description    │  STRING  │                   │
│                               └──────────┘                   │
│                                                                 │
│  RESPONSE STATUS CODES                                        │
│  ────────────────────────────────────────────────────────── │
│  200  │  Successfully queued generation job                  │
│  400  │  Invalid parameters or missing required fields       │
│  401  │  Invalid or expired API key                          │
│  429  │  Rate limit exceeded                                 │
│                                                                 │
│  CODE EXAMPLES                                                │
│  ─────────────────────────────────────────────────────────── │
│  curl -X POST https://api.example.com/v1/api/generate \\    │
│    -H "Authorization: Bearer YOUR_API_KEY" \\               │
│    -H "Content-Type: application/json" \\                   │
│    -d '{                                                       │
│      "provider": "veo",                                       │
│      "mode": "video",                                         │
│      "prompt": "Cinematic drone shot"                        │
│    }'                                                          │
│                                                                 │
╚════════════════════════════════════════════════════════════════╝
```

**Colors:**
- POST badge: Sage green background with gradient
- Border: Left side accent, hover adds full border
- Text: Main dark gray, soft gray for descriptions
- Type badges: Light background with dark text
- Status codes:
  - 200: Green border (success)
  - 400, 401, 429: Red border (error)
- Code: Monospace in light background

---

## Section 5: Use Case Card - E-Commerce

```
╔══════════════════════════════════════════════════════════╗
│  🛒 E-Commerce                                          │
│  ──────────────────────────────────────────────────────  │
│  Generate product showcase videos automatically        │
│  for your catalog. Create engaging demonstrations      │
│  that increase conversion rates and reduce returns.    │
│                                                         │
│  {                                                      │
│    "provider": "veo",                                  │
│    "mode": "video",                                    │
│    "prompt": "Product showcase video for handbag"    │
│  }                                                      │
╚══════════════════════════════════════════════════════════╝
```

**Colors:**
- Header: Gradient sage green background
- Icon: White shopping cart in light background circle
- Border: Left 3px accent on code example
- Hover: Border highlights, shadow appears, lifts up

---

## Section 6: Interactive Playground

```
╔════════════════════════════════════════════════════════════╗
│  Interactive API Playground                               │
│  Test API requests in real-time. Configure parameters,   │
│  send requests, and see live responses.                   │
│                                                            │
│  [Veo Cinematic] [Meta Image] [Image-to-Video]          │
│                                                            │
│  ┌─────────────────────┬────────────────────────────────┐ │
│  │ API Key             │ Provider (Meta AI ▼)          │ │
│  ├─────────────────────┼────────────────────────────────┤ │
│  │ Mode (video ▼)      │ Aspect Ratio (landscape ▼)    │ │
│  └─────────────────────┴────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Prompt                                               │ │
│  │ Create a fashion cinematic intro...                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [POST /api/generate]    [POST /api/download (secondary)]│
│                                                            │
│  ✓ Job ID: abc123def456... (success indicator)          │
│                                                            │
│  JSON Response                                           │
│  {                                                        │
│    "success": true,                                      │
│    "job_id": "abc123def456",                           │
│    "status": "queued"                                   │
│  }                                                        │
│                                                            │
╚════════════════════════════════════════════════════════════╝
```

**Colors:**
- Header: Dark text on light background
- Preset buttons: Light background, hover border accent
- Controls: Light input background with subtle border
- Primary button: Sage green background, white text
- Secondary button: Light background with border
- Status indicator: Green border, success text
- Code: Light background, dark text

---

## Section 7: Use Case Grid (4-column layout)

```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│  🛒 E-Commerce │  🎬 Entertain. │  📢 Marketing  │  🔗 Social Med │
├────────────────┼────────────────┼────────────────┼────────────────┤
│ Product videos │ Cinematic cont │ Campaign vidso │ Short-form con │
│ for catalogs   │ and VFX        │ at scale       │ for platforms  │
│                │                │                │                │
│ [JSON Example] │ [JSON Example] │ [JSON Example] │ [JSON Example] │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

---

## Color Palette Reference

```
PRIMARY ACCENT
Sage Green (#9BA896)
████████████████████  ← Used for: Success, active, primary CTA

SECONDARY ACCENT
Electric Blue (#0099FF)
████████████████████  ← Used for: Info, alt actions

BACKGROUNDS
Light (#FAFAFA)
████████████████████  ← Page background
Panel (#F5F5F5-F9F9F9)
████████████████████  ← Cards, panels

TEXT
Main (#2A2A2A)
████████████████████  ← Headlines, main content
Soft (#6B6B6B)
████████████████████  ← Descriptions, secondary

STATUS
Success: Sage Green (#9BA896)
████████████████████
Error: Red (#D94F4F)
████████████████████
Info: Electric Blue (#0099FF)
████████████████████
```

---

## Typography Hierarchy

```
DOCUMENTATION HEADER
█████████████████████████████████████████
Lora Serif, 1.8rem, Bold
"API Documentation"

SECTION HEADERS
████████████████████████████████████
Lora Serif, 1.4rem, Bold
"Quick Start in 3 Steps"

SUBSECTION HEADERS
██████████████████████████████
Lora Serif, 1.15rem, Bold
Card titles

LABELS & PARAMETERS
████████████████████
Inter Sans-Serif, 0.95rem, Bold
"REQUEST BODY PARAMETERS"

DESCRIPTIONS
████████████████████
Inter Sans-Serif, 0.9rem, Regular
Body text and descriptions

CODE & TECHNICAL
████████████████████
JetBrains Mono, 0.8rem, Regular
{
  "provider": "veo",
  "prompt": "..."
}
```

---

## Interactive States

### Button Hover
```
[Default]          [Hover]             [Active]
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ POST /generat │   │ POST /generat │   │ POST /generat │
│ (sage green) │→  │ (warm greige) │→  │ (scaled down) │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Card Hover
```
[Default]          [Hover]
┌────────────────┐  ┌────────────────┐
│ Endpoint card  │→ │ Endpoint card  │
│ (light border) │  │ (accent border)│
│ (no shadow)    │  │ (deep shadow)  │
└────────────────┘  │ (lifted 2px)   │
                    └────────────────┘
```

---

## Responsive Behavior

### Desktop (1080px+)
```
┌─────────────────────────────────────────┐
│  API Docs Header                        │
├─────────────────────────────────────────┤
│  Quick Start (3 cols grid)              │
├─────────────────────────────────────────┤
│  Endpoint Card 1   │  Endpoint Card 2   │
├─────────────────────────────────────────┤
│  Use Case 1  │  Case 2  │  Case 3  │ Case 4 │
└─────────────────────────────────────────┘
```

### Tablet (640px-1080px)
```
┌──────────────────────────┐
│  API Docs Header         │
├──────────────────────────┤
│  Quick Start (2 cols)    │
├──────────────────────────┤
│  Endpoint Card 1         │
│  Endpoint Card 2         │
├──────────────────────────┤
│  Use Case 1              │
│  Use Case 2              │
└──────────────────────────┘
```

### Mobile (<640px)
```
┌──────────────────┐
│ API Docs Header  │
├──────────────────┤
│ Quick Start      │
│ (stacked)        │
├──────────────────┤
│ Endpoint Card 1  │
│ Endpoint Card 2  │
├──────────────────┤
│ Use Cases        │
│ (stacked)        │
└──────────────────┘
```

---

## Animation Examples

### Status Pulse Animation
```
[Frame 1]   [Frame 2]   [Frame 3]
  ✓ Job         ✓ Job         ✓ Job
  (small        (medium      (small
   pulse)       pulse)       pulse)

Repeats continuously at 1.1s intervals
```

### Transition Timing
```
Hover effects:    0.2s ease
Button press:     0.15s ease
Card transform:   0.3s ease
Color changes:    0.2s ease
```

---

## Component Hierarchy Visual

```
API DOCUMENTATION PANEL
├─ Header Section
│  ├─ Icon (with gradient)
│  ├─ Title (1.8rem)
│  └─ Description
│
├─ Quick Start Section
│  ├─ Title
│  └─ 3 Step Cards
│     ├─ Step number
│     ├─ Title
│     └─ Description
│
├─ Production URL Card
│
├─ Endpoint Card (repeated)
│  ├─ Method Badge
│  ├─ Path Info
│  ├─ Provider Badges
│  ├─ Parameters Section
│  ├─ Status Codes Section
│  └─ Code Examples
│
└─ Use Cases Grid
   ├─ Use Case Card (x4)
   │  ├─ Gradient Header
   │  ├─ Icon
   │  ├─ Title
   │  └─ Body Content
```

---

## Final Visual Summary

**Design Philosophy:**
- Clean, professional aesthetic
- Futuristic color palette (sage green + electric blue)
- Premium spacing and alignment
- Clear visual hierarchy
- Smooth, polished interactions
- Responsive across all devices

**User Experience:**
- Quick start in 3 minutes
- Comprehensive reference documentation
- Interactive testing playground
- Real-world use cases
- Status codes and error handling
- Code examples for all scenarios

**Visual Quality:**
- Gradient accents for modern feel
- Professional color palette
- Elegant typography
- Consistent spacing (1.5rem-2rem padding)
- Smooth transitions (0.2s-0.3s ease)
- Box shadows for depth (4px-24px blur)

---

This showcase demonstrates the complete visual redesign of the API documentation to deliver a premium, professional, and developer-friendly experience.
