/**
 * Shared selectors for PrimeVue components and app-specific elements.
 * Centralizes selector strings to avoid duplication across tests.
 */

const selectors = {
  // Form inputs
  emailInput: '#email',
  passwordInput: '#password',
  emailError: '#email-error',

  // Sign forms
  signinForm: '.signin-signup-form form',
  submitButton: 'button[type="submit"].signin-signup-button-text',
  googleSignIn: '.google-signin',
  forgotPasswordLink: 'a[href="/magiclink"]',
  signupLink: 'a[href="/signup"]',
  signinLink: 'a[href="/signin"]',
  divider: '.divider',

  // PrimeVue validation
  invalidInput: '.p-invalid',
  errorMessage: '.p-error',
  fieldWrapper: '.p-field',

  // PrimeVue components
  dialog: '.p-dialog',
  dialogMask: '.p-dialog-mask',
  dialogContent: '.p-dialog-content',
  dialogClose: '.p-dialog-close-button',
  button: '.p-button',
  progressBar: '.p-progressbar',
  progressSpinner: '.p-progressspinner',
  paginator: '.p-paginator',
  menubar: '.p-menubar',
  toolbar: '.p-toolbar',
  dropdown: '.p-select',
  inputText: '.p-inputtext',
  password: '.p-password',
  toast: '.p-toast',
  toastMessage: '.p-toast-message',
  card: '.p-card',
  dataTable: '.p-datatable',
  tabView: '.p-tabview',
  accordion: '.p-accordion',
  multiSelect: '.p-multiselect',

  // Navbar
  navbar: '.p-menubar',
  navbarLogo: '.mrCallLogo',
  navbarItems: '.p-menubar-root-list',
  navbarStart: '.p-menubar-start',
  navbarEnd: '.p-menubar-end',
  footerLinks: '.footer-links',
  webviewToolbar: '.p-toolbar',

  // Businesses page
  businessesPage: '.businesses-page',
  businessCard: '.business-card',
  businessCards: '.business-cards',
  cardHeader: '.card-header',
  cardCompanyName: '.card-company-name',
  statusBadge: '.status-badge',
  ownerBadge: '.owner-badge',
  infoGrid: '.info-grid',
  infoItem: '.info-item',
  cardActions: '.card-actions',
  actionsPrimary: '.actions-primary-row',
  actionsSecondary: '.actions-secondary-row',
  activationBanner: '.activation-banner',
  serviceNumberBanner: '.service-number-banner',

  // Account page
  accountSection: '.account-section',
  accountTitle: '.account-section .title',

  // Onboarding
  onboardingBase: '.onboarding-base',
  onboardingItem: '.item',
  inputBoxTitle: '.inputboxtitle',
  inputBoxSubtitle: '.inputboxsubtitle',
  supportLarge: '#support-large',
  supportSmall: '#support-small',

  // Sign page layout
  signCentralWindow: '.sign-central-window',
  signBackground: '.sign-background',

  // Main layout
  mainContentSection: '.main-page-content-section',
  preFooter: '#pre-footer',
}

module.exports = { selectors }
