<template lang="pug">
.modal(style="display: flex;")
  .modal-background
  .modal-card
    header.modal-card-head
      h2.modal-card-title Table settings
    .modal-card-body
      .columns
        .column.is-4
          label.label(for="name") Name
        .column.is-8
          b-field(
            :type="getInvalidMessage(validator.getIdentifierRules('table', name, true), dotProp.get(currentMeta, 'rename', name)) ? 'is-danger' : ''"
            :message="getInvalidMessage(validator.getIdentifierRules('table', name, true), dotProp.get(currentMeta, 'rename', name))"
          )
            b-input(
              name="name"
              :value="dotProp.get(currentMeta, 'rename', name)"
              @input="dotProp.set(currentMeta, 'rename', $event)"
            )
      .columns
        .column
          label.label Compound Indexes
      .columns(v-for="[name, idx] in indexList" :key="name")
        .column.is-8
          b-taginput(
            :value="dotProp.get(currentIndexMeta, name + '.name', idx.name)"
            @input="dotProp.set(currentIndexMeta, name + '.name', $event)"
            :data="columns" autocomplete :allow-new="false" open-on-focus placeholder="Add a column"
          )
        .column.is-2
          label.label Unique
        .column.is-2
          b-switch(
            :value="dotProp.get(currentIndexMeta, name + '.unique', idx.unique !== 0)"
            @input="dotProp.set(currentIndexMeta, name + '.unique', $event)"
          )
      .columns
        .column.is-8
          b-taginput(
            v-model="newIndex.name"
            :data="columns" autocomplete :allow-new="false" open-on-focus placeholder="Add a column"
          )
        .column.is-2
          label.label Unique
        .column.is-2
          b-switch(v-model="newIndex.unique")
      pre(v-if="isDevelopment") {{JSON.stringify(content, null ,2)}}
    footer.modal-card-foot
      .buttons
        button.button.is-warning(@click="save") Save
        button.button(@click="$emit('close')") Close
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit, Watch } from 'vue-property-decorator'
import dotProp from 'dot-prop'
import { remote } from 'electron'

import { IColumn } from '../assets/types'
import { nanoid } from 'nanoid'
import { Validator } from '../assets/validator'
import { api } from '../assets/api'

@Component
export default class TableSettings extends Vue {
  @Prop({ required: true }) name!: string
  @Prop({ required: true }) tables!: string[]
  @Prop({ required: true }) meta: any
  @Prop({ required: true }) indexMeta: any

  tableMeta: {
    column: IColumn[]
    index: {
      name: string
      unique: number
      info: {
        name: string
      }[]
    }[]
  } = {
    column: [],
    index: []
  }

  currentMeta: any = {}
  currentIndexMeta: any = {}

  newIndex = {
    name: [] as string[],
    unique: false
  }

  dotProp = dotProp

  isDevelopment = remote.process.env.NODE_ENV !== 'production'

  get columns () {
    return this.tableMeta.column.map((c) => c.name)
  }

  get validator () {
    return new Validator(this.tables, this.tableMeta.column)
  }

  getInvalidMessage = Validator.getInvalidMessage

  get indexList () {
    const indexMap = new Map<string, any>()

    this.content.index.map((idx) => {
      indexMap.set(idx.name, {
        name: idx.info.map(({ name }) => name),
        unique: idx.unique
      })
    })

    Object.entries<any>(this.currentIndexMeta || {}).map(([k, idx]) => {
      indexMap.set(k, idx)
    })

    return Array.from(indexMap)
  }

  get content () {
    return {
      meta: this.currentMeta,
      index: this.tableMeta.index.filter((idx) => {
        return idx.info.length > 1
      })
    }
  }

  async created () {
    this.currentMeta = JSON.parse(JSON.stringify(this.meta))
    this.currentIndexMeta = JSON.parse(JSON.stringify(this.indexMeta))

    const r = await api.get('/api/table/info', {
      params: {
        table: this.name
      }
    })

    this.$set(this, 'tableMeta', r.data.meta)
  }

  beforeDestroy () {
    this.$emit('close')
  }

  save () {
    this.$emit('save', {
      meta: this.currentMeta,
      index: this.currentIndexMeta
    })
  }

  @Watch('newIndex.name', { deep: true })
  watchNewIndex () {
    if (this.newIndex.name.length > 0) {
      this.$set(this.currentIndexMeta, nanoid(), this.newIndex)
      this.$set(this, 'newIndex', {
        name: [],
        unique: false
      })
    }
  }
}
</script>
