<script setup lang="ts">
import { Motion } from '@oku-ui/motion'
import {
  type ComponentPublicInstance,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'

// ------------------------ Props ------------------------
const props = withDefaults(
  defineProps<{
    darkMode?: boolean
    canSwipeClose?: boolean
    snapPoints?: (`${number}%` | number)[]
    initialSnapPoint?: number
    overlay?: boolean
    teleportTo?: string
    containerClass?: string
    sheetClass?: string
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
    minDragDistance?: number // حداقل فاصله drag برای اسنپ معمولی
    fastSwipeVelocity?: number // سرعت لازم برای پرش سریع به snap بعدی
    fastSwipeMaxTapTime?: number // حداکثر زمان برای tap سریع جهت fast swipe
    closeMinDragDistance?: number // حداقل فاصله drag برای تشخیص intent بستن
    closeMaxTapTime?: number // حداکثر زمان برای tap سریع جهت بستن
    closeRelativeThreshold?: number // درصد فاصله برای تشخیص intent بستن
    fastClose?: boolean
    fastCloseMode?:
      | 'default'
      | 'maxSnap'
      | ((
          currHeight: number,
          velocity: number,
          elapsedTime: number,
          currentIndex: number,
        ) => boolean)
    fastCloseVelocity?: number // سرعت لازم برای بستن پنل
    fastCloseVelocityGrace?: number // ارفاق سرعت هنگام بستن
  }>(),
  {
    darkMode: false,
    canSwipeClose: true,
    snapPoints: () => [200, '60%', '90%'],
    initialSnapPoint: 0,
    overlay: true,
    teleportTo: 'body',
    containerClass: '',
    sheetClass: '',
    hideScrollbar: false,
    preventPullToRefresh: true,
    expandOnContentDrag: false,
    edgeScrollSnap: true,
    disableEdgeBounce: false,
    smoothFactor: 0.7,
    animationDuration: 150,
    minDragDistance: 5,
    fastSwipeVelocity: 100,
    fastSwipeMaxTapTime: 200,
    closeMinDragDistance: 5,
    closeMaxTapTime: 200,
    closeRelativeThreshold: 0.2,
    fastClose: false,
    fastCloseMode: 'default',
    fastCloseVelocity: 100,
    fastCloseVelocityGrace: 40,
  },
)

// ------------------------ Emits ------------------------
const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
  (e: 'snapChange', index: number): void
  (e: 'dragStart'): void
  (e: 'dragEnd', finalIndex: number): void
}>()

// ------------------------ Refs ------------------------
const show = ref(false)
const hasBeenOpened = ref(false)
const isClient = ref(false)
const sheetRef = ref<ComponentPublicInstance | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const panelHeight = ref('0px')
const targetHeight = ref('0px')
const isDragging = ref(false)
const vh = ref(0)

const snapOriginalIndices = ref<number[]>([])

