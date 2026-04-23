# GITA AI — COMPLETE FRONTEND DEVELOPMENT SPECIFICATION
**Version:** 1.0 | **Framework:** Next.js 14 (App Router) | **Styling:** TailwindCSS v3

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Design System](#2-design-system)
3. [Project Structure](#3-project-structure)
4. [Page Layouts](#4-page-layouts)
5. [Component Specifications](#5-component-specifications)
6. [State Management](#6-state-management)
7. [API Integration & Backend Contract](#7-api-integration--backend-contract)
8. [Interaction Behavior](#8-interaction-behavior)
9. [Responsiveness Rules](#9-responsiveness-rules)
10. [Environment & Configuration](#10-environment--configuration)

---

## 1. PROJECT OVERVIEW

**Product:** Gita AI — a philosophical conversational assistant grounded in the Bhagavad Gita.

**Nature of the product:** Not a chatbot. A *guided spiritual inquiry interface*. Users bring emotional or philosophical questions; the system responds with structured, scripture-backed answers.

**Frontend role:** Pure presentation and API consumption. All AI logic, RAG retrieval, and LLM calls are handled by the backend. The frontend sends messages, renders structured responses, and manages UI state.

**Aesthetic identity:** Think of a calm reading room, not a tech product. Warm off-white paper, ink-dark text, a touch of saffron — the feeling of holding a scholarly annotated scripture.

---

## 2. DESIGN SYSTEM

### 2.1 Color Palette

Define these as CSS variables in `globals.css` and mirror them in `tailwind.config.js` under `theme.extend.colors`.

```
--color-bg-base:        #FAF8F3   /* Warm off-white. Primary page background */
--color-bg-panel:       #F3EFE6   /* Slightly warmer. Sidebar, panels */
--color-bg-subtle:      #EDE8DC   /* Subtle section separators, verse card bg */
--color-border:         #D9D0BC   /* Dividers, input borders */
--color-border-strong:  #BFB49A   /* Emphasized borders */

--color-text-primary:   #1C1A14   /* Near-black. All body text */
--color-text-secondary: #5C5649   /* Medium-dark. Labels, captions, timestamps */
--color-text-muted:     #9C937E   /* Muted. Placeholder text, meta info */

--color-saffron:        #C8742A   /* Saffron. Section headings, verse labels, accents */
--color-saffron-light:  #F0D9BC   /* Saffron tint. Verse card left border bg */
--color-saffron-subtle: #FBF3EA   /* Very light saffron. Verse card background */

--color-user-bubble:    #EDEAE2   /* User message background */
--color-ai-bg:          #FAF8F3   /* AI response background (same as page, no card) */

--color-link:           #7A5C38   /* Sanskrit inline links or verse references */
--color-focus-ring:     #C8742A   /* Input focus ring color */
```

**Rule:** Never use blue, purple, teal, or any cool-toned accent. Every accent is a warm brown or saffron. Background is never pure white (#FFFFFF) or pure black.

### 2.2 Typography

```
Font Stack:
  Display / Headings:   'Cormorant Garamond', Georgia, serif
  Body / UI Text:       'Lora', Georgia, serif
  Monospace (verse):    'EB Garamond', Georgia, serif
  Sanskrit text:        'Noto Serif Devanagari', serif (Google Fonts)

Import via next/font or @import in globals.css.
```

**Type Scale (TailwindCSS):**

| Token         | Size     | Weight | Usage                          |
|---------------|----------|--------|--------------------------------|
| `text-xs`     | 11px     | 400    | Timestamps, meta labels        |
| `text-sm`     | 13px     | 400    | Input placeholder, captions    |
| `text-base`   | 15px     | 400    | Body text, user messages       |
| `text-lg`     | 17px     | 500    | AI answer text                 |
| `text-xl`     | 20px     | 600    | Section headers (Answer, etc.) |
| `text-2xl`    | 24px     | 700    | App name in header             |
| `text-3xl`    | 30px     | 400    | Empty state headline           |

**Line height:** Always `leading-relaxed` (1.75) for body content. `leading-normal` (1.5) for UI chrome.

**Letter spacing:** Headings and section labels use `tracking-wide` (0.05em). Body text `tracking-normal`.

### 2.3 Spacing System

Use TailwindCSS default spacing. Key spacing rules:

- Page horizontal padding: `px-6` (mobile) → `px-8` (tablet) → `px-12` (desktop)
- Chat message vertical gap: `gap-y-8` between messages
- Within an AI response, section gap: `gap-y-6`
- Verse card internal padding: `p-5`
- Input box padding: `px-4 py-3`
- Sidebar width: `w-64` (256px), fixed

### 2.4 Borders & Shadows

- Dividers between sections: `border-t border-[--color-border]`, no `shadow`
- Verse card: `border-l-4 border-[--color-saffron]`, `bg-[--color-saffron-subtle]`, `rounded-r-sm`
- Input box: `border border-[--color-border]`, on focus: `ring-2 ring-[--color-focus-ring] ring-offset-1`
- No `box-shadow` on message bubbles. No drop shadows anywhere except modal overlays.
- No `rounded-2xl`, `rounded-3xl`. Max border-radius: `rounded-md` (6px) for cards, `rounded-sm` (2px) for dividers.

### 2.5 Iconography

Use `lucide-react` exclusively. Icon size: `16px` for inline, `20px` for buttons. Stroke weight: default (1.5). Color: `text-[--color-text-secondary]` unless active.

---

## 3. PROJECT STRUCTURE

```
/frontend
├── /app
│   ├── layout.jsx                  ← Root layout (fonts, global CSS, providers)
│   ├── globals.css                 ← CSS variables, base resets, font imports
│   ├── page.jsx                    ← Redirects to /chat
│   │
│   ├── /chat
│   │   ├── page.jsx                ← Primary chat page
│   │   └── layout.jsx              ← Chat layout (sidebar + main content wrapper)
│   │
│   ├── /history
│   │   └── page.jsx                ← Past conversation list
│   │
│   ├── /explore
│   │   └── page.jsx                ← Topic/chapter browser (Phase 2)
│   │
│   └── /profile
│       └── page.jsx                ← User settings (Phase 2)
│
├── /components
│   ├── /Chat
│   │   └── ChatWindow.jsx          ← Scrollable message list container
│   │
│   ├── /Message
│   │   ├── UserMessage.jsx         ← User bubble renderer
│   │   ├── AIMessage.jsx           ← Structured AI response renderer
│   │   └── MessageWrapper.jsx      ← Shared wrapper (timestamp, avatar row)
│   │
│   ├── /AIResponse
│   │   ├── AnswerSection.jsx       ← "Direct Answer" block
│   │   ├── ExplanationSection.jsx  ← "Explanation" block
│   │   ├── VerseSection.jsx        ← List of VerseCards
│   │   └── GuidanceSection.jsx     ← "Practical Guidance" block
│   │
│   ├── /VerseCard
│   │   └── VerseCard.jsx           ← Individual scripture verse display
│   │
│   ├── /InputBox
│   │   └── InputBox.jsx            ← Textarea + send button
│   │
│   ├── /Sidebar
│   │   └── Sidebar.jsx             ← Left navigation panel
│   │
│   ├── /Loader
│   │   ├── TypingIndicator.jsx     ← Animated "thinking" state
│   │   └── SectionSkeleton.jsx     ← Skeleton for streaming sections
│   │
│   └── /UI
│       ├── SectionLabel.jsx        ← Reusable section header (e.g., "Answer")
│       ├── Divider.jsx             ← Horizontal rule with optional label
│       └── EmptyState.jsx          ← Empty chat state
│
├── /features
│   ├── /chat
│   │   └── chatSlice.js            ← (if using Redux) or Zustand actions
│   └── /history
│       └── historySlice.js
│
├── /services
│   ├── apiClient.js                ← Axios/fetch base instance
│   ├── chatService.js              ← sendMessage(), streamMessage()
│   └── historyService.js           ← getHistory(), getConversation()
│
├── /store
│   └── chatStore.js                ← Zustand store definition
│
├── /hooks
│   ├── useChat.js                  ← Chat submission logic, state binding
│   └── useStreaming.js             ← SSE streaming handler
│
├── /utils
│   └── formatter.js                ← Parse API response into sections
│
├── tailwind.config.js
├── next.config.js
├── .env.local                      ← NEXT_PUBLIC_API_BASE_URL only
└── package.json
```

---

## 4. PAGE LAYOUTS

### 4.1 Root Layout (`app/layout.jsx`)

- Wraps entire app in font providers (`next/font/google` for Lora, Cormorant Garamond, EB Garamond, Noto Serif Devanagari)
- Sets `<body>` background to `--color-bg-base`, text color to `--color-text-primary`
- Wraps content in a Zustand provider context if needed
- No global navigation here — navigation is inside chat layout

### 4.2 Chat Layout (`app/chat/layout.jsx`)

```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar 256px fixed]  │  [Main Content Area flex-1]   │
│                         │                               │
│  Logo                   │  [ChatPage content here]      │
│  Nav links              │                               │
│  ─────────────          │                               │
│  Recent conversations   │                               │
│                         │                               │
└─────────────────────────────────────────────────────────┘
```

- Layout: `flex flex-row h-screen overflow-hidden`
- Sidebar: `w-64 flex-shrink-0 h-full overflow-y-auto bg-[--color-bg-panel] border-r border-[--color-border]`
- Main: `flex-1 flex flex-col h-full overflow-hidden`
- On mobile (`< md`): Sidebar collapses to a hamburger-accessible drawer overlay

### 4.3 Chat Page (`app/chat/page.jsx`)

```
┌───────────────────────────────────────┐
│  [Header — fixed top]                 │  h-14, border-b
│  "Gita AI"            [New Chat btn]  │
├───────────────────────────────────────┤
│                                       │
│  [ChatWindow — flex-1, overflow-y]    │
│                                       │
│   [EmptyState] ← if no messages       │
│   OR                                  │
│   [MessageList] ← scrollable          │
│                                       │
├───────────────────────────────────────┤
│  [InputBox — fixed bottom]            │  border-t, bg-base, p-4
│  [Textarea]          [Send Button]    │
└───────────────────────────────────────┘
```

- Full height: `flex flex-col h-full`
- Header: `h-14 px-6 flex items-center justify-between border-b border-[--color-border] flex-shrink-0`
- ChatWindow: `flex-1 overflow-y-auto px-4 py-8 md:px-12`
- InputBox container: `flex-shrink-0 border-t border-[--color-border] bg-[--color-bg-base] px-4 py-4 md:px-12`

### 4.4 History Page (`app/history/page.jsx`)

```
┌───────────────────────────────────────┐
│  [Page Header]                        │
│  "Conversations"                      │
├───────────────────────────────────────┤
│  [Conversation List]                  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Date label: "Today"             │  │
│  │ ─────────────────────────       │  │
│  │ [ConversationItem]              │  │
│  │ [ConversationItem]              │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

Each `ConversationItem`: Shows first message snippet, timestamp, and arrow icon. Clicking navigates to `/chat?id={conversation_id}`.

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 Sidebar (`/components/Sidebar/Sidebar.jsx`)

**Layout:**
```
┌──────────────────────┐
│  ☸ Gita AI           │  ← Logo row, font: Cormorant Garamond text-xl
│                      │
│  ─────────────────   │  ← Divider
│                      │
│  [Nav Links]         │
│  • Chat              │  ← lucide: MessageSquare
│  • History           │  ← lucide: Clock
│  • Explore           │  ← lucide: BookOpen
│                      │
│  ─────────────────   │
│                      │
│  Recent              │  ← section label, text-xs uppercase tracking-widest
│  • [Conversation 1]  │
│  • [Conversation 2]  │
│  • [Conversation 3]  │
│                      │
│  (bottom)            │
│  • Profile / Settings│  ← lucide: Settings, pinned to bottom
└──────────────────────┘
```

**Styling:**
- Background: `bg-[--color-bg-panel]`
- Nav item active state: `bg-[--color-bg-subtle] text-[--color-text-primary] font-medium`
- Nav item default: `text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-subtle]`
- Nav item: `flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-colors`
- Section label: `text-[10px] uppercase tracking-widest text-[--color-text-muted] px-4 py-2 mt-4`
- Recent conversation item: `text-sm text-[--color-text-secondary] px-4 py-2 truncate hover:text-[--color-text-primary] cursor-pointer`

**Mobile behavior:** Hidden by default (`hidden md:flex`). A hamburger button in the chat header triggers a drawer overlay with `z-50`, `bg-[--color-bg-panel]`, slide-in from left animation.

---

### 5.2 Chat Header (`inside app/chat/page.jsx`)

- Left: App name "Gita AI" in `font-[Cormorant Garamond] text-2xl font-semibold text-[--color-text-primary]`
  - Optionally a small ☸ (dharma wheel) Unicode symbol `&#9784;` before the name, colored `text-[--color-saffron]`
- Right: "New Chat" button
  - Style: `flex items-center gap-2 text-sm text-[--color-text-secondary] border border-[--color-border] rounded-sm px-3 py-1.5 hover:bg-[--color-bg-subtle] transition-colors`
  - Icon: `lucide: Plus` size 14

---

### 5.3 ChatWindow (`/components/Chat/ChatWindow.jsx`)

- Container: `flex-1 overflow-y-auto scroll-smooth`
- Inner content: `max-w-3xl mx-auto w-full flex flex-col gap-y-8 py-8 px-4`
- Scroll behavior: On new message append, auto-scroll to bottom using `useEffect` + `ref.scrollIntoView({ behavior: 'smooth' })`
- The scroll anchor `<div ref={bottomRef} />` is placed after the last message

**Empty State (no messages):**
```
Center of ChatWindow, vertically and horizontally.
  ☸ (symbol, text-saffron, text-4xl)
  "Begin your inquiry" (Cormorant Garamond, text-3xl, text-[--color-text-primary])
  "Ask anything about dharma, karma, purpose, or the Gita." (Lora, text-base, text-[--color-text-secondary])

  Optionally 3 suggestion chips below:
  [ "What is dharma?" ]  [ "I feel lost in life" ]  [ "Explain karma yoga" ]
  Style: border border-[--color-border] rounded-sm text-sm px-4 py-2 text-[--color-text-secondary]
         hover:bg-[--color-bg-subtle] cursor-pointer
```

---

### 5.4 Message Components

#### 5.4.1 User Message (`/components/Message/UserMessage.jsx`)

```
Layout (right-aligned):
┌────────────────────────────────────────────────────┐
│                          [User message text]  [■]  │
│                          [Timestamp]               │
└────────────────────────────────────────────────────┘
```

- Container: `flex justify-end`
- Bubble: `max-w-[70%] bg-[--color-user-bubble] px-4 py-3 rounded-md`
- Text: `text-base text-[--color-text-primary] leading-relaxed font-[Lora]`
- Timestamp below bubble: `text-xs text-[--color-text-muted] text-right mt-1`
- No avatar for user.

#### 5.4.2 AI Message (`/components/Message/AIMessage.jsx`)

```
Layout (left-aligned, full width):
┌────────────────────────────────────────────────────┐
│  [☸ icon]  Gita AI                                 │  ← sender label row
│                                                    │
│  [AnswerSection]                                   │
│  ─────────────────────────────────────             │  ← subtle divider
│  [ExplanationSection]                              │
│  ─────────────────────────────────────             │
│  [VerseSection]                                    │
│  ─────────────────────────────────────             │
│  [GuidanceSection]                                 │
│                                                    │
│  [Timestamp]                                       │
└────────────────────────────────────────────────────┘
```

- No bubble background — the AI response sits directly on the page background
- Sender row: `flex items-center gap-2 mb-4`
  - Icon: dharma wheel `text-[--color-saffron] text-base`
  - Label: "Gita AI" `text-sm font-medium text-[--color-text-secondary] font-[Lora]`
- Sections container: `flex flex-col gap-y-6`
- Timestamp: `text-xs text-[--color-text-muted] mt-3`

---

### 5.5 Structured AI Response Sections

All four sections follow the same layout pattern:

```
[SectionLabel]    ← e.g., "Answer", "Explanation", "Verses", "Guidance"
[Content]
```

#### SectionLabel (`/components/UI/SectionLabel.jsx`)

- Props: `label: string`, `icon?: LucideIcon`
- Style: `flex items-center gap-2 mb-3`
  - Label text: `text-xs font-semibold uppercase tracking-widest text-[--color-saffron]`
  - Optional icon: `size-3.5 text-[--color-saffron]`

#### 5.5.1 AnswerSection (`/components/AIResponse/AnswerSection.jsx`)

- SectionLabel: "Answer" (icon: `lucide: Lightbulb`)
- Content: `text-lg text-[--color-text-primary] leading-relaxed font-[Lora]`
- This is the most prominent text on the page — largest font size of all sections

#### 5.5.2 ExplanationSection (`/components/AIResponse/ExplanationSection.jsx`)

- SectionLabel: "Explanation" (icon: `lucide: BookOpen`)
- Content: `text-base text-[--color-text-primary] leading-relaxed font-[Lora]`
- May contain multiple paragraphs. Separate with `mb-3` between `<p>` tags.

#### 5.5.3 VerseSection (`/components/AIResponse/VerseSection.jsx`)

- SectionLabel: "From the Gita" (icon: `lucide: Quote`)
- Content: A vertical list of `VerseCard` components, `flex flex-col gap-y-4`

#### 5.5.4 GuidanceSection (`/components/AIResponse/GuidanceSection.jsx`)

- SectionLabel: "Practical Guidance" (icon: `lucide: Compass`)
- Content: `text-base text-[--color-text-secondary] leading-relaxed font-[Lora]`
- Style is intentionally slightly lighter (`text-secondary`) vs body — guidance is softer, reflective tone
- May render as bullet list if backend returns array. Bullet: `•` character, no `<ul>` with default list styling. Manual `flex flex-col gap-y-2`.

---

### 5.6 VerseCard (`/components/VerseCard/VerseCard.jsx`)

**Props:**
```typescript
{
  chapter: number,
  verse: number,
  text?: string,          // Sanskrit original (optional)
  translation: string
}
```

**Design:**
```
┌────────────────────────────────────────────────────┐
║  Chapter 2, Verse 47                               ║  ← verse reference label
║                                                    ║
║  "कर्मण्येवाधिकारस्ते..."                          ║  ← Sanskrit (if present)
║                                                    ║
║  ──────────────────────────────────────────────    ║  ← thin divider inside card
║                                                    ║
║  "You have a right to perform your prescribed      ║  ← translation
║   duties, but you are not entitled to the          ║
║   fruits of your actions."                         ║
└────────────────────────────────────────────────────┘
```

**Styling:**
```css
Container:
  border-l-4 border-[--color-saffron]
  bg-[--color-saffron-subtle]
  rounded-r-md
  p-5

Verse reference:
  text-xs font-semibold uppercase tracking-widest text-[--color-saffron]
  mb-3

Sanskrit text (if present):
  font-['Noto Serif Devanagari'] text-base text-[--color-text-primary] leading-loose
  mb-3

Internal divider:
  border-t border-[--color-border] mb-3  (only shown if Sanskrit text exists)

Translation:
  font-['EB Garamond'] text-base italic text-[--color-text-primary] leading-relaxed
```

---

### 5.7 InputBox (`/components/InputBox/InputBox.jsx`)

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  [Textarea — auto-expand]                      [Send btn]  │
└────────────────────────────────────────────────────────────┘
```

**Textarea:**
- Element: `<textarea>` (not `<input>`)
- Placeholder: `"Ask about dharma, karma, purpose..."`
- Auto-resize: Use `onInput` event to set `height = scrollHeight`. Min height: `44px`, max height: `160px` (after which `overflow-y-auto` kicks in)
- Styling:
  ```css
  flex-1
  resize-none
  bg-transparent
  border border-[--color-border]
  rounded-sm
  px-4 py-3
  text-base text-[--color-text-primary]
  placeholder:text-[--color-text-muted]
  font-[Lora]
  leading-relaxed
  focus:outline-none
  focus:ring-2 focus:ring-[--color-focus-ring] focus:ring-offset-1
  transition-shadow
  ```
- On `Enter` key (without Shift): submit message. `Shift+Enter`: insert newline.

**Send Button:**
- Positioning: `self-end` (aligns to bottom of textarea when expanded)
- Size: `h-10 w-10 flex items-center justify-center rounded-sm`
- Default: `bg-[--color-saffron] text-white hover:bg-[#A85E20] transition-colors`
- Disabled state (empty input or loading): `bg-[--color-border] text-[--color-text-muted] cursor-not-allowed`
- Icon: `lucide: ArrowUp` size 18
- No text label on the button

**Wrapper:**
```css
flex flex-row items-end gap-3 max-w-3xl mx-auto w-full
```

**Below InputBox (optional, centered):**
- Tiny disclaimer: `text-[11px] text-[--color-text-muted] text-center mt-2`
  - Text: "Gita AI may reflect interpretations. Always consult a teacher for deeper guidance."

---

### 5.8 Typing Indicator (`/components/Loader/TypingIndicator.jsx`)

Shown in the message list as a placeholder while awaiting the backend response.

**Design:**
```
[☸ icon]  Gita AI
  ● ● ●   ← three dots, slow pulse animation
```

- Three dots: `<span>` elements with `bg-[--color-saffron]`, `w-1.5 h-1.5 rounded-full`
- Animation: CSS `animate-pulse` on each dot with staggered `animation-delay` (0ms, 150ms, 300ms)
- Same sender row as AI messages for visual consistency

**During streaming:** The TypingIndicator is replaced by the actual streaming content as it arrives. Sections appear one by one.

---

### 5.9 Section Skeleton (`/components/Loader/SectionSkeleton.jsx`)

For streaming mode: as each section arrives, show skeleton placeholders for sections not yet received.

- A skeleton section: `animate-pulse bg-[--color-bg-subtle] h-4 rounded-sm w-3/4 mb-2`
- Show 3 skeleton lines per pending section
- Replace skeleton with real content as streaming data populates it

---

## 6. STATE MANAGEMENT

### 6.1 Zustand Store (`/store/chatStore.js`)

```javascript
const useChatStore = create((set, get) => ({
  // State
  messages: [],          // Array of message objects (see shape below)
  isLoading: false,      // True when API call is in flight
  conversationId: null,  // Current conversation UUID
  error: null,           // Error string or null

  // Actions
  addUserMessage: (text) => { ... },
  addAIMessage: (response) => { ... },
  updateStreamingMessage: (delta) => { ... },   // For SSE
  setLoading: (bool) => set({ isLoading: bool }),
  setConversationId: (id) => set({ conversationId: id }),
  resetChat: () => set({ messages: [], conversationId: null, error: null }),
  setError: (msg) => set({ error: msg }),
}))
```

### 6.2 Message Object Shape

```javascript
// User message
{
  id: string,           // uuid or timestamp string
  role: 'user',
  content: string,      // raw text
  timestamp: ISO8601 string
}

// AI message
{
  id: string,
  role: 'assistant',
  sections: {
    answer: string,
    explanation: string,
    guidance: string,
  },
  verses: [
    {
      chapter: number,
      verse: number,
      text: string | null,
      translation: string
    }
  ],
  timestamp: ISO8601 string,
  isStreaming?: boolean    // True while streaming is in progress
}
```

### 6.3 History Storage

- On each completed conversation turn, store `conversationId` in `localStorage` under key `gita_ai_recent_conversations` as an array of `{ id, preview, timestamp }`.
- The Sidebar reads this to populate the "Recent" list.
- Max 10 recent conversations stored.

---

## 7. API INTEGRATION & BACKEND CONTRACT

### 7.1 API Client (`/services/apiClient.js`)

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

export default apiClient;
```

### 7.2 Chat Service (`/services/chatService.js`)

#### Standard (non-streaming)

**Endpoint:** `POST /api/chat`

**Request body:**
```json
{
  "message": "string — the user's raw query",
  "conversation_id": "string | null — null for first message",
  "history": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ]
}
```

**Response body:**
```json
{
  "response": "string — full plain text response (used as fallback)",
  "verses": [
    {
      "chapter": 2,
      "verse": 47,
      "text": "कर्मण्येवाधिकारस्ते...",
      "translation": "You have a right to perform your duties..."
    }
  ],
  "conversation_id": "string — UUID for this conversation"
}
```

**Frontend parsing (`/utils/formatter.js`):**

The `response` string is structured. The backend is expected to include section delimiters. Parse the `response` field into four sections using one of these two approaches:

**Option A (preferred) — Backend sends structured JSON sections:**
If backend can be extended to return:
```json
{
  "sections": {
    "answer": "...",
    "explanation": "...",
    "guidance": "..."
  },
  "verses": [...],
  "conversation_id": "..."
}
```
Use these directly — no parsing needed.

**Option B — Backend returns plain `response` string:**
Parse using delimiter markers. Ask backend team to include markers in the response string:
```
[ANSWER]
...text...
[EXPLANATION]
...text...
[GUIDANCE]
...text...
```
`formatter.js` splits on these markers using regex: `/\[ANSWER\]|\[EXPLANATION\]|\[GUIDANCE\]/`.

**Fallback:** If no markers detected, display the entire `response` string in the Answer section only.

#### Streaming

**Endpoint:** `POST /api/chat/stream`

Same request body as above. Response is `text/event-stream` (SSE).

Each SSE event:
```
data: {"type": "answer_chunk", "content": "..."}
data: {"type": "explanation_chunk", "content": "..."}
data: {"type": "guidance_chunk", "content": "..."}
data: {"type": "verse", "chapter": 2, "verse": 47, "text": "...", "translation": "..."}
data: {"type": "done", "conversation_id": "uuid"}
```

**Frontend SSE handler (`/hooks/useStreaming.js`):**
```javascript
const eventSource = new EventSource(url_with_params);
// OR use fetch with ReadableStream for POST body support

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'answer_chunk') appendToSection('answer', data.content)
  if (data.type === 'explanation_chunk') appendToSection('explanation', data.content)
  if (data.type === 'guidance_chunk') appendToSection('guidance', data.content)
  if (data.type === 'verse') appendVerse(data)
  if (data.type === 'done') finishStreaming(data.conversation_id)
};
```

Since SSE with POST body requires `fetch` + `ReadableStream` (not native `EventSource`), use this pattern:

```javascript
const response = await fetch(`${BASE_URL}/api/chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
// Read chunks and parse SSE lines
```

### 7.3 History Service (`/services/historyService.js`)

**Get all conversations:**
`GET /api/conversations`
Response: `{ conversations: [{ id, preview, timestamp }] }`

**Get single conversation:**
`GET /api/conversations/:id`
Response: `{ messages: [...], conversation_id }`

### 7.4 Error Handling

All API errors must be caught and:
1. Set `chatStore.error` to a user-facing string
2. Show an inline error in the chat window (not a modal, not a toast)

**Inline error message format:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠ The response could not be retrieved.             │
│  Please try again.  [Retry ↺]                       │
└─────────────────────────────────────────────────────┘
```
- Styled as: `text-sm text-[--color-text-secondary] border border-[--color-border] rounded-sm p-3 flex items-center gap-3`
- Retry button calls the same `sendMessage()` with the last user message

---

## 8. INTERACTION BEHAVIOR

### 8.1 Sending a Message

1. User types in InputBox → presses Enter or clicks Send
2. `useChat.js` calls `addUserMessage(text)` → message appears immediately in ChatWindow
3. InputBox clears and disables
4. `isLoading = true` → TypingIndicator appears at bottom of message list
5. API call is made (`chatService.sendMessage` or `chatService.streamMessage`)
6. On response: `isLoading = false`, TypingIndicator removed, AI message rendered
7. Auto-scroll to bottom
8. InputBox re-enables, focus returns to textarea

### 8.2 Streaming Response UI

1. When the first chunk arrives, replace TypingIndicator with an in-progress AIMessage
2. The Answer section renders characters as they stream
3. When `[EXPLANATION]` chunk starts, render ExplanationSection with a blinking cursor `▌`
4. Verse cards are inserted as complete `verse` events arrive
5. Guidance section renders last
6. On `done` event: remove cursor, mark message as complete, save `conversationId`

**Blinking cursor:** `<span class="animate-pulse text-[--color-saffron]">▌</span>` appended at end of streaming section

### 8.3 Scroll Behavior

- Auto-scroll only if the user is already at (or near) the bottom of the ChatWindow. If user has scrolled up, do NOT force-scroll.
- Detect "near bottom": `scrollHeight - scrollTop - clientHeight < 120px` → auto-scroll enabled
- Use `useEffect` watching `messages` array

### 8.4 New Chat

- Clicking "New Chat" calls `chatStore.resetChat()`
- Navigate to `/chat` (or just reset state if already on `/chat`)
- Show EmptyState

### 8.5 Loading a Past Conversation

- Clicking a history item in Sidebar sets `conversationId` and loads messages
- `GET /api/conversations/:id` → populate `messages[]` in store
- InputBox is active and user can continue the conversation

### 8.6 Suggestion Chips (EmptyState)

- Clicking a suggestion chip pre-fills the textarea with that text
- Does NOT auto-submit — user can review and then send

---

## 9. RESPONSIVENESS RULES

| Breakpoint | Layout behavior |
|------------|-----------------|
| `< 768px` (mobile) | Sidebar hidden. Hamburger icon in header opens sidebar as full-height drawer overlay. Chat content full width. Max-width constraint removed. Input padding reduced. |
| `768px–1024px` (tablet) | Sidebar visible at `w-56`. Chat content `max-w-2xl`. |
| `> 1024px` (desktop) | Sidebar `w-64`. Chat content `max-w-3xl mx-auto`. |

**Verse cards on mobile:** Full width, no truncation. Sanskrit text remains in Devanagari, wraps normally.

**InputBox on mobile:** Textarea stays `min-h-[44px]`. Send button remains `w-10 h-10`. Disclaimer text hidden on mobile.

---

## 10. ENVIRONMENT & CONFIGURATION

### `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

All API calls use `process.env.NEXT_PUBLIC_API_BASE_URL` as the base. Never hardcode URLs.

### `tailwind.config.js` additions

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-base':        '#FAF8F3',
        'bg-panel':       '#F3EFE6',
        'bg-subtle':      '#EDE8DC',
        'border-soft':    '#D9D0BC',
        'border-strong':  '#BFB49A',
        'text-primary':   '#1C1A14',
        'text-secondary': '#5C5649',
        'text-muted':     '#9C937E',
        'saffron':        '#C8742A',
        'saffron-light':  '#F0D9BC',
        'saffron-subtle': '#FBF3EA',
        'user-bubble':    '#EDEAE2',
        'link':           '#7A5C38',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"Lora"', 'Georgia', 'serif'],
        verse:   ['"EB Garamond"', 'Georgia', 'serif'],
        devanagari: ['"Noto Serif Devanagari"', 'serif'],
      },
    },
  },
  plugins: [],
}
```

### `next.config.js`

```javascript
module.exports = {
  // Enable if backend is on a different port/domain during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/:path*`,
      },
    ]
  },
}
```

---

## APPENDIX: DEPENDENCY LIST

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.383.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Google Fonts to import (in `globals.css`):**
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;1,400&family=Noto+Serif+Devanagari:wght@400;500&display=swap');
```

---

## IMPLEMENTATION PRIORITY ORDER

1. **Phase 1 (Core):** Design system setup → Sidebar → ChatWindow + EmptyState → UserMessage → TypingIndicator → InputBox → API integration (non-streaming) → AIMessage + all four sections → VerseCard
2. **Phase 2:** Streaming support (useStreaming.js + SectionSkeleton) → History page → Sidebar recent conversations list
3. **Phase 3:** Explore page → Profile/Settings → Mobile drawer sidebar → Error retry flow

---

*End of Specification — Gita AI Frontend v1.0*
