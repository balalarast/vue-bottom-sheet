<script setup lang="ts">
import { Motion } from '@oku-ui/motion'
import {
  type ComponentPublicInstance,
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from 'vue'

const props = withDefaults(
  defineProps<{
    darkMode?: boolean
    canSwipeClose?: boolean
    snapPoints?: (`${number}%` | number)[]
    initialSnapPoint?: number
    overlay?: boolean
    teleportTo?: string
    containerClass?: string
    hideScrollbar?: boolean
    preventPullToRefresh?: boolean
    expandOnContentDrag?: boolean
    maxOvershootPercent?: 20 | 40 | 60 | 80 | 100
    smoothFactor?: number
    springStiffness?: number
    springDamping?: number
  }>(),
  {
    darkMode: false,
    canSwipeClose: true,
    snapPoints: () => ['30%', '60%', '90%'],
    initialSnapPoint: 0,
    overlay: false,
    teleportTo: 'body',
    containerClass: '',
    hideScrollbar: false,
    preventPullToRefresh: true,
    expandOnContentDrag: false,
    maxOvershootPercent: 100,
    smoothFactor: 0.7,
    springStiffness: 300,
    springDamping: 30,
  },
)

const show = ref(false)
const isClient = ref(false)
const sheetRef = ref<ComponentPublicInstance | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const panelHeight = ref('0px')
const targetHeight = ref('0px')
const pixelSnapPoints = ref<number[]>([])
const isDragging = ref(false)
const canSwipeClose = ref(props.canSwipeClose)
const snapPoints = ref(props.snapPoints)
const currentSnapIndex = ref(props.initialSnapPoint ?? 0)
const isScrollAllowed = ref(false)
const expandOnContentDrag = ref(props.expandOnContentDrag)

const minHeight = computed(() => Math.min(...pixelSnapPoints.value))
const maxHeight = computed(() => Math.max(...pixelSnapPoints.value))

const animatedHeight = computed(() =>
  isDragging.value ? panelHeight.value : targetHeight.value,
)

const maxSnapIndex = computed(() =>
  pixelSnapPoints.value.indexOf(Math.max(...pixelSnapPoints.value)),
)

const canScrollDrag = computed(
  () =>
    expandOnContentDrag.value && currentSnapIndex.value < maxSnapIndex.value,
)

watch(
  () => props.expandOnContentDrag,
  newVal => (expandOnContentDrag.value = newVal),
)

watch(
  () => props.canSwipeClose,
  newVal => (canSwipeClose.value = newVal),
)

watch(
  () => props.snapPoints,
  newVal => {
    snapPoints.value = newVal
    updatePixelSnapPoints(newVal)
  },
  { immediate: true },
)

function updatePixelSnapPoints(snapPts: typeof props.snapPoints) {
  const vh = window.innerHeight
  pixelSnapPoints.value = snapPts.map(p =>
    typeof p === 'string' && p.endsWith('%')
      ? (parseFloat(p) / 100) * vh
      : typeof p === 'number'
        ? p
        : 0,
  )
}

// Drag state and parameters
let startY = 0
let startHeight = 0
let dragging = false
let rafId: number | null = null
let pendingDelta: number | null = null

const smoothFactor = props.smoothFactor!
const useEasing = true
const maxOvershootRatio = 1 + props.maxOvershootPercent / 100

// Variable to manage the Promise in open and close methods
let motionResolveHandler: (() => void) | null = null
function cleanupMotionHandler() {
  motionResolveHandler = null
}

onMounted(() => {
  isClient.value = true

  const initialHeight =
    pixelSnapPoints.value[props.initialSnapPoint] ?? pixelSnapPoints.value[0]

  panelHeight.value = `${initialHeight}px`
  targetHeight.value = `${initialHeight}px`
})

async function open() {
  return new Promise<void>(resolve => {
    show.value = true
    targetHeight.value = '0px'

    nextTick(() => {
      const initialHeight =
        pixelSnapPoints.value[props.initialSnapPoint] ??
        pixelSnapPoints.value[0]

      targetHeight.value = `${initialHeight}px`
      currentSnapIndex.value = props.initialSnapPoint
      motionResolveHandler = resolve
    })
  })
}

async function close() {
  return new Promise<void>(resolve => {
    targetHeight.value = '0px'
    motionResolveHandler = resolve
  })
}

watch(targetHeight, newHeight => {
  if (newHeight === '0px') {
    show.value = false
    cleanup()
  }

  if (motionResolveHandler) {
    motionResolveHandler()
    cleanupMotionHandler()
  }
})

function snapToPoint(index: number) {
  if (index < 0 || index >= pixelSnapPoints.value.length) {
    console.warn('snapToPoint: index out of range')
    return
  }

  currentSnapIndex.value = index
  const point = pixelSnapPoints.value[index]
  targetHeight.value = `${point}px`
}

const handleDragDecision = (currentClientY: number) => {
  if (!isScrollAllowed.value) return true

  if (canScrollDrag.value) return true

  const deltaY = startY - currentClientY
  const el = scrollRef.value
  if (!el) return false

  const isDraggingDown = deltaY < 0
  const atTop = el.scrollTop <= 0

  return isDraggingDown && atTop
}

const startDragFromScroll = (e: PointerEvent | TouchEvent) => {
  isScrollAllowed.value = true
  startDrag(e, true)
}

const startDrag = (e: PointerEvent | TouchEvent, fromScroll = false) => {
  if (!fromScroll) isScrollAllowed.value = false

  if (isScrollAllowed.value && !expandOnContentDrag.value) return

  dragging = true
  isDragging.value = true

  const isTouch = e.type.startsWith('touch')
  const clientY = isTouch
    ? (e as TouchEvent).touches[0].clientY
    : (e as PointerEvent).clientY

  startY = clientY
  startHeight =
    sheetRef.value?.$el?.offsetHeight || parseFloat(panelHeight.value)
  panelHeight.value = `${startHeight}px`

  if (isTouch) {
    window.addEventListener('touchmove', onTouchDrag, { passive: false })
    window.addEventListener('touchend', endDrag)
  } else {
    window.addEventListener('pointermove', onPointerDrag)
    window.addEventListener('pointerup', endDrag)
  }
}

const onPointerDrag = (e: PointerEvent) => {
  if (!dragging) return
  if (!handleDragDecision(e.clientY)) return

  pendingDelta = startHeight + (startY - e.clientY)

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateHeightSmooth(pendingDelta!)
      rafId = null
    })
  }
}

