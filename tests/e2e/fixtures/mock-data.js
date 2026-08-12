/**
 * Mock data for E2E tests.
 * Shapes match the StarChat backend Scala entities.
 * Wrapper: { text, score, result, totalHits }
 */

const mockUser = {
  uid: 'test-uid-12345',
  email: 'test@mrcall.ai',
  emailVerified: true,
  displayName: 'Test User',
  isAnonymous: false,
  providerData: [{ providerId: 'password', email: 'test@mrcall.ai' }],
  accessToken: 'mock-token',
}

const mockAdminUser = {
  ...mockUser,
  uid: 'admin-uid-12345',
  email: 'admin@mrcall.ai',
  displayName: 'Admin User',
  providerData: [{ providerId: 'password', email: 'admin@mrcall.ai' }],
}

const mockResellerUser = {
  ...mockUser,
  uid: 'reseller-uid-12345',
  email: 'reseller@mrcall.ai',
  displayName: 'Reseller User',
  providerData: [{ providerId: 'password', email: 'reseller@mrcall.ai' }],
}

const mockBusiness = {
  businessId: 'test-biz-001',
  companyName: 'Test Restaurant',
  name: 'Mario',
  surname: 'Rossi',
  owner: 'test-uid-12345',
  template: 'generic_onboarding',
  businessPhoneNumber: '+393331234567',
  serviceNumber: '+393339876543',
  emailAddress: 'test@mrcall.ai',
  countryAlpha2: 'IT',
  languageCountry: 'it-IT',
  timezoneStr: 'Europe/Rome',
  subscriptionStatus: 'ACTIVE',
  onboarding: false,
  tested: 'true',
  nickname: 'Test Ristorante',
  variables: {
    business_type: 'restaurant',
    opening_hours: '9-18',
    MRZAPPA_ENABLED: 'false',
    OUTBOUND_CALLS_ENABLED: 'false',
  },
  creationDateTime: '2025-01-01T00:00:00Z',
}

const mockBusinessesResponse = {
  text: 'success',
  score: '1.0',
  result: [mockBusiness],
  totalHits: 1,
}

const mockConversation = {
  id: 'conv-001',
  businessId: 'test-biz-001',
  owner: 'test-uid-12345',
  startTimestamp: 1709712000000,
  contactNumber: '+393331111111',
  contactName: 'Cliente Test',
  subject: 'Prenotazione tavolo',
  body: 'Il cliente ha chiesto disponibilità per venerdì sera',
  duration: 45000,
  properties: [{ name: 'status', type: 'string', value: 'completed' }],
  values: [{ name: 'date', type: 'string', value: '2025-03-07' }],
}

const mockConversationsResponse = {
  text: 'success',
  score: '1.0',
  result: [mockConversation],
  totalHits: 1,
}

const mockContact = {
  id: 'contact-001',
  displayName: 'Cliente Test',
  name: { first: 'Marco', last: 'Bianchi' },
  phones: [{ number: '+393331111111', type: 'mobile', regionCode: 'IT' }],
  emails: [{ address: 'marco@example.com' }],
  organizations: [{ company: 'Acme Srl' }],
}

const mockContactsResponse = {
  text: 'success',
  score: '1.0',
  result: [mockContact],
  totalHits: 1,
}

const mockSubscription = {
  paymentSystem: 'REGISTERED',
  paymentProvider: 'Stripe',
  status: 'ACTIVE',
  secondsToExpiration: 2592000,
  currentPeriodStart: 1709712000,
  currentPeriodEnd: 1712304000,
  testNumber: false,
}

const mockSubscriptionResponse = {
  text: 'success',
  score: '1.0',
  result: [mockSubscription],
  totalHits: 1,
}

const mockAnalyticsKpi = {
  period: { from: 1707091200000, to: 1709712000000 },
  totalCalls: 156,
  avgCallDurationMs: 42000,
  totalCallDurationMs: 6552000,
  uniqueCallers: 89,
  previousPeriod: { totalCalls: 130, avgCallDurationMs: 38000 },
}

const mockAnalyticsResponse = {
  text: 'success',
  score: '1.0',
  result: [mockAnalyticsKpi],
  totalHits: 1,
}

const mockTemplateVariable = {
  name: 'business_type',
  humanName: 'Business Type',
  class: 'variable',
  templateName: 'generic_onboarding',
  defaultValue: '',
  type: 'enum',
  visible: true,
  mandatory: true,
  modifiable: true,
  advanced: false,
  position: '1',
  valuesSelection: [{ value: 'restaurant', label: 'Restaurant' }],
}

const mockTemplateVariablesResponse = {
  text: 'success',
  score: '1.0',
  result: [mockTemplateVariable],
  totalHits: 1,
}

const mockResellerProfile = {
  resellerId: 'res-001',
  displayName: 'Reseller Test',
  email: 'reseller@test.com',
  feeRate: 0.15,
  canGenerateCodes: true,
  canAcceptExistingOwners: false,
}

const mockResellerProfileResponse = {
  text: 'success',
  score: '1.0',
  result: [mockResellerProfile],
  totalHits: 1,
}

const mockInvitationCode = {
  code: 'RES-TEST123',
  resellerId: 'res-001',
  label: 'Test Code',
  maxUses: 100,
  useCount: 5,
  active: true,
}

const mockInvitationCodesResponse = {
  text: 'success',
  score: '1.0',
  result: [mockInvitationCode],
  totalHits: 1,
}

const mockCounterResources = {
  text: 'success',
  score: '1.0',
  result: [{ CALLCREDIT: 3600, SMS: 50 }],
  totalHits: 1,
}

const mockTemplatesResponse = {
  text: 'success',
  score: '1.0',
  result: [{
    name: 'generic_onboarding',
    humanName: 'Generic Assistant',
    description: 'A generic assistant template',
  }],
  totalHits: 1,
}

const mockCustomerRecord = {
  text: 'success',
  score: '1.0',
  result: [{ data: { stripePartnerPromotionCode: null } }],
  totalHits: 1,
}

const mockEmptyResponse = {
  text: 'success',
  score: '1.0',
  result: [],
  totalHits: 0,
}

const mockResellersListResponse = {
  text: 'success',
  score: '1.0',
  result: [mockResellerProfile],
  totalHits: 1,
}

const mockUsersListResponse = {
  text: 'success',
  score: '1.0',
  result: [{
    uid: 'user-001',
    email: 'user1@test.com',
    displayName: 'User One',
    role: 'owner',
  }],
  totalHits: 1,
}

module.exports = {
  mockUser,
  mockAdminUser,
  mockResellerUser,
  mockBusiness,
  mockBusinessesResponse,
  mockConversation,
  mockConversationsResponse,
  mockContact,
  mockContactsResponse,
  mockSubscription,
  mockSubscriptionResponse,
  mockAnalyticsKpi,
  mockAnalyticsResponse,
  mockTemplateVariable,
  mockTemplateVariablesResponse,
  mockResellerProfile,
  mockResellerProfileResponse,
  mockInvitationCode,
  mockInvitationCodesResponse,
  mockCounterResources,
  mockTemplatesResponse,
  mockCustomerRecord,
  mockEmptyResponse,
  mockResellersListResponse,
  mockUsersListResponse,
}
