# Home Budget Application

A modern, full-stack personal finance management application built with Next.js, FastAPI, and PostgreSQL. Track your income, expenses, and loans with an intuitive user interface and robust backend.

## 🌟 Features

### Core Functionality
- 💰 **Income Management**: Track various income sources with recurring payment support
- 💳 **Expense Tracking**: Categorize and monitor expenses with detailed insights
- 📊 **Loan Management**: Comprehensive loan tracking with interest rates and payment schedules
- 📈 **Financial Reports**: Generate detailed reports and analytics with interactive charts
- 🔄 **Recurring Transactions**: Set up and manage recurring income and expenses
- 🤖 **AI Financial Insights**: Personalized financial analysis and recommendations powered by Claude AI, with multilingual support and efficient caching for quick access

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

## 📡 API Endpoints

### User Settings
- `GET /users/{email}/settings/` - Fetch user settings
- `PUT /users/{email}/settings/` - Update user settings
- `GET /users/{email}/export/?format={format}` - Export user data (JSON/CSV/XLSX)

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
