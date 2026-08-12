<script setup>
import Sign from "@/components/templates/sign/Sign";
import MagicLink from "@/components/templates/sign/MagicLink";
</script>

<template>
  <div>
    <Sign>
      <template #title>
        <div id="title">{{$t('views.sign.magiclink.titleText')}}</div>
      </template>
      <template #content>
        <MagicLink></MagicLink>
      </template>
    </Sign>
  </div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';
</style>