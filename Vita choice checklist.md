# Vita Choice Mobile App - Feature Checklist (Updated)

## 🔐 Authentication & User Management

### Registration & Login
- [ ] Welcome/Splash screen with app branding
- [ ] User registration with form validation
  - [ ] Email field with format validation and availability check
  - [ ] Password field with strength indicator
  - [ ] Confirm password with match validation
  - [ ] First name and last name (optional)
- [ ] User login with email and password
- [ ] JWT token storage in AsyncStorage
- [ ] Auto-login with stored valid tokens
- [ ] "Remember Me" functionality
- [ ] Session expiration handling
- [ ] Automatic token refresh on expiry

### Account Management
- [ ] View user profile information
- [ ] Edit profile (first name, last name, email)
- [ ] Change password functionality
- [ ] Logout with confirmation
- [ ] Account statistics display (formulas created, join date)

### Security
- [ ] Secure token storage
- [ ] Biometric authentication (Face ID/Touch ID) - *Optional Phase 2*
- [ ] Password visibility toggle
- [ ] Secure password requirements enforcement

---

## 🏠 Home & Navigation

### Dashboard
- [ ] Home screen with quick stats overview
- [ ] Total formulas count display
- [ ] Formulas breakdown by compliance status (Approved/Warning/Risk)
- [ ] Recent formulas list (last 5)
- [ ] Quick action buttons (Create Formula, Browse Ingredients)
- [ ] Pull-to-refresh functionality
- [ ] User greeting with first name or email display

### Bottom Navigation
- [ ] Home tab
- [ ] Ingredients tab
- [ ] Formulas tab
- [ ] Profile tab
- [ ] Active tab visual indicator
- [ ] Tab badge notifications (optional)

---

## 🔍 Ingredients Module

### Ingredient Browsing
- [ ] List all ingredients with pagination (50 per page)
- [ ] Infinite scroll/load more functionality
- [ ] Ingredient cards with key information display
  - [ ] Ingredient name
  - [ ] Category badge
  - [ ] Source indicator
  - [ ] Safety level icon (green/orange/red)
- [ ] Pull-to-refresh ingredient list
- [ ] Skeleton loading screens

### Search & Filter
- [ ] Real-time ingredient search (debounced)
- [ ] Search by name, category, and source
- [ ] Clear search button
- [ ] Filter modal/bottom sheet
  - [ ] Filter by category (multi-select)
  - [ ] Filter by source (multi-select)
  - [ ] Filter by safety level (single select)
  - [ ] "Safe only" quick filter option
- [ ] Active filters display as dismissible chips
- [ ] "Clear All Filters" button
- [ ] Filter result count display
- [ ] Sort options (A-Z, Z-A, Recently Added, By Category)

### Ingredient Details
- [ ] Full ingredient detail screen
- [ ] Safety status prominently displayed
- [ ] Basic information card (category, source, dates)
- [ ] Evidence and scientific notes section
- [ ] Regulatory status display
- [ ] "Add to Formula" action button
- [ ] Bookmark/favorite ingredient - *Optional Phase 2*

### Data Loading
- [ ] Fetch unique categories from API
- [ ] Fetch unique sources from API
- [ ] Cache categories and sources locally
- [ ] Handle empty search results
- [ ] Handle no ingredients found states

---

## 📋 Formula Management

### Formula List
- [ ] Display all user's formulas
- [ ] Formula cards with complete information
  - [ ] Formula name
  - [ ] Description (truncated)
  - [ ] Region badge
  - [ ] Ingredient count
  - [ ] Total weight
  - [ ] Compliance status badge
  - [ ] Last updated timestamp
- [ ] Sort formulas (Recent, Created, A-Z, By Region)
- [ ] Pull-to-refresh formulas
- [ ] Empty state with call-to-action
- [ ] Floating "Create Formula" button

### Formula CRUD Operations
- [ ] Create new formula
  - [ ] Formula name input (required, 255 char limit)
  - [ ] Description input (optional, multiline)
  - [ ] Region selector (US/EU/CA/AU)
  - [ ] Form validation
- [ ] View formula details
  - [ ] Complete formula information
  - [ ] All ingredients listed with doses
  - [ ] Summary statistics
  - [ ] Ingredient notes display
- [ ] Edit existing formula
  - [ ] Update formula name
  - [ ] Update description
  - [ ] Change region
  - [ ] Unsaved changes warning
- [ ] Delete formula with confirmation
- [ ] Duplicate formula functionality

### Formula Card Actions
- [ ] Three-dot menu on each formula card
  - [ ] View Details
  - [ ] Edit
  - [ ] Duplicate
  - [ ] Check Compliance
  - [ ] Export
  - [ ] Delete (with confirmation)
