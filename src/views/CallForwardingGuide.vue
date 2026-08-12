<template>
  <div class="center-restrict main-page-content-section">
    <p class="title center">{{ pageTexts.it.forwardYourCallsToMrCallTitle }}</p>
    <br>
    <div v-for="(sentence, index) in pageTexts.it.paragraph1.blocks" :key="index">
      <p v-if="sentence.bold" class="center bold">{{sentence.text}}</p>
      <p v-else class="center">{{sentence.text}}</p>
    </div>
    <br>
    <div class="center">
      <Button class="center" @click="gotoElement('#procedures')" :label="pageTexts.it.goToProceduresButtonText" />
    </div>
    <br>
    <p class="title center">{{ pageTexts.it.paragraph2.title }}</p>
    <br>
    <div v-for="(sentence, index) in pageTexts.it.paragraph2.blocks" :key="index">
      <p v-if="sentence.bold" class="center bold">{{sentence.text}}</p>
      <p v-else class="center">{{sentence.text}}</p>
    </div>
    <br>
    <p class="title center">{{ pageTexts.it.paragraph3.title }}</p>
    <br>
    <div v-for="(block, index) in pageTexts.it.paragraph3.blocks" :key="index">
      <div v-if="block.title">
        <p class="title center">{{ block.title }}</p>
        <br>
      </div>
      <div v-else class="left" style="flex-flow: initial; display: flex; padding: 1em;">
        <img style="width: 8em; max-width: 30% ; height: auto; margin-bottom: auto; padding-right: 2em;" :src="block.image"/>
        <div class="left" style="width: 70%; ">
          <div v-for="(textElement, textidx) in block.texts" :key="textidx" style="display: inline;">
            <p v-if="textElement.bold" class="bold" style="display: inline;">{{textElement.text}}</p>
            <p v-else style="display: inline;">{{textElement.text}}</p>
          </div>
        </div>
      </div>
    </div>
    <br>
    <div id="procedures">
      <p class="title center">{{ pageTexts.it.procedures.title }}</p>
    </div>
    <br>
    <div class="center">
      <div v-for="(block, index) in pageTexts.it.procedures.blocks" :key="index" style="padding-bottom: 2em ; ">
        <div class="cap-element">
          <p class="title-white center">{{ block.title }}</p>
        </div>
        <div v-for="(row, rowidx) in block.middle.rows" :key="rowidx">
          <div class="middle-element">
            <div style="padding: 1em ;">
              <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                  <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                </p>
                <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                  {{textElement.phoneNumberHref}}
                </p>
                <p v-else :style="textElement.style">{{textElement.text}}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-for="(row, rowidx) in block.beforeClosing.rows" :key="rowidx">
          <div class="before-closing-element">
            <div style="padding: 1em ;">
              <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                  <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                </p>
                <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                  {{textElement.phoneNumberHref}}
                </p>
                <p v-else :style="textElement.style">{{textElement.text}}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-for="(row, rowidx) in block.closing.rows" :key="rowidx">
          <div class="closing-element">
            <div style="flex-flow: initial; display: flex; padding: 1em;">
              <img style="width: 10%; max-width: 10% ; height: auto;
                  margin-bottom: auto;
                  margin-left: auto;
                  margin-right: auto;" :src="block.closing.image"/>
              <div style="width: 90%; padding-left: 1em;" class="left">
                <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                  <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                    <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                  </p>
                  <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                    {{textElement.phoneNumberHref}}
                  </p>
                  <p v-else :style="textElement.style">{{textElement.text}}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import router from "@/router";
import axios from "axios";
import {useStore} from "vuex";
import {computed} from 'vue';
//import {onAuthStateChanged} from "firebase/auth";
//import {auth} from "@/firebase/config";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";

import windtreImg from "@/assets/images/mrcall/callforward/operators/windtre.svg";
import fastwebImg from "@/assets/images/mrcall/callforward/operators/fastweb.svg";
import fouroperatorImg from "@/assets/images/mrcall/callforward/operators/fouroperators.png";
import voipImg from "@/assets/images/mrcall/callforward/voip.svg";
import redRoundedButtomImg from "@/assets/images/mrcall/callforward/redbutton.svg"

