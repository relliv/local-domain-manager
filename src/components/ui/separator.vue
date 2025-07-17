<template>
  <SeparatorRoot
    :class="cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      $attrs.class ?? ''
    )"
  />
</template>

<script setup lang="ts">
import { Separator as SeparatorRoot, type SeparatorProps as SeparatorRootProps } from 'radix-vue'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SeparatorRootProps>(), {
  orientation: 'horizontal',
})
</script>