- [ ] Swipe actions (optional)
  - [ ] Swipe right: Quick edit
  - [ ] Swipe left: Delete

---

## 🧪 Formula Builder/Editor

### Basic Setup
- [ ] Create/Edit formula screen
- [ ] Auto-save draft to local storage (every 30 seconds)
- [ ] Formula name input with character count
- [ ] Description multiline input
- [ ] Cancel/Back with unsaved changes confirmation

### Ingredient Management
- [ ] Add ingredient button
- [ ] Add ingredient modal with search
  - [ ] Search ingredients in modal
  - [ ] Select ingredient from results
  - [ ] Recently used ingredients quick access
- [ ] Ingredient dose configuration
  - [ ] Dose value numeric input
  - [ ] Unit selector (mg, mcg, g, IU)
  - [ ] Notes/instructions input (optional)
- [ ] Display added ingredients list
  - [ ] Ingredient name and details
  - [ ] Dose and unit display
  - [ ] Safety indicator
  - [ ] Edit dose inline
  - [ ] Remove ingredient button
- [ ] Reorder ingredients (drag and drop)
- [ ] Duplicate ingredient prevention
- [ ] Real-time total weight calculation

### Validation
- [ ] Required field validation (name, region)
- [ ] Dose value validation (must be numeric, positive)
- [ ] Formula must have at least one ingredient
- [ ] Display validation errors clearly

---

## ✅ Compliance Checking

### Compliance Check
- [ ] "Check Compliance" action from formula detail
- [ ] Run compliance check API call
- [ ] Display compliance results screen
  - [ ] Overall status banner (Approved/Warning/Stop)
  - [ ] Colored status indicator
  - [ ] Status message display
- [ ] Compliance summary card
  - [ ] Check date/time
  - [ ] Region
  - [ ] Total ingredients
  - [ ] Total weight
  - [ ] Breakdown by safety level (visual)
- [ ] Issues list display (if any)
  - [ ] Each issue with severity badge
  - [ ] Ingredient name and dose
  - [ ] Issue description
  - [ ] Recommended action
  - [ ] Expandable for full details
- [ ] "All Clear" message when no issues
- [ ] Regulatory disclaimer section

### Quick Compliance Summary
- [ ] Quick compliance badge on formula cards
- [ ] Compliance summary API endpoint integration
- [ ] Auto-calculate compliance status for lists

### Compliance Actions
- [ ] Export compliance report
- [ ] Share compliance results
- [ ] Navigate back to formula from results
- [ ] Navigate to editor if status is "Stop"

---

## 📤 Export Functionality

### Export Options Modal
- [ ] Export modal/bottom sheet
- [ ] Export as Supplement Facts Label (PDF)
  - [ ] Download progress indicator
  - [ ] Success notification
  - [ ] Open/Share options after download
- [ ] Export as Formula Summary (PDF)
- [ ] Export as CSV (Ingredient List)
- [ ] Export All Formulas as CSV - *Optional*
- [ ] Native share sheet integration
  - [ ] Save to device
  - [ ] Share via email
  - [ ] Share to other apps
  - [ ] AirDrop (iOS)

### File Handling
- [ ] Download file from API
- [ ] Save to device storage
- [ ] Handle download errors
- [ ] Show download progress
- [ ] Toast notification on completion

---

## 🎨 UI/UX Components

### Reusable Components
- [ ] Search bar component
- [ ] Filter chip component (dismissible)
- [ ] Safety badge component (color-coded)
- [ ] Region badge component
- [ ] Compliance status badge component
- [ ] Formula card component
- [ ] Ingredient card component
- [ ] Form input components with validation
- [ ] Action button components (primary, secondary)

### Modals & Dialogs
- [ ] Add ingredient modal
- [ ] Filter modal
- [ ] Export options modal
- [ ] Edit profile modal
- [ ] Change password modal
- [ ] Confirmation alert dialog (delete, logout, discard)
- [ ] Select formula modal (when adding ingredient)

### Loading States
- [ ] Inline loader for pagination
- [ ] Skeleton screens for lists
- [ ] Button loading states with spinner
- [ ] Pull-to-refresh indicator

### Empty States
- [ ] No formulas empty state with CTA
- [ ] No ingredients in formula empty state
- [ ] No search results empty state
- [ ] No filter results empty state
- [ ] No internet connection state

### Notifications & Feedback
- [ ] Toast notifications (success, error, info, warning)
  - [ ] Auto-dismiss after 3 seconds
  - [ ] Swipe to dismiss
