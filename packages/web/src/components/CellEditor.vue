<template lang="pug">
.CellEditor(:style="{ 'justify-content': centered ? 'center' : '' }")
  .display(v-if="!isEditing"
    :class="marginless ? '' : 'has-margin'"
    role="button" @click="() => manual ? null : doEdit()"
  )
    span(v-if="placeholder") {{typeof value === 'undefined' ? placeholder : currentValue}}
    i(v-else-if="[null, undefined].includes(value)") NULL
    span(v-else) {{currentValue}}
    slot(name="after")
  .field(v-else v-clickoutside="onClickOutside")
    component.input(
      :is="type || 'input'"
      :class="invalidMessage ? 'is-danger' : ''"
      ref="input"
      :value="currentValue" @input="currentValue = $event.target.value"
      @keyup.enter="() => type !== 'textarea' ? onClickOutside() : null")
    p.help(
      v-if="invalidMessage"
      :class="invalidMessage ? 'is-danger' : ''"
    ) {{invalidMessage}}
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'vue-property-decorator'

@Component
export default class CellEditor extends Vue {
  @Prop() value?: string
  @Prop() placeholder?: string
  @Prop() type?: string
  @Prop({ default: () => [] }) rules!: ((value: string) => string)[]
  @Prop({ default: () => () => true }) beforeOpen!: () => boolean
  @Prop() manual?: boolean
  @Prop() marginless?: boolean
  @Prop() centered?: boolean

  isEditing = false
  wasEditing = false
  currentValue = ''

  get invalidMessage () {
    for (const r of this.rules) {
      const v = r(this.currentValue)
      if (v) {
        return v
      }
    }

    return ''
  }

  created () {
    this.onValueChange()
  }

  @Watch('value')
  onValueChange () {
    this.currentValue = this.value || ''
  }

  doEdit () {
    const r = this.beforeOpen()

    if (r) {
      this.isEditing = true
      this.wasEditing = false

      setTimeout(() => {
        this.wasEditing = true
      }, 100)
    }
  }

  @Watch('isEditing')
  onStartEditing () {
    if (this.isEditing) {
      const el = this.$el as any
      el.style.height = el.parentElement.clientHeight + 'px'

      this.$nextTick(() => {
        const input = this.$refs.input as any
        if (input) {
          input.value = this.currentValue
        }
      })
    } else {
      this.$nextTick(() => {
        this.currentValue = this.value || ''
      })
    }
  }

  onClickOutside () {
    if (this.wasEditing) {
      if (!this.invalidMessage) {
        this.isEditing = false
        this.$emit('finish-editing', this.currentValue)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.CellEditor {
  display: flex;
  align-items: center;
  margin: 0 !important;
  padding: 0;
  width: 100%;
  height: 100%;

  .field, input, textarea {
    width: 100%;
    height: 100%;
  }

  .display.has-margin {
    padding: 0.5em;
    min-width: 1em;
    min-height: 1em;
    max-width: 300px;
    max-height: 200px;
    overflow: scroll;

    cursor: pointer;

    &:hover {
      color: blue;
    }
  }
}
</style>
