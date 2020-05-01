<template lang="pug">
#App.container
  .tabs.is-boxed
    ul(style="flex-grow: 1;")
      li(v-for="t in tables.filter(t => t.startsWith('__'))" :class="t === tableName ? 'is-active' : ''"
        @contextmenu.prevent="(evt) => { selectedTable = t; $refs.tableContext.open(evt) }")
        a(role="button" @click="beforeChangeTable() && tableName = t")
          CellEditor(placeholder="+" @finish-editing="addTable($event)" type="input"
            :rules="getIdentifierRules('table')" :before-open="() => beforeChangeTable()")
      li
        a(role="button")
          CellEditor(placeholder="+" @finish-editing="addTable($event)" type="input"
            :rules="getIdentifierRules('table')" :before-open="() => beforeChangeTable()")
  .nav-right(style="display: flex; flex-direction: row; justify-content: center;")
    div(style="flex-grow: 1;")
    .buttons
      button.button.is-outlined(
        :class="Object.keys(editList).length === 0 ? '' : 'is-success'"
        :disabled="Object.keys(editList).length === 0"
        @click="commit"
      )
        fontawesome(icon="check")
      button.button.is-outlined(
        :class="Object.keys(editList).length === 0 ? '' : 'is-danger'"
        :disabled="Object.keys(editList).length === 0"
        @click="clear"
      )
        fontawesome(icon="times")
    form.field
      .control.has-icons-left
        input.input(name="q")
        span.icon.is-small.is-left
          fontawesome(icon="search")
    b-tooltip.center-vh(label="Please visit https://github.com/patarapolw/qsearch on how to search"
      type="is-white" position="is-left" multilined)
      fontawesome(icon="question" style="color: #ccc;")
  .table-container
    table.table.is-striped.is-hoverable.is-bordered
      thead
        tr
          th(v-for="c in columns.filter(c => c.field[0] !== '_')" :key="c.field")
            .padded(v-if="c.type === 'primary'" style="text-align: right;") {{c.field}}
            div(v-else @contextmenu.prevent="(evt) => { selectedField = c.field; $refs.colContext.open(evt) }")
              CellEditor(v-model="c.field" @finish-editing="renameCol($event, c.field)" type="input"
                :rules="getIdentifierRules('column', c.field)"
                style="text-align: center;")
          th
            CellEditor(placeholder="+" @finish-editing="addCol($event)" type="input"
              :rules="getIdentifierRules('column')")
      tbody
        tr(v-for="d in data" :key="d.__id")
          th(v-for="c in columns.filter(c => c.type === 'primary')" :key="c.field"
            @contextmenu.prevent="(evt) => { selectedRow = d; $refs.rowContext.open(evt) }"
          )
            .padded {{d[c.field]}}
          td(v-for="c in columns.filter(c => c.type !== 'primary')" :key="c.field"
            @contextmenu.prevent="(evt) => { selectedRow = d; selectedField = c.field; $refs.cellContext.open(evt) }"
          )
            CellEditor(v-model="d[c.field]"
              @finish-editing="onFinishEdit(d, c.field, $event)"
              type="textarea"
              :placeholder="d.__id ? '' : ' '"
            )
          td
            div
  b-pagination(:total="count" :current.sync="page")
  .modal(:style="{ display: isCommitFirstModal ? 'flex' : 'none'}")
    .modal-background
    .modal-card(style="border-radius: 6px;")
      b-message(type="is-warning" has-icon style="margin-bottom: 0;") Do you want to commit first?
      footer.modal-card-foot
        button.button.is-success(@click="commit(); isCommitFirstModal = false") Commit
        button.button.is-warning(@click="clear(); isCommitFirstModal = false") Do not commit
        button.button(@click="isCommitFirstModal = false") Cancel
  contextmenu(ref="tableContext")
    li
      a(role="button" @click="openSettingsTable") Settings
    li
      a(role="button" @click="renameTable") Rename
    li
      a(role="button" @click="deleteTable") Delete
  contextmenu(ref="colContext")
    li
      a(role="button" @click="openSettingsCol") Settings
    li
      a(role="button" @click="deleteCol") Delete
  contextmenu(ref="rowContext")
    li
      a(role="button" @click="deleteRow") Delete
  contextmenu(ref="cellContext")
    li
      a(role="button" @click="setNull") Set NULL
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { nanoid } from 'nanoid'
import dotProp from 'dot-prop'
import dayjs from 'dayjs'

import CellEditor from './components/CellEditor.vue'

@Component({
  components: {
    CellEditor
  }
})
export default class App extends Vue {
  data: any[] = []
  columns: any[] = []

  count = 0
  perPage = 10
  page = 1

  tableName = 'default'
  newTableName = ''
  selectedTable = ''
  tables: string[] = []

  selectedField = ''
  selectedRow: any = {}

  editList: any = {}

  isCommitFirstModal = false

  created () {
    this.init()
  }

  getIdentifierRules (type: string, existing?: string) {
    return [
      ...(type === 'column' ? [
        (v: string) => (v !== existing && this.columns.map(c0 => c0.field).includes(v)) ? 'Duplicate column name' : ''
      ] : [
        (v: string) => (v !== existing && this.tables.includes(v)) ? 'Duplicate table name' : ''
      ]),
      (v: string) => (!v || /^[A-Z][A-Z0-9]*$/i.test(v)) ? '' : `Invalid ${type} name`,
      (v: string) => (!v || v.startsWith('__')) ? '' : `Invalid ${type} name`
    ]
  }

