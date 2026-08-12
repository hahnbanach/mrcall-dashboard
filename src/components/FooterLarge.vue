<template>
  <div id="footer-large-container">
    <div class="footer-element" style="width: 25%">
      <img style="padding: 10% ; width: 65%" src="@/assets/images/mrcall/logo_footer_mrcall.svg"/>
    </div>
    <div class="footer-element" style="width: 25%">
<!--      <p>-->
<!--        <a :href="pageTexts.it.privacyPolicy.link" download>{{pageTexts.it.privacyPolicy.label}}</a>-->
<!--        <a :href="pageTexts.it.termsAndConditions.link" download>{{pageTexts.it.termsAndConditions.label}}</a>-->
<!--      </p>-->
      <!--
      <p>
        <a href="#" @click="$router.push(pageTexts.it.privacyPolicy.link)">{{pageTexts.it.privacyPolicy.label}}</a>
      </p>
      <p>
        <a href="#" @click="$router.push(pageTexts.it.termsAndConditions.link)">{{pageTexts.it.termsAndConditions.label}}</a>
      </p>
      -->
    </div>
    <div class="footer-element" style="width: 50% ; min-width: fit-content ;">
      <p class="title">
        Hahn Banach Srl
      </p>
      <br>
      <p>
        Milano, Italia
      </p>
      <p>
        <i class="pi pi-phone"> <a href="tel:+390221102420">(+39) 0221102420</a></i>
      </p>
      <p>
        <i class="pi pi-envelope"> <a href="mailto:info@mrcall.ai">info@mrcall.ai</a></i>
      </p>
      <p>
        P. IVA IT 11619040964
      </p>
    </div>
  </div>
</template>

<script>
export default {
  data: () => {
    const pageTexts = {
      it: {
        // privacyPolicy: {
        //   link: "https://www.iubenda.com/privacy-policy/13724557", //"/privacypolicy",
        //   label: "Privacy policy, "
        // },
        // termsAndConditions: {
        //   link: "https://www.iubenda.com/termini-e-condizioni/13724557", //"/termsandconditions",
        //   label: "termini d'uso"
        // }
      }
    }

    return {
      pageTexts
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

#footer-large-container {
  display: flex;
  width: 100%;
  background: @mrcall_black;
  flex-flow: row wrap;

  .footer-element {
    align-self: center;
    flex: 1;
    padding: 0.5em ;
  }

  a {
    font-family: Montserrat, serif;
    font-size: 1em;
    font-weight: normal;
    text-decoration-line: unset;
    color: @mrcall_white;
  }

  p, i {
    font-size: 1em;
    font-weight: normal;
    color: @mrcall_white;
  }

  p.title {
    font-weight: bold;
  }
}
</style>
