<script setup>
import { useSlots } from 'vue'
const slots = useSlots()
</script>

<template>
  <div class="sign-page" :class="{ 'sign-page--split': slots.messaging }">

    <!-- ─── LEFT: messaging panel (only when slot provided) ─── -->
    <div v-if="slots.messaging" class="sign-messaging-panel">
      <a href="https://www.mrcall.ai" class="sign-messaging-logo">
        <div class="mrcall-title-logo"></div>
      </a>
      <slot name="messaging"></slot>
    </div>

    <!-- ─── RIGHT: form panel ─── -->
    <div class="sign-form-panel">
      <!-- Logo shown on mobile (split) or always (centered/no-split) -->
      <a href="https://www.mrcall.ai" class="headinglogobox" :class="{ 'mobile-only': slots.messaging }">
        <div class="mrcall-title-logo"></div>
      </a>

      <div class="sign-central-window">
        <div class="title">
          <slot name="title"></slot>
        </div>
        <slot name="content"></slot>
        <slot name="signin-signup-alternative"></slot>
      </div>
    </div>

  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

/* ------------------------------------------------------------------ *
 * Logo background (shared)
 * ------------------------------------------------------------------ */
.mrcall-title-logo {
  background: url(../../../assets/images/mrcall/logo_menu_mrcall.svg) no-repeat;
  background-size: contain;
}

/* ------------------------------------------------------------------ *
 * Base page container
 * ------------------------------------------------------------------ */
.sign-page {
  min-height: 100vh;
  width: 100%;
  background: @mrcall_white;
  display: grid;
  grid-template-columns: 1fr;
}

/* ------------------------------------------------------------------ *
 * SPLIT layout (signup / signin — has messaging slot)
 * ------------------------------------------------------------------ */
.sign-page--split {
  /* Desktop: two columns, capped width so panels stay close on wide screens */
  @media screen and (min-width: 960px) {
    grid-template-columns: 1fr 1fr;
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* ─── Messaging panel (left) ─── */
.sign-messaging-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 32px 24px;

  @media screen and (min-width: 960px) {
    padding: 64px;
  }

  .sign-messaging-logo {
    margin-bottom: 40px;

    .mrcall-title-logo {
      width: 180px;
      height: 48px;
    }

    /* Hide logo in messaging panel on mobile — form panel shows it */
    @media screen and (max-width: 959px) {
      display: none;
    }
  }
}

/* ─── Form panel (right or only panel) ─── */
.sign-form-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;

  @media screen and (min-width: 960px) {
    padding: 48px;
  }
}

/* ─── Logo in form panel ─── */
.headinglogobox {
  margin-bottom: 24px;
  text-align: center;

  .mrcall-title-logo {
    width: 180px;
    height: 48px;
    margin: 0 auto;
  }

  /* When split: logo in form panel is mobile-only */
  &.mobile-only {
    @media screen and (min-width: 960px) {
      display: none;
    }
  }
}

/* ─── Central form card ─── */
.sign-central-window {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  gap: 24px;
  width: 100%;
  max-width: 480px;
  background: @mrcall_white;
  border-radius: 6px;

  @media screen and (min-width: 640px) {
    padding: 48px;
  }

  .title {
    font-family: 'Inter', sans-serif;
    font-style: normal;
    font-weight: 700;
    font-size: 24.5px;
    line-height: 30px;
    color: @mrcall_grey_text;
    text-align: center;
  }
}

/* ------------------------------------------------------------------ *
 * CENTERED layout (magiclink — no messaging slot)
 * Keep the classic look but with white bg instead of grey
 * ------------------------------------------------------------------ */
.sign-page:not(.sign-page--split) {
  .sign-form-panel {
    /* Center the form vertically and horizontally */
    min-height: 100vh;
  }

  .sign-central-window {
    /* Add the card shadow back for centered mode */
    @media screen and (min-width: 640px) {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12),
                  0 1px 1px rgba(0, 0, 0, 0.14),
                  0 2px 1px -1px rgba(0, 0, 0, 0.02);
      max-width: 556px;
    }
  }
}
</style>