  getCellRules (type: string) {
    if (type === 'INTEGER') {
      return [
        (v: string) => (!v || /^-?\d+$/.test(v)) ? '' : `Not ${type}`
      ]
    } else if (type === 'REAL') {
      return [
        (v: string) => (!v || [
          /^-?\d*\.\d+$/,
          /^-?\d*\.\d+e-?\d+$/
        ].some(r => r.test(v))) ? '' : `Not ${type}`
      ]
    } else if (type === 'date') {
      return [
        (v: string) => (!v || /^-?\d+$/.test(v)) ? '' : `Not ${type}`,
        (v: string) => (!v || dayjs(v).isValid()) ? '' : `Not ${type}`
      ]
    } else if (type === 'json') {
      return [
        (v: string) => {
          if (!v) {
            return ''
          }

          try {
            JSON.parse(v)
          } catch (_) {
            return `Not ${type}`
          }

          return ''
        }
      ]
    }

    return []
  }

  async init () {
    if (!this.tables.includes(this.tableName)) {
      this.tables = [...this.tables, this.tableName]
    }

    this.page = 1
    this.data = []

    this.$nextTick(async () => {
      this.data = []
      this.columns = [
        {
          field: 'ROWID',
          type: 'primary'
        }
      ]
      this.addRow()
    })
  }

  addTable (name: string) {
    if (!name.trim()) {
      return
    }

    this.newTableName = ''
    this.tableName = name
  }

  renameTable () {}

  deleteTable () {
    this.tables = this.tables.filter(t => t === this.selectedTable)
  }

  openSettingsTable () {}

  beforeChangeTable () {
    if (Object.keys(this.editList).length > 0) {
      this.newTableName = name
      this.isCommitFirstModal = true

      return false
    }

    this.newTableName = ''
    this.onTableChange()

    return true
  }

  @Watch('tableName')
  onTableChange () {
    if (!this.tables.includes(this.tableName)) {
      this.tables = [...this.tables, this.tableName]
    }

    this.init()
  }

  @Watch('page')
  addRow () {
    this.data.unshift({})
    this.$set(this, 'data', this.data)
  }

  deleteRow () {
    this.data = this.data.filter(d => {
      return d.__id !== this.selectedRow.__id
    })
  }

  addCol (name: string) {
    if (!name.trim()) {
      return
    }

    this.columns = [
      ...this.columns,
      { field: name }
    ]

    dotProp.set(this.editList, 'alter.addCol', { field: name })
    this.$set(this, 'editList', this.editList)
  }

  renameCol (name: string, oldName: string) {
    if (!name.trim()) {
      return
    }

    this.columns = this.columns.map(c => {
      if (c.field === oldName) {
        c.field = name
      }

      return c
    })

    this.data = this.data.map(d => {
      const d1: any = {}
      Object.entries(d).map(([k, v]) => {
        if (k === oldName) {
          d1[name] = v
        } else {
          d1[k] = v
        }
      })
      return d1
    })
  }

  deleteCol () {
    this.data = this.data.map(d => {
      const d1: any = {}
      Object.entries(d).map(([k, v]) => {
        if (k !== this.selectedField) {
          d1[k] = v
        }
      })

      return d1
    })

    this.columns = this.columns.filter(c => c.field !== this.selectedField)
  }

  openSettingsCol () {}

  setNull () {
    this.data = this.data.map(d => {
      if (d.__id === this.selectedRow.__id) {
        Object.entries(d).map(([k, v]) => {
          if (k === this.selectedField) {
            d[k] = null
          }
        })
        d.__id = nanoid()
      }

      return d
    })
  }

  onFinishEdit (row: any, field: string, data: string) {
    if (!row.__id) {
      if (data.trim()) {
        row.__id = nanoid()
        row[field] = data

        dotProp.set(this.editList, `insert.${row.__id}.${field}`, data)
        this.$set(this, 'editList', this.editList)

        this.data = [
          {},
          ...this.data
        ]
        this.$set(this, 'data', this.data)
      }
    } else {
      dotProp.set(this.editList, `update.${row.__id}.${field}`, data)
      this.$set(this, 'editList', this.editList)
      this.$set(this, 'data', this.data.map(d => {
        if (d.__id === row.__id) {
          d[field] = data
        }

        return d
      }))
    }
  }

  commit () {
    this.clear()
  }

  clear () {
    this.$set(this, 'editList', {})
    this.init()
  }
}
</script>

<style lang="scss">
body {
  min-width: 100vw;
  min-height: 100vh;
}

#App {
  padding-top: 1em;

  .is-boxed li {
    margin-bottom: -0.5em;
  }

  table.table {
    th, td {
      padding: 0;

      > .padded {
        margin: 0.5em;
        min-height: 1em;
        min-width: 2em;
      }
    }

    th {
      background-color: rgba(238, 238, 238, 0.5);
    }
  }
}

[role="button"] {
  cursor: pointer;
}

.nav-right {
  margin-bottom: 1em;

  * {
    margin-bottom: 0 !important;
  }

  > * + * {
    margin-left: 0.5em;
  }

  .center-vh {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>
