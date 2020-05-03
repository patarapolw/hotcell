<template lang="pug">
.modal(style="display: flex;")
  .modal-background
  .modal-card
    header.modal-card-head
      h2.modal-card-title Column settings
    .modal-card-body
      .columns
        .column.is-4
          label.label(for="name") Name
        .column.is-8
          b-field(
            :type="getInvalidMessage(validator.getIdentifierRules('column', content.column.name, true), dotProp.get(currentMeta, 'rename', content.column.name)) ? 'is-danger' : ''"
            :message="getInvalidMessage(validator.getIdentifierRules('column', content.column.name, true), dotProp.get(currentMeta, 'rename', content.column.name))"
          )
            b-input(
              name="name"
              :value="dotProp.get(currentMeta, 'rename', content.column.name)"
              @input="dotProp.set(currentMeta, 'rename', $event)"
            )
      .columns
        .column.is-4
          label.label(for="type") Type
        .column.is-8
          b-field
            b-select(
              name="type"
              :value="dotProp.get(currentMeta, 'type', xtype || validator.getType(name))"
              @input="dotProp.set(currentMeta, 'type', $event)"
            )
              option(value="TEXT") TEXT
              option(value="INTEGER") INTEGER
              option(value="REAL") REAL
              option(value="BLOB") BLOB
              option(value="date") date
              option(value="boolean") boolean
              option(value="jsonobject") jsonobject
              option(value="jsonarray") jsonarray
      .columns
        .column.is-4
          label.label(for="default") Default
        .column.is-8
          b-field(
            :type="getInvalidMessage(validator.getCellRules(content.column.name, xtype), dotProp.get(currentMeta, 'default', defaultValue)) ? 'is-danger' : ''"
            :message="getInvalidMessage(validator.getCellRules(content.column.name, xtype), dotProp.get(currentMeta, 'default', defaultValue))"
          )
            b-input(
              name="default"
              :value="dotProp.get(currentMeta, 'default', defaultValue)"
              @input="dotProp.set(currentMeta, 'default', $event)"
            )
      .columns
        .column.is-4
          label.label(for="notnull") Not NULL
        .column.is-8
          b-field
            b-switch(
              name="notnull"
              :value="dotProp.get(currentMeta, 'notnull', content.column.notnull === 1)"
              @input="dotProp.set(currentMeta, 'notnull', $event)"
            )
      .columns
        .column.is-4
          label.label(for="primary") Primary
        .column.is-8
          b-field
            b-switch(
              name="primary"
              :value="dotProp.get(currentMeta, 'pk', content.column.pk === 1)"
              @input="dotProp.set(currentMeta, 'pk', $event)"
            )
      .columns
        .column.is-4
          label.label(for="index") Indexing
        .column.is-8
          b-field
            b-radio(v-model="indexType" native-value="unique") Unique
            b-radio(v-model="indexType" native-value="index") Index
            b-radio(v-model="indexType" native-value="") None
      pre(v-if="isDevelopment") {{JSON.stringify(content, null, 2)}}
    footer.modal-card-foot
      .buttons
        button.button.is-warning(@click="save") Save
        button.button(@click="$emit('close')") Close
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from 'vue-property-decorator'
import dotProp from 'dot-prop'
import { remote } from 'electron'

import { IColumn } from '../assets/types'
import { Validator } from '../assets/validator'
import { Formatter } from '../assets/formatter'

@Component
export default class ColSettings extends Vue {
  @Prop({ required: true }) name!: string
  @Prop({ required: true }) meta: any
  @Prop({ required: true }) indexMeta: any
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
  currentIndexMeta: any = null

  dotProp = dotProp

  isDevelopment = remote.process.env.NODE_ENV !== 'production'

  get validator () {
    return new Validator([], this.tableMeta.column)
  }

  get formatter () {
    return new Formatter(this.tableMeta.column)
  }

  get xtype () {
    return dotProp.get<string>(this.currentMeta, 'type')
  }

  get defaultValue () {
    const v = this.formatter.getCellFormatter(this.content.column.name, this.xtype)(this.content.column.dflt_value)
    if (typeof v === 'undefined') {
      return null
    }

    return v
  }

  get indexType () {
    const { unique } = this.currentIndexMeta || {}
    if (typeof unique !== 'undefined') {
      return unique ? 'unique' : 'index'
    }

    const idx = this.content.index
    if (!idx) {
      return ''
    }
    return idx.unique ? 'unique' : 'index'
  }

  set indexType (type: string) {
    if (type) {
      this.currentIndexMeta = this.currentIndexMeta || {}
      this.currentIndexMeta.unique = type === 'unique'
    } else {
      this.currentIndexMeta = {}
    }
  }

  get content () {
    return {
      meta: this.currentMeta,
      column: this.tableMeta.column.filter((c) => {
        return c.name === this.name
      })[0],
      index: this.tableMeta.index.filter((idx) => {
        return idx.info.length === 1 && idx.info[0].name === this.name
      })[0]
    }
  }

  created () {
    this.currentMeta = JSON.parse(JSON.stringify(this.meta))
    this.currentIndexMeta = JSON.parse(JSON.stringify(this.indexMeta))
  }

  getInvalidMessage (rules: ((s: any) => string)[], value: any) {
    for (const r of rules) {
      const v = r(value)
      if (v) {
        return v
      }
    }

    return ''
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
}
</script>
