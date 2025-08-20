<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import BottomSheet from '../src/components/BottomSheet.vue'

// Refs
const bottomSheetRef = ref<InstanceType<typeof BottomSheet>>()
const currentSnapPointIndex = ref(0)
const autoSnap = ref()
const activeItemIndex = ref<number | null>(null)
const isLightTheme = ref(true)
const itemRefs = ref<HTMLElement[]>([])

// Actions
const openSheet = async () => {
  await bottomSheetRef.value?.open()
  scrollToActiveItem()
}
const closeSheet = () => bottomSheetRef.value?.close()

const toggleSheet = () => bottomSheetRef.value?.isOpened ? closeSheet() : openSheet()

const toggleTheme = () => {
  isLightTheme.value = !isLightTheme.value
}

const snapToPoint = (snapPoint: number) => {
  bottomSheetRef.value?.snapToPoint(snapPoint)
}

const handleDragEnd = (finalIndex: number) => {
  currentSnapPointIndex.value = finalIndex
}

const selectItem = (index: number) => {
  activeItemIndex.value = index
  if(autoSnap.value) {
    snapToPoint(0)
    setTimeout(scrollToActiveItem, 100)
  } else {
    scrollToActiveItem()
  }

}

const scrollToActiveItem = () => {
  const el = activeItemIndex.value !== null ? itemRefs.value[activeItemIndex.value] : null
  el?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  document.body.classList.add('overflow-hidden')
})

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
})
</script>

<template>
  <div>
    <ClientOnly>
      <button @click="toggleSheet">Open/Close</button>
      &nbsp;
      <button @click="toggleTheme">Dark/Light</button>
      &nbsp;
      <label>
        <input type="checkbox" v-model="autoSnap" /> Snap to first point on item select
      </label>

      <BottomSheet
        ref="bottomSheetRef"
        :initial-snap-point="currentSnapPointIndex"
        :hide-scrollbar="true"
        :snap-points="['50%', '90%']"
        :dark-mode="!isLightTheme"
        @vue:mounted="openSheet"
        @drag-end="handleDragEnd"
      >
        <template #header>
          <div>Bottom Sheet Demo</div>
        </template>

        <!-- Content -->
        <div
          v-for="i in 20"
          :key="i"
          class="content-item"
          :class="{ active: activeItemIndex === i }"
          @click="selectItem(i)"
          :ref="el => (itemRefs[i] = el as HTMLElement)"
        >
          <div>Item {{ i }}</div>
        </div>
      </BottomSheet>
    </ClientOnly>
  </div>
</template>

<style lang="pcss">
.ba-bs-header--border {
  border: none !important;
}
.ba-bs-scroll {
  border-radius: var(--ba-radius) var(--ba-radius) 0 0;
  background-color: rgb(148,163,184, .2);
}
[data-theme="dark"] {
  color: #fff
}
[data-theme="dark"] .ba-bs-scroll {
  background-color: rgb(51,65,85);
}
.ba-bs-scroll .ba-bs-content {
  padding: 0;
}
.content-item {
  border-bottom: 1px solid #fff;
  padding: 10px 17px;
  cursor: pointer;
}
.content-item.active {
  color: #ffffff;
  position: relative;
}

.content-item.active::before {
  content: '';
  position: absolute;
  top: 0px;
  left: -50%;
  height: 100%;
  width: 100%;
  background-color: rgb(2,132,199);
  transform: translate(50%, 0) rotate(0) skewX(0) skewY(0) scaleX(1) scaleY(1);
}
.content-item.active div {
  position: relative;
}

[data-theme="dark"] .content-item {
  border-color: #475569;
}
</style>