const onTouchDrag = (e: TouchEvent) => {
  if (!dragging) return
  if (!handleDragDecision(e.touches[0].clientY)) return

  e.preventDefault()

  pendingDelta = startHeight + (startY - e.touches[0].clientY)

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateHeightSmooth(pendingDelta!)
      rafId = null
    })
  }
}

const updateHeightSmooth = (rawHeight: number) => {
  let newHeight = rawHeight

  if (rawHeight < minHeight.value) {
    if (canSwipeClose.value) {
      newHeight = Math.max(rawHeight, 0)
    } else {
      const diff = minHeight.value - rawHeight
      const easedDiff = useEasing ? Math.sqrt(diff) * 5 : diff
      newHeight = minHeight.value - Math.min(diff, easedDiff)
      const minAllowedHeight = minHeight.value / maxOvershootRatio
      if (newHeight < minAllowedHeight) newHeight = minAllowedHeight
    }
  } else if (rawHeight > maxHeight.value) {
    const diff = rawHeight - maxHeight.value
    const easedDiff = useEasing ? Math.sqrt(diff) * 5 : diff
    newHeight = maxHeight.value + Math.min(diff, easedDiff)
    const maxAllowedHeight = maxHeight.value * maxOvershootRatio
    if (newHeight > maxAllowedHeight) newHeight = maxAllowedHeight
  }

  const current = parseFloat(panelHeight.value)
  const smoothed = current * (1 - smoothFactor) + newHeight * smoothFactor
  panelHeight.value = `${smoothed}px`
}

const endDrag = () => {
  dragging = false
  isDragging.value = false

  const currentHeight = parseFloat(panelHeight.value)
  const vh = window.innerHeight

  if (canSwipeClose.value && currentHeight < vh * 0.2) {
    close()
    cleanup()
    return
  }

  const clampedHeight = Math.min(
    maxHeight.value,
    Math.max(minHeight.value, currentHeight),
  )

  let closestIndex = 0
  let closest = pixelSnapPoints.value[0]
  let minDiff = Math.abs(clampedHeight - closest)

  for (let i = 1; i < pixelSnapPoints.value.length; i++) {
    const p = pixelSnapPoints.value[i]
    const diff = Math.abs(clampedHeight - p)
    if (diff < minDiff) {
      closest = p
      minDiff = diff
      closestIndex = i
    }
  }

  targetHeight.value = `${closest}px`
  panelHeight.value = `${closest}px`
  currentSnapIndex.value = closestIndex

  cleanup()
}

const cleanup = () => {
  window.removeEventListener('touchmove', onTouchDrag)
  window.removeEventListener('touchend', endDrag)
  window.removeEventListener('pointermove', onPointerDrag)
  window.removeEventListener('pointerup', endDrag)
}

defineExpose({ open, close, snapToPoint, isOpened: computed(() => show.value) })
</script>

