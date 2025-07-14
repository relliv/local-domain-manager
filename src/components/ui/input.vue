<template>
  <input
    :class="cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      $attrs.class ?? ''
    )"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    v-bind="omit($attrs, ['class'])"
  />
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  modelValue?: string | number
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

// Helper to omit specific keys from attrs
const omit = (obj: Record<string, any>, keys: string[]) => {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}
</script>