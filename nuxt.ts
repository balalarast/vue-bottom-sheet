import { defineNuxtModule, addComponent, createResolver } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'vue-bottom-sheet' },
  setup(_, nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponent({
      name: 'BottomSheet',
      filePath: resolver.resolve('./src/components/BottomSheet.vue'),
    })
  },
})