<template>
  <teleport :to="teleportTo">
    <div
      v-if="show"
      class="ba-bs-container"
      :data-theme="darkMode ? 'dark' : undefined"
      data-ba-container
    >
      <div
        v-if="overlay"
        class="ba-bs-overlay"
        @click="close"
        data-ba-overlay
      />

      <Motion
        v-if="isClient"
        ref="sheetRef"
        class="ba-bs-sheet"
        :class="containerClass"
        :style="{ height: maxHeight + 'px', willChange: 'height' }"
        tabindex="-1"
        :initial="{ height: '0px' }"
        :animate="{ height: animatedHeight }"
        :exit="{ height: '0px' }"
        :transition="
          isDragging
            ? { type: 'linear', duration: 0.05 }
            : {
                type: 'spring',
                stiffness: props.springStiffness,
                damping: props.springDamping,
                mass: 1,
              }
        "
        data-ba-sheet
      >
        <div class="ba-bs-wrapper" data-ba-wrapper>
          <div
            class="ba-bs-header"
            :class="{ 'ba-bs-header--border': !!$slots.header }"
            @pointerdown="startDrag"
            @touchstart="startDrag"
            data-ba-header
          >
            <slot name="header" />
          </div>

          <div
            ref="scrollRef"
            class="ba-bs-scroll"
            :class="{
              'ba-bs-scroll--hidden': hideScrollbar,
              'ba-bs-scroll--no-pull': preventPullToRefresh,
            }"
            data-ba-scroll
            @pointerdown="startDragFromScroll"
            @touchstart="startDragFromScroll"
          >
            <div class="ba-bs-content" data-ba-content>
              <slot />
            </div>
          </div>

          <div
            v-if="$slots.footer"
            class="ba-bs-footer"
            @pointerdown="startDrag"
            @touchstart="startDrag"
            data-ba-footer
          >
            <slot name="footer" />
          </div>
        </div>
      </Motion>
    </div>
  </teleport>
</template>

<style>
:root {
  --ba-overlay-bg: rgba(15, 23, 42, 0.5);
  --ba-bg: #ffffff;
  --ba-bg-dark: rgb(30, 41, 59);
  --ba-border-color: rgb(229, 231, 235);
  --ba-border-color-dark: rgb(51, 65, 85);
  --ba-radius: 1rem;
  --ba-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  --ba-max-width: 640px;
  --ba-handle-width: 48px;
  --ba-handle-height: 6px;
  --ba-handle-color: rgb(209, 213, 219);
  --ba-handle-color-dark: rgb(71, 85, 105);
  --ba-padding: 16px;
  --ba-padding-small: 8px;
}

.ba-bs-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 20;
  visibility: visible;
}

.ba-bs-overlay {
  position: absolute;
  inset: 0;
  background: var(--ba-overlay-bg);
  pointer-events: auto !important;
}

.ba-bs-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--ba-bg);
  border-radius: var(--ba-radius) var(--ba-radius) 0 0;
  box-shadow: var(--ba-shadow);
  overflow: hidden;
  pointer-events: auto;
  max-width: var(--ba-max-width);
  margin: 0 auto;
  user-select: none;
}

.ba-bs-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ba-bs-header {
  position: relative;
  flex-shrink: 0;
  padding: calc(var(--ba-padding) + 4px) var(--ba-padding)
    var(--ba-padding-small);
}

.ba-bs-header::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: var(--ba-handle-width);
  height: var(--ba-handle-height);
  border-radius: 9999px;
  background: var(--ba-handle-color);
}

.ba-bs-header--border {
  border-bottom: 1px solid var(--ba-border-color);
}

.ba-bs-scroll {
  flex: 1;
  overflow: auto;
  user-select: text;
  scroll-behavior: smooth;
}

.ba-bs-scroll--hidden {
  scrollbar-width: none;
}
.ba-bs-scroll--hidden::-webkit-scrollbar {
  display: none;
}

.ba-bs-scroll--no-pull {
  overscroll-behavior: contain;
}

.ba-bs-content {
  padding: var(--ba-padding);
  padding-top: var(--ba-padding-small);
}

.ba-bs-footer {
  flex-shrink: 0;
  padding: var(--ba-padding);
  border-top: 1px solid var(--ba-border-color);
}

/* حالت دارک */
[data-theme='dark'] {
  .ba-bs-sheet {
    background: var(--ba-bg-dark);
  }
  .ba-bs-header::before {
    background: var(--ba-handle-color-dark);
  }
  .ba-bs-header--border {
    border-bottom-color: var(--ba-border-color-dark);
  }
  .ba-bs-footer {
    border-top-color: var(--ba-border-color-dark);
  }
}
</style>
