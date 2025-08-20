<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import BottomSheet from '../src/components/BottomSheet.vue'

// Refs
const bottomSheetRef = ref<InstanceType<typeof BottomSheet>>()
const itemRefs = ref<HTMLElement[]>([])
const currentSnapPointIndex = ref(0)
const activeItemIndex = ref<number | null>(null)
const isLightTheme = ref(true)
const canSwipeClose = ref(true)
const showOverlay = ref(true)
const autoSnap = ref()
const expandOnDrag = ref(false)
const fastCloseEnabled = ref(false)
const disableEdgeBounce = ref(false)

// Actions
const openSheet = async () => {
  await bottomSheetRef.value?.open()
  scrollToActiveItem()
}
const closeSheet = () => bottomSheetRef.value?.close()

const toggleSheet = () => bottomSheetRef.value?.isOpened && canSwipeClose.value ? closeSheet() : openSheet()

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
      <button @click="toggleSheet">Open<span v-if="canSwipeClose">/Close</span></button>
      &nbsp;
      <button @click="toggleTheme">Dark/Light</button>
      <div class="playground-settings">
        <div class="setting-item">
          <label>
            <input type="checkbox" v-model="canSwipeClose" /> Enable Swipe to Close
          </label>
          <div class="description">
            When enabled, the panel can be closed by swiping it downward.
          </div>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="showOverlay" />
            Enable Overlay
          </label>
          <p class="description">Toggles a semi-transparent overlay behind the panel.</p>
        </div>

        <div>
          <label>
            <input type="checkbox" v-model="expandOnDrag" />
            Expand on Content Drag
          </label>
          <p class="description">
            When enabled, dragging the content panel will move the panel itself.
            <small>Works only in Responsive Design Mode with touch simulation enabled.</small>
          </p>
        </div>

        <div>
          <label>
            <input type="checkbox" v-model="autoSnap" />
            Snap to First Point on Item Select
          </label>
          <p class="description">
            Automatically snaps the panel to the first snap point when an item inside is selected.
          </p>
        </div>

        <div>
          <label>
            <input type="checkbox" v-model="fastCloseEnabled" />
            Enable Fast Close
          </label>
          <p class="description">
            Allows the panel to close quickly if dragged fast enough. Works with velocity and distance thresholds.
          </p>
        </div>

        <div>
          <label>
            <input type="checkbox" v-model="disableEdgeBounce" />
            Disable Edge Bounce
          </label>
          <p class="description">
            When enabled, the panel won't overshoot beyond the min or max snap points when dragged, providing a firm boundary effect.
          </p>
        </div>
      </div>


      <BottomSheet
        ref="bottomSheetRef"
        :can-swipe-close="canSwipeClose"
        :initial-snap-point="currentSnapPointIndex"
        :overlay="showOverlay"
        :expand-on-content-drag="expandOnDrag"
        :fast-close="fastCloseEnabled"
        :disable-edge-bounce="disableEdgeBounce"
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
          v-for="i in 50"
          :key="i"
          class="content-item"
          :class="{ active: activeItemIndex === i }"
          @click="selectItem(i)"
          :ref="el => (itemRefs[i] = el as HTMLElement)"
        >
          <div>Item {{ i }}</div>
        </div>
        <template #footer>
          <button @click="closeSheet" v-if="canSwipeClose">Close</button>
          <button @click="canSwipeClose = true" v-else>Enable Swipe to Close</button>
          &nbsp;
          <button @click="toggleTheme">Dark/Light</button>
        </template>
      </BottomSheet>
    </ClientOnly>
  </div>
</template>

<style lang="pcss">
.playground-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}
.playground-settings .setting-item {
  display: flex;
  flex-direction: column;
}
.playground-settings .description {
  margin-left: 24px; /* کمی فاصله از چک‌باکس */
  font-size: 0.875rem;
  color: rgb(100,116,139);
  margin: 0
}
.ba-bs-header--border,
.ba-bs-footer {
  border: none !important;
}
.ba-bs-scroll {
  border-radius: var(--ba-radius) var(--ba-radius) var(--ba-radius) var(--ba-radius);
  background-color: rgb(148,163,184, .2);
  margin: 0 20px;
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
