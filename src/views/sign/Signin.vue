<script>
import Sign from '@/components/templates/sign/Sign.vue'
import Signin from '@/components/templates/sign/Signin.vue'
import { useI18n } from 'vue-i18n'

export default {
  components: {
    Sign,
    Signin
  },
  setup() {
    const { t } = useI18n()
    return { t }
  }
}
</script>

<template>
  <Sign>
    <!-- ─── LEFT PANEL: messaging ─── -->
    <template #messaging>
      <div class="signin-messaging">
        <h1 class="signin-headline">{{ t('views.sign.signin.heroHeadline') }}</h1>
        <p class="signin-subheadline">{{ t('views.sign.signin.heroSubheadline') }}</p>
      </div>
    </template>

    <!-- ─── FORM TITLE ─── -->
    <template #title>
      {{ t('views.sign.signin.titleText') }}
    </template>

    <!-- ─── FORM CONTENT ─── -->
    <template #content>
      <Signin />
    </template>

    <!-- ─── BELOW FORM: sign-up link ─── -->
    <template #signin-signup-alternative>
      <div class="text-center">
        <span class="companion-text">{{ t('components.templates.sign.signin.signupLinkCompanionText') }}</span>
        <span class="companion-text">&nbsp;</span>
        <a href="/signup" class="link">{{ t('components.templates.sign.signin.signupButtonLabel') }}</a>
      </div>
    </template>
  </Sign>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

/* ─── Messaging panel content ─── */
.signin-messaging {
  max-width: 480px;
}

.signin-headline {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 2.5rem;
  line-height: 1.15;
  color: @mrcall_black;
  margin: 0;

  @media screen and (max-width: 959px) {
    font-size: 1.5rem;
    text-align: center;
  }
}

.signin-subheadline {
  font-family: 'Inter', sans-serif;
  font-size: 1.1rem;
  line-height: 1.6;
  color: @mrcall_grey_text;
  margin-top: 16px;

  @media screen and (max-width: 959px) {
    display: none;
  }
}

.link {
  text-decoration: none;
  color: @mrcall_blue;
  font-weight: 700;

  &:hover {
    text-decoration: underline;
  }
}
</style>
