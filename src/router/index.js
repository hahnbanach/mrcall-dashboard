const Account = () => import(/* webpackChunkName: "business" */ '@/views/Account.vue')
const ActivateAssistant = () => import(/* webpackChunkName: "business" */ '@/views/activation/ActivateAssistant')
const BusinessConfiguration = () => import(/* webpackChunkName: "business" */ '@/views/business/BusinessConfiguration.vue')
const AladdinConfigurator = () => import(/* webpackChunkName: "business" */ '@/views/business/AladdinConfigurator.vue')
const McpConnectors = () => import(/* webpackChunkName: "business" */ '@/views/business/McpConnectors.vue')
const BusinessPhoneNumberVerification = () => import(/* webpackChunkName: "business" */ '@/views/BusinessPhoneNumberVerification')
const Businesses = () => import(/* webpackChunkName: "business" */ '@/views/Businesses')
const CallBooking = () => import(/* webpackChunkName: "business" */ '@/views/CallBooking.vue')
const CallForwardingGuide = () => import(/* webpackChunkName: "business" */ '@/views/CallForwardingGuide')
const Conversations = () => import(/* webpackChunkName: "conversations" */ '@/views/Conversations')
const CustomTokenSignin = () => import(/* webpackChunkName: "sign" */ '@/views/CustomTokenSignin')
const FailedPayment = () => import(/* webpackChunkName: "payment" */ '@/views/FailedPayment')
const FailedPaymentProduct = () => import(/* webpackChunkName: "payment" */ '@/views/FailedPaymentProduct')
const Home = () => import(/* webpackChunkName: "sign" */ '@/views/Home.vue')
const MagicLink = () => import(/* webpackChunkName: "sign" */ '@/views/sign/MagicLink')
const OAuthConsent = () => import(/* webpackChunkName: "oauth" */ '@/views/oauth/OAuthConsent.vue')
const OnboardingChooseDevice = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingChooseDevice')
const OnboardingChoosePlan = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingChoosePlan')
const OnboardingForwardingOnLandline = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingForwardingOnLandline')
const OnboardingForwardingOnOtherDevice = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingForwardingOnOtherDevice')
const OnboardingForwardingOnThisDevice = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingForwardingOnThisDevice')
const OnboardingLanguage = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingLanguage')
const OnboardingMakeATestCall = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingMakeATestCall')
const OnboardingAssistantCreated = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingAssistantCreated')
const OnboardingNamePhone = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingNamePhone')
const OnboardingNotificationPreview = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingNotificationPreview')
const OnboardingPreBookAppointment = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingPreBookAppointment')
const OnboardingPrePayment = () => import(/* webpackChunkName: "onboarding" */ '@/views/OnboardingPrePayment')
const OnboardingSearchBusiness = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingSearchBusiness')
const OnboardingSwitchboardConfiguration = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingSwitchboardConfiguration')
const OnboardingThisOrOtherDevice = () => import(/* webpackChunkName: "onboarding" */ '@/views/onboarding/OnboardingThisOrOtherDevice')
const PartnerProgram = () => import(/* webpackChunkName: "reseller" */ '@/views/PartnerProgram')
const Payment = () => import(/* webpackChunkName: "payment" */ '@/views/Payment')
const Plan = () => import(/* webpackChunkName: "payment" */ '@/views/Plan')
const PlanAndProducts = () => import(/* webpackChunkName: "payment" */ '@/views/PlanAndProducts.vue')
const PrivacyPolicy = () => import(/* webpackChunkName: "legal" */ '@/views/PrivacyPolicy')
const Signin = () => import(/* webpackChunkName: "sign" */ '@/views/sign/Signin')
const Signup = () => import(/* webpackChunkName: "sign" */ '@/views/sign/Signup.vue')
const SuccessPayment = () => import(/* webpackChunkName: "payment" */ '@/views/SuccessPayment')
const SuccessPaymentProduct = () => import(/* webpackChunkName: "payment" */ '@/views/SuccessPaymentProduct')
const TermsAndConditions = () => import(/* webpackChunkName: "legal" */ '@/views/TermsAndConditions')
const Whatsappweb = () => import(/* webpackChunkName: "business" */ '@/views/Whatsappweb')
import {auth} from '@/firebase/config';
import { userWhenReady } from '@/firebase/authReady';
import { isAdmitted } from '@/firebase/admission';
import {createRouter, createWebHistory} from 'vue-router'
const Analytics = () => import(/* webpackChunkName: "analytics" */ '@/views/Analytics.vue')
const AnalyticsAdmin = () => import(/* webpackChunkName: "analytics" */ '@/views/AnalyticsAdmin.vue')
const AnalyticsReport = () => import(/* webpackChunkName: "analytics" */ '@/views/AnalyticsReport.vue')
const Contacts = () => import(/* webpackChunkName: "business" */ '@/views/Contacts.vue')
const OutboundCalls = () => import(/* webpackChunkName: "business" */ '@/views/OutboundCalls.vue')
const TestChat = () => import(/* webpackChunkName: "business" */ '@/views/TestChat.vue')
const TestReadWebData = () => import(/* webpackChunkName: "business" */ '@/views/TestReadWebData.vue')
const GoogleCallback = () => import(/* webpackChunkName: "sign" */ '@/components/templates/sign/GoogleCallback.vue')
const ResellerDashboardView = () => import(/* webpackChunkName: "reseller" */ '@/views/ResellerDashboard.vue')
const ResellerInvitationCodes = () => import(/* webpackChunkName: "reseller" */ '@/views/reseller/InvitationCodes.vue')
const ResellerProfileView = () => import(/* webpackChunkName: "reseller" */ '@/views/reseller/ResellerProfile.vue')
const ResellerManagement = () => import(/* webpackChunkName: "admin" */ '@/views/admin/ResellerManagement.vue')
const ResellerDetail = () => import(/* webpackChunkName: "admin" */ '@/views/admin/ResellerDetail.vue')
const ProvisionReseller = () => import(/* webpackChunkName: "admin" */ '@/views/admin/ProvisionReseller.vue')
const UserRoleManagement = () => import(/* webpackChunkName: "admin" */ '@/views/admin/UserRoleManagement.vue')
const AgentTemplates = () => import(/* webpackChunkName: "admin" */ '@/views/admin/AgentTemplates.vue')
const AgentTemplateEditor = () => import(/* webpackChunkName: "admin" */ '@/views/admin/AgentTemplateEditor.vue')
const WizardConfiguration = () => import(/* webpackChunkName: "business" */ '@/views/wizard/WizardConfiguration.vue')
import store from '@/store'
import { isLeaving, reloadPage } from '@/utils/pageReload'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { public: true }
  },
  {
    path: '/account',
    name: 'Account',
    component: Account
  },
  {
    path: '/callbooking',
    name: 'CallBooking',
    component: CallBooking
  },
  {
    path: '/magiclink',
    name: 'MagicLink',
    component: MagicLink,
    meta: { public: true }
  },
  {
    path: '/customtokenlogin',
    name: 'CustomTokenSignin',
    component: CustomTokenSignin,
    meta: { public: true }
  },
  {
    path: '/businesses',
    name: 'Businesses',
    component: Businesses,
    props: true

  },
  {
    path: '/onboardinglang',
    name: 'OnboardingLanguage',
    component: OnboardingLanguage,
    props: true
  },
  {
    path: '/onboardingnamephone',
    name: 'OnboardingNamePhone',
    component: OnboardingNamePhone,
    props: true
  },
  {
    path: '/onboardingsearchbusiness',
    name: 'OnboardingSearchBusiness',
    component: OnboardingSearchBusiness,
    props: true
  },
  {
    path: '/onboardingprepayment',
    name: 'OnboardingPrePayment',
    component: OnboardingPrePayment,
    props: { }
  },
  {
    path: '/onboardingmakeatestcall',
    name: 'OnboardingMakeATestCall',
    component: OnboardingMakeATestCall,
    props: { }
  },
  {
    path: '/onboardingassistantcreated',
    name: 'OnboardingAssistantCreated',
    component: OnboardingAssistantCreated,
    props: { }
  },
  {
    path: '/wizard',
    name: 'WizardConfiguration',
    component: WizardConfiguration,
    meta: {
      bare: true
    }
  },
  {
    path: '/onboardingchooseplan',
    name: 'OnboardingChoosePlan',
    component: OnboardingChoosePlan,
    props: { }
  },
  {
    path: '/activate',
    name: 'ActivateAssistant',
    component: ActivateAssistant,
    props: true
  },
  {
    path: '/onboardingnotificationpreview',
    name: 'OnboardingNotificationPreview',
    component: OnboardingNotificationPreview,
    props: { }
  },
  {
    path: '/onboardingchoosedevice',
    name: 'OnboardingChooseDevice',
    component: OnboardingChooseDevice,
    props: { }
  },
  {
    path: '/onboardingprebookappointment',
    name: 'OnboardingPreBookAppointment',
    component: OnboardingPreBookAppointment,
    props: true
  },
  {
    path: '/onboardingthisorotherdevice',
    name: 'OnboardingThisOrOtherDevice',
    component: OnboardingThisOrOtherDevice,
    props: true
  },
  {
    path: '/onboardingforwardingonthisdevice',
    name: 'OnboardingForwardingOnThisDevice',
    component: OnboardingForwardingOnThisDevice,
    props: true
  },
  {
    path: '/onboardingforwardingonotherdevice',
    name: 'OnboardingForwardingOnOtherDevice',
    component: OnboardingForwardingOnOtherDevice,
    props: true
  },
  {
    path: '/onboardingforwardingonlandline',
    name: 'OnboardingForwardingOnLandline',
    component: OnboardingForwardingOnLandline,
    props: true
  },
  {
    path: '/onboardingswitchboardconfiguration',
    name: 'OnboardingSwitchboardConfiguration',
    component: OnboardingSwitchboardConfiguration,
    props: true
  },
  {
    path: '/payment',
    name: 'Payment',
    component: Payment,
    props: { }
  },
  {
    path: '/businessphonenumberverification',
    name: 'BusinessPhoneNumberVerification',
    component: BusinessPhoneNumberVerification,
    props: true
  },
  {
    path: '/businessconfiguration',
    name: 'BusinessConfiguration',
    component: BusinessConfiguration,
    props: true
  },
  {
    path: '/aladmin-configurator',
    name: 'AladminConfigurator',
    component: AladdinConfigurator,
    props: true
  },
  {
    path: '/mcp-connectors',
    name: 'McpConnectors',
    component: McpConnectors,
    props: true
  },
  {
    path: '/plan',
    name: 'Plan',
    component: Plan,
    props: { }
  },
  {
    path: '/planandproducts',
    name: 'PlanAndProducts',
    component: PlanAndProducts,
    props: { }
  },
  {
    path: '/success_payment',
    name: 'SuccessPayment',
    component: SuccessPayment,
    props: true,
    meta: { public: true }
  },
  {
    path: '/success_payment_product',
    name: 'SuccessPaymentProduct',
    component: SuccessPaymentProduct,
    props: true,
    meta: { public: true }
  },
  {
    path: '/failed_payment',
    name: 'FailedPayment',
    component: FailedPayment,
    props: true,
    meta: { public: true }
  },
  {
    path: '/failed_payment_product',
    name: 'FailedPaymentProduct',
    component: FailedPaymentProduct,
    props: true,
    meta: { public: true }
  },
  {
    path: '/privacypolicy',
    name: 'PrivacyPolicy',
    component: PrivacyPolicy,
    props: true,
    meta: { public: true }
  },
  {
    path: '/termsandconditions',
    name: 'TermsAndConditions',
    component: TermsAndConditions,
    props: true,
    meta: { public: true }
  },
  {
    path: '/callforwardingguide',
    name: 'CallForwardingGuide',
    component: CallForwardingGuide,
    props: true,
    meta: { public: true }
  },
  {
    path: '/partnerprogram',
    name: 'PartnerProgram',
    component: PartnerProgram,
    props: true,
    meta: { public: true }
  },
  {
    path: '/conversations',
    name: 'Conversations',
    component: Conversations,
    props: true
  },
  {
    path: '/whatsappweb',
    name: 'Whatsappweb',
    component: Whatsappweb,
    props: true
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: Analytics,
    props: true
  },
  {
    // one call report: ?id=<business>&start=<periodStart>&requestId=<id> (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat)
    path: '/analytics/report',
    name: 'AnalyticsReport',
    component: AnalyticsReport,
    props: true
  },
  {
    path: '/analytics-admin',
    name: 'AnalyticsAdmin',
    component: AnalyticsAdmin,
    props: true
  },
  {
    path: '/contacts',
    name: 'Contacts',
    component: Contacts,
    props: true
  },
  {
    path: '/outboundcalls',
    name: 'OutboundCalls',
    component: OutboundCalls,
    props: true
  },
  {
    path: '/signup',
    name: 'Signup',
    component: Signup,
    meta: { public: true }
  },
  {
    path: '/signin',
    name: 'SigninNew',
    component: Signin,
    meta: { public: true }
  },
  {
    path: '/login',
    name: 'Signin',
    component: Signin,
    meta: { public: true }
  },
  {
    path: '/callback',
    name: 'google-callback',
    component: GoogleCallback,
    meta: { public: true }
  },
  {
    path: '/oauth/authorize',
    name: 'OAuthConsent',
    component: OAuthConsent,
    meta: { public: true }
  },
  {
    path: '/testchat',
    name: 'TestChat',
    component: TestChat
  },
  {
    path: '/testreadwebdata',
    name: 'TestReadWebData',
    component: TestReadWebData
  },
  {
    path: '/reseller',
    name: 'ResellerDashboard',
    component: ResellerDashboardView,
    meta: {
      requiresRole: 'reseller'
    }
  },
  {
    path: '/reseller/codes',
    name: 'ResellerInvitationCodes',
    component: ResellerInvitationCodes,
    meta: {
      requiresRole: 'reseller'
    }
  },
  {
    path: '/reseller/profile',
    name: 'ResellerProfile',
    component: ResellerProfileView,
    meta: {
      requiresRole: 'reseller'
    }
  },
  {
    path: '/admin/resellers',
    name: 'ResellerManagement',
    component: ResellerManagement,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/resellers/new',
    name: 'ProvisionReseller',
    component: ProvisionReseller,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/resellers/:resellerId',
    name: 'ResellerDetail',
    component: ResellerDetail,
    props: true,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/users',
    name: 'UserRoleManagement',
    component: UserRoleManagement,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/templates',
    name: 'AgentTemplates',
    component: AgentTemplates,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/templates/:name',
    name: 'AgentTemplateEditor',
    component: AgentTemplateEditor,
    meta: {
      requiresRole: 'admin'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
    meta: { public: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  base: process.env.BASE_URL || '/'
})

// One readiness promise for every navigation, not a listener each (src/firebase/authReady.js).
const getUser = userWhenReady(auth)

// Capture UTM parameters and reseller referral codes on initial load
router.beforeEach(async (to, from, next) => {
  // Capture reseller referral code
  const refCode = to.query.ref
  if (refCode && refCode.startsWith('RES-')) {
    localStorage.setItem('mrcall_reseller_code', refCode)
    // If the visitor is already authenticated (SPA navigation), App.vue's user
    // watcher won't fire, so claim the code here. The action no-ops if there's
    // no user yet — in that case the post-login claim path takes over.
    if (store.state.user) {
      store.dispatch('claimResellerCode')
    }
  }

  // Capture UTM parameters if they exist in the URL
  if (to.query && Object.keys(to.query).length > 0) {
    const queryString = window.location.search
    const fullUrl = window.location.href
    const referrer = document.referrer

    // Dispatch action to capture and store UTM parameters
    store.dispatch('tracking/captureUtmParams', {
      queryString,
      fullUrl,
      referrer
    })
  }

  // A page needs a session unless its route says `public`. The rule used to be the other way round,
  // and a route that forgot to ask (`/businessconfiguration`, from the first commit) opened without
  // a session and drew an empty shell. tests/unit/publicRoutes.spec.js lists the public ones.
  const requiresAuth = !to.matched.some(record => record.meta.public);
  // Sign-in comes back to the page that asked for it, with its query: a call email links to
  // /conversations?id=<business>&conversation=<call>, and an owner without a session must land on
  // that call, not on the list of businesses. Signin reads `redirect` as {path, query}.
  const toSignin = () => next({
    path: '/signin',
    query: { redirect: JSON.stringify({ path: to.path, query: to.query }) }
  });
  if (requiresAuth) {
    try {
      const user = await getUser();
      if (!isAdmitted(user)) {
        return toSignin();
      }

      // Check role-based access
      const requiresRole = to.matched.find(record => record.meta.requiresRole)?.meta.requiresRole;
      if (requiresRole) {
        const currentRole = store.state.role;
        // Admin can access any role-protected route
        if (currentRole === 'admin') {
          return next();
        }
        // Role matches required role
        if (currentRole === requiresRole) {
          return next();
        }
        // Role is still default 'owner' — may not be loaded yet, let component verify via API
        if (currentRole === 'owner') {
          return next();
        }
        // Role is loaded and doesn't match required role
        return next('/businesses');
      }

      return next();
    } catch (error) {
      console.error('Auth check error:', error);
      return toSignin();
    }
  }
  next();
});

// Every page is loaded on demand, so its code can be missing when asked for: a tab opened before a deploy asks for a
// chunk the deploy has replaced, or one request fails. The page it was going to is then loaded again from scratch,
// once: that load fetches the current chunks. A sessionStorage marker per target stops a chunk that keeps failing
// from reloading in a loop; it is cleared only once a navigation to that target succeeds. Any other error goes on as it
// came (plan docs/execution-plans/2026-10-23-dashboard-load.md, M2).
const CHUNK_FAILURE = /Loading (CSS )?chunk [^ ]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/
export const isChunkLoadError = (error) =>
  !!error && (error.name === 'ChunkLoadError' || CHUNK_FAILURE.test(String(error.message || '')))
const reloadMarker = (fullPath) => 'chunk-reload:' + fullPath

router.onError((error, to) => {
  if (!isChunkLoadError(error) || !to) throw error
  // a download the browser cancelled because the page is leaving: the next page load fetches it anyway
  if (isLeaving()) return
  const marker = reloadMarker(to.fullPath)
  // already reloaded for this target and it failed again: no second reload. The marker stays until a navigation
  // to the target succeeds, so that another attempt in the same tab cannot start the loop again.
  if (sessionStorage.getItem(marker)) throw error
  sessionStorage.setItem(marker, '1')
  reloadPage(to.fullPath)
})

router.afterEach((to) => {
  sessionStorage.removeItem(reloadMarker(to.fullPath))
})

// The first navigation's outcome, taken here, before the app installs the router and the navigation starts. Asked
// later, once that navigation has failed, `isReady()` returns a promise that never settles (vue-router 4.6: it is
// "ready" with the start location as current route), and App.vue's loading state would turn forever.
export const firstNavigation = router.isReady()
// handled here so that a failure before App.vue listens is no unhandled rejection; App.vue still sees it
firstNavigation.catch(() => {})

export default router