export default {
  components: {PreFooterRequireAssistance},
  data: function () {
    const store = useStore()

    let yourPhoneNumber = "[Your phone number]"

    const number = this.$route.query?.number;
    if(number) {
      yourPhoneNumber = number;
    }

    const pageTexts = {
      it: {
        forwardYourCallsToMrCallTitle: "Inoltrare le tue chiamate a MrCall",
        paragraph1: {
          title: "Perché inoltrare le chiamate?",
          blocks: [
            {
              bold: true,
              text: "MrCall è come operatore umano che ha un proprio numero di telefono."
            },
            {
              bold: false,
              text: "Per far sì che riceva le tue chiamate quando tu non rispondi, devi comunicare " +
                  "al tuo operatore telefonico che in caso di mancata risposta la chiamata deve " +
                  "essere inoltrata a MrCall, invece che alla segreteria telefonica."
            }
          ]
        },
        goToProceduresButtonText: "Vai alle procedure",
        paragraph2: {
          title: "Che operatore hai?",
          blocks: [
            {
              bold: true,
              text: "Sapere che operatore telefonico hai è un'informazione importante perché questo " +
                  "processo dipende proprio dal tuo operatore."
            },
            {
              bold: false,
              text: "Ogni operatore gestisce il processo di chiamata in modo diverso e non univoco, " +
                  "perché molto dipende dal tipo di contratto che hai in essere."
            },
            {
              bold: false,
              text: "Per questo motivo ti indichiamo di seguito le procedure che abbiamo testato " +
                  "e con le quali i nostri clienti hanno impostato l'inoltro di chiamata."
            }
          ]
        },
        paragraph3: {
          title: "Alcune note sugli operatori",
          blocks: [
            {
              image: windtreImg,
              texts: [
                {
                  bold: true,
                  text: "WindTre"
                },
                {
                  bold: false,
                  text: ": il mobile dà raramente problemi, se hai un numero fisso Wind con una mono-linea, " +
                      "non puoi usare il nostro servizio perché Wind non offre il servizio di inoltro."
                }
              ]
            },
            {
              image: fastwebImg,
              texts: [
                {
                  bold: true,
                  text: "Fastweb"
                },
                {
                  bold: false,
                  text: ": se l'inoltro non funziona, il servizio potrebbe essere a pagamento: devi andare nell'app "
                },
                {
                  bold: true,
                  text: "myFastweb"
                },
                {
                  bold: false,
                  text: " e fare un accredito indipendentemente dal contratto in essere " +
                      "(puoi cominciare con 2 Euro) - Lo fanno anche altri operatori, controlla come si " +
                      "comporta il tuo. La procedura 1 che vedi sotto, funziona nella maggioranza dei casi, " +
                      "ma anche con questo operatore possono esserci eccezioni."
                }
              ]
            },
            {
              image: fouroperatorImg,
              texts: [
                {
                  bold: true,
                  text: "Vodafone, Iliad, HO, Poste"
                },
                {
                  bold: false,
                  text: ": normalmente non danno nessun problema. Anche qui, potrebbero accreditare una " +
                      "piccola cifra (1-2 centesimi) per ogni inoltro di chiamata."
                }
              ]
            },
            {
              title: "Hai un altro operatore? Contattaci!"
            },
            {
              image: voipImg,
              texts: [
                {
                  bold: true,
                  text: "Centralino VoIP"
                },
                {
                  bold: false,
                  text: ": in questo caso contattaci! Cercheremo di integrarci col tuo centralino. " +
                      "Con il VoIP la qualità delle telefonate sarà migliore."
                }
              ]
            }
          ]
        },
        voipSection: {
          image: voipImg,
          texts: [
            {
              bold: true,
              text: "Vodafone, Iliad, HO, Poste"
            },
            {
              bold: false,
              text: ": normalmente non danno nessun problema. Anche qui, potrebbero accreditare una " +
                  "piccola cifra (1-2 centesimi) per ogni inoltro di chiamata."
            }
          ]
        },
        procedures: {
          title: "Procedure",
          blocks: [
            {
              title: "Procedura 1",
              middle: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Componi sulla tastiera del tuo telefono il seguente numero "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**004*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " e premi il tasto di chiamata. Se stai chiamando da cellulare, il tuo operatore farà apparire " +
                          "sul tuo telefono una schermata grigia dicendoti se l'operazione è andata o meno a buon fine. " +
                          "Se chiami da un fisso potresti sentire un messaggio vocale. D'ora in poi parleremo sempre di " +
                          "una schermata grigia che apparirà sul display del tuo smartphone: " +
                          "se hai una linea fissa, sai che non sarà il tuo caso."
                    }
                  ]
                ]
              },
              beforeClosing: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Vuoi settare il "
                    },
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "il numero di secondi per far partire l'inoltro?"
                    },
                    {
                      style: "", // do not translate
                      text: "Prova questa opzione: " +
                          "**61*" + yourPhoneNumber + "**NUMERO_SECONDI#."
                    },
                    {
                      style: "", // do not translate
                      text: "Per esempio, per far partire l'inoltro dopo 15 secondi: "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**61*" + yourPhoneNumber + "**15#"
                    },
                    {
                      style: "", // do not translate
                      text: "Adesso chiama il tuo numero di telefono (il numero dal quale fai l'inoltro) " +
                          "per verificare se l'inoltro di chiamata funziona."
                    }
                  ]
                ]
              },
              closing: {
                image: redRoundedButtomImg,
                rows: [
                  [
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "Disattivazione"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: ": componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##004#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata."
                    }
                  ]
                ]
              }
            },
            {
              title: "Procedura 2",
              middle: {
                rows: [
                  [
                    {
                      style: "", // do not translate
                      text: "Se la Procedura 1 non funziona, dobbiamo fare un altro tentativo."
                    },
                    {
                      style: "", // do not translate
                      text: "Questa procedura, prevede singoli settaggi per la deviazione nei casi di " +
                          "mancata risposta, occupato e irraggiungibile."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su mancata risposta"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#22#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia che ti dirà che hai disattivato una eventuale " +
                          "precedente deviazione di chiamata per mancata risposta. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*22*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " e chiama: apparirà la schermata grigia, stai inviando un input all'operatore!"
                    },
                    {
                      style: "",
                      text: "Non chiamare ancora il tuo numero, dobbiamo prima impostare tutti e 3 i settaggi."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su occupato"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#23#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*23*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia perché il tuo " +
                          "telefono sta comunicando con il tuo operatore"
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su irrangiugibile"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#24#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia."
                    },
                    {
                      style: "display: inline;",
                      text: "Digita"
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*24*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia."
                    }
                  ],
                  [
                    {
                      style: "display: inline;",
                      text: "Con questa procedura "
                    },
                    {
                      style: "display: inline; font-weight: bold;",
                      text: "non puoi cambiare il numero di secondi dell'inoltro"
                    },
                    {
                      style: "",
                      text: "Può essere di aiuto richiedere supporto al tuo operatore telefonico."
                    }
                  ]
                ]
              },
              beforeClosing: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Vuoi settare il "
                    },
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "il numero di secondi per far partire l'inoltro?"
                    },
                    {
                      style: "", // do not translate
                      text: "Prova questa opzione: " +
                          "**61*" + yourPhoneNumber + "**NUMERO_SECONDI#."
                    },
                    {
                      style: "", // do not translate
                      text: "Per esempio, per far partire l'inoltro dopo 15 secondi: "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**61*" + yourPhoneNumber + "**15#"
                    },
                    {
                      style: "", // do not translate
                      text: "Adesso chiama il tuo numero di telefono (il numero dal quale fai l'inoltro) " +
                          "per verificare se l'inoltro di chiamata funziona."
                    }
                  ]
                ]
              },
              closing: {
                image: redRoundedButtomImg,
                rows: [
                  [
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "Disattivazione"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: ": componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##004#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata."
                    }
                  ]
                ]
              }
            },
            {
              title: "Procedura 3",
              middle: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Anche la Procedura 3 prevede settaggi differenti per la deviazione nei casi di " +
                          "mancata risposta, occupato e irraggiungibile."
                    },
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su mancata risposta"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##61#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia che ti dirà che hai disattivato una eventuale " +
                          "precedente deviazione di chiamata per mancata risposta. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**61*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " e chiama: apparirà la schermata grigia " +
                          "che dice se l'operazione è andata o meno a buon fine."
                    },
                    {
                      style: "",
                      text: "Non chiamare ancora il tuo numero, dobbiamo prima impostare tutti e 3 i settaggi."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su occupato"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##67#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**67*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su irrangiugibile"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##62#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**62*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia."
                    }
                  ]
                ]
              },
              beforeClosing: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Vuoi settare il "
                    },
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "il numero di secondi per far partire l'inoltro?"
                    },
                    {
                      style: "", // do not translate
                      text: "Prova questa opzione: " +
                          "**61*" + yourPhoneNumber + "**NUMERO_SECONDI#."
                    },
                    {
                      style: "", // do not translate
                      text: "Per esempio, per far partire l'inoltro dopo 15 secondi: "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "**61*" + yourPhoneNumber + "**15#"
                    },
                    {
                      style: "", // do not translate
                      text: "Adesso chiama il tuo numero di telefono (il numero dal quale fai l'inoltro) " +
                          "per verificare se l'inoltro di chiamata funziona."
                    }
                  ]
                ]
              },
              closing: {
                image: redRoundedButtomImg,
                rows: [
                  [
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "Disattivazione"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: ": componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##061#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata, "
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "poi componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##067#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata, "
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "poi componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "##062#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata."
                    }
                  ]
                ]
              }
            },
            {
              title: "Procedura 4",
              middle: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Nel caso in cui anche la Procedura 3 non sia andata a buon fine, proviamo  La Procedura 4 " +
                          "che è uguale alla Procedura 3 ma con un singolo cancelletto (#) o " +
                          "singolo asterisco (*) iniziale"
                    },
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su mancata risposta"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#61#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia che ti dirà che hai disattivato una eventuale " +
                          "precedente deviazione di chiamata per mancata risposta. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*61*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " e chiama: apparirà la schermata grigia " +
                          "che dice se l'operazione è andata o meno a buon fine."
                    },
                    {
                      style: "",
                      text: "Non chiamare ancora il tuo numero, dobbiamo prima impostare tutti e 3 i settaggi."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su occupato"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#67#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*67*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia."
                    }
                  ],
                  [
                    {
                      style: "font-weight: bold; padding-bottom: 0.3em;", // do not translate
                      text: "Deviazione su irrangiugibile"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "Chiama "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#62#"
                    },
                    {
                      style: "display: inline;",
                      text: " e comparirà la schermata grigia. "
                    },
                    {
                      style: "display: inline;",
                      text: "Digita "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*62*" + yourPhoneNumber + "#"
                    },
                    {
                      style: "display: inline;",
                      text: " anche in questo caso apparirà una schermata grigia."
                    }
                  ]
                ]
              },
              beforeClosing: {
                rows: [
                  [
                    {
                      style: "display: inline;", // do not translate
                      text: "Vuoi settare il "
                    },
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "il numero di secondi per far partire l'inoltro?"
                    },
                    {
                      style: "", // do not translate
                      text: "Prova questa opzione: " +
                          "*61*" + yourPhoneNumber + "**NUMERO_SECONDI#."
                    },
                    {
                      style: "", // do not translate
                      text: "Per esempio, per far partire l'inoltro dopo 15 secondi: "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "*61*" + yourPhoneNumber + "**15#"
                    },
                    {
                      style: "", // do not translate
                      text: "Adesso chiama il tuo numero di telefono (il numero dal quale fai l'inoltro) " +
                          "per verificare se l'inoltro di chiamata funziona."
                    }
                  ]
                ]
              },
              closing: {
                image: redRoundedButtomImg,
                rows: [
                  [
                    {
                      style: "display: inline; font-weight: bold;", // do not translate
                      text: "Disattivazione"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: ": componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#061#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata, "
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "poi componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#067#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata, "
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: "poi componi "
                    },
                    {
                      style: "display: inline;",
                      phoneNumberHref: "#062#"
                    },
                    {
                      style: "display: inline;", // do not translate
                      text: " e premi il tasto di chiamata."
                    }
                  ]
                ]
              }
            }
          ]
        }
      }
    }

    const isWebView = computed(() => store.state.isWebview)
    const osName = computed(() => store.state.webviewOsName)
    const enabledPhoneLinks = computed(() => ! isWebView || (isWebView && osName === "ios"))

    return {
      store,
      isWebView,
      enabledPhoneLinks,
      osName,
      user: computed(() => store.state.user),
      router,
      yourPhoneNumber,
      name: "Call forwarding page",
      pageTexts
    }
  },
  computed: {
  },
  methods: {
    gotoElement: (id) => {
      var element = document.querySelector(id)
      var top = element.offsetTop;
      window.scrollTo(0, top);
    }
  },
  mounted() {
    window.scrollTo(0, 0);
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/default';

.cap-element {
  padding: 0.5em;
  background: @mrcall_blue ;
  border-top-left-radius: 25px ;
  border-top-right-radius: 25px;
  width: 100%;
}

.middle-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_bluette ;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

.before-closing-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_light_grey_2;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

.closing-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_salmon ;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.center-restrict {
  max-width: 800px;
  margin-bottom: auto;
  margin-left: auto;
  margin-right: auto;
  margin-top: 6em
}
</style>