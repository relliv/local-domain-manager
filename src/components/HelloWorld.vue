<script setup lang="ts">
import { ref } from "vue";
import Button from '@/components/ui/button.vue'

defineProps<{ msg: string }>();

const count = ref(0);
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <div class="flex gap-4 justify-center mb-4">
      <Button @click="count++">
        count is {{ count }}
      </Button>
      <Button variant="secondary" @click="count = 0">
        Reset
      </Button>
      <Button variant="outline" size="sm">
        Small
      </Button>
      <Button variant="destructive" size="icon">
        X
      </Button>
    </div>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <p class="mb-4">
    Check out
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
      >create-vue</a
    >, the official Vue + Vite starter
  </p>
  <p class="mb-4">
    Install
    <a href="https://github.com/johnsoncodehk/volar" target="_blank">Volar</a>
    in your IDE for a better DX
  </p>
  <p class="read-the-docs mb-4">
    Click on the Vite and Vue logos to learn more
  </p>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>