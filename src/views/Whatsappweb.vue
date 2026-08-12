<template>
    <div class="main-page-content-section">
        <Whatsappweb/>
    </div>
</template>

<script>
import Whatsappweb from "@/components/Whatsappweb";

export default {
    components: {Whatsappweb},
    setup() {
    },
    data() {
        return {
        }
    },
    created() {
    },
    mounted() {
        window.scrollTo(0, 0);
    },
    methods: {
    }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';
</style>
