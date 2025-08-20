<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import BottomSheet from '../src/components/BottomSheet.vue'

const bottomSheet = ref<InstanceType<typeof BottomSheet>>()
const lastSnapPointIndex = ref(0)
const itemIndex = ref()
const isLight = ref(true)
const refItems = ref<any[]>([])

const openSheet = async () => {
  await bottomSheet.value?.open()
  focusItem()
}
const closeSheet = () => {
  bottomSheet.value?.close()
}
const toggleSheet = () => {
  if(bottomSheet.value?.isOpened) {
    closeSheet()
  } else {
    openSheet()
  }
}

const toggleMode = () => {
    isLight.value = !isLight.value
}

const snapToPoint = (snapPoint: number) => {
  bottomSheet.value?.snapToPoint(snapPoint)
}

function handleDragEnd(finalIndex: number) {
  lastSnapPointIndex.value = finalIndex
}

function selectItem(index: number) {
  itemIndex.value = index
  focusItem()
  snapToPoint(0)
}

function focusItem() {
  const el = refItems.value[itemIndex.value] as HTMLElement
  if (el) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
}

onMounted(async () => {
  await nextTick()
  document.body.classList.add('overflow-hidden')
})

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
  bottomSheet.value?.close()
})
</script>

<template>
  <div>
    <ClientOnly>
      <button
        @click="toggleSheet"
      >
        Open/Close
      </button>
      &nbsp;
      <button
        @click="toggleMode"
      >
        Dark/Light
      </button>

      <BottomSheet
        ref="bottomSheet"
        :initial-snap-point="lastSnapPointIndex"
        :hideScrollbar="true"
        :snap-points="['50%', '90%']"
        :dark-mode="!isLight"
        @vue:mounted="openSheet"
        @drag-end="handleDragEnd"
      >
        <template #header>
            <div>
                Bottom Sheet Demo
            </div>
        </template>

        <!--Content-->
        <div
          v-for="i in 20"
          :key="i"
          class="content-item"
          :class="itemIndex >= 0 && itemIndex === i && 'active'"
          @click="selectItem(i)"
          :ref="el => (refItems[i] = el)"
        >
          <div>Item {{ i }}</div>
        </div>
      </BottomSheet>
    </ClientOnly>
  </div>
</template>

<style lang="pcss">
:root {
  /* primary - آبی آرامش‌بخش (sky) */
  --color-primary-50: 240 249 255; /* #f0f9ff */
  --color-primary-100: 224 242 254; /* #e0f2fe */
  --color-primary-200: 186 230 253; /* #bae6fd */
  --color-primary-300: 125 211 252; /* #7dd3fc */
  --color-primary-400: 56 189 248; /* #38bdf8 */
  --color-primary-500: 16 165 233; /* #10a5e9 */
  --color-primary-600: 2 132 199; /* #0284c7 */
  --color-primary-700: 3 105 161; /* #0369a1 */
  --color-primary-800: 7 89 133; /* #075985 */
  --color-primary-900: 12 74 110; /* #0c4a6e */
  --color-primary-950: 8 47 73; /* #082f49 */

  /* muted - خاکستری متعادل (zinc) */
  --color-muted-50: 248 250 252; /* #f8fafc */
  --color-muted-100: 241 245 249; /* #f1f5f9 */
  --color-muted-200: 226 232 240; /* #e2e8f0 */
  --color-muted-300: 203 213 225; /* #cbd5e1 */
  --color-muted-400: 148 163 184; /* #94a3b8 */
  --color-muted-500: 100 116 139; /* #64748b */
  --color-muted-600: 71 85 105; /* #475569 */
  --color-muted-700: 51 65 85; /* #334155 */
  --color-muted-800: 30 41 59; /* #1e293b */
  --color-muted-900: 15 23 42; /* #0f172a */
  --color-muted-950: 2 6 23; /* #020617 */
}

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
  background-color: rgb(var(--color-primary-600));
  transform: translate(50%, 0) rotate(0) skewX(0) skewY(0) scaleX(1) scaleY(1);
}
.content-item.active div {
  position: relative;
}

[data-theme="dark"] .content-item {
    border-color: #475569;
}
</style>
