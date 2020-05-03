<template lang="pug">
.modal(style="display: flex;")
  .modal-background
  .modal-card
    header.modal-card-head
      h2.modal-card-title Table settings
    .modal-card-body
      pre {{JSON.stringify(content, null ,2)}}
    footer.modal-card-foot
      .buttons
        button.button.is-warning(@click="save") Save
        button.button(@click="$emit('close')") Close
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from 'vue-property-decorator'
import dotProp from 'dot-prop'

import { IColumn } from '../assets/types'

@Component
export default class TableSettings extends Vue {
  @Prop({ required: true }) meta: any
  @Prop({ required: true }) tableMeta!: {
    column: IColumn[]
    index: {
      name: string
      unique: number
      info: {
        name: string
      }[]
    }[]
  }

  currentMeta: any = {}
  currentTableMeta!: {
    column: IColumn[]
    index: {
      name: string
      unique: number
      info: {
        name: string
      }[]
    }[]
  }

  get content () {
    return {
      meta: this.currentMeta,
      table: this.currentTableMeta
    }
  }

  created () {
    this.currentMeta = JSON.parse(JSON.stringify(this.meta))
    this.currentTableMeta = JSON.parse(JSON.stringify(this.tableMeta))
  }

  beforeDestroy () {
    this.$emit('close')
  }

  save () {
    this.$emit('save', this.content)
  }
}
</script>
