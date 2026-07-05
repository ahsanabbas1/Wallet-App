# Detailed Change Log

## File-by-File Changes

### 1. src/lib/schema.js

**Changes Made:**

1. Updated `loans` table creation with new columns:
   - Added `account_id TEXT`
   - Added `due_date TEXT`
   - Added `is_multi_installment INTEGER DEFAULT 0`
   - Added `repayment_type TEXT DEFAULT 'single'`
   - Added `num_installments INTEGER`
   - Added `installment_interval TEXT`

2. Updated `loan_payments` table creation with new columns:
   - Added `due_date TEXT`
   - Added `is_paid INTEGER DEFAULT 0`

3. Added migration logic in `runMigrations()` to ensure columns exist:

   ```javascript
   try {
     await ensureColumn(db, "loans", "account_id", "TEXT");
   } catch (_) {}
   try {
     await ensureColumn(db, "loans", "due_date", "TEXT");
   } catch (_) {}
   try {
     await ensureColumn(
       db,
       "loans",
       "is_multi_installment",
       "INTEGER DEFAULT 0",
     );
   } catch (_) {}
   try {
     await ensureColumn(db, "loans", "repayment_type", "TEXT DEFAULT 'single'");
   } catch (_) {}
   try {
     await ensureColumn(db, "loans", "num_installments", "INTEGER");
   } catch (_) {}
   try {
     await ensureColumn(db, "loans", "installment_interval", "TEXT");
   } catch (_) {}
   try {
     await ensureColumn(db, "loan_payments", "due_date", "TEXT");
   } catch (_) {}
   try {
     await ensureColumn(db, "loan_payments", "is_paid", "INTEGER DEFAULT 0");
   } catch (_) {}
   ```

4. Expanded `seedMissingCategories()` function with more subcategories for daily usage:
   - Food & Drink: Added 8 subcategories
   - Transportation: Added 8 subcategories
   - Housing & Utilities: Added 6 subcategories
   - Entertainment: Added 7 subcategories
   - Shopping: Added 8 subcategories
   - Health & Personal: Added 8 subcategories
   - Financial: Added 7 subcategories
   - Employment: Added 2 subcategories
   - Other Income: Added 6 subcategories

---

### 2. src/services/accountService.js

**Changes Made:**

1. Added import for `transactionService`:

   ```javascript
   import { transactionService } from "./transactionService";
   ```

2. Added new method `transferFunds()`:
   ```javascript
   async transferFunds(userId, fromAccountId, toAccountId, amount, notes = '')
   ```

   - Validates input parameters
   - Checks if both accounts exist
   - Verifies sufficient balance
   - Prevents self-transfer
   - Updates both account balances
   - Creates transfer transaction records
   - Returns success with transfer ID

**Lines Added:** ~50
**Type:** Feature Addition

---

### 3. src/services/loanService.js

**Changes Made:**

1. Updated import to include `transactionService` (already imported)

2. Enhanced `enrichLoan()` function:
   - Added `is_multi_installment` flag conversion
   - Added `nextDuePayment` calculation
   - Added `isOverdue` status tracking

3. Rewrote `saveLoan()` method:
   - Added `account_id` parameter handling
   - Added `due_date` parameter handling
   - Added `is_multi_installment`, `repayment_type`, `num_installments`, `installment_interval` handling
   - Calls `createInstallmentPayments()` for multi-installment loans
   - Updated transaction creation to include `account_id`
   - Updated INSERT and UPDATE SQL with all new columns

4. Added new method `createInstallmentPayments()`:
   - Takes loanId and loanData as parameters
   - Calculates installment amount: totalAmount / numInstallments
   - Creates individual payment records with calculated due dates
   - Marks each payment as unpaid initially

5. Added new method `calculateDueDate()`:
   - Takes baseDate, interval type, and occurrence number
   - Calculates next due date based on interval
   - Supports: weekly, biweekly, monthly, quarterly, yearly
   - Returns calculated Date object

6. Updated `savePayment()` method:
   - Added `due_date` parameter to INSERT
   - Added `is_paid = 1` flag
   - Updated transaction creation to include `account_id` from loan

**Lines Added/Modified:** ~80
**Type:** Feature Enhancement

---

### 4. src/services/notificationService.js

**Changes Made:**

1. Updated `NOTIFICATION_TYPES` export:
   - Added `LOAN_DUE: 'loan_due'`
   - Added `LOAN_OVERDUE: 'loan_overdue'`

2. Updated `NOTIFICATION_META` export:
   - Added metadata for `LOAN_DUE` with color '#9C27B0' and icon 'AlertCircle'
   - Added metadata for `LOAN_OVERDUE` with color '#f44336' and icon 'AlertOctagon'

3. Updated `DEFAULT_PREFERENCES` export:
   - Added `LOAN_DUE: { enabled: true, daysBefore: 3 }`
   - Added `LOAN_OVERDUE: { enabled: true }`

4. Added new function `checkLoanReminders()`:
   - Checks single-date loans with due dates
   - Checks multi-installment loan payments
   - Creates notifications for loans due within threshold
   - Creates alerts for overdue loans/installments
   - Handles both "given" and "received" loan types
   - Uses dedup keys to prevent duplicate notifications

