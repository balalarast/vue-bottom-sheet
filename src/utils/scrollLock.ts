let lockCount = 0

export function lockBodyScroll() {
  lockCount++
  if (lockCount === 1) {
    document.documentElement.classList.add('ba-lock')
    document.body.classList.add('ba-lock')
  }
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.documentElement.classList.remove('ba-lock')
    document.body.classList.remove('ba-lock')
  }
}
