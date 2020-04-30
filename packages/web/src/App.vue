<template lang="pug">
#App
  b-table(:data="data" sticky-header :height="tableHeight"
      paginated :per-page="perPage" :current-page.sync="page")
    template(slot-scope="props")
      b-table-column(v-for="c in columns" :key="c.field" :field="c.field" :label="c.field")
        span(v-if="c.field === '_id'") {{props.row[c.field]}}
        CellEditor(v-else v-model="props.row[c.field]" @finish-editing="onFinishEdit(props.row, c.field, $event)"
          type="textarea")
      b-table-column
        template(slot="header")
          CellEditor(placeholder="+" @finish-editing="addColumn($event)" type="input")
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { nanoid } from 'nanoid'

import CellEditor from './components/CellEditor.vue'

@Component({
  components: {
    CellEditor
  }
})
export default class App extends Vue {
  data: any[] = []
  columns = [
    {
      field: '_id'
    }
  ]

  tableHeight = window.innerHeight
  perPage = 10
  page = 1

  created () {
    this.data.push({})
    this.$set(this, 'data', this.data)

    window.addEventListener('resize', this.onWindowResize)
  }

  beforeDestroy () {
    window.removeEventListener('resize', this.onWindowResize)
  }

  onWindowResize () {
    this.tableHeight = window.innerHeight
  }

  addColumn (name: string) {
    this.columns = [
      ...this.columns,
      { field: name }
    ]
    this.$forceUpdate()
  }

  onFinishEdit (row: any, field: string, data: string) {
    if (Object.keys(row).length === 0 && data.trim()) {
      this.$set(row, '_id', nanoid())
      this.data = [
        ...this.data,
        {}
      ]
    }

    this.$set(row, field, data)
  }
}
</script>

<style lang="scss">
#App {
  width: fit-content;
}
</style>
