<template>
  <div class="main-page-content-section analytics-report-page">
    <CallReportDetail
      v-if="ready && businessId && periodStart"
      :business-id="businessId"
      :period-start="periodStart"
      :request-id="requestId"
    />
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/config";
import businessUtils from "@/utils/Business";
import { isSessionEnded } from "@/firebase/session";
import CallReportDetail from "@/components/analytics/CallReportDetail.vue";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";

/**
 * The route of one report (`/analytics/report?id=<business>&start=<periodStart>&requestId=<id>`). The role decides
 * the admin's actions, so it is read first, as the analytics pages read it; the server stays the gate.
 */
export default {
  components: { CallReportDetail, PreFooterRequireAssistance },
  data() {
    return { ready: false };
  },
  computed: {
    businessId() {
      const id = this.$route.query.id;
      return typeof id === "string" && id !== "" ? id : null;
    },
    periodStart() {
      const value = Number(this.$route.query.start);
      return Number.isFinite(value) && value > 0 ? value : null;
    },
    requestId() {
      const value = this.$route.query.requestId;
      return typeof value === "string" && value !== "" ? value : null;
    },
  },
  mounted() {
    window.scrollTo(0, 0);
    const proceed = async () => {
      const user = this.$store.state.user;
      try {
        await businessUtils.checkUserHasBusinesses(user, this.$store);
      } catch (error) {
        if (!isSessionEnded(error)) console.warn("AnalyticsReport role:", error);
      }
      this.ready = true;
    };
    if (this.$store.state.user && this.$store.state.user.accessToken) proceed();
    else onAuthStateChanged(auth, (user) => { if (user && user.emailVerified && !user.isAnonymous) proceed(); });
  },
};
</script>

<style lang="less" scoped>
.analytics-report-page {
  // Top-aligned: the dashboard's `margin: auto` centres a page vertically, which left a band as tall as half the
  // screen above a short tab (the U17b review: about 900px in the tall screenshots, on any tall monitor too).
  margin: 0 auto auto;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
