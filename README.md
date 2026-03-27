# Satwik Network CRM Frontend

A modern financial loan management system built with React.js and Tailwind CSS.

## Features

- **Sidebar Navigation** with minimize functionality (shows icons only when minimized)
- **Dashboard** with analytics, charts, and summary cards
- **Multiple Management Pages**:
  - Leads Management
  - Agents Management
  - Staff Management
  - Banks Management
  - Franchises Management
  - Invoices Management
  - Payouts Management
- **Responsive Design** (desktop-first)
- **Clean, Professional UI** with Tailwind CSS
- **Dummy Data** for all entities

## Tech Stack

- React.js 18
- Vite
- React Router DOM
- Tailwind CSS
- Recharts (for charts)
- Lucide React (for icons)

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── Layout.jsx
│   ├── StatCard.jsx
│   └── StatusBadge.jsx
├── pages/           # Page components
│   ├── Dashboard.jsx
│   ├── Leads.jsx
│   ├── Agents.jsx
│   └── ...
├── services/         # Dummy data services
│   └── dummyData.js
├── App.jsx          # Main app component with routing
└── main.jsx         # Entry point
```

## Notes

- This is a **UI-only implementation** - no backend integration
- All data is **dummy/in-memory** data
- No authentication or authorization implemented
- Focus on clean UI and component structure

## Next Steps

The application is set up with a complete dashboard. Other pages (Leads, Agents, etc.) are placeholder pages that will be implemented step by step as requested.
