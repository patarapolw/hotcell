<template lang="pug">
#App.container
  .tabs.is-boxed
    ul(style="flex-grow: 1;")
      li(v-for="t in tables.filter(t => !t.startsWith('__'))" :class="t === tableName ? 'is-active' : ''"
        @contextmenu.prevent="(evt) => { selectedTable = t; $refs.tableContext.open(evt) }")
        a(role="button" @click="changeTable(t)")
          CellEditor(:value="t" @finish-editing="renameTable($event, t)" type="input"
            :rules="getIdentifierRules('table', t)" :before-open="() => checkCommit()"
            :manual="true" :marginless="true" :ref="'table.' + t")
      li
        a(role="button")
          CellEditor(placeholder="+" @finish-editing="addTable($event)" type="input"
            :rules="getIdentifierRules('table')" :before-open="() => checkCommit()")
  nav.nav
    div(style="width: 600px;")
      .file.has-name.is-fullwidth(@click="openFile" @contextmenu.prevent="$refs.fileContext.open")
        label.file-label
          span.file-cta
            span.file-label Filename:
          span.file-name {{filepath || 'New file'}}
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
    .row-align
      .field(style="flex-grow: 1;")
        .control.has-icons-left
          input.input(v-model="qTmp" @keydown.enter="q = qTmp")
          span.icon.is-small.is-left
            fontawesome(icon="search")
      b-tooltip.center-vh(label="Please visit https://github.com/patarapolw/qsearch on how to search"
        type="is-white" position="is-left" multilined)
        fontawesome(icon="question" style="color: #ccc;")
  .table-container
    table.table.is-striped.is-hoverable.is-bordered
      thead
        tr
          th(v-for="c in tableMeta.column.filter(c => !c.name.startsWith('__'))" :key="c.name")
            .padded(v-if="c.pk" style="text-align: right;") {{c.name}}
            div(v-else @contextmenu.prevent="(evt) => { selectedField = c.name; $refs.colContext.open(evt) }")
              CellEditor(v-model="c.name" @finish-editing="renameCol($event, c.name)" type="input"
                :rules="getIdentifierRules('column', c.name)"
                :centered="true")
                template(v-slot:after)
                  fontawesome.sorter(v-if="sort[0] === c.name" icon="caret-down")
                  fontawesome.sorter(v-else-if="sort[0] === '-' + c.name" icon="caret-up")
                  fontawesome.sorter.secondary(v-else-if="sort.includes(c.name)" icon="caret-down")
                  fontawesome.sorter.secondary(v-else-if="sort.includes('-' + c.name)" icon="caret-up")
          th
            CellEditor(placeholder="+" @finish-editing="addCol($event)" type="input"
              :rules="getIdentifierRules('column')")
      tbody
        tr(v-for="d in data" :key="d.__id")
          th(v-for="c in columns.filter(c => c.pk)" :key="c.name"
            @contextmenu.prevent="(evt) => { if(d.__id) { selectedRow = d; $refs.rowContext.open(evt) }}"
          )
            .padded(v-if="c.name === 'ROWID'") {{d[c.name]}}
            CellEditor(v-model="d[c.name]"
              @finish-editing="onFinishEdit(d, c.name, $event)"
              type="textarea"
              :placeholder="d.__id ? '' : ' '"
              :rules="getCellRules(c.name)"
              :formatter="getCellFormatter(c.name)"
            )
          td(v-for="c in columns.filter(c => !c.pk)" :key="c.name"
            @contextmenu.prevent="(evt) => { selectedRow = d; selectedField = c.name; $refs.cellContext.open(evt) }"
          )
            CellEditor(v-model="d[c.name]"
              @finish-editing="onFinishEdit(d, c.name, $event)"
              type="textarea"
              :placeholder="d.__id ? '' : ' '"
              :rules="getCellRules(c.name)"
              :formatter="getCellFormatter(c.name)"
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
  .modal(:style="{ display: isTableSettingsModal ? 'flex' : 'none'}")
    .modal-background
    .modal-card
      header.modal-card-head
        h2.modal-card-title Table settings
      .modal-card-body(style="height: 100px;")
      footer.modal-card-foot
        button.button(@click="isTableSettingsModal = false") Close
  .modal(:style="{ display: isColSettingsModal ? 'flex' : 'none'}")
    .modal-background
    .modal-card
      header.modal-card-head
        h2.modal-card-title Column settings
      .modal-card-body(style="height: 100px;")
      footer.modal-card-foot
        button.button(@click="isColSettingsModal = false") Close
  contextmenu(ref="fileContext")
    li
      a(role="button" @click="filepath = ''") Create new file
    li
      a(role="button" @click="init()") Reload
  contextmenu(ref="tableContext")
    li
      a(role="button" @click="isTableSettingsModal = true") Settings
    li
      a(role="button" @click="normalizeArray($refs['table.' + selectedTable]).doEdit()") Rename
    li
      a(role="button" @click="deleteTable") Delete
  contextmenu(ref="colContext")
    li.v-context__sub
      a Sort
      ul.v-context
        li
          a(role="button" @click="sort = [selectedField]") Sort ascending
        li
          a(role="button" @click="sort = ['-' + selectedField]") Sort descending
        li
          a(role="button" @click="sort.push(selectedField)") Sort ascending secondarily
        li
          a(role="button" @click="sort.push('-' + selectedField)") Sort descending secondarily
    li.v-context__sub
      a Data type
      ul.v-context
        li
          a(
            role="button"
            @click="fieldType = 'TEXT'"
            v-if="fieldType !== 'TEXT'"
          ) TEXT
        li
          a(
            role="button"
            @click="fieldType = 'INTEGER'"
            v-if="fieldType !== 'INTEGER'"
          ) INTEGER
        li
          a(
            role="button"
            @click="fieldType = 'REAL'"
            v-if="fieldType !== 'REAL'"
          ) REAL
        li
          a(
            role="button"
            @click="fieldType = 'BLOB'"
            v-if="fieldType !== 'BLOB'"
          ) BLOB
        li
          a(
            role="button"
            @click="fieldType = 'date'"
            v-if="fieldType !== 'date'"
          ) date
        li
          a(
            role="button"
            @click="fieldType = 'json'"
            v-if="fieldType !== 'json'"
          ) json
        li
          a(
            role="button"
            @click="fieldType = 'boolean'"
            v-if="fieldType !== 'boolean'"
          ) boolean
    li(v-if="selectedUnique !== null")
      a(
        role="button"
        @click="selectedUnique = false"
        v-if="!selectedUnique"
      ) Set as UNIQUE
      a(
        role="button"
        @click="selectedUnique = true"
        v-else
      ) Unset UNIQUE
    li
      a(role="button" v-if="!selectedPK" @click="selectedPK = true") Set as PRIMARY KEY
      a(role="button" v-else @click="selectedPK = false") Unset PRIMARY KEY
    li
      a(role="button" @click="isColSettingsModal = true") Settings
    li
      a(role="button" @click="deleteCol") Delete
  contextmenu(ref="rowContext")
    li
      a(role="button" @click="deleteRow") Delete
  contextmenu(ref="cellContext")
    li
      a(role="button" @click="setNull") Set NULL
  b-loading(:active.sync="isLoading")
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { nanoid } from 'nanoid'
import dotProp from 'dot-prop'
import dayjs from 'dayjs'

import CellEditor from './components/CellEditor.vue'
import { normalizeArray } from './assets/util'
import { api } from './assets/api'

interface IColumn {
  name: string
  type: string
  dflt_value: any
  notnull: number
  pk: number
  xtype?: string
}

@Component({
  components: {
    CellEditor
  }
})
export default class App extends Vue {
  data: any[] = []
  isLoading = false

  count = 0
  perPage = 10
  page = 1
  sort: string[] = []

  tableName = 'default'
  dbMeta: any = {}
  tableMeta = {
    column: [] as IColumn[],
    index: [] as {
      name: string
      unique: number
      info: {
        name: string
      }[]
    }[]
  }

  tables: string[] = ['default']

  selectedTable = ''
  selectedField = ''
  selectedRow: any = {}

  editList: any = {}

  isCommitFirstModal = false
  afterCommitFn: (() => void) | null = null

  isTableSettingsModal = false
  isColSettingsModal = false

  q = ''
  qTmp = ''

  dotProp = dotProp
  normalizeArray = normalizeArray

  filepath = ''

  get columns (): IColumn[] {
    return this.tableMeta.column
  }

  get selectedUnique (): boolean | null {
    let unique: boolean | null = false

    const index = this.tableMeta.index

    index
      .filter((idx) => idx.unique)
      .map((idx) => idx.info.map((info: any) => info.name))
      .map((names: string[]) => {
        if (typeof unique === 'boolean' && names.includes(this.selectedField)) {
          if (names.length > 1) {
            unique = null
          } else {
            unique = true
          }
        }
      })

    return unique
  }

  set selectedUnique (type: boolean | null) {
    let index = this.tableMeta.index

    if (type) {
      index.push({
        name: `${this.selectedField}_unique_idx`,
        unique: 1,
        info: [{
          name: this.selectedField
        }]
      })

      dotProp.set(this.editList, `createIndex.${this.selectedField}_unique_idx`, {
        name: [this.selectedField],
        unique: true
      })
    } else {
      index = index
        .filter((idx) => {
          if (idx.info[0].name === this.selectedField) {
            dotProp.set(this.editList, `dropIndex.${idx.name}`, true)

            return false
          }

          return true
        })
    }

    this.$set(this.tableMeta, 'index', index)
    this.$set(this, 'editList', this.editList)
  }

  get selectedPK () {
    const c = this.tableMeta.column.filter((c) => c.name === this.selectedField && c.pk)[0]
    return !!c
  }

  set selectedPK (type: boolean) {
    const column = this.tableMeta.column
    column.map((c: any) => {
      if (c.name === this.selectedField) {
        c.pk = type ? 1 : 0
        dotProp.set(this.editList, `replaceTable.pk.${this.selectedField}`, type)
      }
    })

    this.$set(this.tableMeta, 'column', column)
    this.$set(this, 'editList', this.editList)
  }

  get fieldType () {
    const c = (this.tableMeta.column || []).filter(c => c.name === this.selectedField)[0]
    if (!c) {
      return ''
    }

    const xtype = dotProp.get<string>(this.dbMeta, `${this.tableName}.col.${this.selectedField}.type`)
    return xtype || c.type
  }

  set fieldType (xtype: string) {
    let type = xtype

    if (type === xtype.toLocaleLowerCase()) {
      if (type === 'boolean') {
        type = 'INTEGER'
      } else if (type === 'date') {
        type = 'INTEGER'
      } else {
        type = 'TEXT'
      }
    }

    dotProp.set(this.editList, `replaceTable.col.${this.selectedField}.type`, type)
    dotProp.set(this.dbMeta, `${this.tableName}.col.${this.selectedField}.type`, xtype)

    this.$set(this, 'editList', this.editList)
  }

  created () {
    this.init()
  }

  getIdentifierRules (type: string, existing?: string) {
    return [
      ...(type === 'column' ? [
        (v: string) => (v !== existing && this.columns.map(c0 => c0.name).includes(v)) ? 'Duplicate column name' : ''
      ] : [
        (v: string) => (v !== existing && this.tables.includes(v)) ? 'Duplicate table name' : ''
      ]),
      (v: string) => (!v || /^[A-Z_][A-Z0-9_$]*$/i.test(v)) ? '' : `Invalid ${type} name`,
      (v: string) => (/[A-Z]/.test(v)) ? 'Lowercase is preferred' : '',
      (v: string) => (v && v.startsWith('__')) ? `Invalid ${type} name` : ''
    ]
  }

  getCellRules (field: string) {
    const c = this.tableMeta.column.filter(c => c.name === field)[0]
    if (!c) {
      return []
    }

    const rules: ((v: string) => string)[] = []

    const xtype = dotProp.get<string>(this.dbMeta, `${this.tableName}.col.${field}.type`)
    const type = xtype || c.type

    /**
     * https://www.sqlite.org/datatype3.html
     *
     * 3.1. Determination Of Column Affinity
     */
    if (type.includes('INT')) {
      rules.push((v) => (!v || /^-?\d+$/.test(v)) ? '' : `Not ${type}`)
    } else if (['CHAR', 'CLOB', 'TEXT'].some(t => type.includes(t))) {
    } else if (type.includes('BLOB')) {
    } else if (['REAL', 'FLOA', 'DOUB'].some(t => type.includes(t))) {
      rules.push((v) => (!v || /^-?\d*(\.\d+)?(e-?\d+)?$/.test(v)) ? '' : `Not ${type}`)
    } else if (type === 'boolean') {
      rules.push((v) => (!v || v === '0' || v === '1') ? '' : `Not ${type}`)
    } else if (type === 'date') {
      rules.push(
        (v) => (!v || /^-?\d*(\.\d+)?(e-?\d+)?$/.test(v)) ? '' : `Not ${type}`,
        (v) => (!v || dayjs(v).isValid()) ? '' : `Not ${type}`
      )
    } else if (type === 'json') {
      rules.push(
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
      )
    }

    if (c.notnull && type !== 'TEXT') {
      rules.push(
        (v) => v ? '' : 'NULL is not allowed'
      )
    }

    return rules
  }

  getCellFormatter (field: string) {
    const c = this.tableMeta.column.filter(c => c.name === field)[0]
    const xtype = dotProp.get<string>(this.dbMeta, `${this.tableName}.col.${field}.type`)
    const type = xtype || (c || {}).type

    if (type === 'json') {
      return (s: any) => s ? JSON.stringify(s) : null
    } else if (type === 'date') {
      return (s: any) => s ? dayjs(s).toISOString() : null
    } else if (type === 'boolean') {
      return (s: any) => s ? s === '0' ? 'FALSE' : 'TRUE' : null
    } else if (['REAL', 'FLOA', 'DOUB'].some(t => type.includes(t))) {
      return (s: any) => {
        if (s || s === 0) {
          const f = parseFloat(s)
          const sign = Math.sign(f)

          if (sign === 0) {
            return '0'
          }

          const [ch, man] = f.toExponential().split('e')
          if (parseInt(man) < 1) {
            if (ch.length > 4) {
              return f.toPrecision(3)
            }
            return s
          }

          return (+f.toFixed(3)).toString()
        }

        return null
      }
    } else if (!['CHAR', 'CLOB', 'TEXT'].some(t => type.includes(t))) {
      return (s: any) => s || null
    }

    return (s: any) => s
  }

  @Watch('q')
  @Watch('filepath')
  async init () {
    this.page = 1
    this.data = []

    if (this.filepath) {
      this.isLoading = true

      const r = await api.put('/api/file/open', {}, {
        params: {
          path: this.filepath
        }
      })

      this.tables = r.data.tables
      this.tableName = r.data.tables[0]
      this.$set(this, 'dbMeta', r.data.meta)

      this.isLoading = false
    } else {
      this.tables = ['default']
      this.tableName = 'default'
      this.dbMeta = {}
    }

    this.page = 1
    this.sort = []

    this.onPageChange()
  }

  @Watch('sort', { deep: true })
  async onSort () {
    this.page = 1
    await this.onPageChange()
  }

  @Watch('page')
  async onPageChange () {
    if (this.filepath) {
      this.isLoading = true

      const r = await api.post('/api/table/q', {
        table: this.tableName,
        q: this.q,
        offset: (this.page - 1) * this.perPage,
        limit: this.perPage,
        sort: this.sort
      })
      const { result, count, meta } = r.data
      this.$set(this, 'tableMeta', r.data.meta)

      this.count = count
      this.data = result.map((r: any) => {
        r.__id = nanoid()
        return r
      })

      this.addRow()

      this.isLoading = false
    } else {
      this.$nextTick(() => {
        this.page = 1
        this.count = 0
        this.data = []
        this.tableMeta.column = [
          {
            name: 'ROWID',
            type: 'INTEGER',
            dflt_value: null,
            pk: 1,
            notnull: 0
          }
        ]
        this.tableMeta.index = []

        this.addRow()
      })
    }
  }

  addTable (name: string) {
    if (!name.trim()) {
      return
    }

    this.checkCommit(() => {
      this.tableName = name
    })
  }

  changeTable (name: string) {
    this.checkCommit(() => {
      this.tableName = name
    })
  }

  renameTable (newName: string, oldName: string) {
    if (this.tableName === oldName) {
      this.checkCommit(() => {
        this.tables = this.tables.map(t => t === oldName ? newName : t)
        this.tableName = newName
      })
    } else {
      this.tables = this.tables.map(t => t === oldName ? newName : t)
    }
  }

  async deleteTable () {
    this.$buefy.dialog.confirm({
      message: `Are you sure you want to delete table: ${this.selectedTable}?`,
      type: 'is-danger',
      hasIcon: true,
      onConfirm: () => {
        this.tables = this.tables.filter(t => t !== this.selectedTable)

        if (this.selectedTable === this.tableName) {
          this.tableName = this.tables[0]
        }
      }
    })
  }

  checkCommit (cb?: () => void) {
    if (Object.keys(this.editList).length > 0) {
      this.afterCommitFn = cb || null
      this.isCommitFirstModal = true

      return false
    }

    if (cb) {
      cb()
    }

    return true
  }

  @Watch('tableName')
  onTableChange () {
    if (!this.tables.includes(this.tableName)) {
      this.tables = [...this.tables, this.tableName]
    }

    this.page = 1
    this.sort = []
    this.onPageChange()
  }

  addRow () {
    this.data = [
      {},
      ...this.data
    ]
  }

  async deleteRow () {
    this.$buefy.dialog.confirm({
      message: 'Are you sure you want to delete this row?',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: () => {
        this.data = this.data.filter(d => {
          return d.__id !== this.selectedRow.__id
        })
      }
    })
  }

  addCol (name: string) {
    if (!name.trim()) {
      return
    }

    this.tableMeta.column = [
      ...this.columns,
      {
        name,
        type: 'TEXT',
        dflt_value: null,
        pk: 0,
        notnull: 0
      }
    ]

    dotProp.set(this.editList, 'alter.addCol', { field: name })
    this.$set(this, 'editList', this.editList)
  }

  renameCol (name: string, oldName: string) {
    if (!name.trim()) {
      return
    }

    this.tableMeta.column = this.columns.map(c => {
      if (c.name === oldName) {
        c.name = name
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

  async deleteCol () {
    this.$buefy.dialog.confirm({
      message: `Are you sure you want to delete column: ${this.selectedField}?`,
      type: 'is-danger',
      hasIcon: true,
      onConfirm: () => {
        this.data = this.data.map(d => {
          const d1: any = {}
          Object.entries(d).map(([k, v]) => {
            if (k !== this.selectedField) {
              d1[k] = v
            }
          })

          return d1
        })

        this.tableMeta.column = this.columns.filter(c => c.name !== this.selectedField)
      }
    })
  }

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
    } else if (row[field] !== data) {
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

  openFile () {
    this.checkCommit(async () => {
      const { remote } = await import('electron')
      const r = await remote.dialog.showOpenDialog({
        filters: [
          { name: 'SQLite database', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      this.filepath = (r.filePaths || [])[0] || ''
    })
  }
}
</script>

<style lang="scss">
body {
  min-width: 100vw;
  min-height: 100vh;
}

#App {
  .nav {
    margin-bottom: 1em;
    display: flex;
    flex-direction: row;
    justify-content: center;

    @media all and (max-width: 600px) {
      flex-direction: column;

      > * + * {
        margin-top: 0.5em;
      }
    }

    @media not all and (max-width: 600px) {
      > * + * {
        margin-left: 0.5em;
      }
    }

    * {
      margin-bottom: 0 !important;
    }

    .buttons {
      white-space: nowrap;
      display: block;
      align-self: center;
    }

    .row-align {
      display: flex;
      flex-direction: row;
      justify-content: center;
      word-break: keep-all;

      > * + * {
        margin-left: 0.5em;
      }
    }

    .center-vh {
      display: flex;
      justify-content: center;
      align-items: center;
    }
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

      .sorter {
        margin-left: 0.5em;

        &.secondary {
          color: lightgray;
        }
      }
    }
  }
}

[role="button"] {
  cursor: pointer;
}

.v-context__sub > a:after {
  content: "▶" !important;
}
</style>
