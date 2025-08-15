<script setup lang="ts">
import { Motion } from '@oku-ui/motion'
import {
  type ComponentPublicInstance,
  computed,
  nextTick,
  onMounted,
  ref,
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
    /**
     * Moves panel to previous snap point when dragging from top of content,
     * only works if expandOnContentDrag is false
     */
    edgeScrollSnap?: boolean
    disableEdgeBounce?: boolean
    smoothFactor?: number
    animationDuration?: number
    allowFastClose?: boolean
  }>(),
  {
    darkMode: false,
    canSwipeClose: true,
    snapPoints: () => [200, '60%', '90%'],
    initialSnapPoint: 0,
    overlay: false,
    teleportTo: 'body',
    containerClass: '',
    hideScrollbar: false,
    preventPullToRefresh: true,
    expandOnContentDrag: false,
    edgeScrollSnap: true,
    disableEdgeBounce: false,
    smoothFactor: 0.7,
    animationDuration: 150,
    allowFastClose: false,
  },
)

/**
 * @emits open - emitted when the bottom sheet is opened
 * @emits close - emitted when the bottom sheet is closed
 * @emits snapChange - emitted when the snap point changes, provides the snap index
 * @emits dragStart - emitted when dragging starts
 * @emits dragEnd - emitted when dragging ends, provides the final snap index
 */
const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
  (e: 'snapChange', index: number): void
  (e: 'dragStart'): void
  (e: 'dragEnd', finalIndex: number): void
}>()

const show = ref(false)
const hasBeenOpened = ref(false)
const isClient = ref(false)
const sheetRef = ref<ComponentPublicInstance | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const panelHeight = ref('0px')
const targetHeight = ref('0px')
const isDragging = ref(false)

const pixelSnapPoints = computed<number[]>(() => {
  const vh = window.innerHeight
  let val = props.snapPoints
    .map(p => {
      let val = 0
      if (typeof p === 'string' && p.endsWith('%')) {
        val = (parseFloat(p) / 100) * vh
      } else if (typeof p === 'number') {
        val = p
      }
      val = Number(val.toFixed(2))
      if (isNaN(val) || val <= 0) {
        console.warn(`Invalid snap point value detected: ${p}. Ignored.`)
        return null
      }
      return val
    })
    .filter((v): v is number => v !== null)

  if (val.length === 0) {
    val = [100]
    console.warn('pixelSnapPoints was empty after update, set default 100px')
  }

  return val
})
const canSwipeClose = computed(() => props.canSwipeClose)
const initialSnapPoint = computed(() => props.initialSnapPoint)

const currentSnapIndex = ref(initialSnapPoint.value)
const isScrollAllowed = ref(false)

const expandOnContentDrag = computed(() => props.expandOnContentDrag)
const edgeScrollSnap = computed(() => props.edgeScrollSnap)
const disableEdgeBounce = computed(() => props.disableEdgeBounce)
const smoothFactor = computed(() => props.smoothFactor)

const animationDuration = computed(() => props.animationDuration)
const animationDurationSeconds = computed(() => animationDuration.value / 1000)

const minHeight = computed(() => Math.min(...pixelSnapPoints.value))
const maxHeight = computed(() => Math.max(...pixelSnapPoints.value))

const animatedHeight = computed(() =>
  isDragging.value ? panelHeight.value : targetHeight.value,
)

const minSnapIndex = computed(() =>
  pixelSnapPoints.value.indexOf(Math.min(...pixelSnapPoints.value)),
)

const maxSnapIndex = computed(() =>
  pixelSnapPoints.value.indexOf(Math.max(...pixelSnapPoints.value)),
)

const canScrollDrag = computed(
  () =>
    expandOnContentDrag.value && currentSnapIndex.value < maxSnapIndex.value,
)

// Drag state and parameters
let startY = 0
let lastY = 0
let lastTime = 0
let velocity = 0
let startHeight = 0
let rafId: number | null = null
let pendingDelta: number | null = null

const useEasing = true
const maxOvershootRatio = 1 + 0.2

function getValidInitialHeight(): number {
  let initialHeight =
    pixelSnapPoints.value[initialSnapPoint.value] ?? pixelSnapPoints.value[0]

  if (isNaN(initialHeight) || initialHeight <= 0) {
    console.warn(
      `Invalid initial height detected: ${initialHeight}. Setting to 100px default.`,
    )
    initialHeight = 100
  }
  return initialHeight
}

onMounted(() => {
  isClient.value = true

  const initialHeight = getValidInitialHeight()

  panelHeight.value = `${initialHeight}px`
  targetHeight.value = `${initialHeight}px`
})

async function open() {
  return new Promise<void>(resolve => {
    if (!hasBeenOpened.value) {
      hasBeenOpened.value = true
    }
    show.value = true
    targetHeight.value = '0px'
    emit('open')

    nextTick(() => {
      const initialHeight = getValidInitialHeight()

      targetHeight.value = `${initialHeight}px`
      currentSnapIndex.value = initialSnapPoint.value
      resolve()
    })
  })
}

async function close() {
  return new Promise<void>(resolve => {
    targetHeight.value = '0px'

    setTimeout(() => {
      show.value = false
      cleanup()
      emit('close')
      resolve()
    }, animationDuration.value)
  })
}

function snapToPoint(index: number) {
  if (index < 0 || index >= pixelSnapPoints.value.length) {
    console.warn('snapToPoint: index out of range')
    return
  }

  currentSnapIndex.value = index
  const point = pixelSnapPoints.value[index]
  targetHeight.value = `${point}px`

  emit('snapChange', index)
}

