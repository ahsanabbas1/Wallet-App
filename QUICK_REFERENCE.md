# Quick Reference Guide - New Features

## 1. ACCOUNTS PAGE - FUND TRANSFER

### How to Use:

1. Go to Accounts page
2. Click the transfer icon (↔) on an account card
3. Select destination account from the list
4. Enter transfer amount
5. Add optional notes (e.g., "Salary transfer")
6. Tap "Transfer" button

### What Happens:

- Source account balance decreases by amount
- Destination account balance increases by amount
- Two transaction records created (one per account)
- Both visible in transaction history
- Can be tracked per account

### Key Features:

- ✅ Prevents transferring to same account
- ✅ Validates sufficient balance
- ✅ Optional notes for reference
- ✅ Real-time balance updates
- ✅ Transaction audit trail

---

## 2. ADD RECORD PAGE - CATEGORY SEARCH

### How to Use:

1. Go to Add Transaction/Record page
2. Tap on the category selector
3. Start typing in the search box (appears at top of modal)
4. Results filter in real-time
5. Tap result or clear search to browse all

### Search Examples:

- Type "Food" → Shows "Food & Drink" category
- Type "trans" → Shows "Transportation" category
- Type "health" → Shows "Health & Personal" category

### Key Features:

- ✅ Case-insensitive search
- ✅ Real-time filtering
- ✅ Works with parent categories
- ✅ Subcategories appear after selecting parent
- ✅ Clear button (×) to reset search

### New Categories Available:

- 50+ new subcategories across expense types
- Common daily items now included
- Better coverage of:
  - Food & beverages
  - Transportation
  - Shopping
  - Personal care
  - Financial services

---

## 3. LOANS PAGE - MULTI-FEATURE ENHANCEMENTS

### 3.1 ACCOUNT SELECTION

**How to Use:**

1. Open "New Loan" modal
2. Scroll to "Account" section
3. Tap an account name to link loan to it
4. Selected account shows highlighted

**Why Link Account:**

- Track which account loan is from/to
- Useful for business vs personal accounts
- Better financial tracking
- Optional feature (can skip)

---

### 3.2 LOAN DATES

**Loan Date:**

- When you gave/received the loan
- Required field
- Tap calendar icon to pick date

**Due Date:**

- When loan needs to be repaid
- Optional field
- Use for single-date loans
- First installment date for multi-installment

**How to Set:**

1. Tap calendar button next to date field
2. Pick date from calendar
3. Date displays in readable format

---

### 3.3 REPAYMENT OPTIONS

### Option A: Single Payment (Default)

Use when:

- Loan will be repaid all at once
- Simple lending arrangement
- One-time payment expected

Steps:

1. Keep "Single Payment" selected
2. Enter due date (optional)
3. Record loan as normal
4. Track repayments manually

### Option B: Multi-Installment (NEW)

Use when:

- Loan will be paid over multiple months/periods
- Monthly, quarterly, or yearly payments
- Want automated reminder schedule

Steps:

1. Select "Installments" toggle
2. Enter "Number of Installments" (e.g., 12)
3. Select "Installment Interval":
   - **Weekly**: Payment every 7 days
   - **Biweekly**: Payment every 14 days
   - **Monthly**: Payment every month (most common)
   - **Quarterly**: Payment every 3 months
   - **Yearly**: Payment every year

4. System automatically creates payment schedule
5. Each installment shows in loan details

**Example:**

- Loan: 120,000 PKR
- Installments: 12
- Interval: Monthly
- → Creates 12 payments of 10,000 PKR each, monthly

---

### 3.4 LOAN REMINDERS & NOTIFICATIONS

**What You'll Get:**

1. **Loan Due Reminder** (3 days before due date)
   - Notification: "Loan Due: [Person Name]"
   - Shows: Amount and days until due
   - Example: "₹10,000 due in 3 days to Raj"

2. **Loan Overdue Alert** (when due date passes)
   - Notification: "⚠️ Overdue Loan: [Person Name]"
   - Shows: Amount and how many days overdue
   - Example: "⚠️ ₹10,000 overdue since 2 days from Priya"

3. **Installment Reminders** (for multi-installment loans)
   - Same as above but for each payment
   - Individual notifications per installment
   - Shows which installment is due

**Enabling/Disabling:**

- Go to Notification Settings
- Find "Loan Due Reminders" and "Overdue Loan Alerts"
- Toggle on/off as needed
- Customize days before reminder (default: 3 days)

**Where to See:**

- Notification bell in app header
- Notification history page
- Marked as "unread" until tapped

---

## QUICK TIPS

### Fund Transfers:

💡 "Use transfers to move money between accounts. Great for allocation strategies!"

### Category Search:

💡 "Search saves time finding the right category. Type first 3-4 letters!"

### Multi-Installment Loans:

💡 "Monthly intervals are most common. System auto-calculates payment amounts!"

### Loan Reminders:

💡 "Enable overdue alerts to never miss a payment. Great for tracking owed money!"

---

## TROUBLESHOOTING

### Transfer Not Working?

- ✓ Check source account has enough balance
- ✓ Ensure you selected a different destination account
- ✓ Both accounts must be active

### No Category Search Results?

- ✓ Try searching with fewer characters
- ✓ Category search is case-insensitive
- ✓ Exact spelling not required

### Loan Installments Not Created?

- ✓ Verify you selected "Installments" (not "Single Payment")
- ✓ Check number of installments is at least 2
- ✓ Select an interval

### Not Getting Loan Reminders?

- ✓ Check notification preferences are enabled
- ✓ Verify loan has a due date set
- ✓ Reminders sent 3 days before due date (or when overdue)
- ✓ Check app notification permissions

---

## KEYBOARD SHORTCUTS (Mobile)

| Action           | Gesture                           |
| ---------------- | --------------------------------- |
| Open transfer    | Tap ↔ icon on account card        |
| Search category  | Tap category modal + start typing |
| Select account   | Tap account in horizontal list    |
| Pick date        | Tap calendar icon                 |
| Toggle repayment | Tap button toggle                 |

---

## FEATURE DEPENDENCIES

### Fund Transfer Requires:

- ✅ At least 2 active accounts
- ✅ Source account with balance > transfer amount

### Category Search Works With:

- ✅ All existing categories
- ✅ 50+ new subcategories
- ✅ Both expense and income categories

### Multi-Installment Loans Require:

- ✅ Total amount > 0
- ✅ Number of installments ≥ 2
- ✅ Valid interval selected

### Loan Reminders Require:

- ✅ Due date set on loan
- ✅ Loan status is "Active" (not settled)
- ✅ Notification preferences enabled

---

## DATA PERSISTENCE

### Stored Data:

- ✅ All transfers recorded as transactions
- ✅ Loan dates and due dates persisted
- ✅ Account associations saved with loans
- ✅ Installment schedules stored
- ✅ Payment status tracked

### Recovery:

- ✅ All data backs up automatically
- ✅ Can edit any loan (dates, amounts, etc.)
- ✅ Can modify installments
- ✅ Delete and re-create as needed

---

## VERSION INFO

**Features Added in This Update:**

- v1.1.0: Fund Transfer Between Accounts
- v1.2.0: Category Search & Expanded Categories
- v1.3.0: Loan Multi-Installments & Account Selection
- v1.4.0: Loan Reminders & Notifications

**Compatibility:**

- ✅ Works with existing data
- ✅ Backwards compatible
- ✅ No data loss
- ✅ Gradual adoption of new features

---

**Last Updated**: June 28, 2026
**Status**: Ready for Production
