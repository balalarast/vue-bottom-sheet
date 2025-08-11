import { beforeEach, afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

// غیرفعال کردن اخطارهای Vue در تست‌ها
(config.global as any).config = {
    ...(config.global as any).config,
    warnHandler: () => {}
}

// پاک‌سازی Mock ها قبل از هر تست
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // افزودن cleanup اضافه
})

if (typeof PointerEvent === 'undefined') {
  // @ts-ignore
  global.PointerEvent = class PointerEvent extends Event {
    clientX: number
    clientY: number

    constructor(type: string, eventInitDict?: EventInit & { clientX?: number; clientY?: number }) {
      super(type, eventInitDict)
      this.clientX = eventInitDict?.clientX ?? 0
      this.clientY = eventInitDict?.clientY ?? 0
    }
  }
}
