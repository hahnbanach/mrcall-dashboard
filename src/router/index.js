import Account from "@/views/Account.vue";
import ActivateAssistant from "@/views/activation/ActivateAssistant";
import BusinessConfiguration from "@/views/business/BusinessConfiguration.vue";
import AladdinConfigurator from "@/views/business/AladdinConfigurator.vue";
import McpConnectors from "@/views/business/McpConnectors.vue";
import BusinessPhoneNumberVerification from "@/views/BusinessPhoneNumberVerification";
import Businesses from "@/views/Businesses"
import CallBooking from "@/views/CallBooking.vue";
import CallForwardingGuide from "@/views/CallForwardingGuide";
import Conversations from "@/views/Conversations";
import CustomTokenSignin from "@/views/CustomTokenSignin";
import FailedPayment from "@/views/FailedPayment"
import FailedPaymentProduct from "@/views/FailedPaymentProduct"
import Home from '@/views/Home.vue'
import MagicLink from "@/views/sign/MagicLink";
import OAuthConsent from "@/views/oauth/OAuthConsent.vue";
import OnboardingChooseDevice from "@/views/onboarding/OnboardingChooseDevice";
import OnboardingChoosePlan from "@/views/onboarding/OnboardingChoosePlan";
import OnboardingForwardingOnLandline from "@/views/onboarding/OnboardingForwardingOnLandline";
import OnboardingForwardingOnOtherDevice from "@/views/onboarding/OnboardingForwardingOnOtherDevice";
import OnboardingForwardingOnThisDevice from "@/views/onboarding/OnboardingForwardingOnThisDevice";
import OnboardingLanguage from "@/views/onboarding/OnboardingLanguage";
import OnboardingMakeATestCall from "@/views/onboarding/OnboardingMakeATestCall";
import OnboardingAssistantCreated from "@/views/onboarding/OnboardingAssistantCreated";
import OnboardingNamePhone from "@/views/onboarding/OnboardingNamePhone";
import OnboardingNotificationPreview from "@/views/onboarding/OnboardingNotificationPreview";
import OnboardingPreBookAppointment from "@/views/onboarding/OnboardingPreBookAppointment";
import OnboardingPrePayment from "@/views/OnboardingPrePayment";
import OnboardingSearchBusiness from "@/views/onboarding/OnboardingSearchBusiness";
import OnboardingSwitchboardConfiguration from "@/views/onboarding/OnboardingSwitchboardConfiguration";
import OnboardingThisOrOtherDevice from "@/views/onboarding/OnboardingThisOrOtherDevice";
import PartnerProgram from "@/views/PartnerProgram";
import Payment from "@/views/Payment";
import Plan from "@/views/Plan";
import PlanAndProducts from "@/views/PlanAndProducts.vue";
import PrivacyPolicy from "@/views/PrivacyPolicy";
import Signin from "@/views/sign/Signin";
import Signup from "@/views/sign/Signup.vue"
import SuccessPayment from "@/views/SuccessPayment"
import SuccessPaymentProduct from "@/views/SuccessPaymentProduct"
import TermsAndConditions from "@/views/TermsAndConditions";
import Whatsappweb from "@/views/Whatsappweb";
import {auth} from '@/firebase/config';
import {createRouter, createWebHistory} from 'vue-router'
import Analytics from "@/views/Analytics.vue";
import AnalyticsAdmin from "@/views/AnalyticsAdmin.vue";
import Contacts from "@/views/Contacts.vue";
import OutboundCalls from "@/views/OutboundCalls.vue";
import TestChat from "@/views/TestChat.vue";
import TestReadWebData from "@/views/TestReadWebData.vue";
import GoogleCallback from '@/components/templates/sign/GoogleCallback.vue'
import ResellerDashboardView from "@/views/ResellerDashboard.vue"
import ResellerInvitationCodes from "@/views/reseller/InvitationCodes.vue"
import ResellerProfileView from "@/views/reseller/ResellerProfile.vue"
import ResellerManagement from "@/views/admin/ResellerManagement.vue"
import ResellerDetail from "@/views/admin/ResellerDetail.vue"
import ProvisionReseller from "@/views/admin/ProvisionReseller.vue"
import UserRoleManagement from "@/views/admin/UserRoleManagement.vue"
const AgentTemplates = () => import('@/views/admin/AgentTemplates.vue')
const AgentTemplateEditor = () => import('@/views/admin/AgentTemplateEditor.vue')
const WizardConfiguration = () => import('@/views/wizard/WizardConfiguration.vue')
import store from '@/store'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/account',
    name: 'Account',
    component: Account,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/callbooking',
    name: 'CallBooking',
    component: CallBooking,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/magiclink',
    name: 'MagicLink',
    component: MagicLink
  },
  {
    path: '/customtokenlogin',
    name: 'CustomTokenSignin',
    component: CustomTokenSignin
  },
  {
    path: '/businesses',
    name: 'Businesses',
    component: Businesses,
    props: true,
    meta: {
      requiresAuth: true
    }

  },
  {
    path: '/onboardinglang',
    name: 'OnboardingLanguage',
    component: OnboardingLanguage,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingnamephone',
    name: 'OnboardingNamePhone',
    component: OnboardingNamePhone,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingsearchbusiness',
    name: 'OnboardingSearchBusiness',
    component: OnboardingSearchBusiness,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingprepayment',
    name: 'OnboardingPrePayment',
    component: OnboardingPrePayment,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingmakeatestcall',
    name: 'OnboardingMakeATestCall',
    component: OnboardingMakeATestCall,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingassistantcreated',
    name: 'OnboardingAssistantCreated',
    component: OnboardingAssistantCreated,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/wizard',
    name: 'WizardConfiguration',
    component: WizardConfiguration,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingchooseplan',
    name: 'OnboardingChoosePlan',
    component: OnboardingChoosePlan,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/activate',
    name: 'ActivateAssistant',
    component: ActivateAssistant,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingnotificationpreview',
    name: 'OnboardingNotificationPreview',
    component: OnboardingNotificationPreview,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingchoosedevice',
    name: 'OnboardingChooseDevice',
    component: OnboardingChooseDevice,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingprebookappointment',
    name: 'OnboardingPreBookAppointment',
    component: OnboardingPreBookAppointment,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingthisorotherdevice',
    name: 'OnboardingThisOrOtherDevice',
    component: OnboardingThisOrOtherDevice,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingforwardingonthisdevice',
    name: 'OnboardingForwardingOnThisDevice',
    component: OnboardingForwardingOnThisDevice,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingforwardingonotherdevice',
    name: 'OnboardingForwardingOnOtherDevice',
    component: OnboardingForwardingOnOtherDevice,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingforwardingonlandline',
    name: 'OnboardingForwardingOnLandline',
    component: OnboardingForwardingOnLandline,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/onboardingswitchboardconfiguration',
    name: 'OnboardingSwitchboardConfiguration',
    component: OnboardingSwitchboardConfiguration,
    props: true,
    meta: {
      requiresAuth: true
    }
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
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/mcp-connectors',
    name: 'McpConnectors',
    component: McpConnectors,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/plan',
    name: 'Plan',
    component: Plan,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/planandproducts',
    name: 'PlanAndProducts',
    component: PlanAndProducts,
    props: { },
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/success_payment',
    name: 'SuccessPayment',
    component: SuccessPayment,
    props: true
  },
  {
    path: '/success_payment_product',
    name: 'SuccessPaymentProduct',
    component: SuccessPaymentProduct,
    props: true
  },
  {
    path: '/failed_payment',
    name: 'FailedPayment',
    component: FailedPayment,
    props: true
  },
  {
    path: '/failed_payment_product',
    name: 'FailedPaymentProduct',
    component: FailedPaymentProduct,
    props: true
  },
  {
    path: '/privacypolicy',
    name: 'PrivacyPolicy',
    component: PrivacyPolicy,
    props: true
  },
  {
    path: '/termsandconditions',
    name: 'TermsAndConditions',
    component: TermsAndConditions,
    props: true
  },
  {
    path: '/callforwardingguide',
    name: 'CallForwardingGuide',
    component: CallForwardingGuide,
    props: true
  },
  {
    path: '/partnerprogram',
    name: 'PartnerProgram',
    component: PartnerProgram,
    props: true
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
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/analytics-admin',
    name: 'AnalyticsAdmin',
    component: AnalyticsAdmin,
    props: true,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/contacts',
    name: 'Contacts',
    component: Contacts,
    props: true,
    meta: {
      requiresAuth: true
    }
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
    component: Signup
  },
  {
    path: '/signin',
    name: 'SigninNew',
    component: Signin,
  },
  {
    path: '/login',
    name: 'Signin',
    component: Signin
  },
  {
    path: '/callback',
    name: 'google-callback',
    component: GoogleCallback
  },
  {
    path: '/oauth/authorize',
    name: 'OAuthConsent',
    component: OAuthConsent
  },
  {
    path: '/testchat',
    name: 'TestChat',
    component: TestChat,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/testreadwebdata',
    name: 'TestReadWebData',
    component: TestReadWebData,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/reseller',
    name: 'ResellerDashboard',
    component: ResellerDashboardView,
    meta: {
      requiresAuth: true,
      requiresRole: 'reseller'
    }
  },
  {
    path: '/reseller/codes',
    name: 'ResellerInvitationCodes',
    component: ResellerInvitationCodes,
    meta: {
      requiresAuth: true,
      requiresRole: 'reseller'
    }
  },
  {
    path: '/reseller/profile',
    name: 'ResellerProfile',
    component: ResellerProfileView,
    meta: {
      requiresAuth: true,
      requiresRole: 'reseller'
    }
  },
  {
    path: '/admin/resellers',
    name: 'ResellerManagement',
    component: ResellerManagement,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/resellers/new',
    name: 'ProvisionReseller',
    component: ProvisionReseller,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/resellers/:resellerId',
    name: 'ResellerDetail',
    component: ResellerDetail,
    props: true,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/users',
    name: 'UserRoleManagement',
    component: UserRoleManagement,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/templates',
    name: 'AgentTemplates',
    component: AgentTemplates,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/admin/templates/:name',
    name: 'AgentTemplateEditor',
    component: AgentTemplateEditor,
    meta: {
      requiresAuth: true,
      requiresRole: 'admin'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  base: process.env.BASE_URL || '/'
})

const getUser = async () => {
  const response = new Promise((resolve, reject) => {
    auth.onAuthStateChanged(user => {
      resolve(user)
    }, err => {
      reject(err)
    })
  })

  return response;
}

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

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  if (requiresAuth) {
    try {
      const user = await getUser();
      // First check if we have a user
      if (!user) {
        return next('login');
      }

      // Then check if user is anonymous
      if (user.isAnonymous) {
        return next('login');
      }

      // For Google users, skip email verification check
      const isVerified = user.providerData[0]?.providerId === 'google.com' || user.emailVerified;
      if (!isVerified) {
        return next('login');
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
      return next('login');
    }
  }
  next();
});

export default router
