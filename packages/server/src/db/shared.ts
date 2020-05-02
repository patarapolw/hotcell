import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { safeColumnName } from './util'

let db: Database | null = null

export async function getDb (filename?: string): Promise<Database> {
  if (!filename) {
    if (!db) {
      throw new Error('Please open a database first.')
    }

    return db
  }

  if (db) {
    if (db.config.filename !== filename) {
      await db.close()
      db = await open({
        filename,
        driver: sqlite3.Database
      })
    }
  } else {
    db = await open({
      filename,
      driver: sqlite3.Database
    })
  }

  return db
}

export async function closeDb (): Promise<void> {
  if (db) {
    await db.close()
  }

  db = null
}

export async function getDbMeta () {
  const db = await getDb()

  const tables: string[] = (await db.all(/*sql*/`
  SELECT [name] FROM sqlite_master
  WHERE [type] = 'table' AND [name] NOT LIKE 'sqlite_%'
  `)).map(it => it.name)

  let meta: any = {}

  if (tables.includes('__user')) {
    const { m } = await db.get(/*sql*/`
      SELECT meta AS m FROM __user
      `) || {}
    meta = JSON.parse(m)
  }

  return {
    tables,
    meta
  }
}

export async function getTableMeta (name: string) {
  const db = await getDb()

  const column: {
    cid: number
    name: string
    type: string
    notnull: number
    dflt_value: any
    pk: number
  }[] = await db.all(/*sql*/`
  PRAGMA table_info(${safeColumnName(name)})
  `)

  const index: {
    name: string
    unique: number
    info: {
      name: string
    }[]
  }[] = await db.all(/*sql*/`
  PRAGMA index_list(${safeColumnName(name)})
  `)

  await Promise.all(index.map(async (idx) => {
    idx.info = await db.all(/*sql*/`
    PRAGMA index_info(${idx.name})
    `)
  }))

  return {
    column,
    index
  }
}
