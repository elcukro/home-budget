# Home Budget Application

A modern, full-stack personal finance management application built with Next.js, FastAPI, and PostgreSQL. Track your income, expenses, and loans with an intuitive user interface and robust backend.

## 🌟 Features

### Core Functionality
- 💰 **Income Management**: Track various income sources with recurring payment support
- 💳 **Expense Tracking**: Categorize and monitor expenses with detailed insights
- 📊 **Loan Management**: Comprehensive loan tracking with interest rates and payment schedules
- 💵 **Savings Management**: Track your savings with categories and goals, deposits and withdrawals
- 📈 **Financial Reports**: Generate detailed reports and analytics with interactive charts
- 🔄 **Recurring Transactions**: Set up and manage recurring income, expenses, and savings
- 🤖 **AI Financial Insights**: Personalized financial analysis and recommendations powered by Anthropic Claude, aligned with FIRE philosophy and Dave Ramsey's Baby Steps methodology, with Polish tax optimization and efficient caching
- 🛣️ **Financial Freedom Journey**: Track your progress through Dave Ramsey's 7 Baby Steps with customizable goals and detailed progress tracking
- 🏦 **Banking Integration**: Securely connect to bank accounts and access transaction data using Tink API (supports Polish banks: ING, PKO BP, mBank, etc.)
- 🏠 **Landing Page**: Beautiful public landing page with storytelling about financial freedom journey
- 💳 **Subscription Management**: Stripe-powered subscription system with free and premium tiers

### User Experience
- 🌓 **Dark Mode Support**: Comfortable viewing experience with automatic theme switching
- 📱 **Responsive Design**: Fully responsive interface that works on desktop and mobile
- 🌍 **Internationalization**: Comprehensive multi-language support (English, Polish, Spanish) with automatic formatting
- 💰 **Currency Support**: Multiple currency support (USD, EUR, GBP, PLN, JPY) with automatic formatting
- 🔒 **Secure Authentication**: Google OAuth integration for secure sign-in
- 📤 **Data Export**: Export your financial data in JSON, CSV, or Excel formats

### Technical Features
- 🔍 **Data Validation**: Robust form validation and error handling
- 💡 **Helpful Tooltips**: Contextual help throughout the application
- 📊 **Real-time Updates**: Instant feedback on data changes
- 🔄 **Automatic Calculations**: Smart calculations for loans and balances
- 📱 **Progressive Web App**: Installable on mobile devices
- 🛡️ **Enhanced Error Handling**: Comprehensive error handling with development mode logging
- 🔗 **RESTful API**: Well-structured API endpoints following REST principles

## 🛠️ Tech Stack

### Frontend
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- React Hook Form for form management
- Heroicons for beautiful icons
- React Intl for internationalization
- NextAuth.js for authentication
- React Query for data fetching
- Chart.js and react-chartjs-2 for interactive charts
- Zod for schema validation
- React Hot Toast for notifications

### Backend
- FastAPI for high-performance API
- PostgreSQL for reliable data storage
- SQLAlchemy for database ORM
- Pydantic for data validation
- Docker for containerization
- Alembic for database migrations
- JWT for authentication
- CORS for secure cross-origin requests
- Anthropic Claude integration for FIRE-aligned financial insights
- GoCardless API integration for secure bank account access

## 📝 Changelog