// ------------------------ Computed ------------------------
const pixelSnapPoints = computed<number[]>(() => {
  let pointsWithIndex = props.snapPoints
    .map((p, index) => {
      let val = 0
      if (typeof p === 'string' && p.endsWith('%')) {
        val = (parseFloat(p) / 100) * vh.value
      } else if (typeof p === 'number') {
        val = p
      }
      val = Number(val.toFixed(2))
      if (isNaN(val) || val <= 0) {
        console.warn(`Invalid snap point value detected: ${p}. Ignored.`)
        return null
      }
      return { value: val, originalIndex: index }
    })
    .filter((v): v is { value: number; originalIndex: number } => v !== null)

  if (pointsWithIndex.length === 0) {
    console.warn('pixelSnapPoints was empty after update, set default 100px')
    return [100]
  }

  pointsWithIndex.sort((a, b) => a.value - b.value)
  snapOriginalIndices.value = pointsWithIndex.map(p => p.originalIndex)
  return pointsWithIndex.map(p => p.value)
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

const minDragDistance = computed(() => props.minDragDistance)
const fastSwipeVelocity = computed(() => props.fastSwipeVelocity)
const fastSwipeMaxTapTime = computed(() => props.fastSwipeMaxTapTime)
const closeMinDragDistance = computed(() => props.closeMinDragDistance)
const closeMaxTapTime = computed(() => props.closeMaxTapTime)
const closeRelativeThreshold = computed(() => props.closeRelativeThreshold)
const fastClose = computed(() => props.fastClose)
const fastCloseMode = computed(() => props.fastCloseMode)
const fastCloseVelocity = computed(() => props.fastCloseVelocity)
const fastCloseVelocityGrace = computed(() => props.fastCloseVelocityGrace)

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

// ------------------------ Drag state ------------------------
let startY = 0
let lastY = 0
let deltaY = 0
let startTime = 0
let lastTime = 0
let velocity = 0
let startHeight = 0
let rafId: number | null = null
let pendingDelta: number | null = null

let hasResetDragStart = false

const useEasing = true
const maxOvershootRatio = 1 + 0.2

// ------------------------ Helper Functions ------------------------
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

function initAndUpdatePanelHeight() {
  vh.value = window.innerHeight

  const initialHeight = getValidInitialHeight()

  panelHeight.value = `${initialHeight}px`
  targetHeight.value = `${initialHeight}px`
}

// ------------------------ Lifecycle ------------------------
onMounted(() => {
  isClient.value = true
  initAndUpdatePanelHeight()
  window.addEventListener('resize', initAndUpdatePanelHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', initAndUpdatePanelHeight)
})

// ------------------------ Panel Controls ------------------------
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
      currentSnapIndex.value = initialSnapPoint.value
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

  if (currentSnapIndex.value != index) {
    const point = pixelSnapPoints.value[index]
    targetHeight.value = `${point}px`
    currentSnapIndex.value = index

    cleanup()
    emit('snapChange', index)
  }
}

function getOriginalIndex(sortedIndex: number): number {
  if (sortedIndex < 0 || sortedIndex >= snapOriginalIndices.value.length) {
    return -1
  }
  return snapOriginalIndices.value[sortedIndex]
}

function recordDragPos(
  y: number,
  isStartDrag: boolean = false,
  skipHeightChange: boolean = false,
) {
  const now = performance.now()

  if (isStartDrag) {
    deltaY = 0
    velocity = 0

    startY = y
    startTime = now
    if (!skipHeightChange) {
      startHeight =
        sheetRef.value?.$el?.offsetHeight || parseFloat(panelHeight.value)
      panelHeight.value = `${startHeight}px`
    }
  }

  const dy = y - lastY
  const dt = now - lastTime
  deltaY = startY - y

  if (dt > 0) {
    velocity = (dy / dt) * 1000 // px/s
  }

  lastY = y
  lastTime = now
}

const handleDragDecision = () => {
  if (!isScrollAllowed.value) return true

  if (canScrollDrag.value) return true

  if (!expandOnContentDrag.value && !edgeScrollSnap.value) return false

  const el = scrollRef.value
  if (!el) return false

  const isDraggingDown = deltaY < 0
  const isDraggingUp = deltaY > 0

  // tolerance to avoid rounding/subpixel issues on mobile
  const TOLERANCE = 1 // px, adjust to 2 if needed

  const atTop = el.scrollTop <= TOLERANCE
  const atBottom =
    el.scrollHeight - (el.scrollTop + el.clientHeight) <= TOLERANCE

  if (isDraggingDown && atTop) {
    if (!hasResetDragStart) {
      recordDragPos(lastY, true, true)
    }
    hasResetDragStart = true
    return true
  }

  if (isDraggingUp && atBottom) {
    if (!hasResetDragStart) {
      recordDragPos(lastY, true, true)
    }
    hasResetDragStart = true
    return true
  }

  return false
}

const startDragFromScroll = (e: PointerEvent | TouchEvent) => {
  isScrollAllowed.value = true
  startDrag(e, true)
}

const startDrag = (e: PointerEvent | TouchEvent, fromScroll = false) => {
  if (!fromScroll) isScrollAllowed.value = false

  isDragging.value = true
  hasResetDragStart = false

  const isTouch = e.type.startsWith('touch')
  const clientY = isTouch
    ? (e as TouchEvent).touches[0].clientY
    : (e as PointerEvent).clientY

  recordDragPos(clientY, true)

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
  if (!handleDragDecision()) return

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
  if (!handleDragDecision()) return

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

function clampHeight(height: number) {
  const minAllowedHeight = minHeight.value / maxOvershootRatio
  const maxAllowedHeight = maxHeight.value * maxOvershootRatio
  return Math.min(Math.max(height, minAllowedHeight), maxAllowedHeight)
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
        newHeight = clampHeight(newHeight)
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
      newHeight = clampHeight(newHeight)
    }
  }

  const current = parseFloat(panelHeight.value)

  if (isScrollAllowed.value) {
    newHeight = newHeight > maxHeight.value ? maxHeight.value : newHeight
    panelHeight.value = `${newHeight}px`
    return
  }

  const smoothed =
    current * (1 - smoothFactor.value) + newHeight * smoothFactor.value
  panelHeight.value = `${smoothed}px`
}

// پیدا کردن نزدیک‌ترین اسنپ
function findNearestSnapIndex(height: number): number {
  let closestIndex = 0
  let closestDistance = Infinity
  pixelSnapPoints.value.forEach((h, i) => {
    const dist = Math.abs(h - height)
    if (dist < closestDistance) {
      closestDistance = dist
      closestIndex = i
    }
  })
  return closestIndex
}

function shouldClose(
  currHeight: number,
  distanceDragged: number,
  elapsedTime: number,
  movingDown: boolean,
  currentIndex: number,
): boolean {
  if (!canSwipeClose.value) return false

  const currSnapHeight = pixelSnapPoints.value[currentIndex]
  const minSnapHeight = pixelSnapPoints.value[minSnapIndex.value]
  const maxSnapHeight = pixelSnapPoints.value[maxSnapIndex.value]
  const isAtLowestSnap = currentIndex === minSnapIndex.value

  const pulledDownPx = Math.max(0, minSnapHeight - currHeight)
  const distancePulled = Math.max(0, currSnapHeight - currHeight)

  const isQuickTap =
    distanceDragged > closeMinDragDistance.value &&
    elapsedTime <= closeMaxTapTime.value

  // ------------------ Threshold ------------------
  let closeThresholdPx: number

  if (isAtLowestSnap) {
    // وقتی روی پایین‌ترین اسنپ هستیم
    // آستانه رو نسبتی از ارتفاع همین اسنپ حساب کن
    closeThresholdPx = currSnapHeight * closeRelativeThreshold.value
  } else {
    // حالت عادی (فاصله بین max و min)
    closeThresholdPx =
      (maxSnapHeight - minSnapHeight) * closeRelativeThreshold.value
  }

  let fastCloseDecision = false
  if (fastClose.value) {
    // تصمیم اولیه بر اساس سرعت و threshold های fast close
    const baseFastClose =
      velocity > 0 &&
      Math.abs(velocity) >= fastCloseVelocity.value &&
      (distancePulled >= closeThresholdPx ||
        pulledDownPx >= fastCloseVelocityGrace.value)

    // اعمال حالت fastCloseMode
    if (fastCloseMode.value === 'maxSnap') {
      fastCloseDecision = baseFastClose && currentIndex === maxSnapIndex.value
    } else if (typeof fastCloseMode.value === 'function') {
      fastCloseDecision =
        velocity > 0 &&
        fastCloseMode.value(currHeight, velocity, elapsedTime, currentIndex)
    } else {
      fastCloseDecision = baseFastClose
    }
  }

  // ------------------ Decision ------------------
  if (
    movingDown &&
    ((fastClose.value && fastCloseDecision) ||
      pulledDownPx >= closeThresholdPx ||
      (isAtLowestSnap && isQuickTap))
  ) {
    return true
  }

  return false
}
const calculateTargetIndex = (
  currHeight: number,
  elapsedTime: number,
  movingDown: boolean,
): number => {
  const closestIndex = findNearestSnapIndex(currHeight)
  let targetIndex = closestIndex
  let candidateIndex: number

  const isFastSwipe =
    Math.abs(velocity) >= fastSwipeVelocity.value &&
    elapsedTime <= fastSwipeMaxTapTime.value

  if (movingDown) {
    candidateIndex = Math.max(closestIndex - 1, minSnapIndex.value)
  } else {
    candidateIndex = Math.min(closestIndex + 1, maxSnapIndex.value)
  }

  if (isFastSwipe) {
    targetIndex = candidateIndex
  } else {
    const currSnapHeight = pixelSnapPoints.value[currentSnapIndex.value]
    const midPoint =
      (currSnapHeight + pixelSnapPoints.value[candidateIndex]) / 2

    if (movingDown) {
      targetIndex = currHeight > midPoint ? closestIndex : candidateIndex
    } else {
      targetIndex = currHeight < midPoint ? closestIndex : candidateIndex
    }
  }

  return targetIndex
}

const endDrag = () => {
  isDragging.value = false

  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  const currHeight = parseFloat(panelHeight.value)
  const currSnapHeight = pixelSnapPoints.value[currentSnapIndex.value]

  const movingDown = deltaY !== 0 ? deltaY < 0 : velocity > 0

  // ---------- بررسی Drag واقعی ----------
  const distanceDragged = Math.abs(currHeight - currSnapHeight)
  const elapsedTime = performance.now() - startTime

  if (
    shouldClose(
      currHeight,
      distanceDragged,
      elapsedTime,
      movingDown,
      currentSnapIndex.value,
    )
  ) {
    close()
    cleanup()
    emit('dragEnd', currentSnapIndex.value)
    return
  }

  if (distanceDragged < minDragDistance.value) {
    // لمس کوتاه → اسنپ تغییر نمی‌کند
    cleanup()
    emit('dragEnd', currentSnapIndex.value)
    return
  }

  const targetIndex = calculateTargetIndex(currHeight, elapsedTime, movingDown)

  snapToPoint(targetIndex)
  emit('dragEnd', targetIndex)
}

const cleanup = () => {
  window.removeEventListener('touchmove', onTouchDrag)
  window.removeEventListener('touchend', endDrag)
  window.removeEventListener('pointermove', onPointerDrag)
  window.removeEventListener('pointerup', endDrag)
}

defineExpose({
  isOpened: computed(() => show.value),
  open,
  close,
  snapToPoint,
  pixelSnapPoints,
  getOriginalIndex,
  currentSnapIndex: computed(() => currentSnapIndex.value),
})
</script>

<template>
  <teleport :to="teleportTo">
    <div
      v-if="show || hasBeenOpened"
      v-show="show"
      class="ba-bs-container"
      :class="containerClass"
      :data-theme="darkMode ? 'dark' : undefined"
      data-ba-container
    >
      <div
        v-if="overlay"
        class="ba-bs-overlay"
        v-on="canSwipeClose ? { click: close } : {}"
        data-ba-overlay
      />

      <Motion
        v-if="isClient"
        ref="sheetRef"
        class="ba-bs-sheet"
        :class="sheetClass"
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
