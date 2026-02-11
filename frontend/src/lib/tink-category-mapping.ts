/**
 * Tink Category Mapping
 *
 * Maps Tink's PFM category names to our app's expense/income categories
 */

export type AppCategory =
  | "housing"
  | "transportation"
  | "food"
  | "utilities"
  | "insurance"
  | "healthcare"
  | "entertainment"
  | "salary"
  | "freelance"
  | "investments"
  | "rental"
  | "other";

/**
 * Maps Tink PFM category names to app categories
 * Tink categories come from their enrichment API
 */
const TINK_TO_APP_CATEGORY: Record<string, AppCategory> = {
  // Food & Groceries
  "Groceries": "food",
  "Restaurants": "food",
  "Food & Beverage": "food",
  "Bar & Café": "food",
  "Fast Food": "food",

  // Transportation
  "Transportation": "transportation",
  "Car": "transportation",
  "Public Transport": "transportation",
  "Taxi": "transportation",
  "Gas": "transportation",
  "Parking": "transportation",

  // Housing
  "Home": "housing",
  "Rent": "housing",
  "Mortgage": "housing",
  "Home Improvement": "housing",

  // Utilities
  "Utilities": "utilities",
  "Phone": "utilities",
  "Internet": "utilities",
  "Electricity": "utilities",

  // Healthcare
  "Healthcare": "healthcare",
  "Pharmacy": "healthcare",
  "Doctor": "healthcare",

  // Entertainment
  "Entertainment": "entertainment",
  "Shopping": "entertainment",
  "Sports & Fitness": "entertainment",
  "Travel": "entertainment",
  "Hobbies": "entertainment",

  // Income categories
  "Salary": "salary",
  "Income": "salary",
  "Freelance": "freelance",
  "Investment Income": "investments",
  "Rental Income": "rental",

  // Insurance
  "Insurance": "insurance",

  // Catch-all
  "Expenses": "other",
  "Transfers": "other",
  "Cash Withdrawal": "other",
};

/**
 * Convert Tink PFM category name to app category
 */
export function mapTinkCategoryToApp(tinkCategory: string | null | undefined): AppCategory {
  if (!tinkCategory) return "other";

  // Try exact match first
  if (TINK_TO_APP_CATEGORY[tinkCategory]) {
    return TINK_TO_APP_CATEGORY[tinkCategory];
  }

  // Try partial match (case-insensitive)
  const normalized = tinkCategory.toLowerCase();
  for (const [key, value] of Object.entries(TINK_TO_APP_CATEGORY)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return value;
    }
  }

  return "other";
}

/**
 * Extract clean category name from Tink's dotted path
 * Example: "expenses.food.groceries" → "Groceries"
 */
export function extractTinkCategoryName(fullPath: string | null | undefined): string | null {
  if (!fullPath) return null;

  // Split by dot and get last segment
  const segments = fullPath.split(".");
  const lastSegment = segments[segments.length - 1];

  // Capitalize first letter
  return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
}