### 2026-01-16
- 🤖 **AI Analysis Major Improvements**:
  - Changed AI provider from OpenAI to Anthropic Claude for better financial insights
  - Moved AI Analysis from modal dialog to dedicated `/ai-analysis` page with sidebar navigation
  - Added FIRE (Financial Independence, Retire Early) and Baby Steps methodology alignment
  - Fixed debt payoff strategy - now uses Debt Snowball (smallest balance first) as per Dave Ramsey method
  - Added proper loan type categorization:
    - Baby Step 2 debts: consumer loans, credit cards, personal loans (pay off now)
    - Mortgage: Baby Step 6 only (ignored until steps 1-5 complete)
    - Leasing: fixed contracts that cannot be prepaid (excluded from payoff suggestions)
  - Added high-interest loan overpayment recommendations with interest savings calculations
  - Fixed emergency fund calculations - pre-calculated values to prevent AI math errors
  - Added Polish tax optimization context (IKE/IKZE limits, youth tax relief, PPK, author's costs)
  - Added cache status banner with generation timestamp and refresh button
  - Added FIRE metrics banner showing current Baby Step, FIRE Number, and savings rate
  - Added clickable markdown links in action items pointing to relevant app sections
- ⚙️ **Tax Profile Settings**:
  - Added "Tax Profile" section to Settings page with editable fields:
    - Birth year (for youth tax relief eligibility check)
    - Number of children
    - Employment status (employee, B2B, contract, freelancer, business, unemployed)
    - Tax form (scale, flat, lump sum, tax card)
    - PPK enrollment status with contribution rates
    - Author's costs (50% KUP) toggle
  - Data now used by AI Analysis for personalized tax optimization advice
  - Full i18n support for all new fields (PL, EN)
- 🌍 **Internationalization**:
  - Added translations for AI Analysis page and new insight categories
  - Added translations for Tax Profile settings section
  - Updated insight categories: `baby_steps`, `debt`, `savings`, `fire`, `tax_optimization`

### 2026-01-15
- 🏠 **Landing Page**:
  - Added public landing page for unauthenticated users with compelling storytelling
  - Created 11 landing components: HeroSection, StatisticsSection, ProblemsSection, SolutionSection, BabyStepsExplainer, FeaturesSection, ModulesShowcase, TestimonialsSection, PricingSection, FinalCTASection, LandingFooter
  - Implemented route groups: `(landing)` for public routes, `(dashboard)` for protected routes
  - Automatic redirect for authenticated users from landing to dashboard
- 💵 **Savings Module Improvements**:
  - Added `end_date` field for recurring savings (auto-stopping recurring items)
  - Added change rate functionality with full history tracking
  - Added goal projection feature to estimate when savings target will be reached
  - Added collapsible history grouping in the table view
  - Added tax disclaimer component for Polish users
- 📊 **Loans Module Fixes**:
  - Fixed months remaining calculation using proper amortization formula with compound interest
  - Fixed `addMonths()` date function for month-end edge cases (e.g., Jan 31 + 1 month = Feb 28/29)
  - Added payment schedule with interest/principal breakdown columns
  - Fixed hardcoded Polish text in DebtPayoffStrategy component (full i18n)
  - Added warning when monthly payment doesn't cover monthly interest
  - Added backend Pydantic validation for all loan fields
- 💳 **Subscription & Billing**:
  - Added Stripe billing integration with subscription management
  - Added subscription context and premium gate hook
  - Added pricing page for subscription plans
- 🌍 **Internationalization**:
  - Added i18n translations for all new features in PL, EN, ES
  - Added tax limits configuration for Polish tax year 2026

### 2025-03-25
- ✨ **New Feature**:
  - Added Banking Integration with GoCardless API for secure bank account connections
  - Implemented requisition management and bank account data access
  - Added UI for connecting to banks, viewing accounts, and fetching transactions
  - Created settings page integration to manage bank connections
  - Added transaction fetching capability for connected accounts

### 2025-03-10
- ✨ **New Feature**: 
  - Added Savings Management feature with categories, goals, deposits, and withdrawals
  - Added support for recurring savings
  - Added support for target amounts for savings goals
  - Implemented filtering by category and date range
- 🎨 **UI Improvements**:
  - Standardized dark mode implementation across all pages including Savings
  - Improved layout consistency between all form-based pages
  - Fixed styling inconsistencies in tables and cards
- 🔄 **Data Management**:
  - Enhanced export/import functionality to include Savings data
  - Added Financial Freedom settings to data export (emergency fund target and months)
  - Fixed bug in import feature for settings data

### 2025-03-07
- 🚀 **Feature Enhancement**:
  - Improved Financial Freedom journey tracking with dynamic emergency fund months from user settings
  - Enhanced BabyStep 6 (Pay Off Home Early) to use real mortgage data
  - Added localization for all Financial Freedom components in all supported languages
  - Added visual progress indicators for each baby step
  - Improved mobile responsiveness of Financial Freedom page

### 2025-03-06
- 🐛 **Bug Fix**: 
  - Fixed 500 error in Financial Freedom feature by properly serializing BabyStep objects to JSON before storing in the database
  - Updated both creation and update logic to consistently handle object serialization

### 2025-03-05
- 🧹 **Dependency Cleanup**: Removed unused Recharts package, reducing bundle size and dependencies
- 🐛 **Bug Fixes**: 
  - Fixed missing translation key for AI insights modal close button
  - Added language column to insights_cache table to support multilingual insights
- 🤖 **AI Insights Enhancement**: 
  - Added multilingual support for AI-generated financial insights
  - Implemented efficient caching system with language-specific entries
  - Optimized database queries with indexed lookups
  - Added comprehensive error handling for OpenAI API interactions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+
- Docker and Docker Compose
- PostgreSQL
- Google OAuth credentials (for authentication)
- OpenAI API key (for AI insights feature)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/home-budget.git
cd home-budget
```

2. Set up environment variables:

Frontend (.env.local):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Backend (.env):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/homebudget
SECRET_KEY=your_secret_key
CORS_ORIGINS=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key
GOCARDLESS_SECRET_ID=your_gocardless_secret_id
GOCARDLESS_SECRET_KEY=your_gocardless_secret_key
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Set up the backend:
```bash
cd backend
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate
pip install -r requirements.txt
```

5. Start the development servers:

Frontend:
```bash
cd frontend
npm run dev
```

Backend:
```bash
cd backend
uvicorn src.main:app --reload
```

Or using Docker:
```bash
docker-compose up
```

## 📁 Project Structure

```
home-budget/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages and routes
│   │   ├── components/       # Reusable React components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript types
│   ├── public/              # Static assets
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── models/          # Database models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   └── main.py         # FastAPI application
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend tests
│   └── requirements.txt
├── shared/                 # Shared types and utilities
├── docker-compose.yml      # Docker configuration
└── README.md
```

## 🧠 AI Financial Insights

The Home Budget Application features an intelligent AI-powered financial analysis system that provides personalized insights and recommendations based on your financial data.

### Key Features
- **Personalized Analysis**: Receive tailored insights about your spending patterns, savings opportunities, and financial health
- **Categorized Insights**: Insights are organized into categories like Spending, Savings, Debt, and Income for easy navigation
- **Actionable Recommendations**: Get practical suggestions to improve your financial situation
- **Multilingual Support**: Access insights in your preferred language (English, Polish, Spanish)
- **Efficient Caching**: Insights are cached for quick access while ensuring data is up-to-date

### How It Works
1. The system analyzes your income, expenses, and loan data
2. OpenAI GPT generates personalized insights and recommendations
3. Results are cached in the database with language-specific entries
4. Cached insights are marked as stale when your financial data changes
5. You can manually refresh insights at any time

### Technical Implementation
- **Caching System**: Efficient database caching with language-specific entries
- **Staleness Tracking**: Automatic detection of when insights need refreshing
- **Optimized Database**: Indexed queries for fast retrieval based on user ID and language
- **Error Handling**: Robust error handling for API rate limits and service disruptions

## 💵 Savings Management

Track and manage your savings with a comprehensive system designed for different financial goals.

### Key Features
- **Categorized Savings**: Organize savings by purpose (Emergency Fund, Retirement, College, etc.)
- **Deposits & Withdrawals**: Track money flowing in and out of your savings
- **Savings Goals**: Set target amounts for different savings categories
- **Recurring Savings**: Set up recurring monthly savings contributions
- **Filtering & Search**: Filter savings by category or date range
- **Summary Statistics**: View total savings and monthly contribution rates
- **Dark Mode Support**: Full dark mode compatibility for comfortable viewing
- **Responsive Design**: Use on any device with appropriate layout adjustments

### Categories
- **Emergency Fund**: Track your emergency savings (integrates with Financial Freedom Baby Steps 1 & 3)
- **Retirement**: Long-term savings for retirement
- **College**: Educational savings for yourself or dependents
- **General**: General purpose savings
- **Investments**: Investment funds
- **Other**: Custom savings categories

### Technical Implementation
- **Flexible Schema**: Store both one-time and recurring transactions
- **Filtering System**: Efficient database queries for filtering
- **Data Integration**: Connect savings data to other parts of the application
- **Full Localization**: Available in all supported languages
- **Export/Import**: Include savings data in data exports and imports

## 🛣️ Financial Freedom Journey

Track your progress through Dave Ramsey's 7 Baby Steps methodology to achieve financial freedom.

### Key Features
- **Structured Plan**: Follow the proven 7 Baby Steps methodology developed by Dave Ramsey
- **Visual Progress Tracking**: See your overall journey and progress on each step with visual indicators
- **Customizable Goals**: Set personalized targets for emergency funds and other financial goals
- **Auto-calculation**: Automatic progress calculation for Baby Steps 1-3 based on your financial data
- **Mortgage Integration**: Baby Step 6 integrates with your mortgage data to track home payoff progress
- **Configurable Settings**: Customize your emergency fund target and months of expenses based on your needs

### The 7 Baby Steps
1. **Save $1,000 Emergency Fund**: A starter emergency fund to cover unexpected expenses
2. **Pay Off All Debt**: Eliminate all debt (except mortgage) using the debt snowball method
3. **3-6 Months of Expenses**: Build a fully-funded emergency fund
4. **Invest 15% for Retirement**: Begin investing 15% of household income for retirement
5. **College Funding**: Save for children's college education
6. **Pay Off Home Early**: Make extra payments to pay off your mortgage
7. **Build Wealth and Give**: Grow your wealth and give generously

### Technical Implementation
- **Dynamic Calculation**: Real-time calculation of progress percentages
- **User Customization**: Flexible targets based on user preferences in settings
- **Loan Integration**: Direct connection with mortgage data from loans section
- **Internationalization**: Fully localized in all supported languages
- **Persistent Storage**: Progress data is stored in the database for long-term tracking

## 🏦 Banking Integration

Connect securely to your bank accounts and access your financial data using the GoCardless Bank Account Data API.

### Key Features
- **Secure Authentication**: Connect to your bank using secure authorization flow
- **Bank Account Access**: Get access to your bank accounts with proper consent
- **Transaction History**: View transaction details from your connected accounts
- **Requisition Management**: Store and manage bank connection details
- **Expiration Handling**: Track connection expiration dates (typically 90 days)
- **Connection Settings**: Manage your bank connections in user settings

### How It Works
1. **Select Your Bank**: Choose from available financial institutions in your country
2. **Authorize Access**: Authenticate securely through your bank's website
3. **Access Accounts**: Once authorized, your accounts become available
4. **View Transactions**: Access transaction data from your connected accounts
5. **Manage Connections**: View and manage all bank connections in settings

### Technical Implementation
- **Secure API**: Uses the GoCardless Bank Account Data API for secure access
- **OAuth Flow**: Follows secure OAuth authentication patterns
- **Token Management**: Handles API tokens securely with proper expiration
- **Connection Storage**: Saves connection details in the database
- **Settings Integration**: Provides UI for managing connections in settings

## 📡 API Endpoints

### User Settings
- `GET /users/{email}/settings/` - Fetch user settings
- `PUT /users/{email}/settings/` - Update user settings
- `GET /users/{email}/export/?format={format}` - Export user data (JSON/CSV/XLSX)
- `POST /users/{email}/import` - Import user data (optional parameter: clear_existing)

### AI Insights
- `GET /users/{email}/insights` - Fetch AI-generated financial insights
- `GET /users/{email}/insights?refresh=true` - Force refresh of AI-generated insights

### Income
- `GET /users/{email}/income/` - Fetch user income entries
- `POST /users/{email}/income/` - Create new income entry
- `PATCH /users/{email}/income/{id}` - Update income entry
- `DELETE /users/{email}/income/{id}` - Delete income entry

### Expenses
- `GET /users/{email}/expenses/` - Fetch user expenses
- `POST /users/{email}/expenses/` - Create new expense
- `PATCH /users/{email}/expenses/{id}` - Update expense
- `DELETE /users/{email}/expenses/{id}` - Delete expense

### Loans
- `GET /users/{email}/loans/` - Fetch user loans
- `POST /users/{email}/loans/` - Create new loan
- `PATCH /users/{email}/loans/{id}` - Update loan
- `DELETE /users/{email}/loans/{id}` - Delete loan

### Savings
- `GET /api/savings` - Fetch user savings (with optional filtering)
- `GET /api/savings/summary` - Get savings summary
- `POST /api/savings` - Create new saving entry
- `PUT /api/savings/{id}` - Update saving entry
- `DELETE /api/savings/{id}` - Delete saving entry

### Financial Freedom
- `GET /api/financial-freedom` - Get user's financial freedom journey progress
- `POST /api/financial-freedom` - Create/initialize financial freedom journey
- `PUT /api/financial-freedom` - Update financial freedom progress
- `PATCH /api/financial-freedom/baby-steps/{step_id}` - Update specific baby step

### Banking
- `GET /api/banking/institutions?country={country}` - Get list of available banks by country
- `POST /api/banking/requisitions` - Create a requisition for bank access
- `GET /api/banking/requisitions/{requisition_id}` - Get details of a requisition
- `GET /api/banking/accounts/{account_id}/transactions` - Get transactions for a specific account
- `POST /api/banking/connections` - Save a bank connection to user settings
- `GET /api/banking/connections` - List user's bank connections
- `DELETE /api/banking/connections/{id}` - Remove a bank connection

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [FastAPI](https://fastapi.tiangolo.com/) for the high-performance API framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [PostgreSQL](https://www.postgresql.org/) for the reliable database
- All contributors and maintainers

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.