- [ ] Success messages after actions
- [ ] Error message display
- [ ] Form validation error display
- [ ] Network error notifications

---

## 🔄 Data Management

### Local Storage
- [ ] Store JWT tokens in AsyncStorage
- [ ] Store user profile locally (email, first name, last name)
- [ ] Cache ingredient categories
- [ ] Cache ingredient sources
- [ ] Auto-save formula drafts
- [ ] Cache recent searches - *Optional*

### API Integration
- [ ] Authentication endpoints integration
  - [ ] Register (email, password, first name, last name)
  - [ ] Login (email, password)
  - [ ] Token refresh
  - [ ] Logout
  - [ ] Get user profile
  - [ ] Update profile (email, first name, last name)
  - [ ] Change password
- [ ] Ingredients endpoints integration
  - [ ] List ingredients with pagination
  - [ ] Search ingredients
  - [ ] Get ingredient details
  - [ ] Get categories
  - [ ] Get sources
- [ ] Formulas endpoints integration
  - [ ] List formulas
  - [ ] Create formula
  - [ ] Get formula details
  - [ ] Update formula
  - [ ] Delete formula
  - [ ] Add ingredient
  - [ ] Update ingredient dose
  - [ ] Remove ingredient
  - [ ] Duplicate formula
- [ ] Compliance endpoints integration
  - [ ] Check compliance
  - [ ] Get compliance summary
- [ ] Export endpoints integration
  - [ ] Export label PDF
  - [ ] Export summary PDF
  - [ ] Export CSV

### Network Handling
- [ ] Automatic token refresh on 401 errors
- [ ] Retry failed requests
- [ ] Handle 403, 404, 500 errors gracefully
- [ ] Network connectivity detection
- [ ] Offline mode indication
- [ ] Queue writes when offline - *Optional Phase 2*

### Sync & Refresh
- [ ] Pull-to-refresh on lists
- [ ] Auto-refresh on screen focus
- [ ] Cache strategy for ingredients (5 min)
- [ ] Sync status indicator
- [ ] Background sync when online - *Optional Phase 2*

---

## ⚙️ Settings & Configuration

### App Settings
- [ ] View app version
- [ ] Dark mode toggle - *Optional Phase 2*
- [ ] Notification preferences - *Optional Phase 2*
- [ ] Language selector - *Optional Phase 2*

### Support & Legal
- [ ] Help center link
- [ ] API documentation link
- [ ] Report issue (email)
- [ ] Terms of service
- [ ] Privacy policy
- [ ] Open source licenses

---

## 🚀 Performance & Optimization

### Performance
- [ ] Pagination for large lists (50 items per page)
- [ ] Debounced search (500ms delay)
- [ ] Image lazy loading - *If images added*
- [ ] List virtualization for large datasets
- [ ] Optimize re-renders with memoization
- [ ] Request caching where appropriate

### App Stability
- [ ] Error boundary implementation
- [ ] Crash reporting setup - *Optional*
- [ ] Analytics integration - *Optional*
- [ ] Performance monitoring - *Optional*

---

## 📱 Platform-Specific Features

### iOS
- [ ] Safe area handling (notch, home indicator)
- [ ] Face ID/Touch ID integration - *Optional Phase 2*
- [ ] AirDrop sharing support
- [ ] iOS share sheet integration
- [ ] Haptic feedback on actions - *Optional*

### Android
- [ ] Back button handling (with unsaved changes confirmation)
- [ ] Android share sheet integration
- [ ] Fingerprint authentication - *Optional Phase 2*
- [ ] Material Design guidelines compliance
- [ ] Android notification channels - *Optional*

---

## 🎯 Priority Phases

### Phase 1 (MVP - Must Have)
- Authentication (register with email, login, logout)
- Ingredient browsing and search with basic filters
- Formula CRUD operations
- Add/remove ingredients to formulas
- Compliance checking
- PDF label export

### Phase 2 (Nice to Have)
- Formula duplication
- Advanced filtering (multiple categories/sources)
- Ingredient favorites/bookmarks
- CSV export
- Formula summary PDF
- Edit ingredient doses inline
- Biometric authentication

### Phase 3 (Future Enhancements)
- Offline mode (full CRUD)
- Formula templates
- Formula sharing
- Cost tracking
- Daily Value % calculator
- Multi-language support
- Dark mode
- Push notifications
- Analytics dashboard

---

**Key Changes Made:**
1. Removed all references to "username" field
2. Updated registration to only use email, password, first name, last name
3. Updated login to use email and password
4. Updated profile display to show email instead of username
5. Updated user greeting to use first name or email
6. Updated all API integration notes to reflect email-based authentication
7. Updated local storage references for user data (no username stored)