function recordDragPos(y: number, resetVelocity: boolean = false) {
  if (resetVelocity) {
    velocity = 0
  }

  const now = performance.now()
  const dy = y - lastY
  const dt = now - lastTime

  if (dt > 0) {
    velocity = (dy / dt) * 1000 // px/s
  }

  lastY = y
  lastTime = now
}

const handleDragDecision = (currentClientY: number) => {
  if (!isScrollAllowed.value) return true

  if (canScrollDrag.value) return true

  if (!expandOnContentDrag.value && !edgeScrollSnap.value) return false

  const deltaY = startY - currentClientY
  const el = scrollRef.value
  if (!el) return false

  const isDraggingDown = deltaY < 0
  const isDraggingUp = deltaY > 0

  const atTop = el.scrollTop <= 0
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight

  if (isDraggingDown && atTop) return true
  if (isDraggingUp && atBottom) return true

  return false
}

const startDragFromScroll = (e: PointerEvent | TouchEvent) => {
  isScrollAllowed.value = true
  startDrag(e, true)
}

const startDrag = (e: PointerEvent | TouchEvent, fromScroll = false) => {
  if (!fromScroll) isScrollAllowed.value = false

  // if (isScrollAllowed.value && !expandOnContentDrag.value) return

  isDragging.value = true

  const isTouch = e.type.startsWith('touch')
  const clientY = isTouch
    ? (e as TouchEvent).touches[0].clientY
    : (e as PointerEvent).clientY

  recordDragPos(clientY, true)

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
  recordDragPos(e.clientY)

  if (!isDragging.value) return
  if (!handleDragDecision(e.clientY)) return

  emit('dragStart')

  pendingDelta = startHeight + (startY - e.clientY)

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateHeightSmooth(pendingDelta!)
      rafId = null
    })
  }
}

const onTouchDrag = (e: TouchEvent) => {
  recordDragPos(e.touches[0].clientY)

  if (!isDragging.value) return
  if (!handleDragDecision(e.touches[0].clientY)) return

  e.preventDefault()

  emit('dragStart')

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
      if (currentSnapIndex.value == 0 && disableEdgeBounce.value) {
        newHeight = minHeight.value
      } else {
        const diff = minHeight.value - rawHeight
        const easedDiff = useEasing ? Math.sqrt(diff) * 5 : diff
        newHeight = minHeight.value - Math.min(diff, easedDiff)
        const minAllowedHeight = minHeight.value / maxOvershootRatio
        if (newHeight < minAllowedHeight) newHeight = minAllowedHeight
      }
    }
  } else if (rawHeight > maxHeight.value) {
    if (
      currentSnapIndex.value >= maxSnapIndex.value &&
      disableEdgeBounce.value
    ) {
      newHeight = maxHeight.value
    } else {
      const diff = rawHeight - maxHeight.value
      const easedDiff = useEasing ? Math.sqrt(diff) * 5 : diff
      newHeight = maxHeight.value + Math.min(diff, easedDiff)
      const maxAllowedHeight = maxHeight.value * maxOvershootRatio
      if (newHeight > maxAllowedHeight) newHeight = maxAllowedHeight
    }
  }

  const current = parseFloat(panelHeight.value)
  const smoothed =
    current * (1 - smoothFactor.value) + newHeight * smoothFactor.value
  panelHeight.value = `${smoothed}px`
}

const endDrag = () => {
  isDragging.value = false

  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  const currentHeight = parseFloat(panelHeight.value)
  const currIndex = currentSnapIndex.value
  const currSnapHeight = pixelSnapPoints.value[currIndex]

  // velocity thresholds پویا بر اساس ارتفاع اسنپ
  const baseFactor = 10 // قابل تنظیم برای حساسیت پرتاب
  const minVelocity = 800 // حداقل سرعت برای پرتاب سریع
  const maxVelocity = 2000 // حداکثر سرعت برای اسنپ‌های خیلی بزرگ

  const fastDownThreshold = Math.min(
    maxVelocity,
    Math.max(minVelocity, currSnapHeight * baseFactor),
  )
  const fastUpThreshold = -fastDownThreshold

  // بررسی بستن سریع
  const pulledDownPx = Math.max(0, currSnapHeight - currentHeight)
  const closeThresholdPx = currSnapHeight * 0.2

  if (canSwipeClose.value && pulledDownPx >= closeThresholdPx) {
    close()
    emit('dragEnd', currIndex)
    cleanup()
    return
  }

  // تعیین اسنپ بعدی
  let targetIndex = currIndex

  const delta = currentHeight - currSnapHeight

  if (delta > 5 || velocity < fastUpThreshold) {
    // درگ به سمت بالا (افزایش ارتفاع)
    targetIndex = Math.min(currIndex + 1, pixelSnapPoints.value.length - 1)
  } else if (delta < -5 || velocity > fastDownThreshold) {
    // درگ به سمت پایین (کاهش ارتفاع)
    targetIndex = Math.max(currIndex - 1, minSnapIndex.value)
  } else {
    targetIndex = currIndex
  }

  // اعمال اسنپ
  targetHeight.value = `${pixelSnapPoints.value[targetIndex]}px`
  currentSnapIndex.value = targetIndex

  cleanup()
  emit('dragEnd', targetIndex)
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
      v-if="show || hasBeenOpened"
      v-show="show"
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
        :initial="{ height: '0px', opacity: 0 }"
        :animate="{ height: animatedHeight, opacity: 1 }"
        :exit="{ height: '0px', opacity: 0 }"
        :transition="
          isDragging
            ? { type: 'linear', duration: 0 }
            : {
                type: 'tween',
                ease: 'easeOut',
                duration: animationDurationSeconds,
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
