<template>
  <Menubar v-if="isWebView === false && ! isNoNavbarView()" :model="itemsWeb" breakpoint="960px" ref="menubar">
    <template #start>
      <router-link to="/signin">
        <img class="mrCallLogo" src="@/assets/images/mrcall/logo_menu_mrcall.svg"/>
      </router-link>
    </template>
    <template #end>
    </template>
  </Menubar>
  <Toolbar v-else-if="! isNoNavbarView()">
    <template #start>
      <img class="mrCallLogo" src="@/assets/images/mrcall/logo_menu_mrcall.svg"/>
    </template>
    <template #end>
      <Button @click="gotoRoute('/account')"
              icon="pi pi-user-edit" class="p-button-danger" />
      <div style="margin-right: 0.2em ; margin-left: 0.2em"></div>
      <Button @click="closeWebview()"
              icon="pi pi-arrow-left" class="p-button-danger" />
    </template>
  </Toolbar>
  <div class="footer-links">
    <a href="https://www.mrcall.ai/privacy-2/" target="_blank">Privacy Policy</a>
  </div>
</template>

<script>
import { useStore } from "vuex";
import { computed } from "vue";
import router from "@/router";
import { useI18n } from "vue-i18n";
import Tr from "@/i18n/translation";

export default {
  components: {},
  data: function () {
    const store = useStore()
    const { t } = useI18n()

    const handleClickOnLogout = () => {
      store.dispatch('logout')
      router.replace('/')
    }

    const isWebView = computed(() => store.state.isWebview)

    const handleClickOnResendVerificationLink = () => {
      //TODO: rewrite with a function which can show an eventual error message
      store.dispatch('resendEmailVerification', {})
    }

    const noNavbarView = new Set();
    noNavbarView.add("/login");
    noNavbarView.add("/signin");
    noNavbarView.add("/signup");
    noNavbarView.add("/magiclink");

    const languageLabel = computed(() => t("language")) ;

    return {
      t,
      languageLabel,
      noNavbarView,
      isWebView,
      handleClickOnLogout,
      handleClickOnResendVerificationLink,
      user: computed(() => store.state.user),
      role: computed(() => store.state.role),
      userVerified: computed(() => store.state.userVerified),
      authIsReady: computed(() => store.state.authIsReady),
      itemsWeb: [
        {
          label: computed(() => t('components.navbar.login')),
          icon: 'pi pi-fw pi-sign-in',
          command: () => { router.push("/login") },
          visible: () => {
            return store.state.user === null
          },
        },
        {
          label: computed(() => t('components.navbar.subscribe')),
          icon: 'pi pi-fw pi-user-plus cta',
          command: () => { router.push("/signup") },
          visible: () => {
            return store.state.user === null
          },
        },
        {
          label: computed(() => t('components.navbar.assistants')),
          icon: 'pi pi-fw pi-box',
          visible: () => {
            return (store.state.user !== null &&
              store.state.user.emailVerified &&
              router.currentRoute.value.path !== "/businesses")
          },
          command: () => { router.push("/businesses") }
        },
        {
          label: computed(() => t('components.navbar.account')),
          icon: 'pi pi-fw pi-user-edit',
          visible: () => {
            return (store.state.user !== null &&
              store.state.user.emailVerified)
          },
          command: () => { router.push("/account") }
        },
        {
          label: languageLabel,
          icon: 'pi pi-fw pi-language',
          items: [
            {
              label: computed(() => t('locale.en-US')),
              value: 'en-US',
              command: () => {
                this.selectLanguage("en-US")
              }
            },
            {
              label: computed(() => t('locale.it-IT')),
              value: 'it-IT',
              command: () => {
                this.selectLanguage("it-IT")
              }
            },
            {
              label: computed(() => t('locale.fr-FR')),
              value: 'fr-FR',
              command: () => {
                this.selectLanguage("fr-FR")
              }
            },
            {
              label: computed(() => t('locale.es-ES')),
              value: 'es-ES',
              command: () => {
                this.selectLanguage("es-ES")
              },
            },
            {
              label: computed(() => t('locale.de-DE')),
              value: 'de-DE',
              command: () => {
                this.selectLanguage("de-DE")
              },
            },
            {
              label: computed(() => t('locale.nl-NL')),
              value: 'nl-NL',
              command: () => {
                this.selectLanguage("nl-NL")
              },
            },
            {
              label: computed(() => t('locale.sv-SE')),
              value: 'sv-SE',
              command: () => {
                this.selectLanguage("sv-SE")
              },
            },
            {
              label: computed(() => t('locale.da-DK')),
              value: 'da-DK',
              command: () => {
                this.selectLanguage("da-DK")
              },
            },
            {
              label: computed(() => t('locale.nb-NO')),
              value: 'nb-NO',
              command: () => {
                this.selectLanguage("nb-NO")
              },
            },
            {
              label: computed(() => t('locale.fi-FI')),
              value: 'fi-FI',
              command: () => {
                this.selectLanguage("fi-FI")
              },
            },
            {
              label: computed(() => t('locale.et-EE')),
              value: 'et-EE',
              command: () => {
                this.selectLanguage("et-EE")
              },
            },
            {
              label: computed(() => t('locale.el-GR')),
              value: 'el-GR',
              command: () => {
                this.selectLanguage("el-GR")
              },
            }
          ]
        },
        {
          label: computed(() => t('components.navbar.createAssistant')),
          icon: 'pi pi-fw pi-plus-circle',
          command: () => { router.push("/onboardinglang") },
          visible: () => {
            return (store.state.user && store.state.user.emailVerified)
              && router.currentRoute.value.path === "/businesses"
          }
        },
        {
          label: computed(() => t('components.navbar.resellerDashboard')),
          icon: 'pi pi-fw pi-briefcase',
          command: () => { router.push("/reseller") },
          visible: () => {
            return store.state.user !== null && store.state.role === 'reseller'
          }
        },
        {
          label: computed(() => t('components.navbar.invitationCodes')),
          icon: 'pi pi-fw pi-key',
          command: () => { router.push("/reseller/codes") },
          visible: () => {
            return store.state.user !== null && store.state.role === 'reseller'
          }
        },
        {
          label: computed(() => t('components.navbar.resellerManagement')),
          icon: 'pi pi-fw pi-users',
          command: () => { router.push("/admin/resellers") },
          visible: () => {
            return store.state.user !== null && store.state.role === 'admin'
          }
        },
        {
          label: computed(() => t('components.navbar.userManagement')),
          icon: 'pi pi-fw pi-user-edit',
          command: () => { router.push("/admin/users") },
          visible: () => {
            return store.state.user !== null && store.state.role === 'admin'
          }
        },
        {
          label: computed(() => t('components.navbar.agentTemplates')),
          icon: 'pi pi-fw pi-cog',
          command: () => { router.push("/admin/templates") },
          visible: () => {
            return store.state.user !== null && store.state.role === 'admin'
          }
        },
        {
          label: computed(() => t('components.navbar.resendVerificationEmail')),
          icon: 'pi pi-fw pi-envelope',
          command: () => {
            handleClickOnResendVerificationLink()
          },
          visible: () => {
            return store.state.user !== null && store.state.user.emailVerified !== true
          }
        },
        {
          label: computed(() => t('components.navbar.logout')),
          icon: 'pi pi-fw pi-sign-out',
          command: () => {
            handleClickOnLogout()
          },
          visible: () => {
            return store.state.user !== null
          }
        }
      ]
    }
  },
  methods: {
    async selectLanguage(newLocale) {
      console.debug("New language selected: ", newLocale)
      await Tr.switchLanguage(newLocale)
    },
    gotoRoute: (route) => {
      router.push(route)
    },
    isNoNavbarView() {
      if(router.currentRoute.value.path) {
        return this.noNavbarView.has(router.currentRoute.value.path);
      }
      return false ;
    },
    closeWebview() {
      window.flutter_inappwebview.callHandler('onMrCallWebCallback', 'exit');
    }
  },
  created() {
    const gl = Tr.getLocale() ;
    console.log("Navbar locale: ", gl);
  },
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.footer-links {
  position: fixed;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.85);
  padding: 4px 10px;
  border-radius: 6px;

  @media screen and (max-width: 640px) {
    display: none;
  }
}

.footer-links a {
  color: #666;
  text-decoration: none;
  font-size: 0.9rem;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.footer-links a:hover {
  opacity: 1;
  text-decoration: underline;
}

@media screen and (max-width: 640px) {
  div.p-menubar.p-component {
    background-color: @mrcall_menu_navbar_background;
    padding-left: 2rem;
    padding-right: 2rem;
    padding-bottom: 0;
  }

  div.p-toolbar.p-component {
    background-color: @mrcall_menu_navbar_background;
    padding-left: 2rem;
    padding-right: 2rem;
    padding-bottom: 0;
  }
}
@media screen and (min-width: 640px) {
  div.p-menubar.p-component {
    background-color: @mrcall_menu_navbar_background;
    opacity: 0.9;
    padding-left: 4rem;
    padding-right: 5rem;
    padding-bottom: 0;
  }

  div.p-toolbar.p-component {
    background-color: @mrcall_menu_navbar_background;
    opacity: 0.9;
    padding-left: 4rem;
    padding-right: 5rem;
    padding-bottom: 0;
  }
}

.mrCallLogo {
  width: 12rem;
  height: 4rem;
}
</style>
