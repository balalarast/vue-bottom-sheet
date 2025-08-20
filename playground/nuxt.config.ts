import { defineNuxtConfig } from 'nuxt/config'
import VueBottomSheet from '../nuxt'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-06-25',
  devtools: { enabled: false },
  modules: [
    VueBottomSheet
  ],

  nitro: {
    output: {
      publicDir: '../dist'
    }
  }
})
