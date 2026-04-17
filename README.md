# Wallet App 💸

A premium, interactive financial management application built with **React Native (Expo)** and **Supabase**. The app provides users with deep insights into their spending habits, automated budgeting feedback, and a highly organized hierarchical category system.

## 🚀 Key Features

### 1. Dynamic Dashboard & Insights
*   **Wallet Insights**: Real-time performance analysis showing Balance Score and Cash Flow health.
*   **Visual Spending Breakdown**: Interactive Donut Charts that roll up sub-category spending into broad parent categories for higher-level clarity.
*   **Live Metrics**: Instant view of "This Month" expenses vs. previous periods with percentage change indicators.

### 2. Hierarchical Category System
*   **Broad & Sub-categories**: A professional 2-tier system (e.g., *Food & Drink* > *Groceries*).
*   **Interactive Drill-Down Picker**: A visual, grid-based selection process using premium Lucide icons to reduce cognitive load and improve speed.
*   **Unique Color Identity**: Every major category has a distinct color used throughout the app for instant recognition.

### 3. Transaction Management
*   **Precise Logging**: Manual Date & Time selection for historical logging.
*   **Detailed Records**: Supports titles, amounts, hierarchical categories, and custom notes.
*   **Upcoming Payments**: Integrated "Planned Payments" section to monitor upcoming bills and subscriptions directly from the dashboard.

### 4. Premium UI/UX
*   **Dark-Mode Aesthetic**: Sleek, glassmorphism-inspired design with vibrant accents.
*   **Micro-animations**: Smooth transitions and interactive feedback on button presses and category selection.
*   **Responsive Layout**: Optimized for various screen sizes with zero text-cutoff or layout distortion.

## 🛠️ Tech Stack

*   **Frontend**: React Native, Expo
*   **Styling**: Vanilla CSS (StyleSheet)
*   **Icons**: Lucide React Native
*   **Database & Auth**: Supabase (PostgreSQL)
*   **Components**: 
    *   `@react-native-community/datetimepicker` (Date/Time selection)
    *   `react-native-svg` (Custom charting)
    *   `react-native-safe-area-context`

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ahsan-Abbas/Wallet-App.git
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
   EXPO_PUBLIC_SUPABASE_SCHEMA=public
   ```

4. **Start the application**:
   ```bash
   npx expo start
   ```

## 🗄️ Database Schema

The app uses a structured Relational schema:
*   **Users**: Profile data and authentication.
*   **Categories**: Hierarchical tree with `parent_id` support for broad grouping.
*   **Transactions**: Core financial records linked to categories.
*   **Budgets**: Category-specific spending limits.
*   **Planned Payments**: Recurring or scheduled transaction tracking.

## 🤝 Contributing

This project was built with a focus on high-quality UI/UX and scalable architecture. Feel free to explore the code and suggest improvements!

---
*Created with ❤️ by Antigravity*