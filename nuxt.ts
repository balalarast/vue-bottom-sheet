import { defineNuxtModule, addComponent } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'vue-bottom-sheet' },
  setup(_, nuxt) {
    addComponent({
      name: 'BottomSheet',
      filePath: './src/components/BottomSheet.vue',
    })
  },
})
