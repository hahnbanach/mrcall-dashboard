# UTM Tracking Implementation Guide

This guide explains how to use the UTM tracking system that has been implemented in your application.

## Overview

The tracking system automatically captures UTM parameters (and other tracking data) from the URL when visitors arrive at your site. These parameters are stored and can be sent to your backend with API requests.

## How It Works

### 1. Automatic Capture

When a user visits your site with UTM parameters in the URL, they are automatically captured:

Example URL:
```
https://yoursite.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale
```

The system will capture:
- `utm_source`: google
- `utm_medium`: cpc
- `utm_campaign`: spring_sale
- `landing_url`: The full URL where the user landed
- `referrer`: Where the user came from
- `captured_at`: Timestamp when captured

### 2. Persistent Storage

The parameters are stored in:
- **Vuex Store**: For use throughout the app session
- **localStorage**: For persistence across page reloads

### 3. Available UTM Parameters

The system automatically tracks:
- `utm_source` - Identifies which site sent the traffic
- `utm_medium` - Identifies what type of link (e.g., email, cpc, social)
- `utm_campaign` - Identifies a specific campaign
- `utm_term` - Identifies search terms
- `utm_content` - Identifies what specifically was clicked
- `ref` - Alternative referral parameter
- Custom parameters you define in `src/utils/UtmTracking.js`

## Using Tracking Data in Your Application

### 1. Access UTM Parameters in Components

```vue
<template>
  <div>
    <p v-if="utmSource">You came from: {{ utmSource }}</p>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'

export default {
  setup() {
    const store = useStore()

    // Get specific UTM parameter
    const utmSource = computed(() => store.getters['tracking/utmSource'])

    // Get all UTM parameters
    const allParams = computed(() => store.getters['tracking/utmParams'])

    // Check if we have any tracking data
    const hasTracking = computed(() => store.getters['tracking/hasUtmParams'])

    return {
      utmSource,
      allParams,
      hasTracking
    }
  }
}
</script>
```

### 2. Send UTM Parameters to Backend

#### Example 1: Using the Utility Function

```javascript
import axios from 'axios'
import { attachUtmToPayload } from '@/utils/UtmTracking'

// Your API call
async function createBusiness(businessData) {
  // Attach UTM parameters to your payload
  const payload = attachUtmToPayload(businessData)

  // payload now contains:
  // {
  //   ...businessData,
  //   tracking: {
  //     utm_source: 'google',
  //     utm_medium: 'cpc',
  //     // ... other UTM params
  //   }
  // }

  const response = await axios.post(
    process.env.VUE_APP_STARCHAT_URL + '/api/business',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  )

  return response.data
}
```

#### Example 2: Using Vuex Getter

```javascript
import axios from 'axios'
import store from '@/store'

async function createBusiness(businessData) {
  // Get tracking data from store
  const trackingData = store.getters['tracking/trackingDataForApi']

  const payload = {
    ...businessData,
    tracking: trackingData
  }

  const response = await axios.post(
    process.env.VUE_APP_STARCHAT_URL + '/api/business',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  )

  return response.data
}
```

#### Example 3: Send as HTTP Headers

```javascript
import axios from 'axios'
import store from '@/store'

async function createBusiness(businessData) {
  const utmParams = store.getters['tracking/utmParams']

  const response = await axios.post(
    process.env.VUE_APP_STARCHAT_URL + '/api/business',
    businessData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-UTM-Source': utmParams.utm_source || '',
        'X-UTM-Medium': utmParams.utm_medium || '',
        'X-UTM-Campaign': utmParams.utm_campaign || '',
        'X-Referrer': utmParams.referrer || ''
      }
    }
  )

  return response.data
}
```

#### Example 4: Send as Query Parameters

```javascript
import axios from 'axios'
import store from '@/store'

async function createBusiness(businessData) {
  const trackingData = store.getters['tracking/trackingDataForApi']

  // Build query string from tracking data
  const queryParams = new URLSearchParams(trackingData).toString()

  const response = await axios.post(
    `${process.env.VUE_APP_STARCHAT_URL}/api/business?${queryParams}`,
    businessData,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  )

  return response.data
}
```

### 3. Real-World Example: Adding to Business Creation

Here's how you might modify the existing `Business.js` utility:

```javascript
// In src/utils/Business.js
import axios from "axios"
import store from '@/store'

export default {
  // ... existing methods ...

  createBusinessNew: function(token, business) {
    // Get tracking data
    const trackingData = store.getters['tracking/trackingDataForApi']

    // Add tracking to business object
    const businessWithTracking = {
      ...business,
      acquisition: trackingData
    }

    return axios.post(
      process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business",
      businessWithTracking,
      {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        }
      }
    )
    .then((response) => {
      return response
    })
    .catch((error) => {
      console.error("Error creating business:", error)
      throw error
    })
  }
}
```

