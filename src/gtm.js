// Initialize dataLayer array
window.dataLayer = window.dataLayer || []

// GTM initialization code
export function initGTM() {
  // Prevent multiple initialization
  if (window.google_tag_manager?.['GTM-MW4TX4N']) {
    console.debug('GTM already initialized')
    return
  }

  // Add GTM noscript iframe
  const noscript = document.createElement('noscript')
  const iframe = document.createElement('iframe')
  iframe.src = "https://www.googletagmanager.com/ns.html?id=GTM-MW4TX4N"
  iframe.height = "0"
  iframe.width = "0"
  iframe.style.display = "none"
  iframe.style.visibility = "hidden"
  noscript.appendChild(iframe)
  document.body.appendChild(noscript)

  // Add GTM script
  const script = document.createElement('script')
  script.async = true
  script.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MW4TX4N');
  `
  document.head.appendChild(script)
}

// Helper function to check if dataLayer is working
export function checkDataLayer() {
  if (window.dataLayer) {
    console.debug('DataLayer is initialized:', window.dataLayer)
    window.dataLayer.push({
      event: 'test_event',
      test_data: 'DataLayer Test'
    })
    console.debug('Test event pushed to DataLayer')
  } else {
    console.error('DataLayer not found')
  }
} 