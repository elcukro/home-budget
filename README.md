# Home Budget Application

A full-stack personal finance management application built with Next.js, FastAPI, and PostgreSQL. Track your income, expenses, and loans with an intuitive user interface and robust backend.

## Features

- 💰 **Income Management**: Track various income sources with recurring payment support
- 💳 **Expense Tracking**: Categorize and monitor expenses with detailed insights
- 📊 **Loan Management**: Comprehensive loan tracking with interest rates and payment schedules
- 🌓 **Dark Mode Support**: Comfortable viewing experience with automatic theme switching
- 📱 **Responsive Design**: Fully responsive interface that works on desktop and mobile
- 🔒 **Data Validation**: Robust form validation for data integrity
- 💡 **Helpful Tooltips**: Contextual help throughout the application

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- React Hook Form
- Heroicons

### Backend
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- Docker

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+
- Docker and Docker Compose
- PostgreSQL

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/home-budget.git
cd home-budget
```

2. Set up the frontend:
```bash
cd frontend
npm install
```

3. Set up the backend:
```bash
cd backend
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate
pip install -r requirements.txt
```

4. Create a `.env` file in the backend directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/homebudget
SECRET_KEY=your_secret_key
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

## Project Structure

```
home-budget/
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js pages and routes
│   │   │   ├── components/   # Reusable React components
│   │   │   └── utils/        # Utility functions and helpers
│   │   ├── public/           # Static assets
│   │   └── package.json
│   ├── backend/
│   │   ├── src/
│   │   │   ├── models/       # Database models
│   │   │   ├── schemas/      # Pydantic schemas
│   │   │   └── main.py      # FastAPI application
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── docker-compose.yml
```

## Features in Detail

### Income Management
- Add and track multiple income sources
- Support for recurring and one-time income
- Detailed history and editing capabilities
- Data validation and formatting

### Expense Tracking
- Categorized expense management
- Recurring expense support
- Detailed transaction history
- Category-based filtering and sorting

### Loan Management
- Track multiple loans with detailed information
- Calculate interest rates and payment schedules
- Monitor remaining balances
- Track payment history

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
