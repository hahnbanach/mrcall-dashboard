<script setup>
import SupportSection from "../support/SupportSection.vue";
import { useSlots, ref } from 'vue'
const slots = useSlots()
const panelCollapsed = ref(false)
</script>

<template>
  <div id="configuration-page">
    <div id="menu-large">
      <slot name="menu-large"></slot>
    </div>
    <div id="spinner-small">
      <slot name="spinner"></slot>
    </div>
    <div id="menu-small">
      <slot name="menu-small"></slot>
    </div>
    <div id="divider"></div>
    <div id="mrcall-configuration-base-content">
      <div id="mrcall-configuration-central-section">
        <div id="spinner-large">
          <slot name="spinner"></slot>
        </div>
        <div id="messages">
          <slot name="messages"></slot>
        </div>
        <div id="central-header-section">
          <slot name="beforetitle"></slot>
          <div id="title">
            <slot name="title"></slot>
          </div>
          <div id="subtitle">
            <slot name="subtitle"></slot>
          </div>
        </div>
        <div id="content">
          <slot name="content"></slot>
        </div>
        <div id="footer" v-if="slots.footer">
          <div id="footer-container">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </div>
    <div id="divider-right" :class="{ collapsed: panelCollapsed }">
      <button class="panel-toggle-btn" @click="panelCollapsed = !panelCollapsed">
        <i :class="panelCollapsed ? 'pi pi-angle-left' : 'pi pi-angle-right'"></i>
      </button>
    </div>
    <div id="support-large" :class="{ collapsed: panelCollapsed }">
      <div v-show="!panelCollapsed" class="panel-content">
        <slot name="action-panel-large">
          <SupportSection></SupportSection>
        </slot>
      </div>
    </div>
    <div id="support-small" :class="{ collapsed: panelCollapsed }">
      <button class="panel-toggle-btn-small" @click="panelCollapsed = !panelCollapsed">
        <i :class="panelCollapsed ? 'pi pi-angle-up' : 'pi pi-angle-down'"></i>
      </button>
      <div v-show="!panelCollapsed" class="panel-content-small">
        <slot name="action-panel-small">
          <Panel toggleable collapsed>
            <template #header>
              <div id="header-assistance-icon">
              </div>
              {{$t('components.templates.onboarding.doYouNeedAssistance')}}
            </template>
            <SupportSection></SupportSection>
          </Panel>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

@max-width-screen: 840px;
@small-content-padding: 0.5em;
@large-content-padding: 2em;
@central-header-section-alignment: left;

