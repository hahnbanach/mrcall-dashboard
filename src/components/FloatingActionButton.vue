<template>
  <Button
      @click="$emit('click')"
      :icon="icon"
      iconPos="left"
      :label="label"
      :class="['fab-button', { 'fab-woosh': woosh, 'fab-desktop-only': !showOnMobile }]"
  />
</template>

<script setup>
import Button from 'primevue/button';

defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: 'pi pi-comments' },
  woosh: { type: Boolean, default: false },
  showOnMobile: { type: Boolean, default: false },
});

defineEmits(['click']);
</script>

<style scoped lang="less">
@import '../assets/style/colors';

@max-width-screen: 840px;

.fab-button.p-button {
  position: fixed;
  bottom: 1.5em;
  right: 1.5em;
  z-index: 1000;
  border-radius: 33px;
  padding: 0.75em 1.5em;
  font-family: 'Inter', serif;
  font-weight: 600;
  font-size: 0.95em;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  background: @mrcall_blue;
  border-color: @mrcall_blue;
  color: white;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  overflow: hidden;

  @media screen and (max-width: @max-width-screen) {
    position: fixed;
    left: 0.5em;
    right: 0.5em;
    bottom: 0.5em;
    width: calc(100% - 1em);
    justify-content: center;
    padding: 0.85em 1em;
  }

  &:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);

    &::after {
      animation: none;
    }
  }
}

.fab-woosh::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    fade(white, 0%) 0%,
    fade(white, 25%) 50%,
    fade(white, 0%) 100%
  );
  transform: skewX(-20deg);
  animation: woosh 4s ease-in-out infinite;
}

.fab-desktop-only {
  @media screen and (max-width: @max-width-screen) {
    display: none;
  }
}

@keyframes woosh {
  0%, 70%, 100% { left: -100%; }
  85% { left: 150%; }
}

@media (prefers-reduced-motion: reduce) {
  .fab-woosh::after {
    animation: none;
  }
}
</style>