5. Updated `generateNotifications()` function:
   - Added `checkLoanReminders()` to the Promise.all() array
   - Now runs loan reminder checks alongside other notification checks

**Lines Added:** ~100
**Type:** Feature Addition

---

### 5. src/screens/Accounts/index.js

**Changes Made:**

1. Added new state variables for transfer modal:

   ```javascript
   const [showTransfer, setShowTransfer] = useState(false);
   const [transferFrom, setTransferFrom] = useState(null);
   const [transferTo, setTransferTo] = useState(null);
   const [transferAmount, setTransferAmount] = useState("");
   const [transferNotes, setTransferNotes] = useState("");
   const [transferring, setTransferring] = useState(false);
   ```

2. Added `openTransfer()` function:
   - Initializes transfer state
   - Opens transfer modal

3. Added `handleTransfer()` function:
   - Validates input (both accounts selected, valid amount)
   - Checks balance sufficiency
   - Calls `accountService.transferFunds()`
   - Shows success/error alerts
   - Refreshes account list

4. Updated account card UI:
   - Added transfer button (ArrowRightLeft icon) between edit and delete buttons
   - Button calls `openTransfer(acct)`

5. Added transfer modal at the end of component:
   - Full keyboard-aware modal
   - From account display (read-only)
   - To account selector with scrollable account list
   - Amount input field
   - Optional notes field
   - Transfer button with validation

**Lines Added/Modified:** ~100
**Type:** Feature Addition (Transfer Functionality)

---

### 6. src/screens/LoanManagement/index.js

**Changes Made:**

1. Added import for `accountService`:

   ```javascript
   import { accountService } from "../../services/accountService";
   ```

2. Added new state variables for loan enhancements:

   ```javascript
   const [loanDueDate, setLoanDueDate] = useState(new Date());
   const [showLoanDueDate, setShowLoanDueDate] = useState(false);
   const [accounts, setAccounts] = useState([]);
   const [selectedAccount, setSelectedAccount] = useState(null);
   const [repaymentType, setRepaymentType] = useState("single");
   const [numInstallments, setNumInstallments] = useState("");
   const [installmentInterval, setInstallmentInterval] = useState("monthly");
   ```

3. Updated `fetchLoans()` function:
   - Now fetches both loans and accounts in parallel
   - Stores accounts in state

4. Updated `openAddLoan()` function:
   - Initializes new loan fields (dueDate, account, repaymentType, etc.)
   - Pre-populates values when editing existing loan

5. Updated `handleSaveLoan()` function:
   - Added validation for multi-installment (minimum 2)
   - Includes new fields in payload: account_id, due_date, is_multi_installment, repayment_type, num_installments, installment_interval
   - Passes payload to updated `loanService.saveLoan()`

6. Updated loan modal UI with new fields:
   - **Due Date Picker**: Calendar icon, date display, date picker dialog
   - **Account Selector**: Horizontal scrollable list of accounts with "None" option
   - **Repayment Type Toggle**: Single Payment vs Installments buttons
   - **Conditional Multi-Installment Fields** (shown when repayment type is 'multi'):
     - Number of Installments input
     - Installment Interval selector with 5 options

**Lines Added/Modified:** ~150
**Type:** Major Feature Enhancement (Multi-Installment Loans + Account Selection)

---

### 7. src/screens/AddTransaction/index.js

**Changes Made:**

1. Added new state variable for category search:

   ```javascript
   const [categorySearch, setCategorySearch] = useState("");
   ```

2. Updated category modal UI:
   - Added search input at top of modal (between handle and header)
   - Search input shows:
     - Search icon
     - TextInput with placeholder "Search categories..."
     - Clear button (×) when search text is present
   - Search input only shows in parent category view (not in subcategory view)

3. Updated category filtering logic:
   - When displaying parent categories, now filters by search term
   - Filter is case-insensitive using `.toLowerCase().includes()`
   - Applied to `.filter(c => !c.parent_id)` (parent categories only)

4. Updated modal close handlers:
   - When closing modal, `setCategorySearch('')` is also called to clear search state

**Lines Added/Modified:** ~40
**Type:** Feature Addition (Category Search)

---

## Summary Statistics

- **Total Files Modified**: 7
- **Total Lines Added**: ~500+
- **New Functions**: 5 (transferFunds, createInstallmentPayments, calculateDueDate, checkLoanReminders, openTransfer, handleTransfer, etc.)
- **New State Variables**: 20+
- **New Database Columns**: 8
- **New Notification Types**: 2
- **New Categories/Subcategories**: 50+

---

## Breaking Changes

**None** - All changes are backwards compatible with existing data.

---

## Performance Impact

- Minimal: Most changes are data additions
- Account transfer queries: O(1) for updates
- Loan reminder checks: O(n) where n = number of active loans (runs periodically, not on every transaction)
- Category search: O(n) where n = number of categories (client-side, very fast)

---

## Testing Coverage Needed

1. Fund transfer functionality with edge cases
2. Multi-installment loan creation and payment tracking
3. Loan reminder notifications at various time thresholds
4. Category search functionality with different search terms
5. Backwards compatibility with existing single-date loans
6. Account selection optional behavior
7. Database migrations for existing databases
