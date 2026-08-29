<template>
  <metainfo>
  </metainfo>
  <div id="app-container" class="h-screen">
    <div v-if="!$route.meta.bare" id="navbar">
      <Navbar/>
    </div>
    <div v-if="managedBy && !$route.meta.bare" class="managed-by-banner">
      <i class="pi pi-briefcase"></i>
      {{ $t('components.reseller.managedBy.label', { name: managedBy.displayName, email: managedBy.email }) }}
    </div>
    <div id="app-central-content">
      <ConfirmDialog class="mrcall-confirm-dialog"></ConfirmDialog>
      <router-view/>
    </div>
  </div>
</template>

<script>
import Navbar from '@/components/Navbar'
import { loadLanguageAsync } from '@/i18n/index.js'
import { computed } from 'vue'
import { useStore } from 'vuex'

export default {
  data() {
    return {
    }
  },
  setup() {
    const store = useStore()

    async function changeLanguage(locale) {
      try {
        await loadLanguageAsync(locale)
      } catch (error) {
        console.error('Failed to change language:', error)
      }
    }
    return {
      store,
      changeLanguage,
      managedBy: computed(() => store.state.managedBy),
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
      role: computed(() => store.state.role),
    }
  },
  components: {
    Navbar
  },
  watch: {
    user(newUser) {
      if (newUser && this.authIsReady) {
        this.store.dispatch('claimResellerCode')
      }
    },
    role(newRole) {
      if (newRole === 'owner' && this.user) {
        this.store.dispatch('loadManagedBy')
      }
    }
  },
  mounted() {
    let googleTagManager = document.head.querySelector(`[id="gtm"]`);
    if (!googleTagManager) {
      let tag = document.createElement("script");
      tag.setAttribute("id", 'gtm');
      tag.setAttribute("type", 'text/javascript');
      tag.innerHTML = "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MW4TX4N');";
      document.head.prepend(tag);
    }

    const enableClarity = true;
    if (enableClarity) {
      let tag = document.createElement("script");
      tag.setAttribute("type", 'text/javascript');
      tag.innerHTML = '(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "o69fhtcykk");' ;
      document.head.prepend(tag);
    }
  /*
  let googleTagManagerNoScript = document.body.querySelector(`[id="gtmns"]`);
  if (!googleTagManagerNoScript) {
    let tag = document.createElement("noscript");
    tag.setAttribute("id", 'gtmns');
    let iframe = document.createElement("iframe");
    iframe.setAttribute("src", 'https://www.googletagmanager.com/ns.html?id=GTM-TZZ3QB6');
    iframe.setAttribute("height", '0');
    iframe.setAttribute("width", '0');
    iframe.setAttribute("style", 'display:none;visibility:hidden');
    tag.prepend(iframe);
    document.body.prepend(tag);
  }
  */
  //document.documentElement.html.setAttribute('lang', 'it')

  /*
  let iubenda1 = document.head.querySelector(`[id="iubenda1"]`);
  if (!iubenda1) {
    const tag = document.createElement("script");
    tag.setAttribute("id", 'iubenda1');
    tag.setAttribute("type", 'text/javascript');
    tag.innerHTML = 'var _iub = _iub || []; _iub.csConfiguration = {"ccpaAcknowledgeOnDisplay":true,"consentOnContinuedBrowsing":false,"countryDetection":true,"enableCcpa":true,"enableLgpd":true,"floatingPreferencesButtonDisplay":"bottom-right","invalidateConsentWithoutLog":true,"lgpdAppliesGlobally":false,"perPurposeConsent":true,"siteId":2787987,"whitelabel":false,"cookiePolicyId":13724557,"lang":"it", "banner":{ "acceptButtonCaptionColor":"#FFFFFF","acceptButtonColor":"#0073CE","acceptButtonDisplay":true,"backgroundColor":"#FFFFFF","brandBackgroundColor":"#FFFFFF","brandTextColor":"#000000","closeButtonDisplay":false,"customizeButtonCaptionColor":"#4D4D4D","customizeButtonColor":"#DADADA","customizeButtonDisplay":true,"explicitWithdrawal":true,"fontSizeBody":"12px","listPurposes":true,"position":"float-bottom-center","rejectButtonCaptionColor":"#4D4D4D","rejectButtonColor":"#DADADA","rejectButtonDisplay":true,"textColor":"#000000","content":"Noi e terze parti selezionate utilizziamo cookie o tecnologie simili per finalità tecniche e, con il tuo consenso, anche per "interazioni e funzionalità semplici", "miglioramento dell\'esperienza", "misurazione". Non per pubblicità né per vendita dei dati personali. Il rifiuto del consenso può rendere non disponibili le relative funzioni.\\\n\\\nPuoi liberamente prestare, rifiutare o revocare il tuo consenso, in qualsiasi momento.\\\n\\\nUsa il pulsante "Accetta" per acconsentire all\'utilizzo di tali tecnologie. Usa il pulsante "Rifiuta" per continuare senza accettare." }};';
    document.head.appendChild(tag);
  }

  let iubenda2 = document.head.querySelector(`[id="iubenda2"]`);
  if (!iubenda2) {
    let tag = document.createElement("script");
    tag.setAttribute("id", 'iubenda2');
    tag.setAttribute("type", 'text/javascript');
    tag.setAttribute("src", 'https://cdn.iubenda.com/cs/ccpa/stub.js');
    document.head.appendChild(tag);
  }

  let iubenda3 = document.head.querySelector(`[id="iubenda3"]`);
  if (!iubenda3) {
    let tag = document.createElement("script");
    tag.setAttribute("id", 'iubenda3');
    tag.setAttribute("type", 'text/javascript');
    tag.setAttribute("src", 'https://cdn.iubenda.com/cs/iubenda_cs.js');
    tag.setAttribute("charSet", "UTF-8");
    tag.async = true;
    document.head.appendChild(tag);
  }
  */
}
}
</script>

<style lang="less">
.mrcall-confirm-dialog .visibility-reject-button-off {
  visibility: hidden ;
}

.mrcall-confirm-dialog div.p-dialog-header-icons {
  visibility: hidden ;
}

// PrimeVue 4 tooltip fallback: the theme system injects these at runtime,
// but HMR / cache race conditions can leave the popup unstyled in dev — the
// directive then renders the text inline at body root instead of as a floater.
// These rules duplicate the essentials so positioning is guaranteed.
.p-tooltip {
  position: absolute;
  pointer-events: none;
  max-width: 12.5rem;
  z-index: 1101;
}
.p-tooltip-text {
  white-space: pre-line;
  word-break: break-word;
  background: #1f2937;
  color: #ffffff;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 0.875rem;
  line-height: 1.4;
}
.p-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-color: transparent;
  border-style: solid;
}
</style>

<style lang="less" scoped>
.managed-by-banner {
  background: #e0edff;
  color: #1a5fb4;
  text-align: center;
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;

  i {
    margin-right: 0.4rem;
  }
}
</style>