## Backend Implementation

On your backend, you can receive this data in various ways depending on how you send it:

### If sent in request body:

```javascript
// Node.js/Express example
app.post('/api/business', (req, res) => {
  const businessData = req.body
  const trackingData = businessData.tracking

  // Save to database
  const business = {
    ...businessData,
    utm_source: trackingData?.utm_source,
    utm_medium: trackingData?.utm_medium,
    utm_campaign: trackingData?.utm_campaign,
    landing_url: trackingData?.landing_url,
    referrer: trackingData?.referrer,
    acquired_at: trackingData?.captured_at
  }

  // Store in your database
  // ...
})
```

### Database Schema Example:

```sql
ALTER TABLE businesses
ADD COLUMN utm_source VARCHAR(255),
ADD COLUMN utm_medium VARCHAR(255),
ADD COLUMN utm_campaign VARCHAR(255),
ADD COLUMN utm_term VARCHAR(255),
ADD COLUMN utm_content VARCHAR(255),
ADD COLUMN landing_url TEXT,
ADD COLUMN referrer TEXT,
ADD COLUMN acquired_at TIMESTAMP;
```

## Advanced Usage

### Manually Set UTM Parameters

```javascript
import { useStore } from 'vuex'

const store = useStore()

// Manually set tracking parameters (useful for testing)
store.dispatch('tracking/setUtmParams', {
  utm_source: 'email',
  utm_medium: 'newsletter',
  utm_campaign: 'weekly_digest'
})
```

### Clear/Reset Tracking Data

#### Option 1: Manual Clear from Any Component

```javascript
import { useStore } from 'vuex'

const store = useStore()

// Clear all tracking data manually
store.dispatch('tracking/clearTrackingParams')
```

#### Option 2: Automatic Clear on Logout (Already Configured)

The tracking data is automatically cleared when a user logs out. This is already set up in `src/store/index.js:92`

#### Option 3: Clear from Utility Function

```javascript
import { clearUtmParams } from '@/utils/UtmTracking'

// Clear from localStorage directly
clearUtmParams()

// Also clear from Vuex store
store.dispatch('tracking/clearTrackingParams')
```

#### Option 4: Add a "Reset Tracking" Button (Example)

```vue
<template>
  <Button
    label="Reset Tracking Data"
    @click="resetTracking"
    class="p-button-text"
  />
</template>

<script>
import { useStore } from 'vuex'

export default {
  setup() {
    const store = useStore()

    const resetTracking = () => {
      store.dispatch('tracking/clearTrackingParams')
      console.log('Tracking data cleared')
    }

    return {
      resetTracking
    }
  }
}
</script>
```

### Check if User Has Tracking Data

```javascript
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

const hasTrackingData = computed(() =>
  store.getters['tracking/hasUtmParams']
)

if (hasTrackingData.value) {
  // Show special offer for campaign visitors
}
```

## Testing

To test the tracking system:

1. Visit your site with UTM parameters:
   ```
   http://localhost:8080/?utm_source=test&utm_medium=email&utm_campaign=welcome
   ```

2. Open browser console and check:
   ```javascript
   // Check localStorage
   localStorage.getItem('utm_params')

   // Check Vuex store (in Vue DevTools)
   // Navigate to Vuex tab > tracking module
   ```

3. The console should log "UTM parameters captured: {...}" when parameters are detected

## Custom Parameters

To track additional custom parameters, edit `src/utils/UtmTracking.js`:

```javascript
// Add your custom parameters to the customParams array
const customParams = ['source', 'partner', 'promo', 'affiliate', 'your_custom_param']
```

## Best Practices

1. **Always check if tracking data exists** before using it
2. **Don't overwrite** - The system only captures on first visit to preserve attribution
3. **Send with important events** - Include tracking data when:
   - User signs up
   - User creates a business
   - User makes a purchase
   - User completes onboarding
4. **Privacy compliance** - Ensure your privacy policy covers tracking parameters
5. **Backend validation** - Always validate and sanitize tracking data on the backend

## Troubleshooting

### UTM parameters not being captured

- Check browser console for errors
- Verify the URL has query parameters
- Check Vue DevTools > Vuex > tracking module

### Parameters not persisting

- Check if localStorage is enabled in the browser
- Verify no browser extensions are blocking storage

### Parameters not sent to backend

- Verify you're using one of the methods above
- Check network tab in DevTools to see request payload
- Ensure backend is configured to receive the data

## Files Reference

- **Utility Module**: `src/utils/UtmTracking.js`
- **Vuex Module**: `src/store/modules/tracking.js`
- **Router Integration**: `src/router/index.js` (lines 361-375)
- **Initialization**: `src/main.js` (line 140)
