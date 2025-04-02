# Banking Integration Documentation

## Overview

The Home Budget application integrates with the GoCardless Bank Account Data API to provide real-time bank data. This integration allows users to:

1. Connect to their bank accounts securely
2. Access account information and balances
3. View transaction history
4. Retrieve account owner details
5. Test functionality using a sandbox environment

## Features

### 1. Bank Connection Flow

The integration provides a multi-step flow for connecting to bank accounts:

- **Country Selection**: Choose your country to see available banks
- **Institution Selection**: Select your bank from the list of supported institutions
- **Authentication**: Securely authenticate with your bank through the GoCardless flow
- **Account Selection**: Choose which accounts to access
- **Data Retrieval**: View transactions and account details

### 2. Account Information

For each connected account, the system displays:

- Account owner name
- Account type/product (e.g., "Current Account for Individuals")
- Currency
- Transaction history
- Full account details when needed

### 3. Transaction Data

The banking page displays:

- Booked (completed) transactions
- Pending transactions
- Details including date, description, amount, and currency
- Full transaction JSON data when clicking on individual transactions

### 4. Sandbox Mode

For testing without using real bank credentials:

- Toggle "Sandbox Mode" in the banking page
- Use GoCardless sandbox bank (SANDBOXFINANCE_SFIN0000)
- Test all functionality in a simulated environment
- No real bank credentials required

### 5. Connection Management

Banking connections are:

- Securely stored in the database
- Automatically expired after 90 days (GoCardless limitation)
- Available for future use without re-authentication
- Displayed with human-readable account names

## Technical Implementation

### Backend Components

- **BankingConnection Model**: Stores connection details, requisition IDs, accounts, and account names
- **Banking Router (FastAPI)**: Handles API requests to GoCardless
- **Account Details Endpoint**: Retrieves and formats account owner information
- **Token Caching**: Optimizes API calls with token caching

### Frontend Components

- **Banking Page**: Multi-step UI for bank connection
- **Transaction Display**: Interactive tables with clickable rows
- **Transaction Details Modal**: Shows complete JSON data for each transaction
- **Sandbox Toggle**: Easy switching between real and test environments

### API Integration

The application communicates with GoCardless through these primary endpoints:

- `/banking/token`: Authentication with GoCardless
- `/banking/institutions`: List available banks
- `/banking/requisitions`: Create bank connection requests
- `/banking/accounts/{id}/details`: Get account details including owner information
- `/banking/accounts/{id}/transactions`: Retrieve transaction history
- `/banking/connections`: Manage saved connections

## Usage Guide

### Connecting to Your Bank

1. Navigate to the Banking page
2. Select your country and click "Get Institutions"
3. Choose your bank from the list
4. Click "Create Bank Connection Link"
5. Follow the authentication process with your bank
6. Select accounts to access
7. View transactions and account details

### Using Sandbox Mode

1. Toggle the "Sandbox Mode" switch at the top of the Banking page
2. Create a requisition using the sandbox bank (no real credentials needed)
3. Test all functionality with simulated data
4. Toggle off to return to real bank connections

### Viewing Transaction Details

1. Connect to a bank and select an account
2. Click "Get Transactions" to view transaction history
3. Click on any transaction row in the table
4. View the complete JSON data in the modal that appears
5. Close the modal to return to the transaction list

### Managing Connections

1. After connecting to a bank, click "Save Bank Connection to Settings"
2. The connection will be saved for future use
3. Return to the Banking page anytime to view saved connections
4. The system will auto-populate connection details when available

## Security Considerations

- No bank credentials are stored in the application
- GoCardless handles all sensitive authentication
- Connections expire after 90 days (GoCardless requirement)
- The application only receives read-only access to accounts
- Account details are stored securely in the database

## Troubleshooting

### Common Issues

1. **Connection Errors**: 
   - Check your internet connection
   - Ensure GoCardless credentials are properly configured
   - Verify that your bank is supported in your region

2. **Missing Transactions**: 
   - Some banks limit transaction history to 90 days
   - Try reconnecting to refresh the data

3. **Expired Connections**:
   - GoCardless connections expire after 90 days
   - Reconnect to reestablish access

4. **API Rate Limits**:
   - Use sandbox mode for testing to avoid hitting limits
   - Account details are limited to 4 queries per day per account

### Sandbox Testing

For development and testing, always use sandbox mode to:
- Avoid API rate limits
- Test without real credentials
- Create consistent test data

## API Reference

### Account Details Response

```json
{
  "account": {
    "resourceId": "PL03105014611000009788197607",
    "iban": "PL03105014611000009788197607",
    "currency": "PLN",
    "ownerName": "FELSZTUKIER LENA EWA",
    "product": "Current Account for Individuals (Retail)",
    "bic": "INGBPLPW",
    "ownerAddressUnstructured": [
      "DZIKICH PÓL 17",
      "93-640 ŁÓDŹ"
    ]
  }
}
```

### Transaction Response

Clicking on any transaction will show the full JSON data with all available fields.