# @balalarast/vue-bottom-sheet

Bottom Sheet component for Vue 3 and Nuxt 3 with drag support, multiple snap points, and dark mode.  
Built with [@oku-ui/motion](https://motion.oku-ui.com) for smooth and performant animations.

## Features

- Compatible with Vue 3 and Nuxt 3
- Smooth open and close animations powered by [@oku-ui/motion](https://motion.oku-ui.com)
- Support for multiple snap points (percentage and pixel values)
- Drag support with adjustable panel height
- Dark mode support
- Prevent pull-to-refresh on mobile devices
- Ability to use teleport for rendering in custom locations

## Install

```bash
npm install @balalarast/vue-bottom-sheet
# or
yarn add @balalarast/vue-bottom-sheet
```

## Usage in Vue 3

```ts
<script setup lang="ts">
import BottomSheet from '@balalarast/vue-bottom-sheet'
import { ref } from 'vue'

const sheetRef = ref(null)

function openSheet() {
  sheetRef.value?.open()
}
</script>

<template>
  <button @click="openSheet">Open Bottom Sheet</button>
  <BottomSheet ref="sheetRef" :overlay="true" :darkMode="false" />
</template>
```

## Usage in Nuxt 3

### 1. Registering the Component (in `plugins/bottom-sheet.client.ts`)

```ts
import { defineNuxtPlugin } from '#app'
import BottomSheet from '@balalarast/vue-bottom-sheet'

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.component('BottomSheet', BottomSheet)
})
```

### 2. Using in Components

```ts
<script setup lang="ts">
const sheetRef = ref(null)

function openSheet() {
  sheetRef.value?.open()
}
</script>

<template>
  <button @click="openSheet">Open Bottom Sheet</button>
  <BottomSheet ref="sheetRef" :overlay="true" />
</template>
```

## Props and Configuration
| Prop Name           | Type                         | Default                | Description                                  |
|---------------------|------------------------------|------------------------|----------------------------------------------|
| `darkMode`          | `boolean`                    | `false`                | Enables dark mode                            |
| `canSwipeClose`     | `boolean`                    | `true`                 | Allows closing the sheet by swiping down    |
| `snapPoints`        | `Array<number \| string>`    | `['30%', '60%', '90%']`| Snap points as percentage or pixels         |
| `initialSnapPoint`  | `number`                     | `0`                    | Initial snap point index                     |
| `overlay`           | `boolean`                    | `false`                | Shows a dark overlay behind the sheet       |
| `teleportTo`        | `string`                     | `'body'`               | Element selector for teleport rendering     |
| `containerClass`    | `string`                     | `''`                   | Additional class for the container           |
| `hideScrollbar`     | `boolean`                    | `false`                | Hides the scrollbar                          |
| `preventPullToRefresh`| `boolean`                  | `true`                 | Prevents pull-to-refresh on mobile devices  |
| `expandOnContentDrag`| `boolean`                   | `false`                | Allows height expansion when dragging content|
| `maxOvershootPercent`| `20 \| 40 \| 60 \| 80 \| 100`| `100`                 | Max overshoot percentage beyond snap points |
| `smoothFactor`      | `number`                     | `0.7`                  | Smoothing factor for height animation       |
| `springStiffness`   | `number`                     | `300`                  | Spring animation stiffness                   |
| `springDamping`     | `number`                     | `30`                   | Spring animation damping                      |

## Running Tests
The project uses Vitest for testing.

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm run test
```


### Running Tests in Watch Mode
```bash
npm run test:watch
```

### Running Tests with Graphical User Interface (UI)
```bash
npm run test:ui
```
Running this command will open the Vitest graphical interface in your browser, allowing you to manage tests interactively.
```
If you have any questions or need further assistance, I’m here to help!
```