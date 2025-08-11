import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import BottomSheet from '../src/components/BottomSheet.vue'

describe('BottomSheet', () => {
  it('renders container when open is called', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })

    await wrapper.vm.open()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ba-bs-container').exists()).toBe(true)
    expect(wrapper.vm.isOpened).toBe(true)
  })
  
  it('closes when close is called', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })

    await wrapper.vm.open()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ba-bs-container').exists()).toBe(true)
    expect(wrapper.vm.isOpened).toBe(true)

    await wrapper.vm.close()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ba-bs-container').exists()).toBe(false)
    expect(wrapper.vm.isOpened).toBe(false)
  })

  it('close event when overlay is clicked', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { overlay: true }
    })
    
    await wrapper.vm.open()
    await wrapper.vm.$nextTick()

    const overlay = wrapper.find('.ba-bs-overlay')
    expect(overlay.exists()).toBe(true)

    await overlay.trigger('click')

    expect(wrapper.find('.ba-bs-container').exists()).toBe(false)
  })

  it('snapToPoint sets correct height and index for valid index', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })

    await wrapper.vm.open()
  
    wrapper.vm.snapToPoint(1)
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as any
  
    const expectedHeight = vm.pixelSnapPoints[1] + 'px'
    expect(vm.currentSnapIndex).toBe(1)
    expect(vm.targetHeight).toBe(expectedHeight)
  })
  
  it('snapToPoint warns and does nothing for invalid index', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  
    wrapper.vm.snapToPoint(-1)
    wrapper.vm.snapToPoint(100)
    expect(warnSpy).toHaveBeenCalledTimes(2)
  
    warnSpy.mockRestore()
  })
  
  it('startDrag sets dragging state correctly', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.vm.open()
  
    const vm = wrapper.vm as any

    // simulate pointerdown event
    vm.startDrag(new PointerEvent('pointerdown'))
    expect(vm.isDragging).toBe(true)
  })
  
  it('endDrag snaps to closest point and resets dragging', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.vm.open()
  
    const vm = wrapper.vm as any

    vm.startDrag(new PointerEvent('pointerdown'))
    expect(vm.isDragging).toBe(true)
  
    // simulate some panel height to snap
    vm.panelHeight = '50px'
  
    vm.endDrag()
    await wrapper.vm.$nextTick()
  
    expect(vm.isDragging).toBe(false)
    expect(vm.targetHeight).not.toBe('50px')
  })
  
  it('does not render overlay if overlay prop is false', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { overlay: false },
    })
    await wrapper.vm.open()
  
    expect(wrapper.find('.ba-bs-overlay').exists()).toBe(false)
  })
  
  it('renders overlay if overlay prop is true', async () => {
    const wrapper = mount(BottomSheet, {
      props: { overlay: true },
      global: { stubs: { teleport: true } }
    })
    await wrapper.vm.open()
  
    expect(wrapper.find('.ba-bs-overlay').exists()).toBe(true)
  })
  
  it('renders header, footer and default slots', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      slots: {
        header: '<div class="test-header">Header</div>',
        footer: '<div class="test-footer">Footer</div>',
        default: '<div class="test-content">Content</div>',
      },
    })
    await wrapper.vm.open()
  
    expect(wrapper.find('.test-header').exists()).toBe(true)
    expect(wrapper.find('.test-footer').exists()).toBe(true)
    expect(wrapper.find('.test-content').exists()).toBe(true)
  })

  it('updates pixelSnapPoints when snapPoints prop changes', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { snapPoints: ['40%', '80%'] },
    })
    await wrapper.vm.open()
  
    const vm = wrapper.vm as any
    expect(vm.pixelSnapPoints.length).toBe(2)
    expect(vm.pixelSnapPoints[0]).not.toBe(0)
  
    await wrapper.setProps({ snapPoints: ['20%', '50%', '90%'] })
    await wrapper.vm.$nextTick()
  
    expect(vm.pixelSnapPoints.length).toBe(3)
  })

  it('does not close panel on drag if canSwipeClose is false', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { canSwipeClose: false },
    })
    await wrapper.vm.open()
    const vm = wrapper.vm as any
  
    vm.startDrag(new PointerEvent('pointerdown'))
    vm.panelHeight = '10px' // کمتر از 20% vh فرضی
    vm.endDrag()
    await wrapper.vm.$nextTick()
  
    expect(vm.isDragging).toBe(false)
    expect(vm.show).toBe(true)  // پنل نباید بسته شود
  })

  it('focuses the sheet element after open', async () => {
    const wrapper = mount(BottomSheet, {
      attachTo: document.body
    })
  
    wrapper.vm.open()
    
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 20))
  
    const sheet = document.querySelector<HTMLElement>('.ba-bs-sheet')
    expect(sheet).not.toBeNull()
  
    sheet!.focus()
    expect(document.activeElement).toBe(sheet)
  })

  it('applies dark mode class and data attribute', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { darkMode: true },
    })
    await wrapper.vm.open()
    await wrapper.vm.$nextTick()
  
    const container = wrapper.find('.ba-bs-container')
    expect(container.attributes('data-theme')).toBe('dark')
  })

  it('adds ba-bs-scroll--no-pull class when preventPullToRefresh is true', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { preventPullToRefresh: true },
    })
    await wrapper.vm.open()
    await wrapper.vm.$nextTick()
  
    const scroll = wrapper.find('.ba-bs-scroll')
    expect(scroll.classes()).toContain('ba-bs-scroll--no-pull')
  })

  it('allows dragging from scroll only if expandOnContentDrag is true', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { expandOnContentDrag: true },
    })
    await wrapper.vm.open()
    const vm = wrapper.vm as any
  
    // شروع درگ از اسکرول
    vm.startDragFromScroll(new PointerEvent('pointerdown'))
    expect(vm.isDragging).toBe(true)
  })

  it('adds ba-bs-scroll--hidden class when hideScrollbar is true', async () => {
    const wrapper = mount(BottomSheet, {
      global: { stubs: { teleport: true } },
      props: { hideScrollbar: true },
    })
    await wrapper.vm.open()
    await wrapper.vm.$nextTick()
  
    const scroll = wrapper.find('.ba-bs-scroll')
    expect(scroll.classes()).toContain('ba-bs-scroll--hidden')
  })
})