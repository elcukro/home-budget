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
- 🤖 **AI Financial Insights**: Personalized financial analysis and recommendations powered by Claude AI, with multilingual support and efficient caching for quick access
- 🛣️ **Financial Freedom Journey**: Track your progress through Dave Ramsey's 7 Baby Steps with customizable goals and detailed progress tracking

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
- Claude AI integration for intelligent financial insights

## 📝 Changelog

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
  - Added comprehensive error handling for Claude API interactions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+
- Docker and Docker Compose
- PostgreSQL
- Google OAuth credentials (for authentication)
- Claude API key (for AI insights feature)

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
CLAUDE_API_KEY=your_claude_api_key
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
2. Claude AI generates personalized insights and recommendations
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
