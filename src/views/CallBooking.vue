<template>
  <div class="main-page-content-section">
    <div class="redirect-notice">
      <i class="pi pi-spin pi-spinner" style="font-size: 2em;"></i>
      <p>{{ $t('views.callbooking.redirecting') }}</p>
    </div>
  </div>
</template>

<script>
import { bookingUrl } from '@/utils/BookingUrl';

export default {
  name: "CallBooking",
  mounted() {
    window.location.replace(bookingUrl());
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';

.redirect-notice {
  display: flex;
  flex-flow: column;
  align-items: center;
  justify-content: center;
  padding: 4em 1em;
  color: @mrcall_grey_text;
  gap: 1em;
  font-family: 'Inter', serif;
}
</style>
