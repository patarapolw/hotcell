<template lang="pug">
section.min-1em
  .min-1em(v-show="!isEditing" role="button" @click="isEditing = true") {{value || placeholder}}
  b-input(v-show="isEditing" :type="type" v-model="currentValue" v-clickoutside="onClickOutside")
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component
export default class CellEditor extends Vue {
  @Prop() value?: string
  @Prop() placeholder?: string
  @Prop() type?: string

  isEditing = false
  currentValue = ''

  created () {
    this.currentValue = this.value || ''
  }

  onClickOutside () {
    setTimeout(() => {
      if (this.isEditing) {
        this.isEditing = false
        this.$emit('finish-editing', this.currentValue)
      }
    }, 100)
  }
}
</script>

<style lang="scss" scoped>
.min-1em {
  min-width: 1em;
  min-height: 1em;
}
</style>