#configuration-page {
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: @mrcall_borders;

  background: @mrcall_white;
  display: flex ;
  flex-direction: row;
  height: 100%;

  #mrcall-configuration-base-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    position: initial;
    background: @mrcall_white;
    flex-grow: 1;
    overflow: hidden;

    #messages {
      border: 0;
      padding: 0;
      margin: 0;
      width: 100% ;
    }

    @media screen and (max-width: @max-width-screen) {
      #mrcall-configuration-central-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: auto;
        margin-bottom: auto;

        position: relative;
        width: 100%;
        min-height: 100%;
        height: auto;

        left: 0;

        /* Lara/Root/surface-card */
        background: @mrcall_white;

        #spinner-large {
          visibility: hidden;
        }
        #spinner-small {
          border: 0;
          padding: 0;
          margin: 0;
          height: fit-content;
          width: 100%;
        }

        #central-header-section {
          width: 100%;
          padding: @small-content-padding;
          text-align: @central-header-section-alignment;
          #title {
            font-family: 'Inter', serif;
            font-style: normal;
            font-weight: 700;
            font-size: 1.75em;
            line-height: 1em;
            padding-bottom: 0.125em;
            color: @mrcall_dark_grey_text;
          }

          #subtitle {
            font-family: 'Inter',serif;
            font-style: normal;
            font-weight: 400;
            font-size: 1.0em;
            line-height: 1.4em;
            color: @mrcall_grey_text;
          }
        }

        #content {
          padding: @small-content-padding;
          width: 100%;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          overflow: scroll;
        }
      }
    }

    @media screen and (min-width: @max-width-screen) {
      background: @mrcall_background;

      #mrcall-configuration-central-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: auto;
        margin-bottom: auto;

        position: relative;
        width: 100%;
        min-height: 100%;
        height: auto;

        /* Lara/Root/surface-card */
        background: @mrcall_white;

        #spinner-small {
          visibility: hidden;
        }
        #spinner-large {
          border: 0;
          padding: 0;
          margin: 0;
          height: fit-content;
          width: 100%;
        }

        #central-header-section {
          width: 100%;
          padding: @large-content-padding;
          text-align: @central-header-section-alignment;
          #title {
            font-family: 'Inter', serif;
            font-style: normal;
            font-weight: 700;
            font-size: 1.75em;
            line-height: 1em;
            padding-bottom: 0.125em;
            color: @mrcall_dark_grey_text;
          }

          #subtitle {
            font-family: 'Inter',serif;
            font-style: normal;
            font-weight: 400;
            font-size: 1em;
            line-height: 1.4em;
            color: @mrcall_grey_text;
          }
        }

        #content {
          padding: @large-content-padding;
          width: 100%;
          max-width: 800px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          overflow: scroll;
        }
      }
    }
  }

  #divider {
    margin-left: 0;
    border-right-width: 1px;
    border-right-style: solid;
    border-right-color: @mrcall_borders;
  }

  #divider-right {
    margin-left: 0;
    border-left: 1px solid @mrcall_borders;
    border-right: 1px solid @mrcall_borders;
    display: flex;
    align-items: flex-start;
    flex-shrink: 0;
    background: @mrcall_background;

    .panel-toggle-btn {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 1em 0.2em;
      background: none;
      border: none;
      cursor: pointer;
      color: @mrcall_grey_text;
      font-size: 1.2em;

      &:hover {
        color: @mrcall_blue;
        background: darken(@mrcall_background, 5%);
      }
    }
  }

  // Desktop: support-large panel
  #support-large {
    display: flex;
    flex-direction: column;
    width: 300px;
    min-width: 300px;
    flex-shrink: 0;
    transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease;
    overflow: visible;

    .panel-content {
      flex: 1;
      min-width: 0;
    }

    &.collapsed {
      width: 0;
      min-width: 0;
      padding: 0 !important;
      overflow: hidden;
    }
  }

  // Mobile: support-small panel
  #support-small {
    transition: max-height 0.25s ease;
    overflow: hidden;

    .panel-toggle-btn-small {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.4em 0;
      background: @mrcall_background;
      border: none;
      border-top: 1px solid @mrcall_borders;
      cursor: pointer;
      color: @mrcall_grey_text;
      font-size: 1.1em;

      &:hover {
        color: @mrcall_blue;
      }
    }

    .panel-content-small {
      overflow: visible;
    }

    &.collapsed {
      .panel-content-small {
        display: none;
      }
    }

    #header-assistance-icon {
      background: url(../../../assets/images/mrcall/littleman/assistance_transparent_bg.svg) no-repeat;

      width: 48px;
      height: 48px;
      mix-blend-mode: multiply;

      /* Inside auto layout */

      flex: none;
      order: 0;
      flex-grow: 0;
    }

    .p-component {
      width: 100%;
    }
  }

  @media screen and (max-width: @max-width-screen) {
    width: 100%;
    #menu-large {
      display: none;
    }
    #support-large {
      display: none;
    }
    #divider-right {
      display: none;
    }
    #menu-small {
      padding: @small-content-padding;
      display: flex;
    }
    #support-small {
      display: flex;
      flex-direction: column;
      position: sticky;
      bottom: 0;
      z-index: 11;
      background: @mrcall_white;
      flex-shrink: 0;

      .panel-content-small {
        max-height: 50vh;
        overflow-y: auto;
      }
    }
  }
  @media screen and (min-width: @max-width-screen) {
    border: 0;
    padding: 0;
    margin: 0;

    #menu-large {
      padding: 2em @small-content-padding;
      display: flex;
    }
    #support-large {
      padding: 2em 1em;
      display: flex;
    }
    #menu-small {
      display: none;
    }
    #support-small{
      display: none;
    }
  }

  #footer {
    width: 100%;
    display: flex;
    position: sticky;
    bottom: 0;
    z-index: 10;
    background: @mrcall_white;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);

    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: @mrcall_borders;

    @media screen and (max-width: @max-width-screen) {
      flex-direction: column;
      margin-left: auto;
      #footer-container {
        padding: @small-content-padding ;
      }
    }

    @media screen and (min-width: @max-width-screen) {
      flex-direction: row;
      margin-left: auto;
      #footer-container {
        width: 100%;
        padding: @large-content-padding;

      }
    }
  }
}

@media screen and (max-width: @max-width-screen) {
  #configuration-page {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100%;
    overflow-y: auto;

    #mrcall-configuration-base-content {
      overflow: visible;
      flex-grow: 0;

      #mrcall-configuration-central-section {
        min-height: auto;

        #content {
          overflow: visible;
        }
      }
    }
  }
}
</style>
