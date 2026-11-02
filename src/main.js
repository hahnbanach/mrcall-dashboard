import {createApp, defineAsyncComponent} from 'vue'

import App from '@/App.vue'
import PrimeVue from 'primevue/config'
import router from '@/router'

import i18n, { startLocale } from '@/i18n'
import { isLeaving, reloadPage } from '@/utils/pageReload'
import Accordion from "primevue/accordion";
import AccordionTab from "primevue/accordiontab";
import ConfirmationService from "primevue/confirmationservice"
import ToastService from "primevue/toastservice"
import '@/assets/style/flags/flags.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'

//import predefinedTheme from '@primevue/themes/material'
import predefinedTheme from '@primevue/themes/aura'
//import 'primevue/resources/primevue.min.css'
//import 'primevue/resources/themes/saga-blue/theme.css'

//MAZ-UI library
import 'maz-ui/css/main.css'

// global styles

//import CascadeSelect from 'primevue/cascadeselect'
//import Dock from 'primevue/dock';
//import MegaMenu from 'primevue/megamenu'
//import PanelMenu from 'primevue/panelmenu'
//import Steps from 'primevue/steps'
//import TabMenu from 'primevue/tabmenu'
//import Textarea from 'primevue/textarea'
import '@/assets/style/default.less'
import '@/assets/style/insights.less'
import Chart from 'primevue/chart'
import Autocomplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import BlockUI from 'primevue/blockui'
import Calendar from "primevue/calendar";
import Card from 'primevue/card'
import Carousel from 'primevue/carousel'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import ConfirmDialog from 'primevue/confirmdialog'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import Fieldset from 'primevue/fieldset'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Image from 'primevue/image'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import MazPhoneNumberInput from 'maz-ui/components/MazPhoneNumberInput'
import Menu from 'primevue/menu'
import Menubar from 'primevue/menubar'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Paginator from 'primevue/paginator'
import Panel from 'primevue/panel'
import Password from 'primevue/password'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import SelectButton from 'primevue/selectbutton'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast'
import ToggleButton from 'primevue/togglebutton'
import Toolbar from "primevue/toolbar";
import Tooltip from 'primevue/tooltip'
import stickyHead from '@/directives/stickyHead'
import VueGtag from "vue-gtag"
import store from '@/store/index'
import {createMetaManager, plugin as metaPlugin} from 'vue-meta'
import TieredMenu from "primevue/tieredmenu";
import PanelMenu from "primevue/panelmenu";
import JsonEditorLoadError from '@/components/widgets/JsonEditorLoadError.vue'
import {definePreset} from "@primevue/themes";
import { setupAuthListener } from './firebase/authUtils'
import { initGTM, checkDataLayer } from './gtm'
// Import axios config to set up interceptors globally
import './firebase/axiosConfig'

// The starting locale's chunk is asked for first, so that its request overlaps the set-up below (plan
// docs/execution-plans/2026-10-23-dashboard-load.md, M3). If it fails, the page is loaded again once; a second failure
// mounts with whatever messages did load rather than leaving the page empty. The marker is the locale's own, cleared
// only when the locale loads: the router's marker for a page chunk is cleared as soon as a navigation succeeds, which
// here happens before the locale fails, and sharing it reloaded the page in a loop.
const localeReloadMarker = 'locale-reload:' + window.location.pathname + window.location.search
const localeReady = startLocale().then(
    () => sessionStorage.removeItem(localeReloadMarker),
    (error) => {
        // cancelled because the page is already leaving (a page chunk's reload, in WebKit): not a failure
        if (isLeaving()) return new Promise(() => {})
        if (!sessionStorage.getItem(localeReloadMarker)) {
            sessionStorage.setItem(localeReloadMarker, '1')
            reloadPage()
            return new Promise(() => {})
        }
        console.error('The interface language could not be loaded:', error)
    }
)

const MrCallPreset = definePreset(predefinedTheme, {
    semantic: {
        primary: {
            50: '{blue.50}',
            100: '{blue.100}',
            200: '{blue.200}',
            300: '{blue.300}',
            400: '{blue.400}',
            500: '{blue.500}',
            600: '{blue.600}',
            700: '{blue.700}',
            800: '{blue.800}',
            900: '{blue.900}',
            950: '{blue.950}'
        }
    },
    components: {
    }
});

