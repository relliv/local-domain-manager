<template>
  <DropdownMenuRoot v-bind="forwarded">
    <slot />
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { useForwardPropsEmits } from 'radix-vue'
import { DropdownMenuRoot, type DropdownMenuRootEmits, type DropdownMenuRootProps } from 'radix-vue'

const props = defineProps<DropdownMenuRootProps>()
const emits = defineEmits<DropdownMenuRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>