// Initialize GTM
initGTM()

// Check dataLayer after a short delay to ensure initialization
setTimeout(checkDataLayer, 2000)

const app = createApp(App)
    .use(PrimeVue, {
        theme: {
            preset: MrCallPreset,
            options: {
                darkModeSelector: 'none', //'system',
            }
        }
    })
    .use(ConfirmationService)
    .use(ToastService)
    .use(i18n)
    .use(router)
    .use(store)
    .use(VueGtag, {
        config: {
            id: "G-2C4EZMZHVF", // GA4 measurement ID
            debug: true,
            params: {
                anonymize_ip: true
            }
        },
    })
    .use(metaPlugin)
    .use(createMetaManager(false, {
        meta: { tag: 'meta', nameless: true }
    }))
// vue3-google-login used to be installed here. It loaded Google Identity
// Services on every page view of every route, public ones included, and
// registered the OAuth client with Google, while the app used none of it: no
// <GoogleLogin> component, no One Tap (the plugin only prompts when asked to),
// and its callback was undefined, so a credential would have been dropped
// anyway. Sign-in goes through the redirect flow in GoogleSignIn.vue.

// Setup Firebase auth listener
setupAuthListener()

// Load stored UTM parameters (if any) when the app starts
store.dispatch('tracking/loadStoredParams')

//app.component('CascadeSelect', CascadeSelect)
//app.component('Dock', Dock)
//app.component('MegaMenu', MegaMenu)
//app.component('PanelMenu', PanelMenu)
//app.component('Steps', Steps)
//app.component('TabMenu', TabMenu)
//app.component('Textarea', Textarea)
app.component('Accordion', Accordion)
app.component('AccordionTab', AccordionTab)
app.component('Autocomplete', Autocomplete)
app.component('BlockUI', BlockUI)
app.component('Button', Button)
app.component('Calendar', Calendar)
app.component('Card', Card)
app.component('Chart', Chart)
app.component('Carousel', Carousel)
app.component('Column', Column)
app.component('DataTable', DataTable)
app.component('ConfirmDialog', ConfirmDialog)
app.component('Dialog', Dialog)
app.component('Drawer', Drawer)
app.component('Divider', Divider)
app.component('Dropdown', Dropdown)
app.component('Fieldset', Fieldset)
app.component('IconField', IconField)
app.component('Image', Image)
app.component('InputIcon', InputIcon)
app.component('InputNumber', InputNumber)
app.component('ToggleSwitch', ToggleSwitch)
app.component('InputText', InputText)
app.component('MazPhoneNumberInput', MazPhoneNumberInput)
app.component('Menu', Menu)
app.component('Menubar', Menubar)
app.component('Message', Message)
app.component('MultiSelect', MultiSelect)
app.component('Paginator', Paginator)
app.component('Panel', Panel)
app.component('PanelMenu', PanelMenu)
app.component('Password', Password)
app.component('ProgressBar', ProgressBar)
app.component('ProgressSpinner', ProgressSpinner)
app.component('SelectButton', SelectButton)
app.component('TabPanel', TabPanel)
app.component('TabView', TabView)
app.component('Tag', Tag)
app.component('Textarea', Textarea)
app.component('TieredMenu', TieredMenu)
app.component('Toast', Toast)
app.component('ToggleButton', ToggleButton)
app.component('Toolbar', Toolbar)
app.directive('Tooltip', Tooltip)
app.directive('sticky-head', stickyHead)

// The JSON editor (about 0.85 MB with CodeMirror) is fetched by the first page that draws one, not by every page
// (plan docs/execution-plans/2026-10-23-dashboard-load.md, M4). Same name as the plugin registered, so TupleVariable,
// BusinessConfiguration and JsonField keep writing <JsonEditorVue>; the plugin had no global option to keep.
app.component('JsonEditorVue', defineAsyncComponent({
    loader: () => import(/* webpackChunkName: "json-editor" */ 'json-editor-vue'),
    errorComponent: JsonEditorLoadError,
}))

Promise.all([localeReady, router.isReady()]).then(() => app.mount('#app'))
